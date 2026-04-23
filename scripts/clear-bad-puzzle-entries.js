// Reads a JSON report from verify-puzzles.js and clears the TMDB-derived
// fields (tmdb_id, summary, director, stars, genres) on every entry flagged
// as `mismatch` or `fetch-error`. Title and year are preserved so
// fetch-posters.js can re-resolve via search.
//
// Usage:
//   node scripts/verify-puzzles.js 2026-04-22 2026-05-05 --json > /tmp/bad.json
//   node scripts/clear-bad-puzzle-entries.js /tmp/bad.json

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUZZLES_PATH = path.join(ROOT, 'public', 'puzzles.json');

const reportPath = process.argv[2];
if (!reportPath) {
  console.error('Usage: node scripts/clear-bad-puzzle-entries.js <verify-report.json>');
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const puzzles = JSON.parse(fs.readFileSync(PUZZLES_PATH, 'utf8'));

const TARGET_STATUSES = new Set(['mismatch', 'fetch-error']);

// Build a Set of (puzzleId, category, title, year) to clear
const targets = new Map();
for (const b of report.bad) {
  if (!TARGET_STATUSES.has(b.status)) continue;
  const key = `${b.puzzleId}::${b.category}::${b.title}::${b.year}`;
  targets.set(key, b);
}

let cleared = 0;
for (const puzzle of puzzles.puzzles) {
  for (const cat of puzzle.categories) {
    for (const movie of cat.movies) {
      const key = `${puzzle.id}::${cat.name}::${movie.title}::${movie.year}`;
      if (!targets.has(key)) continue;
      delete movie.tmdb_id;
      delete movie.summary;
      delete movie.director;
      delete movie.stars;
      delete movie.genres;
      cleared++;
      console.log(`cleared ${puzzle.id} | ${cat.name} | ${movie.title} (${movie.year})`);
    }
  }
}

fs.writeFileSync(PUZZLES_PATH, JSON.stringify(puzzles, null, 2));
console.log(`\nCleared ${cleared} of ${targets.size} target entries`);
if (cleared !== targets.size) {
  console.error('WARNING: some target entries did not match — investigate before refetch');
  process.exit(1);
}
