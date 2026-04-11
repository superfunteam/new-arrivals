import { verifyToken } from './lib/auth.mjs';

/**
 * List users via the Netlify API (not the Identity GoTrue admin endpoint).
 * This uses the personal access token to query site members directly.
 */
async function listUsersViaNetlifyApi() {
  // Log every env var we care about (redacted)
  const netlifyToken = Netlify.env.get('NETLIFY_API_TOKEN');
  const siteId = Netlify.env.get('SITE_ID');

  console.log(`[admin-users] ENV CHECK:`);
  console.log(`  NETLIFY_API_TOKEN: ${netlifyToken ? netlifyToken.slice(0, 8) + '...' : 'NOT SET'}`);
  console.log(`  SITE_ID: ${siteId || 'NOT SET'}`);

  if (!netlifyToken) {
    console.log('[admin-users] ABORT: no NETLIFY_API_TOKEN');
    return [];
  }
  if (!siteId) {
    console.log('[admin-users] ABORT: no SITE_ID');
    return [];
  }

  const url = `https://api.netlify.com/api/v1/sites/${siteId}/identity/users`;
  console.log(`[admin-users] Fetching: ${url}`);

  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${netlifyToken}` },
    });

    const body = await res.text();
    console.log(`[admin-users] Response: ${res.status} (${body.length} bytes)`);

    if (res.ok) {
      const users = JSON.parse(body);
      console.log(`[admin-users] Found ${users.length} users`);
      return users;
    }

    console.log(`[admin-users] Error body: ${body.slice(0, 500)}`);
  } catch (err) {
    console.log(`[admin-users] Fetch error: ${err.message}`);
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
