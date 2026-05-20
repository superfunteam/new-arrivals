// Reject any puzzle that contains the same movie twice. Runs offline (no
// TMDB calls), so it's cheap enough for pre-commit and CI.
//
// Usage:
//   node scripts/check-puzzle-duplicates.js              # check all puzzles
//   node scripts/check-puzzle-duplicates.js 2026-05-01   # check one puzzle id
//   node scripts/check-puzzle-duplicates.js --json       # machine output
//
// Exit code: 0 if no duplicates, 1 if any puzzle has duplicates.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUZZLES_PATH = path.join(__dirname, '..', 'public', 'puzzles.json');

// A movie may legitimately reappear ACROSS puzzles, but never within one —
// the shelf renders 16 distinct tapes, and the categories are supposed to be
// the player's discovery, so a tape sitting in two categories breaks the game.
// We check both tmdb_id (authoritative) and title+year (catches entries that
// haven't been resolved to a tmdb_id yet).
export function findDuplicateMovies(puzzle) {
  const seenIds = new Map();
  const seenTitles = new Map();
  const dupes = [];
  for (const cat of puzzle.categories || []) {
    for (const m of cat.movies || []) {
      if (m.tmdb_id != null) {
        const prev = seenIds.get(m.tmdb_id);
        if (prev) {
          dupes.push({
            title: m.title, year: m.year, tmdb_id: m.tmdb_id,
            firstCategory: prev, secondCategory: cat.name,
          });
        } else {
          seenIds.set(m.tmdb_id, cat.name);
        }
      }
      const titleKey = `${(m.title || '').trim().toLowerCase()}|${m.year}`;
      const prevT = seenTitles.get(titleKey);
      if (prevT && prevT !== cat.name) {
        if (!dupes.some(d => d.secondCategory === cat.name && d.title === m.title && d.year === m.year)) {
          dupes.push({
            title: m.title, year: m.year, tmdb_id: m.tmdb_id,
            firstCategory: prevT, secondCategory: cat.name,
          });
        }
      } else if (!prevT) {
        seenTitles.set(titleKey, cat.name);
      }
    }
  }
  return dupes;
}

function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const targetId = args.find(a => !a.startsWith('--'));

  const data = JSON.parse(fs.readFileSync(PUZZLES_PATH, 'utf8'));
  const puzzles = targetId ? data.puzzles.filter(p => p.id === targetId) : data.puzzles;

  if (targetId && puzzles.length === 0) {
    console.error(`No puzzle with id "${targetId}"`);
    process.exit(2);
  }

  const report = [];
  for (const p of puzzles) {
    const dupes = findDuplicateMovies(p);
    if (dupes.length) report.push({ puzzleId: p.id, title: p.title, duplicates: dupes });
  }

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    if (report.length === 0) {
      console.log(`OK: no duplicate movies in ${puzzles.length} puzzle(s).`);
    } else {
      for (const r of report) {
        console.log(`\n${r.puzzleId} — ${r.title}`);
        for (const d of r.duplicates) {
          console.log(`  ${d.title} (${d.year}) [${d.tmdb_id ?? 'no-id'}] in "${d.firstCategory}" AND "${d.secondCategory}"`);
        }
      }
      console.log(`\n${report.length} puzzle(s) contain duplicates.`);
    }
  }

  process.exit(report.length === 0 ? 0 : 1);
}

// Only run when invoked directly (so other scripts can import findDuplicateMovies).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
