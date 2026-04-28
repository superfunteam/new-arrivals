// Verify that public/interrupts.json is structurally sound and aligned with
// public/puzzles.json. Catches:
//   - puzzles missing interrupt entries entirely (= no customer chat, no hints)
//   - interrupt entries for dates that don't have a puzzle
//   - hint entries whose `hintCategory` doesn't match any puzzle category
//   - missing/invalid required fields per type
//   - character/sprite/folder values that don't exist on disk
//
// Usage:
//   node scripts/verify-interrupts.js                # check all puzzles
//   node scripts/verify-interrupts.js 2026-04-22 2026-05-05
//   node scripts/verify-interrupts.js --json
//
// Exit code: 0 if clean, 1 on any problem.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUZZLES_PATH = path.join(ROOT, 'public', 'puzzles.json');
const INTERRUPTS_PATH = path.join(ROOT, 'public', 'interrupts.json');
const CHARACTERS_DIR = path.join(ROOT, 'public', 'characters');

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) return id.startsWith('extra-shift-') ? false : true;
  return id >= start && id <= end;
}

function validCharacterFolders() {
  if (!fs.existsSync(CHARACTERS_DIR)) return new Set();
  return new Set(fs.readdirSync(CHARACTERS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name));
}

const REQUIRED_BY_TYPE = {
  trivia: ['character', 'sprite', 'folder', 'dialogue', 'answers', 'correct'],
  hint:   ['character', 'sprite', 'folder', 'dialogue', 'hintCategory', 'cost'],
  story:  ['character', 'sprite', 'folder', 'dialogue', 'dismiss'],
};

function validateInterrupt(item, puzzleCategories, validFolders) {
  const problems = [];
  if (!item.type) problems.push('missing type');
  else if (!REQUIRED_BY_TYPE[item.type]) problems.push(`unknown type '${item.type}'`);
  else {
    for (const f of REQUIRED_BY_TYPE[item.type]) {
      if (item[f] == null || item[f] === '') problems.push(`missing field '${f}'`);
    }
  }
  if (item.type === 'trivia') {
    if (Array.isArray(item.answers)) {
      if (item.answers.length !== 4) problems.push(`trivia.answers must have 4 entries, got ${item.answers.length}`);
      if (typeof item.correct !== 'number' || item.correct < 0 || item.correct > 3) {
        problems.push(`trivia.correct must be 0-3, got ${JSON.stringify(item.correct)}`);
      }
    }
  }
  if (item.type === 'hint') {
    if (item.hintCategory && !puzzleCategories.has(item.hintCategory)) {
      problems.push(`hintCategory '${item.hintCategory}' not in puzzle categories [${[...puzzleCategories].join(' | ')}]`);
    }
    if (typeof item.cost !== 'number' || item.cost <= 0) {
      problems.push(`hint.cost must be a positive number, got ${JSON.stringify(item.cost)}`);
    }
  }
  if (item.folder && !validFolders.has(item.folder)) {
    problems.push(`folder '${item.folder}' is not a directory under public/characters/`);
  }
  if (item.folder && item.sprite) {
    const spritePath = path.join(CHARACTERS_DIR, item.folder, `${item.sprite}.png`);
    if (!fs.existsSync(spritePath)) {
      problems.push(`sprite file does not exist: characters/${item.folder}/${item.sprite}.png`);
    }
  }
  return problems;
}

function main() {
  const { json, rangeStart, rangeEnd } = parseArgs();
  const puzzles = JSON.parse(fs.readFileSync(PUZZLES_PATH, 'utf8'));
  const interrupts = JSON.parse(fs.readFileSync(INTERRUPTS_PATH, 'utf8'));
  const validFolders = validCharacterFolders();

  const puzCats = {};
  const puzMeta = {};
  for (const p of puzzles.puzzles) {
    puzCats[p.id] = new Set(p.categories.map(c => c.name));
    puzMeta[p.id] = p;
  }

  const report = {
    missingInterrupts: [],     // puzzles with no interrupt entries
    orphanInterrupts: [],      // interrupt dates with no matching puzzle
    perPuzzle: [],             // {puzzleId, total, byType, problems[]}
  };

  // Puzzles missing interrupt entries
  for (const p of puzzles.puzzles) {
    if (!inRange(p.id, rangeStart, rangeEnd)) continue;
    if (!interrupts[p.id] || interrupts[p.id].length === 0) {
      report.missingInterrupts.push({ puzzleId: p.id, title: p.title });
    }
  }

  // Interrupt dates with no puzzle
  for (const date of Object.keys(interrupts)) {
    if (!puzCats[date]) report.orphanInterrupts.push(date);
  }

  // Per-puzzle structural checks
  for (const [puzzleId, items] of Object.entries(interrupts)) {
    if (!inRange(puzzleId, rangeStart, rangeEnd)) continue;
    if (!puzCats[puzzleId]) continue; // already flagged as orphan
    const byType = {};
    const problems = [];
    items.forEach((item, idx) => {
      byType[item.type] = (byType[item.type] || 0) + 1;
      const issues = validateInterrupt(item, puzCats[puzzleId], validFolders);
      for (const p of issues) problems.push(`#${idx} (${item.type || '?'}): ${p}`);
    });
    if (problems.length > 0 || items.length === 0) {
      report.perPuzzle.push({ puzzleId, total: items.length, byType, problems });
    }
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('=== Puzzles MISSING interrupt entries ===');
    if (report.missingInterrupts.length === 0) console.log('  (none)');
    for (const m of report.missingInterrupts) console.log(`  ${m.puzzleId} | ${m.title}`);

    console.log('\n=== Orphan interrupt dates (no matching puzzle) ===');
    if (report.orphanInterrupts.length === 0) console.log('  (none)');
    for (const d of report.orphanInterrupts) console.log(`  ${d}`);

    console.log('\n=== Per-puzzle structural problems ===');
    if (report.perPuzzle.length === 0) console.log('  (none)');
    for (const p of report.perPuzzle) {
      console.log(`\n  ${p.puzzleId} — ${p.total} items (${JSON.stringify(p.byType)})`);
      for (const prob of p.problems) console.log(`    - ${prob}`);
    }

    const totalProblems =
      report.missingInterrupts.length +
      report.orphanInterrupts.length +
      report.perPuzzle.reduce((a, p) => a + p.problems.length, 0);
    console.log(`\nTotal problems: ${totalProblems}`);
  }

  const hasProblems =
    report.missingInterrupts.length > 0 ||
    report.orphanInterrupts.length > 0 ||
    report.perPuzzle.length > 0;
  process.exit(hasProblems ? 1 : 0);
}

main();
