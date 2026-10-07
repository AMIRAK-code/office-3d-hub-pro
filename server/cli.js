// Manage workspaces from the command line (works for hosted and single installs).
//
//   npm run workspace -- list
//   npm run workspace -- show acme
//   npm run workspace -- create acme --name "Acme Studio" [--sign "Acme HQ"] [--domain office.acme.com] [--seats 50]
//   npm run workspace -- set acme --accent "#e64980" --neon "#00e5ff" --passcode "secret" --admin "Jane Doe"
//   npm run workspace -- set acme --disable-feature giveaways --enable-feature jukebox
//   npm run workspace -- disable acme   |   enable acme
//
// A running server picks up changes within a couple of seconds; open browsers reload to apply them.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRegistry } from './workspaces.js';
import { FEATURES, ConfigError } from './config.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = createRegistry({ dataDir: path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data')) });

const [cmd, slug, ...rest] = process.argv.slice(2);
const flags = {};
for (let i = 0; i < rest.length; i++) {
  const k = rest[i].replace(/^--/, '');
  const v = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true;
  (flags[k] ||= []).push(v);
}
const one = (k) => flags[k]?.at(-1);

function toInput(base = {}) {
  const input = { brand: {}, theme: {}, features: {}, access: {} };
  if (one('name')) input.name = one('name');
  if (one('brand')) input.brand.name = one('brand');
  if (one('sign')) input.brand.sign = one('sign');
  if (one('tagline')) input.brand.tagline = one('tagline');
  if (one('logo')) input.brand.logo = one('logo');
  for (const t of ['accent', 'neon', 'wall', 'sideWall', 'wainscot']) if (one(t)) input.theme[t] = one(t);
  for (const f of flags['enable-feature'] || []) input.features[f] = true;
  for (const f of flags['disable-feature'] || []) input.features[f] = false;
  if (one('passcode') !== undefined) input.access.passcode = one('passcode') === true ? '' : one('passcode');
  if (flags.admin) input.access.admins = [...new Set([...(base.access?.admins || []), ...flags.admin])];
  if (flags.domain) input.domains = [...new Set([...(base.domains || []), ...flags.domain])];
  if (one('seats')) input.seats = Number(one('seats'));
  if (one('plan')) input.plan = one('plan');
  return input;
}

function print(ws) {
  const { access, ...cfg } = ws.config();
  console.log(JSON.stringify({ slug: ws.slug, ...cfg, access: { admins: access.admins, passcodeSet: !!access.passcodeHash } }, null, 2));
}

try {
  switch (cmd) {
    case 'list':
      for (const w of registry.list()) console.log(`${w.disabled ? '⏸' : '●'} ${w.slug.padEnd(20)} ${w.name}${w.domains?.length ? `  (${w.domains.join(', ')})` : ''}`);
      break;
    case 'show':
      print(registry.get(slug) || (() => { throw new ConfigError(`No workspace "${slug}"`); })());
      break;
    case 'create':
      print(registry.create(slug, { ...toInput(), name: one('name') || slug }));
      break;
    case 'set':
      print(registry.update(slug, toInput(registry.get(slug)?.config())));
      break;
    case 'disable':
    case 'enable':
      print(registry.update(slug, { disabled: cmd === 'disable' }));
      break;
    default:
      console.log('Commands: list | show <id> | create <id> --name "…" | set <id> [flags] | disable <id> | enable <id>');
      console.log(`Features: ${Object.keys(FEATURES).join(', ')}`);
  }
} catch (err) {
  if (!(err instanceof ConfigError)) throw err;
  console.error(`✗ ${err.message}`);
  process.exitCode = 1;
}
