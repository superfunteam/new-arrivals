import { verifyToken, authResponse } from './lib/auth.mjs';

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

async function handleGet() {
  const res = await fetch(API_BASE, { headers: ghHeaders() });
  if (!res.ok) {
    const err = await res.text();
    return authResponse(res.status, { error: `GitHub API error: ${err}` });
  }
  const data = await res.json();
  const puzzles = JSON.parse(Buffer.from(data.content, 'base64').toString());
  return authResponse(200, { puzzles: puzzles.puzzles, sha: data.sha });
}

async function handlePut(body) {
  const { puzzles, sha, message } = JSON.parse(body);
  if (!puzzles || !sha) {
    return authResponse(400, { error: 'Missing puzzles or sha' });
  }
  const content = Buffer.from(
    JSON.stringify({ puzzles }, null, 2)
  ).toString('base64');

  const res = await fetch(API_BASE, {
    method: 'PUT',
    headers: ghHeaders(),
    body: JSON.stringify({
      message: message || 'Update puzzles.json via admin dashboard',
      content,
      sha,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return authResponse(res.status, { error: `GitHub API error: ${err}` });
  }
  const data = await res.json();
  return authResponse(200, { sha: data.content.sha });
}

export async function handler(event) {
  const isAuthed = await verifyToken(event.headers.cookie);
  if (!isAuthed) return authResponse(401, { error: 'Unauthorized' });

  if (event.httpMethod === 'GET') {
    return handleGet();
  }

  if (event.httpMethod === 'PUT') {
    return handlePut(event.body);
  }

  return authResponse(405, { error: 'Method not allowed' });
}
