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

export async function listUsers(adminToken) {
  // This requires admin access — use the Netlify API via our function
  return null; // Handled via admin-users function
}

export { auth };
