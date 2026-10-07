// The Office 3D Hub server: serves every workspace (hosted mode) or one (single/dedicated mode).
//
// Workspace resolution (hosted mode), first match wins:
//   1. custom domain   office.acme.com            → the workspace that lists it in "domains"
//   2. subdomain       acme.<BASE_DOMAIN>          → workspace "acme"
//   3. path            /w/acme/                     → workspace "acme" (handy locally)
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { createRegistry, ensureDefaultWorkspace, DEFAULT_SLUG } from './workspaces.js';
import { workspaceApi } from './routes.js';
import { platformApi } from './platform.js';
import { MAX_UPLOAD_BYTES, UPLOAD_FILE } from './uploads.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * options: { dataDir, mode: 'single' | 'hosted', baseDomain, platformToken, trustProxy, env }
 * Returns { app, server, io, registry } — call server.listen() yourself.
 */
export function createApp(options) {
  const { dataDir, mode = 'single', baseDomain = '', platformToken = '', trustProxy = false, env = process.env } = options;
  const registry = createRegistry({ dataDir });
  if (mode === 'single') ensureDefaultWorkspace(registry, { dataDir, env });

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 1e6 });
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', trustProxy);
  app.use(express.json({ limit: Math.ceil(MAX_UPLOAD_BYTES * 1.4) }));

  const indexHtml = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  const page = (ws, base) => indexHtml
    .replace('<title>Office 3D Hub</title>', `<title>${escapeHtml(ws.config().brand.name)}</title>`)
    .replace('<!--WORKSPACE-->', `<script>window.__WS = ${JSON.stringify({ slug: ws.slug, base })};</script>`);

  // ---------- which workspace is this request for? ----------
  function fromHost(req) {
    if (mode === 'single') return registry.get(DEFAULT_SLUG);
    const host = (req.hostname || '').toLowerCase();
    const bySlug = registry.domains().get(host);
    if (bySlug) return registry.get(bySlug);
    if (baseDomain && host.endsWith(`.${baseDomain}`)) {
      const sub = host.slice(0, -(baseDomain.length + 1));
      if (!sub.includes('.')) return registry.get(sub);
    }
    return null;
  }
  const usable = (ws) => ws && !ws.config().disabled;
  const notFound = (res) => res.status(404).type('html').send(NOT_FOUND_HTML);

  // ---------- shared static assets ----------
  app.use(express.static(path.join(ROOT, 'public'), { index: false }));
  app.use('/vendor/three/build', express.static(path.join(ROOT, 'node_modules/three/build'), { maxAge: '7d' }));
  app.use('/vendor/three/addons', express.static(path.join(ROOT, 'node_modules/three/examples/jsm'), { maxAge: '7d' }));
  app.get('/u/:slug/:file', (req, res) => {
    const ws = registry.get(req.params.slug);
    if (!usable(ws) || !UPLOAD_FILE.test(req.params.file)) return res.status(404).end();
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(path.join(ws.store.uploadDir, req.params.file), { maxAge: '30d', immutable: true }, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  });

  // ---------- operator API ----------
  if (platformToken) app.use('/_platform/api', platformApi(registry, { token: platformToken }));

  // Caddy "on-demand TLS" asks here before issuing a certificate for a domain, so certificates
  // are only ever requested for domains that belong to a real, active workspace.
  app.get('/_platform/tls-check', (req, res) => {
    const domain = String(req.query.domain || '').toLowerCase();
    const slug = registry.domains().get(domain)
      || (baseDomain && domain.endsWith(`.${baseDomain}`) ? domain.slice(0, -(baseDomain.length + 1)) : null);
    res.status(usable(registry.get(slug)) ? 200 : 404).end();
  });

  // ---------- workspace pages & API ----------
  const api = workspaceApi();
  app.use('/w/:slug/api', (req, res, next) => {
    if (mode === 'single') return notFound(res);
    const ws = registry.get(req.params.slug);
    if (!usable(ws)) return res.status(404).json({ error: 'Workspace not found' });
    req.ws = ws;
    api(req, res, next);
  });
  app.get(['/w/:slug', '/w/:slug/'], (req, res) => {
    if (mode === 'single') return notFound(res);
    const ws = registry.get(req.params.slug);
    if (!usable(ws)) return notFound(res);
    if (!req.path.endsWith('/')) return res.redirect(301, `/w/${ws.slug}/`);
    res.type('html').send(page(ws, `/w/${ws.slug}/`));
  });
  app.use('/api', (req, res, next) => {
    const ws = fromHost(req);
    if (!usable(ws)) return res.status(404).json({ error: 'Workspace not found' });
    req.ws = ws;
    api(req, res, next);
  });
  app.get('/', (req, res) => {
    const ws = fromHost(req);
    if (!usable(ws)) return notFound(res);
    res.type('html').send(page(ws, '/'));
  });

  app.use((err, req, res, next) => {
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'That image is too large (max 2.5 MB).' });
    next(err);
  });

  // ---------- realtime: one namespace per workspace (/ws/<slug>) ----------
  const workspaces = io.of(/^\/ws\/[a-z0-9-]+$/);
  workspaces.use((socket, next) => {
    const ws = registry.get(socket.nsp.name.slice(4));
    if (!usable(ws)) return next(new Error('unauthorized'));
    if (mode === 'single' && ws.slug !== DEFAULT_SLUG) return next(new Error('unauthorized'));
    socket.data.ws = ws;
    ws.hub.authenticate(socket, next);
  });
  workspaces.on('connection', (socket) => socket.data.ws.hub.attach(socket));

  return { app, server, io, registry };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const NOT_FOUND_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Workspace not found</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#2b2440;color:#fff;text-align:center}
main{padding:24px}h1{font-size:28px;margin:12px 0 6px}p{opacity:.75}</style></head>
<body><main><div style="font-size:56px">🏢</div><h1>Workspace not found</h1><p>Check the address, or ask your office admin for the right link.</p></main></body></html>`;
