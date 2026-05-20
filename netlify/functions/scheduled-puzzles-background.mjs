// Daily scheduled background function that keeps a rolling buffer of upcoming
// dated puzzles in public/puzzles.json. Runs entirely on Netlify so it uses
// the AI Gateway via `new Anthropic()` — no extra config needed.
//
// Pipeline per run:
//   1. Fetch the latest puzzles.json + sha from the GitHub Contents API.
//   2. Backfill any pre-existing entries that are missing tmdb_id / poster /
//      summary / genres / director / stars (catches puzzles that were
//      hand-committed without enrichment).
//   3. Compute how many days short of PUZZLE_BUFFER_DAYS we are.
//   4. For each missing day: ask Claude to design a puzzle, then enrich each
//      movie via TMDB. Enrichment is strict — the puzzle is rejected unless
//      every movie resolves to a tmdb_id whose title+year matches and that
//      has a poster_path. Better to retry than to ship grey-box puzzles.
//   5. Commit the updated puzzles.json back to GitHub. The commit triggers
//      a normal Netlify rebuild, which runs scripts/fetch-posters.js to
//      download the actual poster files for any new tmdb_ids.
//
// Background functions can run up to 15 minutes — plenty of time for serial
// Anthropic + TMDB calls. Manual top-ups can still be done via the CLI
// (`npm run generate-puzzles`) or the existing admin dashboard.

import Anthropic from '@anthropic-ai/sdk';

const REPO = 'superfunteam/new-arrivals';
const FILE_PATH = 'public/puzzles.json';
const INTERRUPTS_PATH = 'public/interrupts.json';
const GITHUB_API = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
const GITHUB_INTERRUPTS_API = `https://api.github.com/repos/${REPO}/contents/${INTERRUPTS_PATH}`;
const TMDB_BASE = 'https://api.themoviedb.org/3';

const COLOR_BY_DIFFICULTY = {
  1: '#4CAF50',
  2: '#FFC107',
  3: '#2196F3',
  4: '#9C27B0',
};

// Index 0 = Monday (we shift Sunday=0 → 6 in dayOfWeekIndex below).
const WEEKLY_THEMES = [
  'Monday Mayhem — pulse-pounding action and adventure',
  'Two-for-Tuesday — pairings, double features, sequels and twins',
  'Wacky Wednesday — left-of-center comedies, oddities, mysteries',
  'Throwback Thursday — decade-defining hits and nostalgic deep cuts',
  'Friday Frights — horror, suspense, and creature features',
  'Saturday Matinee — family, animation, fantasy, all-ages crowd-pleasers',
  'Sunday Slow Burn — drama, character studies, awards-bait classics',
];

const SYSTEM_PROMPT = `You are a puzzle designer for "New Arrivals," a daily VHS rental store trivia game.

GAME CONCEPT: Players sort 16 VHS tapes into 4 hidden genre categories on a 3D shelf. Think NYT Connections meets 1980s Blockbuster Video.

DIFFICULTY TIERS (required, exactly one of each):
- Category 1 (Easy): Instantly recognizable grouping. Actor filmography, franchise, studio, obvious genre.
- Category 2 (Medium): Requires some film knowledge. Theme, subgenre, source material, era.
- Category 3 (Hard): Non-obvious trait. Behind-the-scenes fact, setting constraint, production detail.
- Category 4 (Devious): Deep trivia. Cameos, bans, actor trivia, obscure production facts.

RULES:
- Exactly 4 categories, exactly 4 movies per category (16 total)
- Movies primarily from 1970-1999 (video store golden age). Occasional outliers OK.
- Use the EXACT title as it appears on TMDB and the correct release year
- At least 2-3 movies must plausibly fit multiple categories (overlap traps)
- Pick a fun, evocative puzzle title

OUTPUT: Valid JSON only, no commentary, no markdown fences.
{
  "title": "Puzzle Title",
  "categories": [
    {
      "name": "Category Name",
      "difficulty": 1,
      "color": "#4CAF50",
      "movies": [
        { "title": "Movie Title", "year": 1985 }
      ]
    }
  ]
}

Difficulty colors are fixed: 1="#4CAF50", 2="#FFC107", 3="#2196F3", 4="#9C27B0"`;

// ── date utilities ──

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const da = new Date(a + 'T00:00:00Z');
  const db = new Date(b + 'T00:00:00Z');
  return Math.round((db - da) / 86400000);
}

