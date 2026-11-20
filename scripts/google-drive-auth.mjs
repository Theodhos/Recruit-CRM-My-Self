// One-off helper: signs in to Google once and prints the refresh token for GOOGLE_DRIVE_REFRESH_TOKEN.
//
//   GOOGLE_DRIVE_CLIENT_ID=... GOOGLE_DRIVE_CLIENT_SECRET=... node scripts/google-drive-auth.mjs
//
// Needs an OAuth client of type "Web application" whose authorised redirect URI is http://localhost:53682/callback
// (Google Cloud Console -> APIs & Services -> Credentials), with the Google Drive API enabled.
import { createServer } from 'node:http';

const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET first.');
  process.exit(1);
}

const redirectUri = 'http://localhost:53682/callback';
const consentUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.file',
    access_type: 'offline',
    prompt: 'consent',
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, redirectUri);
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get('code');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: code ?? '',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data = await response.json();
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  if (data.refresh_token) {
    res.end('Done - you can close this tab and go back to the terminal.');
    console.log('\nGOOGLE_DRIVE_REFRESH_TOKEN=' + data.refresh_token + '\n');
  } else {
    res.end('No refresh token received - see the terminal.');
    console.error('Google answered:', data);
  }
  server.close();
});

server.listen(53682, () => {
  console.log('Open this address in the browser and allow access:\n\n' + consentUrl + '\n');
});
