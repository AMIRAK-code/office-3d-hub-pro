// Hosted (multi-workspace) mode: the guarantees paying customers rely on.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, wait } from './helpers.js';

const TOKEN = 'operator-secret-token';
let srv;
const login = (slug, firstName, lastName, extra = {}) => srv.api('POST', `/w/${slug}/api/login`, { body: { firstName, lastName, ...extra } });

before(async () => {
  srv = await startServer({ mode: 'hosted', platformToken: TOKEN, baseDomain: 'hub.test' });
});
after(() => srv.close());

test('operator API requires the platform token', async () => {
  assert.equal((await srv.api('GET', '/_platform/api/workspaces')).status, 401);
  assert.equal((await srv.api('GET', '/_platform/api/workspaces', { token: 'wrong' })).status, 401);
  assert.equal((await srv.api('GET', '/_platform/api/workspaces', { token: TOKEN })).status, 200);
});

test('operator creates workspaces with their own branding', async () => {
  const a = await srv.api('POST', '/_platform/api/workspaces', { token: TOKEN, body: { slug: 'acme', name: 'Acme Studio', brand: { sign: 'Acme HQ' }, theme: { accent: '#e64980' }, domains: ['office.acme.test'] } });
  assert.equal(a.status, 201, a.text);
  assert.equal(a.json.brand.sign, 'Acme HQ');
  assert.equal(a.json.access.passcodeSet, false);
  const b = await srv.api('POST', '/_platform/api/workspaces', { token: TOKEN, body: { slug: 'beta', name: 'Beta Labs' } });
  assert.equal(b.status, 201);
  assert.equal((await srv.api('POST', '/_platform/api/workspaces', { token: TOKEN, body: { slug: 'acme', name: 'Again' } })).status, 400);
  assert.equal((await srv.api('POST', '/_platform/api/workspaces', { token: TOKEN, body: { slug: 'Bad Slug!', name: 'X' } })).status, 400);
  const dupDomain = await srv.api('POST', '/_platform/api/workspaces', { token: TOKEN, body: { slug: 'copycat', name: 'X', domains: ['office.acme.test'] } });
  assert.equal(dupDomain.status, 400);
  assert.match(dupDomain.json.error, /already used/);
});

test('each workspace page is branded and knows its own id', async () => {
  const page = await srv.api('GET', '/w/acme/');
  assert.equal(page.status, 200);
  assert.match(page.text, /<title>Acme Studio<\/title>/);
  assert.match(page.text, /window\.__WS = \{"slug":"acme","base":"\/w\/acme\/"\}/);
  const cfg = await srv.api('GET', '/w/acme/api/config');
  assert.equal(cfg.json.brand.sign, 'Acme HQ');
  assert.equal(cfg.json.theme.accent, '#e64980');
  assert.equal((await srv.api('GET', '/w/nope/')).status, 404);
  assert.equal((await srv.api('GET', '/w/nope/api/config')).status, 404);
});

test('custom domains and subdomains reach the right workspace', async () => {
  const custom = await srv.getWithHost('/', 'office.acme.test');
  assert.equal(custom.status, 200);
  assert.match(custom.text, /"slug":"acme","base":"\/"/);
  const sub = await srv.getWithHost('/', 'beta.hub.test');
  assert.match(sub.text, /"slug":"beta"/);
  assert.equal((await srv.getWithHost('/', 'ghost.hub.test')).status, 404);
  assert.equal((await srv.getWithHost('/', 'random.example')).status, 404);
});

test('TLS check only approves domains of real workspaces', async () => {
  assert.equal((await srv.api('GET', '/_platform/tls-check?domain=office.acme.test')).status, 200);
  assert.equal((await srv.api('GET', '/_platform/tls-check?domain=beta.hub.test')).status, 200);
  assert.equal((await srv.api('GET', '/_platform/tls-check?domain=ghost.hub.test')).status, 404);
  assert.equal((await srv.api('GET', '/_platform/tls-check?domain=evil.example')).status, 404);
});