function dayOfWeekIndex(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z').getUTCDay();
  return (d + 6) % 7;
}

// ── puzzle helpers ──

function findLatestDated(puzzles) {
  const dated = puzzles
    .map((p) => p.id)
    .filter((id) => /^\d{4}-\d{2}-\d{2}$/.test(id))
    .sort();
  return dated[dated.length - 1] || null;
}

function collectRecentTitles(puzzles, limit = 60) {
  const out = [];
  const dated = [...puzzles]
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.id))
    .sort((a, b) => (a.id < b.id ? 1 : -1))
    .slice(0, 8);
  for (const p of dated) {
    for (const c of p.categories || []) {
      for (const m of c.movies || []) {
        if (m.title) out.push(`${m.title} (${m.year || '?'})`);
      }
    }
  }
  return Array.from(new Set(out)).slice(0, limit);
}

function parseJsonLoose(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let candidate = (fenced ? fenced[1] : text).trim();
  if (!candidate.startsWith('{')) {
    const first = candidate.indexOf('{');
    const last = candidate.lastIndexOf('}');
    if (first !== -1 && last > first) candidate = candidate.slice(first, last + 1);
  }
  return JSON.parse(candidate);
}

function validatePuzzle(p) {
  if (!p || typeof p !== 'object') throw new Error('puzzle is not an object');
  if (!p.title || typeof p.title !== 'string') throw new Error('missing puzzle title');
  if (!Array.isArray(p.categories) || p.categories.length !== 4) {
    throw new Error(`expected 4 categories, got ${p.categories?.length ?? 0}`);
  }
  const seen = new Set();
  for (const c of p.categories) {
    if (!c.name) throw new Error('category missing name');
    if (![1, 2, 3, 4].includes(c.difficulty)) throw new Error(`bad difficulty: ${c.difficulty}`);
    if (seen.has(c.difficulty)) throw new Error(`duplicate difficulty: ${c.difficulty}`);
    seen.add(c.difficulty);
    c.color = COLOR_BY_DIFFICULTY[c.difficulty];
    if (!Array.isArray(c.movies) || c.movies.length !== 4) {
      throw new Error(`category "${c.name}" needs 4 movies, got ${c.movies?.length ?? 0}`);
    }
    for (const m of c.movies) {
      if (!m.title || typeof m.title !== 'string') throw new Error(`movie missing title in "${c.name}"`);
      if (!Number.isInteger(m.year)) throw new Error(`movie "${m.title}" has bad year`);
    }
  }

  // Reject the same movie appearing in two categories. The shelf renders 16
  // distinct tapes; duplicates break drag-and-drop and the category-discovery
  // mechanic. Compared by normalized title+year because tmdb_id isn't resolved
  // until later in the pipeline.
  const titlesSeen = new Map();
  for (const c of p.categories) {
    for (const m of c.movies) {
      const key = `${m.title.trim().toLowerCase()}|${m.year}`;
      const prev = titlesSeen.get(key);
      if (prev && prev !== c.name) {
        throw new Error(`duplicate movie: "${m.title}" (${m.year}) in "${prev}" and "${c.name}"`);
      }
      titlesSeen.set(key, c.name);
    }
  }

  p.categories.sort((a, b) => a.difficulty - b.difficulty);
}

// ── title/year matching ──
//
// Mirror of scripts/fetch-posters.js so the scheduled function and the build
// step agree on what counts as a match. Tolerates subtitle additions, regional
// title swaps, and ±1 year of release-date drift. Number words map to digits
// so "Twelve Monkeys" matches "12 Monkeys", and superscript digits fold so
// "Alien³" matches "Alien 3".

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
const DIGIT_FOLD = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
};
const SUPERSCRIPT_RE = /[²³¹⁰⁴-⁹₀-₉]/g;

