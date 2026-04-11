import { verifyToken } from './lib/auth.mjs';

const SITE_URL = 'https://game.vhsgarage.com';
const IDENTITY_URL = `${SITE_URL}/.netlify/identity`;

/**
 * Call the Netlify Identity Admin API.
 * Uses the Netlify site API to get an admin token for the Identity instance.
 */
async function getIdentityAdminToken() {
  const siteId = Netlify.env.get('SITE_ID') || Netlify.env.get('NETLIFY_SITE_ID');
  const netlifyToken = Netlify.env.get('NETLIFY_API_TOKEN');

  if (!netlifyToken || !siteId) {
    console.log('[admin-users] Missing NETLIFY_API_TOKEN or SITE_ID');
    return null;
  }

  // Use the Netlify API to generate a short-lived Identity admin token
  const res = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/identity/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${netlifyToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.log(`[admin-users] Failed to get admin token: ${res.status} ${errText}`);
    return null;
  }

  const data = await res.json();
  return data.token;
}

async function identityAdmin(method, path, body) {
  const adminToken = await getIdentityAdminToken();

  const url = `${IDENTITY_URL}/admin${path}`;
  const headers = { 'Content-Type': 'application/json' };

  if (adminToken) {
    headers['Authorization'] = `Bearer ${adminToken}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.log(`[admin-users] Identity API error: ${res.status} ${errText}`);
    throw new Error(`Identity API error: ${res.status}`);
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
      // List users via Identity Admin API
      try {
        const data = await identityAdmin('GET', '/users');
        return Response.json({ users: data.users || [] });
      } catch (err) {
        console.log(`[admin-users] Identity not available, returning empty: ${err.message}`);
        return Response.json({ users: [] });
      }
    }

    if (req.method === 'POST') {
      const body = await req.json();

      if (body.action === 'invite') {
        // Invite a user via Identity Admin API
        const result = await identityAdmin('POST', '/invite', {
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
