# Running the hosted service

One server (`MODE=hosted`) serves every customer workspace.

## 1. Server and DNS
- A small VM with Docker (2 vCPU / 2 GB RAM handles many small offices; see Limits) and a domain, e.g. `office3dhub.com`.
- DNS: an `A` record for `office3dhub.com` **and** a wildcard `*.office3dhub.com`, both pointing at the server.

## 2. Configure

```bash
cp .env.example .env
```

Set at least:

```
MODE=hosted
BASE_DOMAIN=office3dhub.com
PLATFORM_TOKEN=<long random secret>
TRUST_PROXY=1
```

## 3. Start

```bash
cd deploy
docker compose up -d
```

Caddy issues HTTPS certificates automatically for `<workspace>.office3dhub.com` and for customers' custom domains. It only does so after the app confirms, at `/_platform/tls-check`, that the domain belongs to an active workspace.

> The Dockerfile and Compose setup haven't been run on this machine yet (no Docker installed). Do a trial deploy before your first customer.

## 4. Onboard a customer

```bash
curl -X POST https://office3dhub.com/_platform/api/workspaces \
  -H "Authorization: Bearer $PLATFORM_TOKEN" -H "Content-Type: application/json" \
  -d '{"slug":"acme","name":"Acme Studio","brand":{"sign":"Acme HQ","logo":"🚀"},"seats":50,"access":{"admins":["Jane Doe"],"passcode":"choose-one"}}'
```

The customer goes to **https://acme.office3dhub.com**. For their own domain:

1. Add `"domains": ["office.acme.com"]` with a PATCH.
2. Ask them to point a **CNAME** for `office.acme.com` at `acme.office3dhub.com`.

HTTPS then appears by itself.

Alternatively, run the CLI inside the container: `docker compose exec app node server/cli.js create acme --name "Acme Studio"`.

## 5. Backups
All customer data is in the `office-data` volume (`/data`, one folder per workspace). Back it up daily, for example:

```bash
docker run --rm -v deploy_office-data:/data -v "$PWD":/backup alpine tar czf /backup/office-$(date +%F).tgz -C /data .
```

## Limits (current architecture)
- **One server process.** Workspaces share one Node process, and each one keeps its data in memory with a JSON file on disk. That's comfortable for hundreds of small offices (tens of people each). It does not scale horizontally: don't run two copies against the same data.
- **When to evolve:** if one customer has thousands of people, or you need zero-downtime deploys, move storage to Postgres and live updates to a Redis adapter. The `store` / `hub` boundary is where that change goes.
- **Games and the jukebox state** are in memory and reset when the server restarts. Everything else is saved.

## Updating

```bash
git pull
cd deploy
docker compose up -d --build
```

Connected people reconnect automatically after a few seconds.
