# Office 3D Hub

> Working product name. Change it in one place per workspace (`brand.name`), and in the ads via `marketing/ad/page/config.js`.

A white-label 3D office for remote and hybrid teams. People drop into a cosy shared room in the browser. They see each other's live cursors, put stickers and notes on the wall, recommend shows, podcasts, music, books and places, give things away, celebrate birthdays, play games together and share a lo-fi jukebox.

It is sold two ways from **one codebase**:

| | **Hosted** (SaaS) | **Dedicated** |
| --- | --- | --- |
| Who runs it | We do | Us or the customer, on their own server |
| Mode | `MODE=hosted`, many workspaces on one server | `MODE=single`, one workspace |
| Customer address | `acme.<our-domain>` or their own `office.acme.com` | Their own domain |
| Data | Separate folder per workspace, never shared | All on their machine |
| Guide | [docs/HOSTING.md](docs/HOSTING.md) | [docs/DEDICATED.md](docs/DEDICATED.md) |

Each customer's workspace is customized in `workspace.json`: brand name, neon-sign text, logo, colours, which rooms and features exist, passcode, admins and seat limit. See [docs/CUSTOMIZE.md](docs/CUSTOMIZE.md).

## Quick start

```bash
npm install
npm start                       # single office at http://localhost:3000
```

Try hosted mode locally:

```bash
MODE=hosted npm start                                        # (PowerShell: $env:MODE="hosted"; npm start)
npm run workspace -- create acme --name "Acme Studio" --accent "#e64980" --neon "#22d3ee"
# open http://localhost:3000/w/acme/
```

## What's inside

```
server/
  app.js         HTTP + Socket.IO app; resolves the workspace by custom domain, subdomain or /w/<id>/
  workspaces.js  workspace registry (lazy-loaded, live config reload, imports old Office Board data)
  config.js      workspace.json schema, defaults, validation, feature → action map
  hub.js         realtime hub, one per workspace (presence, cursors, every action, feature gate)
  routes.js      workspace API: config, sign-in, uploads
  platform.js    operator API for running the hosted service (token-protected)
  cli.js         `npm run workspace -- …` to create and configure workspaces
  store.js       per-workspace JSON store with atomic writes
public/          the 3D client (Three.js, no build step)
deploy/          Docker Compose + Caddy (automatic HTTPS, including customers' custom domains)
marketing/ad/    renders the 30-second ads from the real app (see its README)
test/            node:test suite: isolation, access, seats, feature gates, migration, game rules
```

## Guarantees (covered by `npm test`)

- **Isolation:** each workspace has its own data, sessions, uploads and realtime channel. A sign-in token from one workspace is rejected by every other.
- **Server-side feature gates:** a feature that's switched off is rejected by the server, not just hidden in the interface.
- **Access:** passcodes are stored only as salted scrypt hashes, with repeated wrong guesses blocked. Seat limits stop new sign-ups but never lock out existing members.
- **Upgrades:** an existing Office Board `data/` folder is imported automatically in single mode, and the originals are left untouched.

```bash
npm test
```

## Licence

Proprietary — see [LICENSE](LICENSE). Not open source.
