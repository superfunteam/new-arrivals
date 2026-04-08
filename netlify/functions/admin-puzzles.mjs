import { verifyToken } from './lib/auth.mjs';

const REPO = 'superfunteam/new-arrivals';
const FILE_PATH = 'public/puzzles.json';
const API_BASE = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;

function ghHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'new-arrivals-admin',
  };
}

export default async (req, context) => {
  console.log(`[admin-puzzles] ${req.method} ${req.url}`);
  const cookie = req.headers.get('cookie');
  if (!(await verifyToken(cookie))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (req.method === 'GET') {
      const res = await fetch(API_BASE, { headers: ghHeaders() });
      if (!res.ok) return Response.json({ error: 'GitHub API error' }, { status: res.status });
      const data = await res.json();
      const puzzles = JSON.parse(Buffer.from(data.content, 'base64').toString());
      return Response.json({ puzzles: puzzles.puzzles, sha: data.sha });
    }

    if (req.method === 'PUT') {
      const body = await req.json();
      const { puzzles, sha, message } = body;
      if (!puzzles || !sha) return Response.json({ error: 'Missing puzzles or sha' }, { status: 400 });

      const content = Buffer.from(JSON.stringify({ puzzles }, null, 2)).toString('base64');
      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message || 'Update puzzles.json via admin dashboard',
          content,
          sha,
        }),
      });

      if (!res.ok) return Response.json({ error: 'GitHub API error' }, { status: res.status });
      const data = await res.json();
      return Response.json({ sha: data.content.sha });
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};


export const config = { path: '/api/admin-puzzles' };
