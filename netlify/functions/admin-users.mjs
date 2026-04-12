import { verifyToken } from './lib/auth.mjs';
import { getStore } from '@netlify/blobs';

const NETLIFY_API = 'https://api.netlify.com/api/v1';
const HELPER_URL = 'https://game.vhsgarage.com/.netlify/functions/identity-helper';
const ROLES_STORE = 'user-roles';

/**
 * Call GoTrue admin API via the v1 identity-helper function,
 * which has access to a pre-signed admin JWT via clientContext.
 * We forward the user's Identity JWT so the helper gets the context.
 */
async function gotrueAdmin(method, path, body, identityJwt) {
  const url = `${HELPER_URL}?path=${encodeURIComponent(path)}`;
  const headers = { 'Content-Type': 'application/json' };
  if (identityJwt) {
    headers['Authorization'] = `Bearer ${identityJwt}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  console.log(`[admin-users] GoTrue ${method} ${path} → ${res.status}`);

  if (!res.ok) {
    console.log(`[admin-users] GoTrue error: ${text.slice(0, 200)}`);
    throw new Error(`GoTrue ${res.status}`);
  }

  return text ? JSON.parse(text) : null;
}

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

  // Diagnostic endpoint
  if (req.method === 'GET' && new URL(req.url).searchParams.get('debug') === 'env') {
    const cookie = req.headers.get('cookie');
    if (!(await verifyToken(cookie))) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Diagnostic only — confirm JWT secret is accessible
    const secret = await getGoTrueSecret();
    return Response.json({
      hasSecret: !!secret,
      secretPreview: secret ? secret.slice(0, 8) + '...' : null,
    });
  }

  const cookie = req.headers.get('cookie');
  if (!(await verifyToken(cookie))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { token, siteId } = getCredentials();
  if (!token || !siteId) {
    console.log(`[admin-users] Missing env: token=${!!token} siteId=${!!siteId}`);
    return Response.json({ users: [] });
  }

  const store = getStore(ROLES_STORE);

  try {
    if (req.method === 'GET') {
      // Check for ?email= param to get a single user's role
      const url = new URL(req.url);
      const emailParam = url.searchParams.get('email');
      if (emailParam) {
        let role = await store.get(emailParam, { type: 'text' });
        if (!role) {
          // Bootstrap: first user to check gets admin if no role is set
          role = 'admin';
          await store.set(emailParam, role);
          console.log(`[admin-users] Bootstrapped ${emailParam} as admin (first login)`);
        }
        return Response.json({ email: emailParam, role });
      }

      // List users via GoTrue admin API
      let users = [];
      try {
        const data = await gotrueAdmin('GET', '/users');
        users = data?.users || [];
        console.log(`[admin-users] Found ${users.length} users via GoTrue`);
      } catch (err) {
        console.log(`[admin-users] GoTrue list failed: ${err.message}`);
        // Fallback to Netlify API
        try {
          const data = await netlifyApi('GET', `/sites/${siteId}/members`);
          users = Array.isArray(data) ? data : [];
        } catch {}
      }

      // Enrich with roles from blob store
      // First user with no role set gets admin (bootstrap)
      let hasAnyAdmin = false;
      for (const user of users) {
        const email = user.email;
        if (email) {
          const role = await store.get(email, { type: 'text' });
          user.role = role || null;
          if (role === 'admin') hasAnyAdmin = true;
        }
      }
      // If no admin exists, make the first user admin
      if (!hasAnyAdmin && users.length > 0 && !users[0].role) {
        users[0].role = 'admin';
        await store.set(users[0].email, 'admin');
        console.log(`[admin-users] Bootstrapped ${users[0].email} as admin`);
      }
      // Default remaining null roles to author
      for (const user of users) {
        if (!user.role) user.role = 'author';
      }

      return Response.json({ users });
    }

    if (req.method === 'POST') {
      const body = await req.json();

      if (body.action === 'invite') {
        console.log(`[admin-users] Inviting ${body.email}...`);
        try {
          const result = await gotrueAdmin('POST', '/invite', { email: body.email });
          if (body.email) {
            await store.set(body.email, body.role || 'author');
          }
          console.log(`[admin-users] Invite sent to ${body.email}`);
          return Response.json({ ok: true, user: result });
        } catch (err) {
          console.log(`[admin-users] Invite failed: ${err.message}`);
          return Response.json({ error: 'Failed to send invite: ' + err.message }, { status: 500 });
        }
      }

      if (body.action === 'set-role') {
        const { email, role } = body;
        if (!email || !['admin', 'author'].includes(role)) {
          return Response.json({ error: 'Invalid email or role' }, { status: 400 });
        }
        await store.set(email, role);
        console.log(`[admin-users] Set role for ${email}: ${role}`);
        return Response.json({ ok: true, email, role });
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
