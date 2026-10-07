// Workspace registry: every customer office is a folder under DATA_DIR/workspaces/<slug>/
// holding workspace.json (config), db.json (data) and uploads/. Loaded lazily, cached.
import fs from 'node:fs';
import path from 'node:path';
import { openStore } from './store.js';
import { createHub } from './hub.js';
import { normalizeConfig, validateSlug, ConfigError } from './config.js';

export const DEFAULT_SLUG = 'default';

function writeJson(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  try {
    fs.renameSync(tmp, file);
  } catch {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  }
}

export function createRegistry({ dataDir }) {
  const root = path.join(dataDir, 'workspaces');
  fs.mkdirSync(root, { recursive: true });
  const cache = new Map();
  let domainMap = null;

  const dirOf = (slug) => path.join(root, slug);
  const cfgFile = (slug) => path.join(dirOf(slug), 'workspace.json');

  function readConfig(slug) {
    try {
      return JSON.parse(fs.readFileSync(cfgFile(slug), 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  const mtimeOf = (slug) => {
    try {
      return fs.statSync(cfgFile(slug)).mtimeMs;
    } catch {
      return 0;
    }
  };
  /** Pick up edits made outside this process (e.g. the CLI) — checked at most every 2 s. */
  function refreshIfChanged(ws) {
    if (Date.now() - ws.checkedAt < 2000) return;
    ws.checkedAt = Date.now();
    const m = mtimeOf(ws.slug);
    if (m === ws.mtime) return;
    ws.mtime = m;
    const cfg = readConfig(ws.slug);
    if (!cfg) return;
    ws.setConfig(cfg);
    domainMap = null;
    if (ws.loadedHub) {
      if (cfg.disabled) ws.loadedHub.disconnectAll();
      else ws.loadedHub.configChanged();
    }
  }

  function wrap(slug, cfg) {
    let store = null;
    let hub = null;
    const ws = {
      slug,
      dir: dirOf(slug),
      config: () => cfg,
      setConfig(next) {
        cfg = next;
      },
      get store() {
        store ||= openStore(dirOf(slug));
        return store;
      },
      get hub() {
        hub ||= createHub(ws);
        return hub;
      },
      get loadedHub() {
        return hub;
      },
      get loadedStore() {
        return store;
      },
      /** Seats: 0 = unlimited. */
      seatsLeft() {
        const seats = cfg.seats || 0;
        return seats === 0 ? Infinity : seats - Object.keys(ws.store.db.users).length;
      },
    };
    return ws;
  }

  const registry = {
    root,
    /** The workspace with this slug, or null. */
    get(slug) {
      if (typeof slug !== 'string') return null;
      if (cache.has(slug)) {
        const ws = cache.get(slug);
        refreshIfChanged(ws);
        return ws;
      }
      try {
        validateSlug(slug, { allowReserved: slug === DEFAULT_SLUG });
      } catch {
        return null;
      }
      const cfg = readConfig(slug);
      if (!cfg) return null;
      const ws = wrap(slug, cfg);
      ws.mtime = mtimeOf(slug);
      ws.checkedAt = Date.now();
      cache.set(slug, ws);
      return ws;
    },
    list() {
      return fs.readdirSync(root, { withFileTypes: true })
        .filter((d) => d.isDirectory() && fs.existsSync(cfgFile(d.name)))
        .map((d) => ({ slug: d.name, ...readConfig(d.name) }));
    },
    create(slug, input, { allowReserved = false } = {}) {
      validateSlug(slug, { allowReserved });
      if (fs.existsSync(cfgFile(slug))) throw new ConfigError(`Workspace "${slug}" already exists`);
      const cfg = normalizeConfig(input);
      registry.assertDomainsFree(slug, cfg.domains);
      fs.mkdirSync(dirOf(slug), { recursive: true });
      writeJson(cfgFile(slug), cfg);
      domainMap = null;
      return registry.get(slug);
    },
    update(slug, input) {
      const ws = registry.get(slug);
      if (!ws) throw new ConfigError(`No workspace "${slug}"`);
      const cfg = normalizeConfig(input, ws.config());
      registry.assertDomainsFree(slug, cfg.domains);
      writeJson(cfgFile(slug), cfg);
      ws.setConfig(cfg);
      ws.mtime = mtimeOf(slug);
      domainMap = null;
      if (ws.loadedHub) {
        if (cfg.disabled) ws.loadedHub.disconnectAll();
        else ws.loadedHub.configChanged();
      }
      return ws;
    },
    assertDomainsFree(slug, domains) {
      const map = registry.domains();
      for (const d of domains) {
        if (map.has(d) && map.get(d) !== slug) throw new ConfigError(`Domain ${d} is already used by "${map.get(d)}"`);
      }
    },
    /** Custom domain → slug. */
    domains() {
      if (!domainMap) {
        domainMap = new Map();
        for (const w of registry.list()) for (const d of w.domains || []) domainMap.set(d, w.slug);
      }
      return domainMap;
    },
    flushAll() {
      for (const ws of cache.values()) ws.loadedStore?.flush();
    },
  };
  return registry;
}

/**
 * Single-workspace (dedicated) installs: make sure the "default" workspace exists.
 * Seeds it from environment variables, and imports a pre-workspace Office Board data folder
 * (DATA_DIR/db.json + DATA_DIR/uploads) if one is found, rewriting its image URLs.
 */
export function ensureDefaultWorkspace(registry, { dataDir, env = process.env }) {
  if (registry.get(DEFAULT_SLUG)) return registry.get(DEFAULT_SLUG);
  const admins = (env.OFFICE_ADMINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const name = (env.OFFICE_NAME || 'Office 3D Hub').trim();
  const input = { name, brand: { name }, access: { admins } };
  if (env.OFFICE_PASSCODE) input.access.passcode = env.OFFICE_PASSCODE;
  const ws = registry.create(DEFAULT_SLUG, { ...input, plan: 'dedicated' }, { allowReserved: true });

  const legacyDb = path.join(dataDir, 'db.json');
  if (fs.existsSync(legacyDb)) {
    const json = fs.readFileSync(legacyDb, 'utf8').replaceAll('"/uploads/', `"/u/${DEFAULT_SLUG}/`);
    fs.writeFileSync(path.join(ws.dir, 'db.json'), json);
    const legacyUploads = path.join(dataDir, 'uploads');
    if (fs.existsSync(legacyUploads)) fs.cpSync(legacyUploads, path.join(ws.dir, 'uploads'), { recursive: true });
    console.log(`  ↪ Imported the existing office data from ${legacyDb} into workspace "${DEFAULT_SLUG}" (originals left untouched).`);
  }
  return ws;
}
