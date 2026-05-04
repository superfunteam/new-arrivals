// Daily scheduled background function that keeps a rolling buffer of upcoming
// dated puzzles in public/puzzles.json. Runs entirely on Netlify so it uses
// the AI Gateway via `new Anthropic()` — no extra config needed.
//
// Pipeline per run:
//   1. Fetch the latest puzzles.json + sha from the GitHub Contents API.
//   2. Compute how many days short of PUZZLE_BUFFER_DAYS we are.
//   3. For each missing day: ask Claude to design a puzzle, then enrich each
//      movie via TMDB (tmdb_id, summary, genres, director, stars).
//   4. Commit the updated puzzles.json back to GitHub. The commit triggers
//      a normal Netlify rebuild, which runs scripts/fetch-posters.js to
//      download the actual poster files for any new tmdb_ids.
//
// Background functions can run up to 15 minutes — plenty of time for serial
// Anthropic + TMDB calls. Manual top-ups can still be done via the CLI
// (`npm run generate-puzzles`) or the existing admin dashboard.

import Anthropic from '@anthropic-ai/sdk';

const REPO = 'superfunteam/new-arrivals';
const FILE_PATH = 'public/puzzles.json';
const GITHUB_API = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
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
  p.categories.sort((a, b) => a.difficulty - b.difficulty);
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

// ── TMDB helpers (mirror of admin-tmdb-enrich.mjs) ──

function tmdbHeaders() {
  return {
    Authorization: `Bearer ${Netlify.env.get('TMDB_ACCESS_TOKEN')}`,
    Accept: 'application/json',
  };
}

async function tmdbSearch(title, year) {
  const params = new URLSearchParams({ query: title });
  if (year) params.set('year', String(year));
  const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, { headers: tmdbHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

async function tmdbDetails(id) {
  const res = await fetch(`${TMDB_BASE}/movie/${id}?append_to_response=credits`, { headers: tmdbHeaders() });
  if (!res.ok) return null;
  return res.json();
}

function pickBestMatch(movie, results) {
  if (!results.length) return null;
  const want = movie.year;
  // Prefer a result with a release year within ±1 of the requested year.
  const yearMatch = results.find((r) => {
    if (!r.release_date) return false;
    const y = parseInt(r.release_date.slice(0, 4), 10);
    return Math.abs(y - want) <= 1;
  });
  return yearMatch || results[0];
}

async function enrichMovie(movie) {
  // Best-effort: if enrichment fails the entry stays as title+year and
  // scripts/fetch-posters.js will retry on the next build.
  let results = await tmdbSearch(movie.title, movie.year);
  let candidate = pickBestMatch(movie, results);
  if (!candidate) {
    results = await tmdbSearch(movie.title, null);
    candidate = pickBestMatch(movie, results);
  }
  if (!candidate) return movie;
  const details = await tmdbDetails(candidate.id);
  if (!details) return { ...movie, tmdb_id: candidate.id };
  const director = details.credits?.crew?.find((c) => c.job === 'Director')?.name || null;
  const stars = (details.credits?.cast || [])
    .sort((a, b) => a.order - b.order)
    .slice(0, 3)
    .map((c) => c.name);
  return {
    ...movie,
    tmdb_id: details.id,
    summary: details.overview || null,
    genres: (details.genres || []).map((g) => g.name),
    director,
    stars,
  };
}

async function enrichPuzzle(puzzle) {
  for (const cat of puzzle.categories) {
    // Run the 4 movies in a category in parallel — TMDB tolerates this fine.
    cat.movies = await Promise.all(cat.movies.map(enrichMovie));
  }
  return puzzle;
}

// ── AI generation ──

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

  const bufferDays = parseInt(Netlify.env.get('PUZZLE_BUFFER_DAYS') || '14', 10);

  let puzzles, sha;
  try {
    ({ puzzles, sha } = await loadFromGitHub());
  } catch (err) {
    console.error('[scheduled-puzzles] GitHub load failed:', err.message);
    return new Response(`load failed: ${err.message}`, { status: 500 });
  }

  const today = todayUTC();
  const latest = findLatestDated(puzzles);
  const startDate = latest && latest >= today ? addDays(latest, 1) : today;
  const daysAhead = latest && latest >= today ? daysBetween(today, latest) : 0;
  const need = Math.max(0, bufferDays - daysAhead);

  if (need === 0) {
    console.log(`[scheduled-puzzles] buffer at ${daysAhead}/${bufferDays} — nothing to do`);
    return new Response('buffer full');
  }

  console.log(`[scheduled-puzzles] generating ${need} puzzle(s) starting ${startDate}`);

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
        await enrichPuzzle(puzzle);
        puzzles.push(puzzle);
        newlyAdded.push(puzzle);
        added++;
        success = true;
        console.log(`  ✓ ${dateStr} — "${puzzle.title}"`);
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

  if (added === 0) {
    console.error('[scheduled-puzzles] no puzzles generated — not committing');
    return new Response('no puzzles generated', { status: 500 });
  }

  const message =
    added === 1
      ? `Auto-publish: queue ${newlyAdded[0].id} — ${newlyAdded[0].title}`
      : `Auto-publish: queue ${added} new puzzle(s) (${newlyAdded[0].id} → ${newlyAdded[added - 1].id})`;

  // One retry on SHA conflict — re-fetch and re-apply if someone committed
  // mid-run. We always append, so re-applying is safe.
  let attempt = 0;
  while (attempt < 2) {
    attempt++;
    try {
      await commitToGitHub(puzzles, sha, message);
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`[scheduled-puzzles] committed ${added} puzzle(s) in ${elapsed}s`);
      return new Response(`added ${added} puzzle(s)`);
    } catch (err) {
      const isShaConflict = /409|sha|conflict/i.test(err.message);
      if (!isShaConflict || attempt >= 2) {
        console.error('[scheduled-puzzles] commit failed:', err.message);
        return new Response(`commit failed: ${err.message}`, { status: 500 });
      }
      console.warn('[scheduled-puzzles] sha conflict — re-fetching and reapplying');
      const reloaded = await loadFromGitHub();
      sha = reloaded.sha;
      // Append newly-added puzzles to the freshly-loaded list.
      puzzles = reloaded.puzzles.concat(newlyAdded);
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
