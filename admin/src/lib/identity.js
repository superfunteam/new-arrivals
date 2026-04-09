import GoTrue from 'gotrue-js';

// Initialize GoTrue client pointing at the site's Identity endpoint
const auth = new GoTrue({
  APIUrl: `${window.location.origin}/.netlify/identity`,
  setCookie: true,
});

export function getCurrentUser() {
  return auth.currentUser();
}

export async function loginWithEmail(email, password) {
  const user = await auth.login(email, password, true);
  return user;
}

export async function logout() {
  const user = auth.currentUser();
  if (user) {
    await user.logout();
  }
}

/**
 * Handle invite/confirmation/recovery tokens from the URL hash.
 * Call this on app init. Returns the token type if found, or null.
 */
export async function handleAuthCallback() {
  const hash = window.location.hash;
  if (!hash) return null;

  const params = new URLSearchParams(hash.substring(1));

  // Invite token — user needs to set password
  const inviteToken = params.get('invite_token');
  if (inviteToken) {
    return { type: 'invite', token: inviteToken };
  }

  // Confirmation token — auto-confirm
  const confirmToken = params.get('confirmation_token');
  if (confirmToken) {
    try {
      await auth.confirm(confirmToken, true);
      window.location.hash = '';
      return { type: 'confirmed' };
    } catch (err) {
      console.error('Confirmation failed:', err);
      return { type: 'error', message: err.message };
    }
  }

  // Recovery token
  const recoveryToken = params.get('recovery_token');
  if (recoveryToken) {
    try {
      const user = await auth.recover(recoveryToken, true);
      window.location.hash = '';
      return { type: 'recovery', user };
    } catch (err) {
      return { type: 'error', message: err.message };
    }
  }

  // Access token (from external provider or email link login)
  const accessToken = params.get('access_token');
  if (accessToken) {
    try {
      await auth.createUser({ access_token: accessToken }, true);
      window.location.hash = '';
      return { type: 'login' };
    } catch (err) {
      return { type: 'error', message: err.message };
    }
  }

  return null;
}

/**
 * Accept an invite by setting a password.
 */
export async function acceptInvite(token, password) {
  const user = await auth.acceptInvite(token, password, true);
  return user;
}

export { auth };
