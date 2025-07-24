// githubCallback.js
export async function onRequest({ request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  const clientId = 'Ov23liRcioXspq2sqZpG';
  const clientSecret = 'daffff65aed35d9afcec94c44e326b06d3fbccb2';

  const tempStorage = global.tempStorage;

  // 1. Exchange code for access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  // 2. Fetch GitHub user info
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'EdgeoneForum',
    },
  });
  const githubUser = await userRes.json();

  if (!githubUser || !githubUser.login) {
    return new Response('Failed to fetch GitHub user', { status: 400 });
  }

  // 3. Check or create user in KV
  const username = `gh_${githubUser.login}`;
  let user = tempStorage.users.get(username);
  if (!user) {
    user = {
      username,
      email: githubUser.email || `${githubUser.login}@github.local`,
      bio: githubUser.bio || 'GitHub user',
    };
    tempStorage.users.set(username, user);
  }

  // 4. Create a simple token
  const mockToken = btoa(JSON.stringify({ username }));

  // 5. Redirect to index.html with query params
  const redirectUrl = `http://localhost:3001/index.html?token=${encodeURIComponent(mockToken)}&username=${encodeURIComponent(username)}`;

  return Response.redirect(redirectUrl, 302);
}
