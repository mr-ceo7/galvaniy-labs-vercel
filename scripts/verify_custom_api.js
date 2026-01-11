// Simple local verification of getApiBaseUrl behavior from services/customApiService.ts

function getApiBaseUrlMock({settingsCustomApiUrl, stored, envVar, protocol}) {
  let cachedApiUrl = null;

  if (settingsCustomApiUrl) {
    cachedApiUrl = settingsCustomApiUrl;
  } else if (stored) {
    cachedApiUrl = stored;
  } else if (envVar) {
    cachedApiUrl = envVar;
  } else {
    cachedApiUrl = 'http://localhost:5000';
  }

  if (protocol === 'https' && cachedApiUrl && cachedApiUrl.startsWith('http:')) {
    console.warn('[Mock] Insecure HTTP API detected while on HTTPS; using Vercel proxy (relative /api path).');
    return '';
  }

  return cachedApiUrl;
}

const cases = [
  {name: 'HTTPS with HTTP API (should proxy -> empty)', settings: 'http://102.37.19.54:8000', stored: null, env: null, protocol: 'https'},
  {name: 'HTTP with HTTP API (no proxy)', settings: 'http://102.37.19.54:8000', stored: null, env: null, protocol: 'http'},
  {name: 'HTTPS with HTTPS API (no proxy)', settings: 'https://example.com', stored: null, env: null, protocol: 'https'},
  {name: 'No config, HTTPS (fallback http localhost -> proxy)', settings: null, stored: null, env: null, protocol: 'https'},
];

console.log('Verifying getApiBaseUrl behavior (mock)...\n');

for (const c of cases) {
  const result = getApiBaseUrlMock({settingsCustomApiUrl: c.settings, stored: c.stored, envVar: c.env, protocol: c.protocol});
  console.log(`${c.name}\n  protocol=${c.protocol} settings=${c.settings} => result='${result}'\n`);
}

console.log('Done.');
