import { createToken } from './lib/auth.mjs';

export default async (req, context) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const { password } = await req.json();

  if (password !== 'vhsgarage') {
    return Response.json({ error: 'Wrong password' }, { status: 401 });
  }

  const token = await createToken();

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `backroom_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`,
    },
  });
};

export const config = {
  path: '/api/admin-auth',
};