function normalizeTitle(t) {
  if (!t) return '';
  return t
    .toLowerCase()
    .replace(SUPERSCRIPT_RE, (c) => DIGIT_FOLD[c] || c)
    .replace(/^(the |a |an )/, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((tok) => TOKEN_ALIASES[tok] || tok)
    .filter(Boolean)
    .join(' ')
    .trim();
}

function yearsMatch(puzzleYear, tmdbDate) {
  if (!puzzleYear || !tmdbDate) return false;
  const tmdbYear = parseInt(tmdbDate.slice(0, 4), 10);
  return Math.abs(tmdbYear - puzzleYear) <= 1;
}

function titlesMatch(puzzleTitle, tmdbTitle, tmdbOriginalTitle, yearMatch) {
  const a = normalizeTitle(puzzleTitle);
  const candidates = [normalizeTitle(tmdbTitle), normalizeTitle(tmdbOriginalTitle)].filter(Boolean);
  if (candidates.includes(a)) return true;
  if (!yearMatch) return false;
  for (const c of candidates) {
    if (!c) continue;
    if (c.includes(a) || a.includes(c)) return true;
    const aHead = a.split(' ').slice(0, 3).join(' ');
    const cHead = c.split(' ').slice(0, 3).join(' ');
    if (aHead && aHead === cHead) return true;
  }
  return false;
}

function isCorrectMatch(puzzleTitle, puzzleYear, tmdbResult) {
  const yMatch = yearsMatch(puzzleYear, tmdbResult.release_date);
  const tMatch = titlesMatch(puzzleTitle, tmdbResult.title, tmdbResult.original_title, yMatch);
  return tMatch && yMatch;
}

// ── GitHub helpers (mirror of admin-puzzles.mjs) ──

function ghHeaders() {
  return {
    Authorization: `Bearer ${Netlify.env.get('GITHUB_TOKEN')}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'new-arrivals-puzzle-bot',
  };
}

async function loadFromGitHub() {
  const res = await fetch(GITHUB_API, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const parsed = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  return { puzzles: parsed.puzzles, sha: data.sha };
}

async function loadInterruptsFromGitHub() {
  const res = await fetch(GITHUB_INTERRUPTS_API, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub GET (interrupts) failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const parsed = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  return { interrupts: parsed, sha: data.sha };
}

async function commitToGitHub(puzzles, sha, message) {
  const content = Buffer.from(JSON.stringify({ puzzles }, null, 2)).toString('base64');
  const res = await fetch(GITHUB_API, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content, sha }),
  });
  if (!res.ok) throw new Error(`GitHub PUT failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function commitInterruptsToGitHub(interrupts, sha, message) {
  const content = Buffer.from(JSON.stringify(interrupts, null, 2)).toString('base64');
  const res = await fetch(GITHUB_INTERRUPTS_API, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content, sha }),
  });
  if (!res.ok) throw new Error(`GitHub PUT (interrupts) failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ── TMDB helpers ──

function tmdbHeaders() {
  // Accept either env name. TMDB_ACCESS_TOKEN is what the admin functions use;
  // TMDB_READ_ACCESS_TOKEN is what scripts/fetch-posters.js uses at build time.
  // Keeping both happy avoids a class of "works locally, silently no-ops on
  // Netlify" bugs.
  const token =
    Netlify.env.get('TMDB_ACCESS_TOKEN') ||
    Netlify.env.get('TMDB_READ_ACCESS_TOKEN');
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

async function tmdbFetch(url) {
  const res = await fetch(url, { headers: tmdbHeaders() });
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${url}`);
  return res.json();
}

async function tmdbSearch(title, year) {
  const params = new URLSearchParams({ query: title });
  if (year) params.set('year', String(year));
  try {
    const data = await tmdbFetch(`${TMDB_BASE}/search/movie?${params}`);
    return data.results || [];
  } catch {
    return [];
  }
}

async function tmdbDetails(id) {
  try {
    return await tmdbFetch(`${TMDB_BASE}/movie/${id}?append_to_response=credits`);
  } catch {
    return null;
  }
}

async function matchesAlternativeTitle(tmdbId, puzzleTitle, yMatch) {
  try {
    const alt = await tmdbFetch(`${TMDB_BASE}/movie/${tmdbId}/alternative_titles`);
    const a = normalizeTitle(puzzleTitle);
    for (const t of alt.titles || []) {
      if (titlesMatch(puzzleTitle, t.title, null, yMatch)) return true;
      if (normalizeTitle(t.title) === a) return true;
    }
  } catch {
    // best-effort
  }
  return false;
}

