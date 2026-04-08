import { SignJWT, jwtVerify } from 'jose';

const SECRET = () => new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || 'dev-secret');

export async function createToken() {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(SECRET());
}

export async function verifyToken(cookieHeader) {
  if (!cookieHeader) return false;
  const match = cookieHeader.match(/backroom_session=([^;]+)/);
  if (!match) return false;
  try {
    await jwtVerify(match[1], SECRET());
    return true;
  } catch {
    return false;
  }
}

export function authResponse(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
