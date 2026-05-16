// Two hand-fix puzzle edits requested by Tom:
//
//   1. 2026-05-16 "Saturday Matinee Magic" — "80s Family Fantasy Adventures"
//      category had E.T. as the easy out. E.T. reads as sci-fi more than
//      family-fantasy. Swap it for The Princess Bride, which fits the
//      category cleanly.
//
//   2. 2026-05-14 "Rewind & Remember" — the "Set in San Francisco" category
//      was reaching for it (Tom called it a "BIG STRETCH"). Replace the
//      entire category with "Schwarzenegger Action" — four films nobody
//      can mistake for anything else.
//
// Movies reused from elsewhere in puzzles.json so metadata is already
// verified — no need to refetch TMDB. Idempotent: re-running this is a
// no-op once the edits are in place.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUZZLES_PATH = path.join(ROOT, 'public', 'puzzles.json');

const PRINCESS_BRIDE = {
  title: 'The Princess Bride',
  year: 1987,
  tmdb_id: 2493,
  summary: "In this enchantingly cracked fairy tale, the beautiful Princess Buttercup and the dashing Westley must overcome staggering odds to find happiness amid six-fingered swordsmen, murderous princes, Sicilians and rodents of unusual size. But even death can't stop these true lovebirds from triumphing.",
  genres: ['Adventure', 'Family', 'Fantasy', 'Comedy', 'Romance'],
  director: 'Rob Reiner',
  stars: ['Cary Elwes', 'Robin Wright', 'Mandy Patinkin'],
};

const SCHWARZENEGGER_CATEGORY = {
  name: 'Schwarzenegger Action',
  difficulty: 3,
  color: '#2196F3',
  movies: [
    {
      title: 'The Terminator',
      year: 1984,
      tmdb_id: 218,
      summary: 'In the post-apocalyptic future, reigning tyrannical supercomputers teleport a cyborg assassin known as the "Terminator" back to 1984 to kill Sarah Connor, whose unborn son is destined to lead insurgents against 21st century mechanical hegemony. Meanwhile, the human-resistance movement dispatches a lone warrior to safeguard Sarah. Can he stop the virtually indestructible killing machine?',
      genres: ['Action', 'Thriller', 'Science Fiction'],
      director: 'James Cameron',
      stars: ['Arnold Schwarzenegger', 'Michael Biehn', 'Linda Hamilton'],
    },
    {
      title: 'Predator',
      year: 1987,
      tmdb_id: 106,
      summary: 'A team of elite commandos on a secret mission in a Central American jungle come to find themselves hunted by an extraterrestrial warrior.',
      genres: ['Science Fiction', 'Action', 'Adventure', 'Thriller'],
      director: 'John McTiernan',
      stars: ['Arnold Schwarzenegger', 'Carl Weathers', 'Kevin Peter Hall'],
    },
    {
      title: 'Total Recall',
      year: 1990,
      tmdb_id: 861,
      summary: "Construction worker Douglas Quaid's obsession with the planet Mars leads him to visit Recall, a company that manufactures memories. When his memory implant goes wrong, Doug can no longer be sure what is and isn't reality.",
      genres: ['Action', 'Adventure', 'Science Fiction'],
      director: 'Paul Verhoeven',
      stars: ['Arnold Schwarzenegger', 'Rachel Ticotin', 'Sharon Stone'],
    },
    {
      title: 'True Lies',
      year: 1994,
      tmdb_id: 36955,
      summary: 'A fearless, globe-trotting, terrorist-battling secret agent has his life turned upside down when he discovers his wife might be having an affair with a used car salesman while terrorists smuggle nuclear war heads into the United States.',
      genres: ['Action', 'Thriller'],
      director: 'James Cameron',
      stars: ['Arnold Schwarzenegger', 'Jamie Lee Curtis', 'Tom Arnold'],
    },
  ],
};

const data = JSON.parse(fs.readFileSync(PUZZLES_PATH, 'utf8'));
let editsApplied = 0;

for (const puzzle of data.puzzles) {
  // --- Edit 1: Saturday Matinee Magic ---
  if (puzzle.id === '2026-05-16') {
    const cat = puzzle.categories.find((c) => c.name === '80s Family Fantasy Adventures');
    if (!cat) {
      console.warn(`[skip] 2026-05-16 has no "80s Family Fantasy Adventures" category`);
    } else {
      const etIdx = cat.movies.findIndex((m) => /^E\.?T\.?($| )/i.test(m.title));
      if (etIdx === -1) {
        console.log(`[skip] 2026-05-16 no longer has E.T. in the category — already edited`);
      } else if (cat.movies.some((m) => m.tmdb_id === PRINCESS_BRIDE.tmdb_id)) {
        console.log(`[skip] 2026-05-16 already contains The Princess Bride`);
      } else {
        const before = cat.movies[etIdx].title;
        cat.movies[etIdx] = { ...PRINCESS_BRIDE };
        editsApplied++;
        console.log(`[edit] 2026-05-16 "${cat.name}": ${before} → The Princess Bride`);
      }
    }
  }

  // --- Edit 2: Rewind & Remember ---
  if (puzzle.id === '2026-05-14') {
    const sfIdx = puzzle.categories.findIndex((c) => /san francisco/i.test(c.name));
    if (sfIdx === -1) {
      console.log(`[skip] 2026-05-14 no longer has a San Francisco category — already edited`);
    } else {
      const before = puzzle.categories[sfIdx].name;
      // Preserve difficulty + color slot of the category being replaced
      puzzle.categories[sfIdx] = {
        ...SCHWARZENEGGER_CATEGORY,
        difficulty: puzzle.categories[sfIdx].difficulty,
        color: puzzle.categories[sfIdx].color,
      };
      editsApplied++;
      console.log(`[edit] 2026-05-14 "${before}" → "Schwarzenegger Action" (4 movies replaced)`);
    }
  }
}

if (editsApplied === 0) {
  console.log('\nNo edits needed — puzzles already in target state.');
  process.exit(0);
}

fs.writeFileSync(PUZZLES_PATH, JSON.stringify(data, null, 2));
console.log(`\nApplied ${editsApplied} edit(s). Wrote ${PUZZLES_PATH}`);
console.log('Player saves of these puzzles will auto-invalidate via the new puzzleSignature() check.');
