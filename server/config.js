// workspace.json — everything a customer can customise, with defaults and validation.
import { hashSecret } from './util.js';

/** Every switchable feature, and which server actions it owns. */
export const FEATURES = {
  stickers: { label: 'Sticker wall & sticker mail', actions: ['sticker.', 'wall.add', 'mail.'] },
  notes: { label: 'Text notes on the wall', actions: ['wall.addNote'] },
  requests: { label: 'Request box (public & anonymous)', actions: ['request.'] },
  radio: { label: 'Radio: podcasts & music', actions: ['podcasts.', 'music.'] },
  tv: { label: 'TV: movies & series', actions: ['shows.'] },
  books: { label: 'Book club', actions: ['books.'] },
  places: { label: 'Top places (window)', actions: ['places.'] },
  giveaways: { label: 'Too Good To Go basket', actions: ['giveaways.'] },
  birthdays: { label: 'Birthday board & celebrations', actions: [] },
  games: { label: 'Game arcade & darts', actions: ['game.'] },
  jukebox: { label: 'Lo-fi jukebox', actions: ['jukebox.'] },
};

/** Which feature (if any) gates a server action. Actions owned by no feature are always allowed. */
export function featureForAction(type) {
  for (const [name, f] of Object.entries(FEATURES)) {
    if (f.actions.some((a) => (a.endsWith('.') ? type.startsWith(a) : type === a))) return name;
  }
  return null;
}

export const DEFAULT_THEME = {
  wall: '#f5e8d6',
  sideWall: '#efdcc6',
  wainscot: '#86a897',
  neon: '#ff6ec7',
  accent: '#7950f2',
};

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const RESERVED = new Set(['api', 'www', 'admin', 'app', 'platform', 'static', 'assets', 'mail', 'u', 'w', 'ws', 'socket', 'socket-io', 'vendor', 'default']);
const HEX = /^#[0-9a-f]{6}$/i;
const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export class ConfigError extends Error {}

const str = (v, max, label, { required = false } = {}) => {
  if (v == null || v === '') {
    if (required) throw new ConfigError(`${label} is required`);
    return '';
  }
  if (typeof v !== 'string') throw new ConfigError(`${label} must be text`);
  const s = v.trim();
  if (s.length > max) throw new ConfigError(`${label} must be at most ${max} characters`);
  return s;
};

export function validateSlug(slug, { allowReserved = false } = {}) {
  if (typeof slug !== 'string' || !SLUG.test(slug)) throw new ConfigError('Workspace id must be 1–40 lowercase letters, digits or dashes');
  if (!allowReserved && RESERVED.has(slug)) throw new ConfigError(`"${slug}" is reserved`);
  return slug;
}

/**
 * Build a complete, validated config from user input (plus an existing config when updating).
 * Plain-text `access.passcode` is accepted on input and stored only as a salted hash.
 */
export function normalizeConfig(input, existing = null) {
  const prev = existing || {};
  const inp = input || {};
  const brandIn = { ...(prev.brand || {}), ...(inp.brand || {}) };
  const themeIn = { ...DEFAULT_THEME, ...(prev.theme || {}), ...(inp.theme || {}) };
  const featuresIn = { ...Object.fromEntries(Object.keys(FEATURES).map((f) => [f, true])), ...(prev.features || {}), ...(inp.features || {}) };
  const accessIn = { ...(prev.access || {}), ...(inp.access || {}) };

  const name = str(inp.name ?? prev.name, 60, 'Workspace name', { required: true });
  const brand = {
    name: str(brandIn.name, 60, 'Brand name') || name,
    sign: str(brandIn.sign, 40, 'Neon sign text') || str(brandIn.name, 60, 'Brand name') || name,
    tagline: str(brandIn.tagline, 120, 'Tagline'),
    logo: str(brandIn.logo, 8, 'Logo emoji') || '🏢',
  };

  const theme = {};
  for (const key of Object.keys(DEFAULT_THEME)) {
    const v = themeIn[key];
    if (typeof v !== 'string' || !HEX.test(v)) throw new ConfigError(`theme.${key} must be a colour like #7950f2`);
    theme[key] = v.toLowerCase();
  }

  const features = {};
  for (const key of Object.keys(FEATURES)) features[key] = featuresIn[key] !== false;
  for (const key of Object.keys(inp.features || {})) {
    if (!FEATURES[key]) throw new ConfigError(`Unknown feature "${key}"`);
  }

  const domainsIn = inp.domains ?? prev.domains ?? [];
  if (!Array.isArray(domainsIn)) throw new ConfigError('domains must be a list');
  const domains = [...new Set(domainsIn.map((d) => String(d).trim().toLowerCase()))];
  for (const d of domains) if (!DOMAIN.test(d)) throw new ConfigError(`"${d}" is not a valid domain`);

  const adminsIn = accessIn.admins ?? [];
  if (!Array.isArray(adminsIn)) throw new ConfigError('access.admins must be a list of full names');
  const admins = adminsIn.map((a) => str(a, 81, 'Admin name')).filter(Boolean);

  let passcodeHash = accessIn.passcodeHash || null;
  if ('passcode' in (inp.access || {})) {
    const pc = inp.access.passcode;
    if (pc === null || pc === '') passcodeHash = null;
    else {
      if (typeof pc !== 'string' || pc.length < 4 || pc.length > 100) throw new ConfigError('Passcode must be 4–100 characters');
      passcodeHash = hashSecret(pc);
    }
  }

  const seats = inp.seats ?? prev.seats ?? 0;
  if (!Number.isInteger(seats) || seats < 0 || seats > 100000) throw new ConfigError('seats must be a whole number (0 = unlimited)');
  const plan = inp.plan ?? prev.plan ?? 'hosted';
  if (!['hosted', 'dedicated', 'trial'].includes(plan)) throw new ConfigError('plan must be hosted, dedicated or trial');

  return {
    name,
    brand,
    theme,
    features,
    domains,
    access: { passcodeHash, admins },
    plan,
    seats,
    disabled: Boolean(inp.disabled ?? prev.disabled ?? false),
    createdAt: prev.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
}

/** The part of the config that is safe to send to browsers. */
export function publicConfig(slug, cfg) {
  return {
    slug,
    officeName: cfg.brand.name,
    brand: cfg.brand,
    theme: cfg.theme,
    features: cfg.features,
    passcodeRequired: !!cfg.access.passcodeHash,
  };
}
