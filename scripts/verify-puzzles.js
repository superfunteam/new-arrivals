// Verify that every movie's `tmdb_id` in puzzles.json actually points to the
// movie named in `title` + `year` on TMDB. Catches hallucinated/stale IDs.
//
// Usage:
//   node scripts/verify-puzzles.js                        # check all puzzles
//   node scripts/verify-puzzles.js 2026-04-22 2026-05-05  # check date range (inclusive)
//   node scripts/verify-puzzles.js --json                  # machine-readable output
//
// Exit code: 0 if all match, 1 if any mismatch (good for CI / pre-commit).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUZZLES_PATH = path.join(ROOT, 'public', 'puzzles.json');

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();

const BEARER_TOKEN = process.env.TMDB_READ_ACCESS_TOKEN;
if (!BEARER_TOKEN) {
  console.error('TMDB_READ_ACCESS_TOKEN not set — cannot verify');
  process.exit(2);
}

const TMDB_BASE = 'https://api.themoviedb.org/3';
const RATE_LIMIT_DELAY = 100;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function tmdbFetch(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${url}`);
  return res.json();
}

// Normalize titles for comparison: lowercase, strip leading articles,
// drop punctuation, collapse whitespace. TMDB titles sometimes differ in
// punctuation/articles from the puzzle title.
// Token aliases collapse common interchangeable words to a canonical form.
// Number words map to digits so "Twelve Monkeys" matches "12 Monkeys".
const TOKEN_ALIASES = {
  vol: 'volume', pt: 'part', vs: 'versus', '&': 'and',
  one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  eleven: '11', twelve: '12', thirteen: '13', fourteen: '14',
  fifteen: '15', sixteen: '16', seventeen: '17', eighteen: '18',
  nineteen: '19', twenty: '20', thirty: '30', forty: '40',
  fifty: '50', sixty: '60', seventy: '70', eighty: '80',
  ninety: '90', hundred: '100',
};

// Superscript/subscript digits → regular digits ("Alien³" → "Alien 3")
const DIGIT_FOLD = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
};

// ¹²³ live in Latin-1 Supplement (U+00B2/B3/B9), the rest in the
// Superscripts/Subscripts block — both ranges need folding.
const SUPERSCRIPT_RE = /[\u00B2\u00B3\u00B9\u2070\u2074-\u2079\u2080-\u2089]/g;

function normalizeTitle(t) {
  if (!t) return '';
  return t
    .toLowerCase()
    .replace(SUPERSCRIPT_RE, c => DIGIT_FOLD[c] || c)
    .replace(/^(the |a |an )/, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map(tok => TOKEN_ALIASES[tok] || tok)
    .filter(Boolean)
    .join(' ')
    .trim();
}

// Returns true when the puzzle title and a TMDB title clearly refer to the
// same film. Tolerates common variants:
//   - subtitle additions ("Infinity War" vs "Avengers: Infinity War")
//   - regional title swaps ("Sorcerer's Stone" vs "Philosopher's Stone")
//   - punctuation/abbreviation drift ("Vol." vs "Volume")
// Substring/token-prefix matches are only accepted when the year also matches,
// to avoid matching unrelated films that happen to share a word.
function titlesMatch(puzzleTitle, tmdbTitle, tmdbOriginalTitle, yearMatch) {
  const a = normalizeTitle(puzzleTitle);
  const candidates = [normalizeTitle(tmdbTitle), normalizeTitle(tmdbOriginalTitle)]
    .filter(Boolean);

  if (candidates.includes(a)) return true;
  if (!yearMatch) return false;

  for (const c of candidates) {
    if (!c) continue;
    if (c.includes(a) || a.includes(c)) return true;
    // First-3-words match catches "Sorcerer's Stone" vs "Philosopher's Stone",
    // "Kill Bill Volume 1" vs "Kill Bill Vol 1", etc.
    const aHead = a.split(' ').slice(0, 3).join(' ');
    const cHead = c.split(' ').slice(0, 3).join(' ');
    if (aHead && aHead === cHead) return true;
  }
  return false;
}

function yearsMatch(puzzleYear, tmdbDate) {
  if (!puzzleYear || !tmdbDate) return false;
  const tmdbYear = parseInt(tmdbDate.slice(0, 4), 10);
  return Math.abs(tmdbYear - puzzleYear) <= 1;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const dates = args.filter(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
  return {
    json,
    rangeStart: dates[0] || null,
    rangeEnd: dates[1] || dates[0] || null,
  };
}

function inRange(id, start, end) {
  if (!start) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) return false; // skip training-* etc.
  return id >= start && id <= end;
}

async function matchesAlternativeTitle(tmdbId, puzzleTitle, yearMatch) {
  try {
    const alt = await tmdbFetch(`${TMDB_BASE}/movie/${tmdbId}/alternative_titles`);
    await sleep(RATE_LIMIT_DELAY);
    const a = normalizeTitle(puzzleTitle);
    for (const t of alt.titles || []) {
      if (titlesMatch(puzzleTitle, t.title, null, yearMatch)) return true;
      if (normalizeTitle(t.title) === a) return true;
    }
  } catch {
    // ignore — alt title lookup is best-effort
  }
  return false;
}

async function verifyMovie(movie) {
  const { title, year, tmdb_id } = movie;
  if (!tmdb_id) return { status: 'missing-id', title, year, tmdb_id };

  let data;
  try {
    data = await tmdbFetch(`${TMDB_BASE}/movie/${tmdb_id}`);
  } catch (err) {
    return { status: 'fetch-error', title, year, tmdb_id, error: err.message };
  }

  const yMatch = yearsMatch(year, data.release_date);
  let tMatch = titlesMatch(title, data.title, data.original_title, yMatch);

  // Fallback: if primary title doesn't match but year does, the film may be
  // released under an alternate title in the puzzle's region (e.g. "The Road
  // Warrior" = TMDB "Mad Max 2"). Consult alternative_titles before declaring
  // the id wrong.
  if (!tMatch && yMatch) {
    tMatch = await matchesAlternativeTitle(tmdb_id, title, yMatch);
  }

  if (tMatch && yMatch) return { status: 'ok', title, year, tmdb_id };

  return {
    status: 'mismatch',
    title,
    year,
    tmdb_id,
    tmdb_title: data.title,
    tmdb_original_title: data.original_title,
    tmdb_year: data.release_date ? parseInt(data.release_date.slice(0, 4), 10) : null,
    titleMatch: tMatch,
    yearMatch: yMatch,
  };
}

async function main() {
  const { json, rangeStart, rangeEnd } = parseArgs();
  const data = JSON.parse(fs.readFileSync(PUZZLES_PATH, 'utf8'));

  const results = [];
  let total = 0;

  for (const puzzle of data.puzzles) {
    if (!inRange(puzzle.id, rangeStart, rangeEnd)) continue;
    if (!json) console.log(`\n=== ${puzzle.id} — ${puzzle.title} ===`);
    for (const cat of puzzle.categories) {
      for (const movie of cat.movies) {
        total++;
        const result = await verifyMovie(movie);
        result.puzzleId = puzzle.id;
        result.category = cat.name;
        results.push(result);
        if (!json) {
          if (result.status === 'ok') {
            console.log(`  OK   ${movie.title} (${movie.year}) [${movie.tmdb_id}]`);
          } else if (result.status === 'mismatch') {
            console.log(
              `  BAD  ${movie.title} (${movie.year}) [${movie.tmdb_id}] -> "${result.tmdb_title}" (${result.tmdb_year})`
            );
          } else {
            console.log(`  ${result.status.toUpperCase()}  ${movie.title} (${movie.year}) [${movie.tmdb_id}]`);
          }
        }
        await sleep(RATE_LIMIT_DELAY);
      }
    }
  }

  const bad = results.filter(r => r.status !== 'ok');
  if (json) {
    console.log(JSON.stringify({ total, bad }, null, 2));
  } else {
    console.log(`\n\nTotal checked: ${total}`);
    console.log(`OK:            ${results.filter(r => r.status === 'ok').length}`);
    console.log(`Mismatches:    ${results.filter(r => r.status === 'mismatch').length}`);
    console.log(`Missing IDs:   ${results.filter(r => r.status === 'missing-id').length}`);
    console.log(`Fetch errors:  ${results.filter(r => r.status === 'fetch-error').length}`);
  }

  process.exit(bad.length === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
