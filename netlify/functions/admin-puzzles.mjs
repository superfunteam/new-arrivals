import { verifyToken, authResponse } from './lib/auth.mjs';

export async function handler(event) {
  const isAuthed = await verifyToken(event.headers.cookie);
  if (!isAuthed) return authResponse(401, { error: 'Unauthorized' });

  // Stub — full implementation in Task 3
  return authResponse(200, { puzzles: [] });
}