// Verify an existing tmdb_id actually points to the named movie. Cheap insurance
// against hallucinated IDs sitting in the file.
async function verifyTmdbId(tmdbId, title, year) {
  const data = await tmdbDetails(tmdbId);
  if (!data) return false;
  if (isCorrectMatch(title, year, data)) return true;
  if (yearsMatch(year, data.release_date)) {
    return matchesAlternativeTitle(tmdbId, title, true);
  }
  return false;
}

// Resolve title+year to a tmdb_id by searching with year first, then without.
// Picks the first result whose title AND year match — never falls back to
// `results[0]` blindly (the previous bug, which silently shipped wrong posters
// for puzzles where TMDB's year-with-no-match returned an unrelated film).
async function resolveTmdbId(title, year) {
  let results = await tmdbSearch(title, year);
  let match = results.find((r) => isCorrectMatch(title, year, r));
  if (match) return match.id;

  results = await tmdbSearch(title, null);
  match = results.find((r) => isCorrectMatch(title, year, r));
  if (match) return match.id;

  return null;
}

// Returns a fully-enriched movie or null if we couldn't find a verified match
// with a poster. The caller MUST treat null as a hard failure — never commit
// a puzzle with an unresolved movie.
async function enrichMovie(movie) {
  // Already fully enriched and tmdb_id is verified? Nothing to do.
  // We don't re-verify on every run for cost reasons; verify-puzzles.js
  // catches drift on demand.
  if (
    movie.tmdb_id &&
    movie.poster_path &&
    movie.summary &&
    Array.isArray(movie.genres) && movie.genres.length > 0 &&
    movie.director &&
    Array.isArray(movie.stars) && movie.stars.length > 0
  ) {
    return movie;
  }

  let tmdbId = movie.tmdb_id || null;

  if (tmdbId) {
    const ok = await verifyTmdbId(tmdbId, movie.title, movie.year);
    if (!ok) {
      console.log(`    [fix] tmdb_id ${tmdbId} does not match "${movie.title}" (${movie.year}) — re-resolving`);
      tmdbId = null;
    }
  }

  if (!tmdbId) {
    tmdbId = await resolveTmdbId(movie.title, movie.year);
  }
  if (!tmdbId) return null;

  const details = await tmdbDetails(tmdbId);
  if (!details) return null;
  if (!details.poster_path) {
    console.log(`    [skip] No poster_path on TMDB for "${movie.title}" (${tmdbId})`);
    return null;
  }

  const director = details.credits?.crew?.find((c) => c.job === 'Director')?.name || null;
  const stars = (details.credits?.cast || [])
    .sort((a, b) => a.order - b.order)
    .slice(0, 3)
    .map((c) => c.name);

  return {
    ...movie,
    tmdb_id: details.id,
    poster_path: details.poster_path,
    summary: details.overview || null,
    genres: (details.genres || []).map((g) => g.name),
    director,
    stars,
  };
}

// Enrich a freshly-generated puzzle. Throws if any movie can't be resolved
// to a verified tmdb_id with a poster. The handler retries on throw.
async function enrichPuzzleStrict(puzzle) {
  for (const cat of puzzle.categories) {
    const enriched = await Promise.all(cat.movies.map(enrichMovie));
    for (let i = 0; i < enriched.length; i++) {
      if (!enriched[i]) {
        const m = cat.movies[i];
        throw new Error(
          `could not resolve "${m.title}" (${m.year}) to a TMDB id with a poster`
        );
      }
    }
    cat.movies = enriched;
  }
  return puzzle;
}

// Best-effort backfill for entries already in the file that are missing
// fields. Unlike enrichPuzzleStrict, this never throws — we want today's
// run to make progress even if a single legacy entry is unresolvable.
// Returns the count of entries that gained a tmdb_id.
async function backfillStaleEntries(puzzles) {
  let fixed = 0;
  let failed = 0;
  for (const p of puzzles) {
    for (const cat of p.categories || []) {
      for (let i = 0; i < (cat.movies || []).length; i++) {
        const m = cat.movies[i];
        const needsWork =
          !m.tmdb_id ||
          !m.poster_path ||
          !m.summary ||
          !Array.isArray(m.genres) || m.genres.length === 0 ||
          !m.director ||
          !Array.isArray(m.stars) || m.stars.length === 0;
        if (!needsWork) continue;
        const before = m.tmdb_id;
        const enriched = await enrichMovie(m);
        if (enriched) {
          cat.movies[i] = enriched;
          if (!before) fixed++;
        } else {
          failed++;
          console.log(`    [warn] backfill failed: ${p.id} / ${cat.name} / "${m.title}" (${m.year})`);
        }
      }
    }
  }
  if (fixed || failed) {
    console.log(`[scheduled-puzzles] backfill: ${fixed} entries gained a tmdb_id, ${failed} still unresolved`);
  }
  return fixed;
}

