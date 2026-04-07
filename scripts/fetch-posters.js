import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUZZLES_PATH = path.join(ROOT, 'public', 'puzzles.json');
const POSTERS_DIR = path.join(ROOT, 'public', 'posters');

// Load .env manually (no dotenv dependency)
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found at ' + envPath);
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    process.env[key] = value;
  }
}

loadEnv();

const BEARER_TOKEN = process.env.TMDB_READ_ACCESS_TOKEN;
if (!BEARER_TOKEN) {
  throw new Error('TMDB_READ_ACCESS_TOKEN not found in .env');
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

async function resolveMovieId(title, year) {
  // First try with year
  let results = await searchMovie(title, year);
  await sleep(RATE_LIMIT_DELAY);

  if (results.length > 0) {
    return results[0].id;
  }

  // Fallback: try without year
  console.log(`  [retry] No results for "${title}" (${year}), retrying without year...`);
  results = await searchMovie(title, null);
  await sleep(RATE_LIMIT_DELAY);

  if (results.length > 0) {
    return results[0].id;
  }

  return null;
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
  await sharp(sourcePath)
    .resize(24, 36, { kernel: sharp.kernel.nearest })
    .resize(320, 480, { kernel: sharp.kernel.nearest })
    .jpeg({ quality: 80 })
    .toFile(destPath);
}

async function getPosterPath(tmdbId) {
  const url = `${TMDB_BASE}/movie/${tmdbId}`;
  const data = await tmdbFetch(url);
  await sleep(RATE_LIMIT_DELAY);
  return data.poster_path || null;
}

async function processMovie(movie) {
  const { title, year } = movie;
  let { tmdb_id } = movie;

  // Resolve tmdb_id if null
  if (!tmdb_id) {
    console.log(`Searching TMDB for: "${title}" (${year})`);
    tmdb_id = await resolveMovieId(title, year);
    if (!tmdb_id) {
      console.log(`  [skip] Could not find TMDB ID for "${title}"`);
      return { ...movie };
    }
    console.log(`  Found tmdb_id: ${tmdb_id}`);
  } else {
    console.log(`Using existing tmdb_id ${tmdb_id} for "${title}"`);
  }

  const posterFile = path.join(POSTERS_DIR, `${tmdb_id}.jpg`);
  const pixelFile = path.join(POSTERS_DIR, `${tmdb_id}_pixel.jpg`);

  // Check if already downloaded
  if (fs.existsSync(posterFile) && fs.existsSync(pixelFile)) {
    console.log(`  [skip] Poster already exists for "${title}" (${tmdb_id})`);
    return { ...movie, tmdb_id };
  }

  // Get poster path from TMDB
  let posterPath;
  try {
    posterPath = await getPosterPath(tmdb_id);
  } catch (err) {
    console.log(`  [error] Failed to get movie details for "${title}": ${err.message}`);
    return { ...movie, tmdb_id };
  }

  if (!posterPath) {
    console.log(`  [skip] No poster available for "${title}" (${tmdb_id})`);
    return { ...movie, tmdb_id };
  }

  // Download poster
  try {
    console.log(`  Downloading poster for "${title}"...`);
    await downloadPoster(posterPath, posterFile);
  } catch (err) {
    console.log(`  [error] Failed to download poster for "${title}": ${err.message}`);
    return { ...movie, tmdb_id };
  }

  // Generate pixelated version
  try {
    console.log(`  Generating pixelated version for "${title}"...`);
    await generatePixelated(posterFile, pixelFile);
  } catch (err) {
    console.log(`  [error] Failed to generate pixelated poster for "${title}": ${err.message}`);
    // Still return with tmdb_id even if pixelation failed
    return { ...movie, tmdb_id };
  }

  console.log(`  Done: ${tmdb_id}.jpg + ${tmdb_id}_pixel.jpg`);
  return { ...movie, tmdb_id };
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
        const wasNull = movie.tmdb_id === null;
        const alreadyExists =
          movie.tmdb_id &&
          fs.existsSync(path.join(POSTERS_DIR, `${movie.tmdb_id}.jpg`)) &&
          fs.existsSync(path.join(POSTERS_DIR, `${movie.tmdb_id}_pixel.jpg`));

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
