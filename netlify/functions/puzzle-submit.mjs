import { getStore } from '@netlify/blobs';

const STORE_NAME = 'puzzle-submissions';

export default async (req, context) => {
  if (req.method === 'GET') {
    // List submissions (for backroom)
    const store = getStore(STORE_NAME);
    const { blobs } = await store.list();
    const submissions = [];
    for (const blob of blobs) {
      const data = await store.get(blob.key, { type: 'json' });
      if (data) submissions.push({ key: blob.key, ...data });
    }
    submissions.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
    return Response.json({ submissions });
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { title, categories, submittedBy } = body;
    if (!title || !categories || categories.length !== 4) {
      return Response.json({ error: 'Need title + 4 categories' }, { status: 400 });
    }

    const store = getStore(STORE_NAME);
    const key = `submit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await store.setJSON(key, {
      title,
      categories,
      submittedBy: submittedBy || 'Anonymous Clerk',
      submittedAt: new Date().toISOString(),
      status: 'pending',
    });

    return Response.json({ ok: true, key });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
};

export const config = { path: '/api/puzzle-submit' };
