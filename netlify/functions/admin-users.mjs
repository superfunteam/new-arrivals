import { verifyToken } from './lib/auth.mjs';

const IDENTITY_URL = `https://game.vhsgarage.com/.netlify/identity`;

// Use the Netlify Identity Admin API
// Requires NETLIFY_API_TOKEN or site-level identity admin access
async function identityAdmin(method, path, body) {
  // The identity admin endpoint uses the site's identity URL
  const url = `${IDENTITY_URL}/admin${path}`;

  const headers = {
    'Content-Type': 'application/json',
  };

  // Try to use the NETLIFY_API_TOKEN if available for admin access
  const token = typeof Netlify !== 'undefined' && Netlify.env
    ? Netlify.env.get('IDENTITY_ADMIN_TOKEN')
    : process.env.IDENTITY_ADMIN_TOKEN;

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
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
