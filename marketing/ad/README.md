# Ad renderer

Renders the two 30-second ads straight from the real app. Simulated colleagues
move their cursors along recorded-style paths, the camera flies through the 3D office, and live
counters read the app's own data. Each frame is captured on a virtual clock, so the output is
perfectly smooth at 30 fps, whatever the machine's speed.

| Cut | Size | File | Use it for |
| --- | --- | --- | --- |
| Product tour | 1920×1080 (16:9) | `out/office-3d-hub-ad-16x9.mp4` | YouTube, LinkedIn, website hero, sales decks |
| Live cut | 1080×1920 (9:16) | `out/office-3d-hub-ad-9x16.mp4` | Instagram Reels, TikTok, YouTube Shorts, Stories |

## Render

Needs Node 20+ and Google Chrome (or Edge) installed. The app's own `npm install` must have been run in the repo root, because Three.js is served from there.

```bash
cd marketing/ad
npm install
npm run render            # both cuts (about 10–20 min, depending on the GPU)
npm run render:landscape  # just the 16:9 cut
npm run render:vertical   # just the 9:16 cut
node record.mjs landscape --stills=2,9,18   # quick JPG stills for review
npm run preview           # serves the ad page for a live look in your browser
```

## Change the copy or the brand

- **Product name, tagline, call to action, URL, white-label names:** `page/config.js`.
- **Timing, captions, camera moves, what the cast does:** `page/scene-landscape.js` and `page/scene-vertical.js`. Every beat is a line like
  `d.at(8.5, () => S.sticker('u-maya', 0, 0.18, 0.7), 'slap')`, meaning "at 8.5 s Maya slaps sticker 0 on the wall, with a slap sound".
- **Cast (fictional people and avatars):** `page/assets.js`. No real colleague data is used.
- **Music:** each cut picks one of the jukebox's lo-fi tracks (`track` in the scene's return value). The music is synthesized,
  so there are no licensing issues.

## How it works

- `page/time-shim.js` replaces the page's clock (animation frames, timers, `Date`, CSS animations) with a virtual one
  that only moves when the recorder says so.
- `page/director.js` is a tiny timeline: one-off beats, per-frame spans, camera keyframes, motion-capture-style cursor paths
  (smooth splines plus natural hand wobble), and kinetic captions.
- `page/stage.js` changes the app's data exactly as the server would (stickers, notes, votes, birthdays, game moves), so the
  real UI reacts naturally.
- `page/soundtrack.js` renders the soundtrack offline with the app's jukebox engine, plus sound effects on each beat.
- `record.mjs` serves everything, drives headless Chrome frame by frame and pipes the frames into ffmpeg (H.264 + AAC).