// ── AI generation ──

const CHARACTERS = [
  { character: 'Blonde Kid Girl',      sprite: 'blonde_kid_girl',      folder: 'Blonde Kid Girl',      type: 'kid' },
  { character: 'Blonde Man',           sprite: 'blonde_man',           folder: 'Blonde Man',           type: 'adult' },
  { character: 'Blonde Woman',         sprite: 'blonde_woman',         folder: 'Blonde Woman',         type: 'adult' },
  { character: 'Blue Haired Kid Girl', sprite: 'blue_haired_kid_girl', folder: 'Blue Haired Kid Girl', type: 'kid' },
  { character: 'Blue Haired Woman',    sprite: 'blue_haired_woman',    folder: 'Blue Haired Woman',    type: 'adult' },
  { character: 'Bride',                sprite: 'bride',                folder: 'Bride',                type: 'adult' },
  { character: 'Businessman',          sprite: 'businessman',          folder: 'Businessman',          type: 'adult' },
  { character: 'Chef',                 sprite: 'chef',                 folder: 'Chef',                 type: 'adult' },
  { character: 'Farmer',               sprite: 'farmer',               folder: 'Farmer',               type: 'adult' },
  { character: 'Firefighter',          sprite: 'firefighter',          folder: 'Firefighter',          type: 'adult' },
  { character: 'Goblin Kid',           sprite: 'goblin_kid',           folder: 'Goblin Kid',           type: 'kid' },
  { character: 'Joker',                sprite: 'joker',                folder: 'Joker',                type: 'adult' },
  { character: 'Knight',               sprite: 'knight',               folder: 'Knight',               type: 'adult' },
  { character: 'Knight Kid',           sprite: 'knight_kid',           folder: 'Knight Kid',           type: 'kid' },
  { character: 'Ninja',                sprite: 'ninja',                folder: 'Ninja',                type: 'adult' },
  { character: 'Old Man',              sprite: 'old_man',              folder: 'Old Man',              type: 'old' },
  { character: 'Old Woman',            sprite: 'old_woman',            folder: 'Old Woman',            type: 'old' },
  { character: 'Policeman',            sprite: 'policeman',            folder: 'Policeman',            type: 'adult' },
  { character: 'Punk Kid Boy',         sprite: 'punk_kid_boy',         folder: 'Punk Kid Boy',         type: 'kid' },
  // "Punk Man" folder uses the plural filename punk_men.png — see public/characters/.
  { character: 'Punk Man',             sprite: 'punk_men',             folder: 'Punk Man',             type: 'adult' },
  { character: 'Punk Woman',           sprite: 'punk_woman',           folder: 'Punk Woman',           type: 'adult' },
  { character: 'Viking Kid Boy',       sprite: 'viking_kid_boy',       folder: 'Viking Kid Boy',       type: 'kid' },
  { character: 'Viking Man',           sprite: 'viking_man',           folder: 'Viking Man',           type: 'adult' },
  { character: 'Viking Woman',         sprite: 'viking_woman',         folder: 'Viking Woman',         type: 'adult' },
];

const INTERRUPT_SYSTEM_PROMPT = `You are writing customer dialogue for "New Arrivals," a VHS rental store game. Customers interrupt the player while they sort tapes.

SETTING: A video rental store, Friday night, 1987. Customers are browsing, chatting, looking for movies.

Generate exactly 10 interruptions:
- 4 TRIVIA: Ask about a specific movie on the shelf. 4 multiple-choice answers (1 correct, 3 plausible wrong from the same era). Short question, 1-2 sentences.
- 3 HINTS: Character vaguely describes what they're looking for (obliquely referencing a category). Include the exact category name as hintCategory. Never say the category name in dialogue.
- 3 STORIES: Funny 80s rental store anecdote, joke, pun, or oversharing. Include a fun dismiss button label.

CHARACTER VOICE RULES:
- Kid characters: UNHINGED energy. Caps, "UHHH", "MY MOM SAID", sugar-high, Tindendo references
- Adults: Normal 80s rental customer. Friday nights, date nights, late fees, opinions
- Old characters: Slower, nostalgic, confused by technology, wholesome

Keep dialogue SHORT (1-3 sentences max). These are quick interruptions.

OUTPUT: Valid JSON array only, no commentary. Each object must include ALL required fields for its type.`;

