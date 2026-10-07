// Operator API for running the hosted service: create, inspect, update and disable workspaces.
// Enabled only when PLATFORM_TOKEN is set. Every call needs  Authorization: Bearer <PLATFORM_TOKEN>.
import express from 'express';
import { safeEqual } from './util.js';
import { ConfigError, FEATURES } from './config.js';

/** Config as shown to the operator: never the passcode hash itself. */
function adminView(registry, slug) {
  const ws = registry.get(slug);
  if (!ws) return null;
  const { access, ...cfg } = ws.config();
  const stats = ws.loadedStore
    ? { users: Object.keys(ws.store.db.users).length, onlineNow: ws.loadedHub ? ws.loadedHub.online.size : 0 }
    : null;
  return { slug, ...cfg, access: { admins: access.admins, passcodeSet: !!access.passcodeHash }, stats };
}

export function platformApi(registry, { token }) {
  const r = express.Router();
  r.use((req, res, next) => {
    const auth = req.get('authorization') || '';
    if (!token || !auth.startsWith('Bearer ') || !safeEqual(auth.slice(7), token)) return res.status(401).json({ error: 'Unauthorized' });
    next();
  });
  const handle = (fn) => (req, res) => {
    try {
      fn(req, res);
    } catch (err) {
      if (err instanceof ConfigError) return res.status(400).json({ error: err.message });
      console.error(err);
      res.status(500).json({ error: 'Something went wrong' });
    }
  };

  r.get('/features', (req, res) => res.json(Object.fromEntries(Object.entries(FEATURES).map(([k, f]) => [k, f.label]))));
  r.get('/workspaces', handle((req, res) => res.json(registry.list().map((w) => adminView(registry, w.slug)))));
  r.get('/workspaces/:slug', handle((req, res) => {
    const view = adminView(registry, req.params.slug);
    if (!view) return res.status(404).json({ error: 'No such workspace' });
    res.json(view);
  }));
  r.post('/workspaces', handle((req, res) => {
    const { slug, ...config } = req.body || {};
    registry.create(slug, config);
    res.status(201).json(adminView(registry, slug));
  }));
  r.patch('/workspaces/:slug', handle((req, res) => {
    registry.update(req.params.slug, req.body || {});
    res.json(adminView(registry, req.params.slug));
  }));
  return r;
}
