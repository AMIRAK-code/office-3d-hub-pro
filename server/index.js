// Entry point. Configure with environment variables (see docs/HOSTING.md):
//   MODE=single|hosted   single = one office (default); hosted = many workspaces
//   PORT, HOST, DATA_DIR, BASE_DOMAIN (hosted subdomains), PLATFORM_TOKEN (operator API),
//   TRUST_PROXY (e.g. 1 behind Caddy/nginx/Cloudflare Tunnel)
//   Single mode only, used once to seed the workspace: OFFICE_NAME, OFFICE_PASSCODE, OFFICE_ADMINS
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;
const mode = env.MODE === 'hosted' ? 'hosted' : 'single';
const PORT = Number(env.PORT) || 3000;
const HOST = env.HOST || '0.0.0.0';
const dataDir = path.resolve(env.DATA_DIR || path.join(ROOT, 'data'));
const trustProxy = env.TRUST_PROXY ? (/^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY) : false;

const { server, registry } = createApp({
  dataDir,
  mode,
  baseDomain: (env.BASE_DOMAIN || '').toLowerCase(),
  platformToken: env.PLATFORM_TOKEN || '',
  trustProxy,
  env,
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    registry.flushAll();
    process.exit(0);
  });
}

server.listen(PORT, HOST, () => {
  const lan = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => `http://${i.address}:${PORT}`);
  console.log(`\n  🏢 Office 3D Hub — ${mode === 'hosted' ? 'hosted (multi-workspace)' : 'single workspace'} mode\n`);
  console.log(`  Local:   http://localhost:${PORT}${mode === 'hosted' ? '/w/<workspace>/' : ''}`);
  for (const url of lan) console.log(`  Network: ${url}`);
  console.log(`  Data:    ${dataDir}`);
  if (mode === 'hosted') {
    const list = registry.list();
    console.log(`  Workspaces: ${list.length ? list.map((w) => w.slug).join(', ') : 'none yet — create one with  npm run workspace -- create <id> --name "Acme"'}`);
    if (!env.PLATFORM_TOKEN) console.log('  Operator API: off (set PLATFORM_TOKEN to enable /_platform/api)');
  } else {
    const ws = registry.get('default');
    console.log(ws.config().access.passcodeHash ? '  🔒 Passcode required to enter.' : '  🔓 No passcode (set one: npm run workspace -- set default --passcode "…").');
  }
  console.log('');
});
