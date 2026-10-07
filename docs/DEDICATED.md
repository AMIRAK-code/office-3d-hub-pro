# Dedicated install (one office)

For customers who want their own server, or for our own office. Runs in `MODE=single` (the default) with one workspace.

## Option A: Docker + Caddy (recommended)
1. A small VM (1 vCPU / 1 GB is plenty for one office), with a DNS record such as `office.acme.com` pointing at it.
2. `cp .env.example .env`, then set `OFFICE_NAME`, `OFFICE_PASSCODE` and `OFFICE_ADMINS`. These are used **once**, to create the workspace. Afterwards, change things with the CLI.
3. In `deploy/Caddyfile`, delete the on-demand block and use the `office.acme.com { reverse_proxy app:3000 }` example.
4. `cd deploy && docker compose up -d`.

## Option B: a machine in the office + Cloudflare Tunnel (no open ports)
1. Install Node 20+ and run `npm ci --omit=dev`, then `npm start` (use a service manager such as pm2 or NSSM so it restarts on reboot).
2. In Cloudflare Zero Trust, create a tunnel and route `office.acme.com` to `http://localhost:3000`. WebSockets work out of the box.
3. Set `TRUST_PROXY=1` so the passcode attempt limiter sees real visitor IPs.

## Customizing
Use the same `workspace.json` and CLI as hosted, with the workspace id `default`:

```bash
npm run workspace -- set default --sign "Acme HQ" --accent "#e64980" --passcode "new-pass" --admin "Jane Doe"
```

See [CUSTOMIZE.md](CUSTOMIZE.md).

## Upgrading from the original Office Board
Point `DATA_DIR` at the old data folder (the one containing `db.json` and `uploads/`) and start the server. On first start it imports everything into `DATA_DIR/workspaces/default/` and rewrites image links. Everyone keeps their account, avatar, stickers and history. The old files are left untouched.

Admins are no longer an environment default. Set them explicitly, with `OFFICE_ADMINS` on first start or with `--admin` afterwards.

## Backups
Copy `DATA_DIR/workspaces/default/` (or the whole `DATA_DIR`) somewhere safe regularly.
