// Player-submitted puzzles, stored in a Netlify Blobs bucket. Submissions
// land in `status: 'pending'` and never auto-publish — an admin reviews
// them in the backroom Submissions page and either opens one in the
// puzzle editor (which then publishes via the normal admin-puzzles flow)
// or marks it rejected.
//
// Routes:
//   POST   /api/puzzle-submit          PUBLIC — anyone can submit a puzzle
//   GET    /api/puzzle-submit          ADMIN  — list all submissions
//   PATCH  /api/puzzle-submit?key=...  ADMIN  — update status + admin notes
//   DELETE /api/puzzle-submit?key=...  ADMIN  — hard-delete a submission
//
// Admin endpoints require a valid backroom_session cookie (same JWT
// pattern as the rest of the admin functions).

import { getStore } from '@netlify/blobs';
import { verifyToken } from './lib/auth.mjs';

const STORE_NAME = 'puzzle-submissions';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

async function requireAdmin(req) {
  const cookie = req.headers.get('cookie');
  if (!(await verifyToken(cookie))) return json({ error: 'Unauthorized' }, 401);
  return null;
}

export default async (req, context) => {
  const url = new URL(req.url);
  const store = getStore(STORE_NAME);

  // -------- POST: public submission --------
  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const { title, categories, submittedBy, email } = body;
    if (!title || !Array.isArray(categories) || categories.length !== 4) {
      return json({ error: 'Need title + 4 categories' }, 400);
    }

    const key = `submit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await store.setJSON(key, {
      title,
      categories,
      submittedBy: submittedBy || 'Anonymous Clerk',
      email: email || null,
      submittedAt: new Date().toISOString(),
      status: 'pending',
      adminNotes: null,
      publishedAs: null, // populated when an admin publishes the submission
    });

    return json({ ok: true, key });
  }

  // -------- All other methods require admin auth --------
  const authError = await requireAdmin(req);
  if (authError) return authError;

  // -------- GET: list submissions --------
  if (req.method === 'GET') {
    const { blobs } = await store.list();
    const submissions = [];
    for (const blob of blobs) {
      const data = await store.get(blob.key, { type: 'json' });
      if (data) submissions.push({ key: blob.key, ...data });
    }
    submissions.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
    return json({ submissions });
  }

  // -------- PATCH: update status / admin notes --------
  if (req.method === 'PATCH') {
    const key = url.searchParams.get('key');
    if (!key) return json({ error: 'Missing key' }, 400);

    const existing = await store.get(key, { type: 'json' });
    if (!existing) return json({ error: 'Not found' }, 404);

    let patch;
    try {
      patch = await req.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    // Only allow updating these fields — other fields are immutable
    const allowed = ['status', 'adminNotes', 'publishedAs'];
    const updated = { ...existing };
    for (const k of allowed) {
      if (k in patch) updated[k] = patch[k];
    }
    updated.reviewedAt = new Date().toISOString();

    await store.setJSON(key, updated);
    return json({ ok: true, submission: { key, ...updated } });
  }

  // -------- DELETE: hard delete --------
  if (req.method === 'DELETE') {
    const key = url.searchParams.get('key');
    if (!key) return json({ error: 'Missing key' }, 400);
    await store.delete(key);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
};

export const config = { path: '/api/puzzle-submit' };
