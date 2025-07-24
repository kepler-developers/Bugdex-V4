// githubLogin.js
export async function onRequest({ request }) {
  const clientId = 'Ov23liRcioXspq2sqZpG';
  const redirectUri = 'http://localhost:3001/api/auth/github/callback';
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user`;

  return Response.redirect(githubAuthUrl, 302);
}
