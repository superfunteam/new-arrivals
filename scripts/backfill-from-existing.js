// One-shot backfill: when a puzzle entry only has title+year (no tmdb_id),
// reuse the tmdb_id + summary/genres/director/stars from another already-
// enriched entry in the same file that matches title+year. Catches the case
// where a puzzle was committed un-enriched and TMDB enrichment never ran on
// Netlify (e.g. missing token, build skipped).
//
// Movies that can't be matched locally are left untouched so the scheduled
// function (or scripts/fetch-posters.js) can resolve them via TMDB later.
//
// Usage:
//   node scripts/backfill-from-existing.js                # mutate in place
//   node scripts/backfill-from-existing.js --dry-run      # report only
//
// Exit code: 0 always (best-effort), prints a summary.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUZZLES_PATH = path.join(ROOT, 'public', 'puzzles.json');
const POSTERS_DIR = path.join(ROOT, 'public', 'posters');

const TOKEN_ALIASES = {
  vol: 'volume', pt: 'part', vs: 'versus', '&': 'and',
  one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
};
const SUPERSCRIPT_RE = /[²³¹⁰⁴-⁹₀-₉]/g;
const DIGIT_FOLD = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
};

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

function isEnriched(m) {
  return Boolean(
    m.tmdb_id &&
    m.summary &&
    Array.isArray(m.genres) && m.genres.length > 0 &&
    m.director &&
    Array.isArray(m.stars) && m.stars.length > 0
  );
}

function postersExistFor(id) {
  if (!id) return false;
  return (
    fs.existsSync(path.join(POSTERS_DIR, `${id}.jpg`)) &&
    fs.existsSync(path.join(POSTERS_DIR, `${id}_pixel.jpg`))
  );
}

const dryRun = process.argv.includes('--dry-run');

const data = JSON.parse(fs.readFileSync(PUZZLES_PATH, 'utf8'));

// Build lookup: (normalized_title, year) -> enriched movie record.
// Prefer entries whose poster files are already on disk (confidence boost),
// but fall back to any in-file enrichment so newly-scheduled puzzles can
// share IDs even before the next build downloads their posters.
const lookup = new Map();
const lookupNoPoster = new Map();
for (const p of data.puzzles) {
  for (const c of p.categories) {
    for (const m of c.movies) {
      if (!isEnriched(m)) continue;
      const key = `${normalizeTitle(m.title)}|${m.year}`;
      if (postersExistFor(m.tmdb_id)) {
        if (!lookup.has(key)) lookup.set(key, m);
      } else if (!lookupNoPoster.has(key)) {
        lookupNoPoster.set(key, m);
      }
    }
  }
}

let scanned = 0;
let filled = 0;
let stillMissing = 0;
const fixed = [];

for (const p of data.puzzles) {
  for (const c of p.categories) {
    for (let i = 0; i < c.movies.length; i++) {
      const m = c.movies[i];
      if (m.tmdb_id) continue;
      scanned++;
      const key = `${normalizeTitle(m.title)}|${m.year}`;
      const hit = lookup.get(key) || lookupNoPoster.get(key);
      if (!hit) {
        stillMissing++;
        continue;
      }
      const merged = {
        ...m,
        tmdb_id: hit.tmdb_id,
        summary: hit.summary,
        genres: hit.genres,
        director: hit.director,
        stars: hit.stars,
      };
      c.movies[i] = merged;
      filled++;
      fixed.push(`${p.id} / ${c.name} / ${m.title} (${m.year}) -> ${hit.tmdb_id}`);
    }
  }
}

console.log(`Scanned ${scanned} unenriched movie entries.`);
console.log(`Filled ${filled} from existing enriched entries.`);
console.log(`Still missing ${stillMissing} (will need TMDB lookup).`);
if (fixed.length) {
  console.log('\nFilled:');
  for (const line of fixed) console.log(`  ${line}`);
}

if (!dryRun && filled > 0) {
  fs.writeFileSync(PUZZLES_PATH, JSON.stringify(data, null, 2));
  console.log(`\nWrote ${PUZZLES_PATH}`);
} else if (dryRun) {
  console.log('\n(dry-run — no file written)');
}