test('workspaces are isolated: sessions, data and realtime', async () => {
  const jane = await login('acme', 'Jane', 'Doe');
  assert.equal(jane.status, 200);
  assert.equal((await srv.api('GET', '/w/acme/api/me', { token: jane.json.token })).status, 200);
  assert.equal((await srv.api('GET', '/w/beta/api/me', { token: jane.json.token })).status, 401, 'acme token must not work in beta');

  const bob = await login('beta', 'Bob', 'Smith');
  await assert.rejects(srv.socket('beta', jane.json.token), /unauthorized/);
  const A = await srv.socket('acme', jane.json.token);
  const B = await srv.socket('beta', bob.json.token);
  assert.deepEqual(B.init.cols.users.map((u) => u.firstName), ['Bob']);

  let leaked = false;
  B.socket.on('col:upsert', ({ col }) => {
    if (col === 'podcasts') leaked = true;
  });
  const res = await srv.act(A.socket, 'podcasts.add', { title: 'Acme internal pod' });
  assert.equal(res.ok, true);
  await wait(150);
  assert.equal(leaked, false, 'beta must never see acme events');
});

test('turned-off features are rejected by the server, not just hidden', async () => {
  const off = await srv.api('PATCH', '/_platform/api/workspaces/acme', { token: TOKEN, body: { features: { giveaways: false, stickers: false } } });
  assert.equal(off.json.features.giveaways, false);
  const jane = await login('acme', 'Jane', 'Doe');
  const { socket } = await srv.socket('acme', jane.json.token);
  const give = await srv.act(socket, 'giveaways.add', { title: 'Lamp' });
  assert.equal(give.ok, false);
  assert.match(give.error, /turned off/);
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const up = await srv.api('POST', '/w/acme/api/upload', { token: jane.json.token, body: { kind: 'sticker', dataUrl: png } });
  assert.equal(up.status, 403);
  assert.equal((await srv.act(socket, 'profile.update', { mood: '☕' })).ok, true, 'core actions still work');
  await srv.api('PATCH', '/_platform/api/workspaces/acme', { token: TOKEN, body: { features: { giveaways: true, stickers: true } } });
});

test('config changes reach connected browsers live', async () => {
  const jane = await login('acme', 'Jane', 'Doe');
  const { socket } = await srv.socket('acme', jane.json.token);
  const changed = new Promise((r) => socket.once('config:changed', r));
  await srv.api('PATCH', '/_platform/api/workspaces/acme', { token: TOKEN, body: { brand: { tagline: 'Hello' } } });
  await changed;
});

test('passcode protects a workspace', async () => {
  await srv.api('PATCH', '/_platform/api/workspaces/beta', { token: TOKEN, body: { access: { passcode: 'beta-pass' } } });
  assert.equal((await srv.api('GET', '/w/beta/api/config')).json.passcodeRequired, true);
  assert.equal((await login('beta', 'Eve', 'X')).status, 401);
  assert.equal((await login('beta', 'Eve', 'X', { passcode: 'nope' })).status, 401);
  assert.equal((await login('beta', 'Eve', 'X', { passcode: 'beta-pass' })).status, 200);
  const shown = await srv.api('GET', '/_platform/api/workspaces/beta', { token: TOKEN });
  assert.equal(shown.json.access.passcodeSet, true);
  assert.ok(!shown.text.includes('scrypt'), 'operator API never returns the hash');
});

test('seat limits stop new people, not returning ones', async () => {
  await srv.api('PATCH', '/_platform/api/workspaces/beta', { token: TOKEN, body: { seats: 2, access: { passcode: '' } } });
  // Bob and Eve already exist → workspace full.
  const full = await login('beta', 'New', 'Person');
  assert.equal(full.status, 403);
  assert.match(full.json.error, /seat limit/);
  assert.equal((await login('beta', 'Bob', 'Smith')).status, 200);
});

test('uploads are served only from their own workspace', async () => {
  const jane = await login('acme', 'Jane', 'Doe');
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const up = await srv.api('POST', '/w/acme/api/upload', { token: jane.json.token, body: { kind: 'avatar', dataUrl: png } });
  assert.equal(up.status, 200);
  assert.match(up.json.url, /^\/u\/acme\/[a-z0-9]+\.png$/);
  assert.equal((await fetch(srv.base + up.json.url)).status, 200);
  assert.equal((await fetch(srv.base + up.json.url.replace('/u/acme/', '/u/beta/'))).status, 404);
  assert.equal((await fetch(`${srv.base}/u/acme/..%2Fworkspace.json`)).status, 404);
});

test('disabled workspaces go dark', async () => {
  await srv.api('PATCH', '/_platform/api/workspaces/beta', { token: TOKEN, body: { disabled: true } });
  assert.equal((await srv.api('GET', '/w/beta/')).status, 404);
  assert.equal((await login('beta', 'Bob', 'Smith')).status, 404);
  await srv.api('PATCH', '/_platform/api/workspaces/beta', { token: TOKEN, body: { disabled: false } });
  assert.equal((await srv.api('GET', '/w/beta/')).status, 200);
});
