import { SignJWT } from 'jose';
import { verifyToken as verifyAdminToken } from './lib/auth.mjs';

const IDENTITY_URL = 'https://game.vhsgarage.com/.netlify/identity';

/**
 * Generate a GoTrue admin JWT signed with the Identity JWT secret.
 * GoTrue accepts any valid JWT with role=admin signed with its secret.
 */
async function makeGoTrueAdminToken() {
  // Netlify auto-injects this for sites with Identity enabled
  const jwtSecret = Netlify.env.get('GOTRUE_JWT_SECRET');
  if (!jwtSecret) {
    console.log('[admin-users] GOTRUE_JWT_SECRET not set — check Identity settings');
    return null;
  }

  const secret = new TextEncoder().encode(jwtSecret);
  const token = await new SignJWT({
    role: 'admin',
    aud: '',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);

  return token;
}

async function gotrueAdmin(method, path, body) {
  const token = await makeGoTrueAdminToken();
  if (!token) return null;

  const url = `${IDENTITY_URL}/admin${path}`;
  console.log(`[admin-users] GoTrue ${method} ${url}`);

  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const resBody = await res.text();
  console.log(`[admin-users] GoTrue response: ${res.status} (${resBody.length} bytes)`);

  if (!res.ok) {
    console.log(`[admin-users] GoTrue error: ${resBody.slice(0, 300)}`);
    throw new Error(`GoTrue ${res.status}: ${resBody.slice(0, 100)}`);
  }

  return JSON.parse(resBody);
}

export default async (req, context) => {
  console.log(`[admin-users] ${req.method} ${req.url}`);

  const cookie = req.headers.get('cookie');
  if (!(await verifyAdminToken(cookie))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (req.method === 'GET') {
      const data = await gotrueAdmin('GET', '/users');
      return Response.json({ users: data?.users || [] });
    }

    if (req.method === 'POST') {
      const body = await req.json();

      if (body.action === 'invite') {
        const result = await gotrueAdmin('POST', '/invite', { email: body.email });
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
