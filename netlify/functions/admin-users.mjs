import { verifyToken } from './lib/auth.mjs';
import { getStore } from '@netlify/blobs';

const NETLIFY_API = 'https://api.netlify.com/api/v1';
const ROLES_STORE = 'user-roles';

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

  // One-time diagnostic: log all env vars related to identity/jwt
  if (req.method === 'GET' && new URL(req.url).searchParams.get('debug') === 'env') {
    const cookie = req.headers.get('cookie');
    if (!(await verifyToken(cookie))) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const allKeys = [];
    for (const key of ['GOTRUE_JWT_SECRET', 'JWT_SECRET', 'IDENTITY_JWT_SECRET', 'NETLIFY_IDENTITY_JWT_SECRET',
      'SITE_ID', 'NETLIFY_API_TOKEN', 'GOTRUE_URL', 'IDENTITY_URL', 'ROLES_KEY']) {
      const val = Netlify.env.get(key);
      allKeys.push({ key, set: !!val, preview: val ? val.slice(0, 8) + '...' : null });
    }
    // Also check context
    const ctxKeys = context ? Object.keys(context) : [];
    const clientCtx = context?.clientContext ? Object.keys(context.clientContext) : [];
    return Response.json({ env: allKeys, contextKeys: ctxKeys, clientContextKeys: clientCtx });
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

      // List all users — try Netlify API endpoints
      let users = [];
      const endpoints = [
        `/sites/${siteId}/identity/users`,
        `/sites/${siteId}/identity/users?per_page=100`,
        `/sites/${siteId}/members`,
      ];

      for (const ep of endpoints) {
        try {
          const data = await netlifyApi('GET', ep);
          users = Array.isArray(data) ? data : (data?.users || []);
          if (users.length > 0) {
            console.log(`[admin-users] Found ${users.length} users via ${ep}`);
            break;
          }
        } catch (err) {
          console.log(`[admin-users] ${ep} failed: ${err.message}`);
        }
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

        // Try Netlify API invite endpoint
        let invited = false;
        const inviteEndpoints = [
          `/sites/${siteId}/identity/users/invite`,
          `/sites/${siteId}/identity/invite`,
        ];

        for (const ep of inviteEndpoints) {
          try {
            const result = await netlifyApi('POST', ep, { email: body.email });
            console.log(`[admin-users] Invite succeeded via ${ep}`);
            invited = true;
            // Set role
            if (body.email) {
              await store.set(body.email, body.role || 'author');
            }
            return Response.json({ ok: true, user: result });
          } catch (err) {
            console.log(`[admin-users] Invite via ${ep} failed: ${err.message}`);
          }
        }

        // Fallback: just store the role and return success
        // The admin can manually add the user in Netlify Identity dashboard
        if (!invited && body.email) {
          await store.set(body.email, body.role || 'author');
          console.log(`[admin-users] Stored role for ${body.email}, but invite API failed. Use Netlify dashboard to invite.`);
          return Response.json({
            ok: true,
            warning: 'Role saved. Invite the user manually from Netlify Identity dashboard.',
          });
        }

        return Response.json({ error: 'Invite failed' }, { status: 500 });
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
