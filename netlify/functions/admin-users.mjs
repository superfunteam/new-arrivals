import { verifyToken } from './lib/auth.mjs';

const NETLIFY_API = 'https://api.netlify.com/api/v1';

function getCredentials() {
  const token = Netlify.env.get('NETLIFY_API_TOKEN');
  const siteId = Netlify.env.get('SITE_ID');
  return { token, siteId };
}

async function netlifyApi(method, path, body) {
  const { token } = getCredentials();
  const res = await fetch(`${NETLIFY_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  console.log(`[admin-users] ${method} ${path} → ${res.status}`);

  if (!res.ok) {
    console.log(`[admin-users] Error: ${text.slice(0, 300)}`);
    throw new Error(`Netlify API ${res.status}`);
  }

  return text ? JSON.parse(text) : null;
}

export default async (req, context) => {
  console.log(`[admin-users] ${req.method} ${req.url}`);

  const cookie = req.headers.get('cookie');
  if (!(await verifyToken(cookie))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { token, siteId } = getCredentials();
  if (!token || !siteId) {
    console.log(`[admin-users] Missing env: token=${!!token} siteId=${!!siteId}`);
    return Response.json({ users: [] });
  }

  try {
    if (req.method === 'GET') {
      // Try multiple Netlify API endpoints to find users
      const endpoints = [
        `/sites/${siteId}/identity/users`,
        `/sites/${siteId}/identity/users?per_page=100`,
        `/sites/${siteId}/members`,
      ];

      for (const ep of endpoints) {
        try {
          const data = await netlifyApi('GET', ep);
          const users = Array.isArray(data) ? data : (data?.users || []);
          if (users.length > 0) {
            console.log(`[admin-users] Found ${users.length} users via ${ep}`);
            return Response.json({ users });
          }
        } catch (err) {
          console.log(`[admin-users] ${ep} failed: ${err.message}`);
        }
      }

      console.log('[admin-users] All endpoints returned empty');
      return Response.json({ users: [] });
    }

    if (req.method === 'POST') {
      const body = await req.json();

      if (body.action === 'invite') {
        const result = await netlifyApi('POST', `/sites/${siteId}/identity/users/invite`, {
          email: body.email,
        });
        return Response.json({ ok: true, user: result });
      }

      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (err) {
    console.error('[admin-users] Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
};

export const config = { path: '/api/admin-users' };
