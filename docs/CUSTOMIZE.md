# Customizing a workspace

Every workspace is a folder `DATA_DIR/workspaces/<id>/` containing:

| File | What |
| --- | --- |
| `workspace.json` | The customer's setup (below). Safe to edit; a running server picks up changes within ~2 s and open browsers reload. |
| `db.json` | Their data: people, wall, recommendations, etc. |
| `uploads/` | Their avatars, stickers and photos. |

Prefer the CLI or the operator API to editing by hand: they validate everything and hash passcodes.

## `workspace.json`

```jsonc
{
  "name": "Acme Studio",                 // required
  "brand": {
    "name": "Acme Studio",               // shown in the top bar, sign-in screen and tab title
    "sign": "Acme HQ",                   // the neon sign on the back wall (max 40 chars)
    "tagline": "Where Acme hangs out",
    "logo": "🚀"                         // an emoji
  },
  "theme": {                             // #rrggbb colours
    "wall": "#1f2547",                   // back wall
    "sideWall": "#181d3a",               // side walls
    "wainscot": "#3b2f6b",               // lower wall panelling
    "neon": "#22d3ee",                   // neon sign + its glow
    "accent": "#e64980"                  // buttons and highlights in the interface
  },
  "features": {                          // all true by default
    "stickers": true,  "notes": true,  "requests": true,  "radio": true,  "tv": true,
    "books": true,  "places": true,  "giveaways": true,  "birthdays": true,  "games": true,  "jukebox": true
  },
  "domains": ["office.acme.com"],        // hosted mode: custom domains that open this workspace
  "access": {
    "passcodeHash": "scrypt$…",          // set with --passcode; never stored in plain text
    "admins": ["Jane Doe"]               // full names; admins can remove anyone's stickers and notes
  },
  "plan": "hosted",                      // hosted | dedicated | trial (informational)
  "seats": 50,                           // max people; 0 = unlimited
  "disabled": false                      // true = workspace goes offline (data kept)
}
```

## Features

| Key | What it switches | When off |
| --- | --- | --- |
| `stickers` | Sticker wall, sticker library, sticker mail | Upload and actions refused |
| `notes` | Text notes on the wall | Note tile hidden, action refused |
| `requests` | Request box (public and anonymous ideas) | Box removed from the room |
| `radio` | Radio: podcasts and music | Radio removed |
| `tv` | TV watchlist | TV stays as furniture, not clickable |
| `books` | Book club shelf | Shelf stays as decor |
| `places` | Top places (window) | Window stays as decor |
| `giveaways` | Too Good To Go basket | Basket removed |
| `birthdays` | Birthday board and celebrations | Board removed, no parties |
| `games` | Game arcade and darts | Arcade and dartboard removed |
| `jukebox` | Shared lo-fi jukebox | Jukebox and its 🎧 button removed |

Switched-off features are rejected **by the server**, not just hidden.

## CLI

```bash
npm run workspace -- list
npm run workspace -- show acme
npm run workspace -- create acme --name "Acme Studio" --sign "Acme HQ" --logo "🚀" --seats 50
npm run workspace -- set acme --accent "#e64980" --neon "#22d3ee" --wall "#1f2547"
npm run workspace -- set acme --passcode "a-long-passcode" --admin "Jane Doe"
npm run workspace -- set acme --disable-feature giveaways --enable-feature jukebox
npm run workspace -- set acme --domain office.acme.com
npm run workspace -- disable acme      # and: enable acme
```

Set `DATA_DIR` the same way as the server does, if you changed it.

## Operator API (hosted)

Enabled when `PLATFORM_TOKEN` is set. Send `Authorization: Bearer <PLATFORM_TOKEN>`.

| Method & path | Does |
| --- | --- |
| `GET /_platform/api/workspaces` | List workspaces with live stats (people, online now) |
| `POST /_platform/api/workspaces` | Create: `{ "slug": "acme", "name": "Acme Studio", ... }` |
| `GET /_platform/api/workspaces/:id` | Show one |
| `PATCH /_platform/api/workspaces/:id` | Change any part, e.g. `{ "features": { "jukebox": false } }`, `{ "access": { "passcode": "…" } }`, `{ "disabled": true }` |
| `GET /_platform/api/features` | Feature keys and labels |

The passcode hash is never returned (only `passcodeSet: true/false`). Connected browsers reload automatically after a change. Wire this API to your billing or sign-up flow.
