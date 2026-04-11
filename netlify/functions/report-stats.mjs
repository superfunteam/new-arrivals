import { getStore } from '@netlify/blobs';

const STORE_NAME = 'game-stats';
const AGG_KEY = 'aggregate';
const DAILY_PREFIX = 'daily:';
const FEED_KEY = 'live-feed';
const MAX_FEED = 50;

// ── Canned event messages ────────────────────────────────────────────────────

const PERFECT_MSGS = [
  'A video clerk just ran a flawless shift!',
  'Someone just shelved every tape perfectly.',
  'A coworker just got a perfect score!',
  'Somebody just earned Employee of the Month.',
];
const HIGH_MSGS = [
  'A clerk just earned ${w} — not bad for one shift.',
  '${w}?! Somebody knows their movies.',
  'Another clerk just banked ${w}.',
];
const MID_MSGS = [
  'A clerk just earned ${w}. Honest work.',
  'Someone finished their shift — ${w} earned.',
  'Another tape sorted, another ${w} earned.',
];
const LOW_MSGS = [
  'Rough shift. Someone walked out with ${w}.',
  '${w}... somebody had a tough night.',
];
const FAST_MSGS = [
  'A speed clerk just finished in ${t}!',
  '${t}?! That clerk was in a hurry.',
];
const STAR3_MSGS = [
  'A clerk just earned three stars!',
  'Three-star performance from the night shift.',
];

function buildEventMessage(finalWage, wrongGuesses, stars, timeSecs) {
  const w = `$${finalWage}`;
  const m = Math.floor(timeSecs / 60);
  const s = timeSecs % 60;
  const t = `${m}:${String(s).padStart(2, '0')}`;

  let pool;
  if (wrongGuesses === 0 && Math.random() < 0.6) pool = PERFECT_MSGS;
  else if (stars === 3 && Math.random() < 0.5) pool = STAR3_MSGS;
  else if (timeSecs > 0 && timeSecs < 120 && Math.random() < 0.4) pool = FAST_MSGS;
  else if (finalWage >= 23) pool = HIGH_MSGS;
  else if (finalWage >= 15) pool = MID_MSGS;
  else pool = LOW_MSGS;

  return pool[Math.floor(Math.random() * pool.length)]
    .replace('${w}', w)
    .replace('${t}', t);
}

function emptyAggregate() {
  return {
    totalShifts: 0,
    totalWages: 0,
    totalWrongGuesses: 0,
    totalHintsPurchased: 0,
    totalTimeSecs: 0,
    perfectShifts: 0,
    bestWage: 0,
    totalTriviaEarnings: 0,
    puzzleCounts: {},   // { [puzzleId]: count }
    starCounts: { 1: 0, 2: 0, 3: 0 },
    lastUpdated: null,
  };
}

function emptyDaily() {
  return {
    shifts: 0,
    wages: 0,
    wrongGuesses: 0,
    perfectShifts: 0,
  };
}

export default async (req, context) => {
  const store = getStore(STORE_NAME);

  // ── GET: return aggregate stats ─────────────────────────────────────────
  if (req.method === 'GET') {
    const agg = await store.get(AGG_KEY, { type: 'json' }) || emptyAggregate();

    // Gather last 14 days of daily stats
    const dailyStats = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const day = await store.get(`${DAILY_PREFIX}${dateStr}`, { type: 'json' });
      dailyStats.push({ date: dateStr, ...(day || emptyDaily()) });
    }

    return Response.json({ aggregate: agg, daily: dailyStats });
  }

  // ── POST: record a completed game ───────────────────────────────────────
  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const {
      puzzleId,
      finalWage = 0,
      wrongGuesses = 0,
      hintsUsed = 0,
      timeSecs = 0,
      stars = 1,
      triviaEarnings = 0,
    } = body;

    if (!puzzleId) {
      return Response.json({ error: 'Missing puzzleId' }, { status: 400 });
    }

    // Update aggregate
    const agg = await store.get(AGG_KEY, { type: 'json' }) || emptyAggregate();
    agg.totalShifts += 1;
    agg.totalWages += finalWage;
    agg.totalWrongGuesses += wrongGuesses;
    agg.totalHintsPurchased += hintsUsed;
    agg.totalTimeSecs += timeSecs;
    agg.totalTriviaEarnings += triviaEarnings;
    if (wrongGuesses === 0) agg.perfectShifts += 1;
    if (finalWage > agg.bestWage) agg.bestWage = finalWage;
    agg.puzzleCounts[puzzleId] = (agg.puzzleCounts[puzzleId] || 0) + 1;
    agg.starCounts[stars] = (agg.starCounts[stars] || 0) + 1;
    agg.lastUpdated = new Date().toISOString();
    await store.setJSON(AGG_KEY, agg);

    // Update daily bucket
    const today = new Date().toISOString().slice(0, 10);
    const day = await store.get(`${DAILY_PREFIX}${today}`, { type: 'json' }) || emptyDaily();
    day.shifts += 1;
    day.wages += finalWage;
    day.wrongGuesses += wrongGuesses;
    if (wrongGuesses === 0) day.perfectShifts += 1;
    await store.setJSON(`${DAILY_PREFIX}${today}`, day);

    // Append to live feed
    const feed = await store.get(FEED_KEY, { type: 'json' }) || [];
    feed.push({
      ts: new Date().toISOString(),
      msg: buildEventMessage(finalWage, wrongGuesses, stars, timeSecs),
      wage: finalWage,
      stars,
      perfect: wrongGuesses === 0,
    });
    // Keep only the last MAX_FEED events
    if (feed.length > MAX_FEED) feed.splice(0, feed.length - MAX_FEED);
    await store.setJSON(FEED_KEY, feed);

    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
};

export const config = { path: '/api/report-stats' };
