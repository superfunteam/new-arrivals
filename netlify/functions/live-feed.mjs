import { getStore } from '@netlify/blobs';

const STORE_NAME = 'game-stats';
const FEED_KEY = 'live-feed';
const MAX_EVENTS = 50;

// ── Canned messages based on game outcome ────────────────────────────────────

const PERFECT_MESSAGES = [
  'A video clerk just ran a flawless shift!',
  'Someone just shelved every tape perfectly.',
  'A coworker just got a perfect score!',
  'Somebody just earned Employee of the Month.',
  'A clerk just closed out with zero mistakes!',
];

const HIGH_WAGE_MESSAGES = [
  'A clerk just earned ${wage} — not bad for one shift.',
  'Someone just walked out with ${wage} in their pocket.',
  'A coworker just pulled ${wage} on the night shift.',
  '${wage}?! Somebody knows their movies.',
  'Another clerk just banked ${wage}. The shelves are sorted.',
];

const MID_WAGE_MESSAGES = [
  'A clerk just earned ${wage}. Honest work.',
  'Someone finished their shift — ${wage} earned.',
  'A coworker clocked out with ${wage}.',
  '${wage} for tonight. Not every shift is perfect.',
  'Another tape sorted, another ${wage} earned.',
];

const LOW_WAGE_MESSAGES = [
  'A clerk barely survived — ${wage} earned.',
  'Rough shift. Someone walked out with ${wage}.',
  '${wage}... somebody had a tough night.',
  'A coworker is rethinking their career. ${wage}.',
];

const THREE_STAR_MESSAGES = [
  'A clerk just earned three stars!',
  '⭐⭐⭐ — somebody is on fire tonight.',
  'Three-star performance from the night shift.',
];

const FAST_MESSAGES = [
  'A speed clerk just finished in ${time}!',
  'Someone just blitzed through in ${time}.',
  '${time}?! That clerk was in a hurry.',
];

function pickMessage(finalWage, wrongGuesses, stars, timeSecs) {
  const wage = `$${finalWage}`;
  const mins = Math.floor(timeSecs / 60);
  const secs = timeSecs % 60;
  const time = `${mins}:${String(secs).padStart(2, '0')}`;

  let pool;

  // Priority: perfect > 3-star > fast > wage-based
  if (wrongGuesses === 0 && Math.random() < 0.6) {
    pool = PERFECT_MESSAGES;
  } else if (stars === 3 && Math.random() < 0.5) {
    pool = THREE_STAR_MESSAGES;
  } else if (timeSecs < 120 && Math.random() < 0.4) {
    pool = FAST_MESSAGES;
  } else if (finalWage >= 23) {
    pool = HIGH_WAGE_MESSAGES;
  } else if (finalWage >= 15) {
    pool = MID_WAGE_MESSAGES;
  } else {
    pool = LOW_WAGE_MESSAGES;
  }

  const template = pool[Math.floor(Math.random() * pool.length)];
  return template.replace('${wage}', wage).replace('${time}', time);
}

// ── Handler ──────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=10',
};

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const store = getStore(STORE_NAME);

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), MAX_EVENTS);
    const since = url.searchParams.get('since'); // ISO timestamp

    const feed = await store.get(FEED_KEY, { type: 'json' }) || [];

    let events = feed;
    if (since) {
      events = feed.filter(e => e.ts > since);
    }

    return Response.json(
      { events: events.slice(-limit) },
      { headers: CORS }
    );
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
};

export const config = { path: '/api/live-feed' };

// ── Exported for use by report-stats ─────────────────────────────────────────

export { STORE_NAME, FEED_KEY, MAX_EVENTS, pickMessage };
