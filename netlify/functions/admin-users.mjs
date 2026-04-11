import { verifyToken } from './lib/auth.mjs';

/**
 * List users via the Netlify API (not the Identity GoTrue admin endpoint).
 * This uses the personal access token to query site members directly.
 */
async function listUsersViaNetlifyApi() {
  const netlifyToken = Netlify.env.get('NETLIFY_API_TOKEN');
  const siteId = Netlify.env.get('SITE_ID');

  if (!netlifyToken) {
    console.log('[admin-users] NETLIFY_API_TOKEN not set');
    return [];
  }

  // Try Identity users endpoint via Netlify API
  if (siteId) {
    try {
      const res = await fetch(
        `https://api.netlify.com/api/v1/sites/${siteId}/identity/users`,
        { headers: { 'Authorization': `Bearer ${netlifyToken}` } }
      );
      if (res.ok) {
        const users = await res.json();
        console.log(`[admin-users] Found ${users.length} identity users via Netlify API`);
        return users;
      }
      console.log(`[admin-users] Netlify API identity/users: ${res.status} ${await res.text()}`);
    } catch (err) {
      console.log(`[admin-users] Netlify API error: ${err.message}`);
    }
  }

  return [];
}

async function inviteUserViaNetlifyApi(email) {
  const netlifyToken = Netlify.env.get('NETLIFY_API_TOKEN');
  const siteId = Netlify.env.get('SITE_ID');

  if (!netlifyToken || !siteId) {
    throw new Error('Missing NETLIFY_API_TOKEN or SITE_ID');
  }

  const res = await fetch(
    `https://api.netlify.com/api/v1/sites/${siteId}/identity/users/invite`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${netlifyToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.log(`[admin-users] Invite error: ${res.status} ${errText}`);
    throw new Error(`Invite failed: ${res.status}`);
  }

  return res.json();
}

export default async (req, context) => {
  console.log(`[admin-users] ${req.method} ${req.url}`);

  const cookie = req.headers.get('cookie');
  if (!(await verifyToken(cookie))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (req.method === 'GET') {
      const users = await listUsersViaNetlifyApi();
      return Response.json({ users });
    }

    if (req.method === 'POST') {
      const body = await req.json();

      if (body.action === 'invite') {
        const result = await inviteUserViaNetlifyApi(body.email);
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