async function generateInterrupts(client, puzzle) {
  const allMovies = puzzle.categories.flatMap((cat) =>
    (cat.movies || []).map((m) => `${m.title} (${m.year})`)
  );
  const categoryNames = puzzle.categories.map((cat) => cat.name);

  // Pick 10 distinct characters at random. 4 trivia + 3 hint + 3 story.
  const shuffled = [...CHARACTERS].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 10);
  const assignments = selected.map((char, i) => {
    if (i < 4) return { ...char, role: 'trivia' };
    if (i < 7) return { ...char, role: 'hint' };
    return { ...char, role: 'story' };
  });

  const characterDescriptions = assignments
    .map((a) => `- ${a.character} (${a.type}) → ${a.role.toUpperCase()}`)
    .join('\n');

  const prompt = `PUZZLE MOVIES (on the shelf):
${allMovies.map((m) => `- ${m}`).join('\n')}

PUZZLE CATEGORIES:
${categoryNames.map((n) => `- ${n}`).join('\n')}

CHARACTERS:
${characterDescriptions}

Generate 10 interruptions with these exact character/sprite/folder values.`;

  const message = await client.messages.create({
    model: Netlify.env.get('INTERRUPT_GEN_MODEL') || 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: INTERRUPT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content?.find((b) => b.type === 'text')?.text || message.content?.[0]?.text || '';
  if (!text) throw new Error('empty response from Claude (interrupts)');

  const parsed = parseJsonLoose(text.startsWith('[') ? `{"items":${text}}` : text);
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(items)) throw new Error('interrupts response did not parse to an array');

  // Force sprite/folder to authoritative values per character — the model
  // occasionally swaps them, and one bad sprite makes the customer render
  // as a missing image.
  const charMap = Object.fromEntries(assignments.map((a) => [a.character, a]));
  const validated = items.map((item) => {
    const charData = charMap[item.character];
    if (charData) {
      item.sprite = charData.sprite;
      item.folder = charData.folder;
    }
    return item;
  });

  // Final structural check — counts, required fields, hintCategory match.
  const triviaCount = validated.filter((i) => i.type === 'trivia').length;
  const hintCount = validated.filter((i) => i.type === 'hint').length;
  const storyCount = validated.filter((i) => i.type === 'story').length;
  if (validated.length !== 10 || triviaCount < 1 || hintCount < 1 || storyCount < 1) {
    throw new Error(
      `bad interrupt mix: total=${validated.length} trivia=${triviaCount} hint=${hintCount} story=${storyCount}`
    );
  }
  const catNameSet = new Set(categoryNames);
  for (const item of validated) {
    if (item.type === 'hint' && !catNameSet.has(item.hintCategory)) {
      throw new Error(`hint references unknown category: "${item.hintCategory}"`);
    }
  }
  return validated;
}

