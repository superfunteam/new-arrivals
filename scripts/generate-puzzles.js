// Generates upcoming daily puzzle entries via the Anthropic API and appends
// them to public/puzzles.json. Designed to be run unattended on a schedule.
//
// Usage:
//   ANTHROPIC_API_KEY=... node scripts/generate-puzzles.js
//   PUZZLE_BUFFER_DAYS=21 node scripts/generate-puzzles.js  # override target buffer
//   node scripts/generate-puzzles.js --count 3              # force-generate N regardless of buffer
//
// Behavior:
//   - Finds the latest scheduled YYYY-MM-DD puzzle.
//   - Fills forward until there are PUZZLE_BUFFER_DAYS (default 14) of puzzles
//     queued ahead of today. If already buffered, exits 0 with no changes.
//   - Asks Claude to design each puzzle with a weekly-themed prompt.
//   - Writes the puzzle (title + year only) to puzzles.json after each
//     successful generation so partial failures don't lose work.
//   - TMDB enrichment (tmdb_id, summary, director, stars, posters) is handled
//     by scripts/fetch-posters.js, which the workflow runs next.

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUZZLES_PATH = path.join(ROOT, 'public', 'puzzles.json');

const TARGET_BUFFER_DAYS = parseInt(process.env.PUZZLE_BUFFER_DAYS || '14', 10);
const MODEL = process.env.PUZZLE_GEN_MODEL || 'claude-sonnet-4-5-20250929';

// Index 0 = Monday so dayOfWeek shifted Sunday=>6
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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

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
  // 0=Mon ... 6=Sun
  const d = new Date(dateStr + 'T00:00:00Z').getUTCDay();
  return (d + 6) % 7;
}

function findLatestDated(puzzles) {
  const dated = puzzles
    .map(p => p.id)
    .filter(id => /^\d{4}-\d{2}-\d{2}$/.test(id))
    .sort();
  return dated[dated.length - 1] || null;
}

function collectRecentTitles(puzzles, limit = 60) {
  const out = [];
  // Prefer the most recent dated puzzles
  const dated = [...puzzles]
    .filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p.id))
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
  // Tolerates ```json ... ``` fences and stray prose around the JSON object.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let candidate = (fenced ? fenced[1] : text).trim();
  if (!candidate.startsWith('{')) {
    const first = candidate.indexOf('{');
    const last = candidate.lastIndexOf('}');
    if (first !== -1 && last > first) candidate = candidate.slice(first, last + 1);
  }
  return JSON.parse(candidate);
}

const COLOR_BY_DIFFICULTY = {
  1: '#4CAF50',
  2: '#FFC107',
  3: '#2196F3',
  4: '#9C27B0',
};

function validatePuzzle(p) {
  if (!p || typeof p !== 'object') throw new Error('puzzle is not an object');
  if (!p.title || typeof p.title !== 'string') throw new Error('missing puzzle title');
  if (!Array.isArray(p.categories) || p.categories.length !== 4) {
    throw new Error(`expected 4 categories, got ${p.categories?.length ?? 0}`);
  }
  const seenDifficulties = new Set();
  for (const c of p.categories) {
    if (!c.name) throw new Error('category missing name');
    if (![1, 2, 3, 4].includes(c.difficulty)) throw new Error(`bad difficulty: ${c.difficulty}`);
    if (seenDifficulties.has(c.difficulty)) throw new Error(`duplicate difficulty: ${c.difficulty}`);
    seenDifficulties.add(c.difficulty);
    c.color = COLOR_BY_DIFFICULTY[c.difficulty];
    if (!Array.isArray(c.movies) || c.movies.length !== 4) {
      throw new Error(`category "${c.name}" needs 4 movies, got ${c.movies?.length ?? 0}`);
    }
    for (const m of c.movies) {
      if (!m.title || typeof m.title !== 'string') throw new Error(`movie missing title in "${c.name}"`);
      if (!Number.isInteger(m.year)) throw new Error(`movie "${m.title}" has bad year`);
    }
  }
  // Sort categories by difficulty so the file stays consistent.
  p.categories.sort((a, b) => a.difficulty - b.difficulty);
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

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = msg.content?.find(b => b.type === 'text')?.text || msg.content?.[0]?.text || '';
  if (!text) throw new Error('empty response from Claude');

  const parsed = parseJsonLoose(text);
  validatePuzzle(parsed);
  parsed.id = dateStr;
  // Re-shape so id comes first (matches existing file style)
  return { id: parsed.id, title: parsed.title, categories: parsed.categories };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { count: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count') out.count = parseInt(args[++i], 10);
  }
  return out;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is required');
    process.exit(2);
  }

  const { count: forcedCount } = parseArgs();
  const data = JSON.parse(fs.readFileSync(PUZZLES_PATH, 'utf8'));
  const today = todayUTC();
  const latest = findLatestDated(data.puzzles);

  let need;
  let startDate;
  if (forcedCount && forcedCount > 0) {
    need = forcedCount;
    startDate = latest && latest >= today ? addDays(latest, 1) : today;
  } else {
    if (!latest || latest < today) {
      // No future buffer at all — fill from today.
      startDate = today;
      need = TARGET_BUFFER_DAYS;
    } else {
      const daysAhead = daysBetween(today, latest); // inclusive of `latest`
      need = Math.max(0, TARGET_BUFFER_DAYS - daysAhead);
      startDate = addDays(latest, 1);
    }
  }

  if (need === 0) {
    console.log(`Buffer already at target (${TARGET_BUFFER_DAYS} days). No puzzles to generate.`);
    return;
  }

  console.log(`Generating ${need} puzzle(s) starting ${startDate} (model: ${MODEL})...`);

  const client = new Anthropic();
  let cursor = startDate;
  let added = 0;

  for (let i = 0; i < need; i++) {
    const dateStr = cursor;
    let attempts = 0;
    let success = false;
    while (attempts < 3 && !success) {
      attempts++;
      try {
        console.log(`  [${i + 1}/${need}] ${dateStr} (attempt ${attempts})`);
        const recent = collectRecentTitles(data.puzzles, 60);
        const puzzle = await generatePuzzle(client, dateStr, recent);
        data.puzzles.push(puzzle);
        // Persist after each so a later failure doesn't lose earlier work.
        fs.writeFileSync(PUZZLES_PATH, JSON.stringify(data, null, 2));
        added++;
        success = true;
      } catch (err) {
        console.error(`    failed: ${err.message}`);
        if (attempts < 3) await sleep(1000 * attempts);
      }
    }
    if (!success) {
      console.error(`Giving up on ${dateStr} after 3 attempts. Stopping.`);
      break;
    }
    cursor = addDays(cursor, 1);
  }

  console.log(`\nDone. Added ${added} puzzle(s).`);
  // Non-zero exit if we couldn't produce anything at all (so the workflow is loud).
  if (added === 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
