// Boots the real Office Board modules with a fictional cast, then plays a scripted cut.
import { initCore, onFrame } from '/js/scene/core.js';
import { buildRoom, room } from '/js/scene/room.js';
import { initWall } from '/js/scene/wall.js';
import '/js/scene/fx.js';
import { initCursors } from '/js/cursors.js';
import { store, emit } from '/js/net.js';
import { initHud } from '/js/ui/hud.js';
import { initBirthdays } from '/js/features/birthdays.js';
import { tvSlides } from '/js/features/recs.js';
import config from './config.js';
import { buildCast, buildStickers, buildRecs } from './assets.js';
import { createDirector } from './director.js';
import { renderSoundtrack } from './soundtrack.js';

const params = new URLSearchParams(location.search);
const cut = params.get('cut') || 'landscape';
document.body.classList.add(`cut-${cut}`);

const overlay = {
  live: document.getElementById('ad-live'),
  captions: document.getElementById('ad-captions'),
  end: document.getElementById('ad-end'),
  fade: document.getElementById('ad-fade'),
};

async function boot() {
  await Promise.race([
    Promise.all(['700 40px Fredoka', '600 40px Fredoka', '700 30px Nunito', '800 30px Nunito'].map((f) => document.fonts.load(f))).catch(() => {}),
    new Promise((r) => setTimeout(r, 4000)),
  ]);

  // Fictional workspace: only Alex ("you") is online at first; the rest join on cue.
  const cast = buildCast();
  store.me = cast[0];
  store.online = new Set([cast[0].id]);
  store.cols.users = new Map(cast.map((u) => [u.id, u]));
  store.cols.stickers = new Map(buildStickers().map((s) => [s.id, s]));
  for (const [col, items] of Object.entries(buildRecs())) store.cols[col] = new Map(items.map((i) => [i.id, i]));
  store.jukebox = { track: 3, playing: true, pos: 0, at: Date.now(), by: 'u-leo' };
  store.ready = true;

  initCore(document.getElementById('stage'));
  buildRoom(() => {}); // clicks are scripted, not interactive
  initWall();
  room.sign.setText(config.brand);
  room.tv.setSlides(tvSlides);
  room.basket.setCount(2);
  room.requestBox.setCount(0);
  room.bookshelf?.setCount(store.cols.books.size);
  room.jukebox?.setInfo({ name: 'Focus Mode', playing: true, bpm: 84 });
  room.monitor.draw(1, cast.length);

  initHud({ officeName: config.brand });
  initCursors();
  initBirthdays();
  emit('ready');
  emit('me', store.me);
  emit('presence', {});
  for (const c of Object.keys(store.cols)) emit(`col:${c}`, { type: 'reset' });

  const director = createDirector({ overlay });
  const { default: scene } = await import(`./scene-${cut}.js`);
  const plan = scene(director, { config, overlay });

  let t0 = null;
  onFrame(() => {
    if (t0 === null) return;
    director.update((performance.now() - t0) / 1000);
    room.monitor.draw(store.online.size, store.cols.users.size);
  });

  window.__ad = {
    ready: true,
    cut,
    duration: plan.duration,
    start() {
      t0 = performance.now();
    },
    renderAudio: () => renderSoundtrack({ duration: plan.duration, track: plan.track, cues: director.cues }),
  };
  // Live preview (no recorder): start straight away.
  if (!window.__timeShim?.record) window.__ad.start();
}

boot().catch((err) => {
  console.error(err);
  window.__ad = { error: String(err?.stack || err) };
});
