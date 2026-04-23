import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUZZLES_PATH = path.join(ROOT, 'public', 'puzzles.json');
const POSTERS_DIR = path.join(ROOT, 'public', 'posters');

// Load .env if it exists (local dev). On Netlify, env vars come from the dashboard.
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value; // don't override existing env vars
  }
}

loadEnv();

const BEARER_TOKEN = process.env.TMDB_READ_ACCESS_TOKEN;
if (!BEARER_TOKEN) {
  console.warn('TMDB_READ_ACCESS_TOKEN not set — skipping poster fetch (existing posters will be used)');
  process.exit(0);
}

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const RATE_LIMIT_DELAY = 250; // ms between API calls

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function tmdbFetch(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${BEARER_TOKEN}`,
      'Content-Type': 'application/json;charset=utf-8',
    },
  });
  if (!res.ok) {
    throw new Error(`TMDB API error ${res.status} for ${url}`);
  }
  return res.json();
}

async function searchMovie(title, year) {
  const query = encodeURIComponent(title);
  let url = `${TMDB_BASE}/search/movie?query=${query}`;
  if (year) url += `&year=${year}`;
  const data = await tmdbFetch(url);
  return data.results || [];
}

// Title/year matcher shared with scripts/verify-puzzles.js. Tolerates subtitle
// additions, regional title swaps, and ±1 year of release-date drift.
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

function yearsMatch(puzzleYear, tmdbDate) {
  if (!puzzleYear || !tmdbDate) return false;
  const tmdbYear = parseInt(tmdbDate.slice(0, 4), 10);
  return Math.abs(tmdbYear - puzzleYear) <= 1;
}

function titlesMatch(puzzleTitle, tmdbTitle, tmdbOriginalTitle, yearMatch) {
  const a = normalizeTitle(puzzleTitle);
  const candidates = [normalizeTitle(tmdbTitle), normalizeTitle(tmdbOriginalTitle)]
    .filter(Boolean);
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

async function resolveMovieId(title, year) {
  // First try with year — search any matching candidate (not just position 0,
  // which can be a different film with a similar title).
  let results = await searchMovie(title, year);
  await sleep(RATE_LIMIT_DELAY);

  let match = results.find(r => isCorrectMatch(title, year, r));
  if (match) return match.id;

  // Fallback: try without year
  console.log(`  [retry] No year-matched result for "${title}" (${year}), retrying without year...`);
  results = await searchMovie(title, null);
  await sleep(RATE_LIMIT_DELAY);

  match = results.find(r => isCorrectMatch(title, year, r));
  if (match) return match.id;

  return null;
}

// Verify an existing tmdb_id actually points to the named movie. Returns true
// if it does, false if the id is wrong/stale and should be re-resolved.
// Falls back to /alternative_titles when the primary title doesn't match but
// the year does (e.g. "The Road Warrior" → TMDB "Mad Max 2").
async function verifyTmdbId(tmdbId, title, year) {
  try {
    const data = await tmdbFetch(`${TMDB_BASE}/movie/${tmdbId}`);
    await sleep(RATE_LIMIT_DELAY);
    if (isCorrectMatch(title, year, data)) return true;

    if (yearsMatch(year, data.release_date)) {
      const alt = await tmdbFetch(`${TMDB_BASE}/movie/${tmdbId}/alternative_titles`);
      await sleep(RATE_LIMIT_DELAY);
      const a = normalizeTitle(title);
      for (const t of alt.titles || []) {
        if (titlesMatch(title, t.title, null, true) || normalizeTitle(t.title) === a) return true;
      }
    }
    return false;
  } catch (err) {
    console.log(`  [warn] Could not verify tmdb_id ${tmdbId} for "${title}": ${err.message}`);
    return false;
  }
}

async function downloadPoster(posterPath, destPath) {
  const url = `${TMDB_IMAGE_BASE}${posterPath}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download poster: ${res.status} ${url}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

async function generatePixelated(sourcePath, destPath) {
  // Shelf version: 6x9 mosaic — very chunky, hard to identify
  await sharp(sourcePath)
    .resize(6, 9, { kernel: sharp.kernel.nearest })
    .resize(320, 480, { kernel: sharp.kernel.nearest })
    .jpeg({ quality: 80 })
    .toFile(destPath);
}

async function generatePixelatedDetail(sourcePath, destPath) {
  // Detail/lightbox version: actual 81x122 pixels — no pre-upscale.
  // Browser's image-rendering: pixelated does the upscaling with crisp blocks.
  await sharp(sourcePath)
    .resize(81, 122, { kernel: sharp.kernel.nearest })
    .png()
    .toFile(destPath);
}

async function getMovieDetails(tmdbId) {
  const url = `${TMDB_BASE}/movie/${tmdbId}?append_to_response=credits`;
  const data = await tmdbFetch(url);
  await sleep(RATE_LIMIT_DELAY);

  const posterPath = data.poster_path || null;
  const summary = data.overview || null;
  const genres = (data.genres || []).map(g => g.name);
  const director =
    (data.credits?.crew || []).find(c => c.job === 'Director')?.name || null;
  const stars = (data.credits?.cast || [])
    .sort((a, b) => a.order - b.order)
    .slice(0, 3)
    .map(c => c.name);

  return { posterPath, summary, genres, director, stars };
}

async function processMovie(movie) {
  const { title, year } = movie;
  let { tmdb_id } = movie;

  // Fast path: if tmdb_id is set and we already have everything on disk, skip.
  // Use scripts/verify-puzzles.js to audit existing entries; we don't re-verify
  // every run for performance reasons.
  const metadataExists =
    Array.isArray(movie.genres) &&
    movie.genres.length > 0 &&
    movie.director != null &&
    Array.isArray(movie.stars) &&
    movie.stars.length > 0 &&
    movie.summary != null;
  const postersExistFor = id =>
    id != null &&
    fs.existsSync(path.join(POSTERS_DIR, `${id}.jpg`)) &&
    fs.existsSync(path.join(POSTERS_DIR, `${id}_pixel.jpg`));

  if (tmdb_id && postersExistFor(tmdb_id) && metadataExists) {
    console.log(`  [skip] Poster + metadata already exist for "${title}" (${tmdb_id})`);
    return { ...movie, tmdb_id };
  }

  // We're going to fetch. First, make sure tmdb_id is correct — never trust a
  // stale/hallucinated ID. Verification is cheap (one API call) compared to
  // shipping wrong posters.
  if (tmdb_id) {
    const ok = await verifyTmdbId(tmdb_id, title, year);
    if (!ok) {
      console.log(`  [fix] tmdb_id ${tmdb_id} does not match "${title}" (${year}) — re-resolving`);
      tmdb_id = null;
      // Drop stale metadata so the freshly-fetched fields below get written.
      movie = { ...movie, tmdb_id: null, summary: null, director: null, stars: null, genres: null };
    }
  }

  if (!tmdb_id) {
    console.log(`Searching TMDB for: "${title}" (${year})`);
    tmdb_id = await resolveMovieId(title, year);
    if (!tmdb_id) {
      console.log(`  [skip] Could not find TMDB ID for "${title}"`);
      return { ...movie, tmdb_id: null };
    }
    console.log(`  Found tmdb_id: ${tmdb_id}`);
  } else {
    console.log(`Using existing tmdb_id ${tmdb_id} for "${title}"`);
  }

  const posterFile = path.join(POSTERS_DIR, `${tmdb_id}.jpg`);
  const pixelFile = path.join(POSTERS_DIR, `${tmdb_id}_pixel.jpg`);
  const postersExist = postersExistFor(tmdb_id);

  // Fetch movie details (poster path + summary/genres/director/stars in one call)
  let posterPath, summary, genres, director, stars;
  try {
    ({ posterPath, summary, genres, director, stars } = await getMovieDetails(tmdb_id));
  } catch (err) {
    console.log(`  [error] Failed to get movie details for "${title}": ${err.message}`);
    return { ...movie, tmdb_id };
  }

  if (!postersExist) {
    if (!posterPath) {
      console.log(`  [skip] No poster available for "${title}" (${tmdb_id})`);
      return { ...movie, tmdb_id, summary, genres, director, stars };
    }

    // Download poster
    try {
      console.log(`  Downloading poster for "${title}"...`);
      await downloadPoster(posterPath, posterFile);
    } catch (err) {
      console.log(`  [error] Failed to download poster for "${title}": ${err.message}`);
      return { ...movie, tmdb_id, summary, genres, director, stars };
    }

    // Generate pixelated versions (shelf + detail)
    const pixelDetailFile = path.join(POSTERS_DIR, `${tmdb_id}_pixel_detail.png`);
    try {
      console.log(`  Generating pixelated versions for "${title}"...`);
      await generatePixelated(posterFile, pixelFile);
      await generatePixelatedDetail(posterFile, pixelDetailFile);
    } catch (err) {
      console.log(`  [error] Failed to generate pixelated poster for "${title}": ${err.message}`);
      return { ...movie, tmdb_id, summary, genres, director, stars };
    }

    console.log(`  Done: ${tmdb_id}.jpg + pixel + pixel_detail`);
  } else {
    console.log(`  [skip] Poster already exists for "${title}", fetched metadata only`);
  }

  return { ...movie, tmdb_id, summary, genres, director, stars };
}

async function main() {
  // Ensure posters directory exists
  fs.mkdirSync(POSTERS_DIR, { recursive: true });

  // Read puzzles.json
  const puzzlesData = JSON.parse(fs.readFileSync(PUZZLES_PATH, 'utf8'));

  let totalMovies = 0;
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const puzzle of puzzlesData.puzzles) {
    console.log(`\n=== Puzzle: ${puzzle.title} (${puzzle.id}) ===`);
    for (const category of puzzle.categories) {
      console.log(`\n-- Category: ${category.name} --`);
      const updatedMovies = [];
      for (const movie of category.movies) {
        totalMovies++;
        const alreadyExists =
          movie.tmdb_id &&
          fs.existsSync(path.join(POSTERS_DIR, `${movie.tmdb_id}.jpg`)) &&
          fs.existsSync(path.join(POSTERS_DIR, `${movie.tmdb_id}_pixel.jpg`)) &&
          Array.isArray(movie.genres) && movie.genres.length > 0 &&
          movie.director != null &&
          Array.isArray(movie.stars) && movie.stars.length > 0 &&
          movie.summary != null;

        const updated = await processMovie(movie);
        updatedMovies.push(updated);

        if (!updated.tmdb_id) {
          failCount++;
        } else if (alreadyExists) {
          skipCount++;
        } else {
          successCount++;
        }
      }
      category.movies = updatedMovies;
    }
  }

  // Write updated puzzles.json
  fs.writeFileSync(PUZZLES_PATH, JSON.stringify(puzzlesData, null, 2));
  console.log(`\n\nUpdated puzzles.json with resolved tmdb_ids.`);
  console.log(`\nSummary:`);
  console.log(`  Total movies: ${totalMovies}`);
  console.log(`  Downloaded:   ${successCount}`);
  console.log(`  Skipped:      ${skipCount}`);
  console.log(`  Failed:       ${failCount}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
