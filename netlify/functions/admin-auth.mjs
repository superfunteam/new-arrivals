import { createToken, authResponse } from './lib/auth.mjs';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return authResponse(405, { error: 'Method not allowed' });
  }

  const { password } = JSON.parse(event.body || '{}');

  if (password !== 'vhsgarage') {
    return authResponse(401, { error: 'Wrong password' });
  }

  const token = await createToken();

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `backroom_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`,
    },
    body: JSON.stringify({ ok: true }),
  };
}