async function generatePuzzle(client, dateStr, recentTitles) {
  const themeIdx = dayOfWeekIndex(dateStr);
  const vibe = WEEKLY_THEMES[themeIdx];
  const banList = recentTitles.length
    ? `\n\nRecently used movies — try not to repeat these:\n- ${recentTitles.join('\n- ')}`
    : '';

  const userPrompt = `Design tomorrow's New Arrivals puzzle.

Date: ${dateStr}
Vibe to lean into: ${vibe}

Pick a fun, punchy puzzle title. Make sure the four categories span easy → devious as required.${banList}`;

  const message = await client.messages.create({
    model: Netlify.env.get('PUZZLE_GEN_MODEL') || 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = message.content?.find((b) => b.type === 'text')?.text || message.content?.[0]?.text || '';
  if (!text) throw new Error('empty response from Claude');

  const parsed = parseJsonLoose(text);
  validatePuzzle(parsed);
  return { id: dateStr, title: parsed.title, categories: parsed.categories };
}

// ── handler ──

export default async (req, context) => {
  const startedAt = Date.now();
  console.log(`[scheduled-puzzles] start (scheduled=${context?.scheduledTime || 'manual'})`);

  // Hard-fail on missing TMDB token. Without it every enrichment silently
  // returns null and we'd commit grey-box puzzles — which is exactly the
  // bug we're fixing.
  if (!Netlify.env.get('TMDB_ACCESS_TOKEN') && !Netlify.env.get('TMDB_READ_ACCESS_TOKEN')) {
    console.error('[scheduled-puzzles] no TMDB token configured');
    return new Response('TMDB token missing', { status: 500 });
  }

  const bufferDays = parseInt(Netlify.env.get('PUZZLE_BUFFER_DAYS') || '14', 10);

  let puzzles, sha, interrupts, interruptsSha;
  try {
    ({ puzzles, sha } = await loadFromGitHub());
  } catch (err) {
    console.error('[scheduled-puzzles] GitHub load failed:', err.message);
    return new Response(`load failed: ${err.message}`, { status: 500 });
  }
  try {
    ({ interrupts, sha: interruptsSha } = await loadInterruptsFromGitHub());
  } catch (err) {
    console.error('[scheduled-puzzles] interrupts load failed:', err.message);
    return new Response(`load failed: ${err.message}`, { status: 500 });
  }

  // Step 2: catch up any pre-existing entries that were committed unenriched
  // (e.g. hand-curated puzzles or earlier broken runs). Best-effort — we
  // continue even if some can't be resolved.
  let backfilled = 0;
  try {
    backfilled = await backfillStaleEntries(puzzles);
  } catch (err) {
    console.error('[scheduled-puzzles] backfill threw:', err.message);
  }

  // Step 2b: backfill interrupts for puzzles that don't have any. This catches
  // puzzles that were auto-published before interrupt generation existed in
  // this function, or any other path that bypassed admin-process.
  let interruptsBackfilled = 0;
  const interruptsBackfilledIds = [];
  for (const p of puzzles) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.id)) continue; // skip floating/training
    if (Array.isArray(interrupts[p.id]) && interrupts[p.id].length > 0) continue;
    try {
      const items = await generateInterrupts(new Anthropic(), p);
      interrupts[p.id] = items;
      interruptsBackfilled++;
      interruptsBackfilledIds.push(p.id);
      console.log(`  ✓ interrupts backfilled for ${p.id} — "${p.title}"`);
    } catch (err) {
      console.error(`  ✗ interrupts backfill failed for ${p.id}: ${err.message}`);
    }
  }

  const today = todayUTC();
  const latest = findLatestDated(puzzles);
  const startDate = latest && latest >= today ? addDays(latest, 1) : today;
  const daysAhead = latest && latest >= today ? daysBetween(today, latest) : 0;
  const need = Math.max(0, bufferDays - daysAhead);

  if (need === 0 && backfilled === 0 && interruptsBackfilled === 0) {
    console.log(`[scheduled-puzzles] buffer at ${daysAhead}/${bufferDays} and nothing to backfill — nothing to do`);
    return new Response('buffer full');
  }

  if (need > 0) {
    console.log(`[scheduled-puzzles] generating ${need} puzzle(s) starting ${startDate}`);
  }

  const client = new Anthropic();
  let cursor = startDate;
  let added = 0;
  const newlyAdded = [];

  for (let i = 0; i < need; i++) {
    const dateStr = cursor;
    let attempts = 0;
    let success = false;
    while (attempts < 3 && !success) {
      attempts++;
      try {
        const recent = collectRecentTitles(puzzles.concat(newlyAdded), 60);
        const puzzle = await generatePuzzle(client, dateStr, recent);
        // Strict enrichment: throws if any movie can't be verified with a
        // poster. The retry loop will then ask Claude for a different
        // puzzle, which avoids shipping wrong-poster days.
        await enrichPuzzleStrict(puzzle);
        // Generate interrupts as part of the same retry loop. If interrupts
        // fail we treat it as a puzzle-generation failure and retry the
        // whole thing — better than committing a puzzle with no chat data,
        // which is what was happening before.
        const items = await generateInterrupts(client, puzzle);
        interrupts[puzzle.id] = items;
        puzzles.push(puzzle);
        newlyAdded.push(puzzle);
        added++;
        success = true;
        console.log(`  ✓ ${dateStr} — "${puzzle.title}" (+${items.length} interrupts)`);
      } catch (err) {
        console.error(`  ✗ ${dateStr} attempt ${attempts}: ${err.message}`);
        if (attempts < 3) await new Promise((r) => setTimeout(r, 1000 * attempts));
      }
    }
    if (!success) {
      console.error(`[scheduled-puzzles] giving up on ${dateStr}`);
      break;
    }
    cursor = addDays(cursor, 1);
  }

  if (added === 0 && backfilled === 0 && interruptsBackfilled === 0) {
    console.error('[scheduled-puzzles] no puzzles generated and nothing backfilled — not committing');
    return new Response('no changes', { status: 500 });
  }

  let message;
  if (added > 0 && backfilled > 0) {
    message =
      added === 1
        ? `Auto-publish: queue ${newlyAdded[0].id} — ${newlyAdded[0].title} (+${backfilled} backfilled)`
        : `Auto-publish: queue ${added} new puzzle(s) (${newlyAdded[0].id} → ${newlyAdded[added - 1].id}) (+${backfilled} backfilled)`;
  } else if (added > 0) {
    message =
      added === 1
        ? `Auto-publish: queue ${newlyAdded[0].id} — ${newlyAdded[0].title}`
        : `Auto-publish: queue ${added} new puzzle(s) (${newlyAdded[0].id} → ${newlyAdded[added - 1].id})`;
  } else {
    message = `Auto-backfill: enrich ${backfilled} stale puzzle entr${backfilled === 1 ? 'y' : 'ies'}`;
  }

  // Commit interrupts FIRST. If something goes wrong, we'd rather leave the
  // file with orphan interrupts (harmless — verify-interrupts flags them but
  // they don't break the game) than commit a puzzle that has no chat data
  // (which is exactly today's bug).
  const interruptsDirty =
    added > 0 || interruptsBackfilled > 0;
  if (interruptsDirty) {
    try {
      const interruptsMessage = added > 0
        ? `Auto-publish: interrupts for ${newlyAdded.map((p) => p.id).join(', ')}${interruptsBackfilled ? ` (+${interruptsBackfilled} backfilled: ${interruptsBackfilledIds.join(', ')})` : ''}`
        : `Auto-backfill: ${interruptsBackfilled} missing interrupt set(s) — ${interruptsBackfilledIds.join(', ')}`;
      await commitInterruptsToGitHub(interrupts, interruptsSha, interruptsMessage);
      console.log(`[scheduled-puzzles] interrupts committed (${added} new + ${interruptsBackfilled} backfilled)`);
    } catch (err) {
      console.error('[scheduled-puzzles] interrupts commit failed:', err.message);
      return new Response(`interrupts commit failed: ${err.message}`, { status: 500 });
    }
  }

  // One retry on SHA conflict — re-fetch and re-apply if someone committed
  // mid-run. We always append, so re-applying is safe.
  let attempt = 0;
  while (attempt < 2) {
    attempt++;
    try {
      await commitToGitHub(puzzles, sha, message);
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`[scheduled-puzzles] committed ${added} new + ${backfilled} backfilled in ${elapsed}s`);
      return new Response(`added ${added} puzzle(s), backfilled ${backfilled}, interrupts backfilled ${interruptsBackfilled}`);
    } catch (err) {
      const isShaConflict = /409|sha|conflict/i.test(err.message);
      if (!isShaConflict || attempt >= 2) {
        console.error('[scheduled-puzzles] commit failed:', err.message);
        return new Response(`commit failed: ${err.message}`, { status: 500 });
      }
      console.warn('[scheduled-puzzles] sha conflict — re-fetching and reapplying');
      const reloaded = await loadFromGitHub();
      sha = reloaded.sha;
      // Re-apply both backfill and newly-added puzzles to the freshly-loaded
      // list. Backfill is idempotent (already-enriched entries are no-ops).
      puzzles = reloaded.puzzles;
      try {
        await backfillStaleEntries(puzzles);
      } catch (e) {
        console.error('[scheduled-puzzles] re-backfill threw:', e.message);
      }
      puzzles = puzzles.concat(newlyAdded);
    }
  }

  return new Response('commit failed', { status: 500 });
};

// 13:00 UTC daily — early morning Pacific, mid-morning Eastern.
// Background function (filename suffix `-background`) gets up to 15 min
// of runtime, plenty for serial Anthropic + TMDB calls.
export const config = {
  schedule: '0 13 * * *',
};
