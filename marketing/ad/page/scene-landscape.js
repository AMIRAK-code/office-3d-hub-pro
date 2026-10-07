// 16:9 product tour — 30 seconds.
import { playIntro, clearFocus } from '/js/scene/core.js';
import { room } from '/js/scene/room.js';
import { confettiBurst } from '/js/scene/fx.js';
import { store } from '/js/net.js';
import { openRecs } from '/js/features/recs.js';
import { openGames } from '/js/features/games.js';
import { closePanel } from '/js/ui/kit.js';
import * as THREE from 'three';
import * as S from './stage.js';
import { liveCard, endCard } from './common.js';

const bp = S.boardPoint;
const OFF_L = [-14, 4, 3];
const OFF_R = [14, 4, 3];
const OFF_T = [0, 13, -2];
const RADIO = [-7.45, 2.45, -4.85];
const TV = [5.0, 2.45, -5.3];
const ARCADE = [8.1, 2.9, -3.5];
const CAKE = [0.3, 1.7, -1.15];
const BDAY = [-7.55, 5.1, -6.85];
const BASKET = [-3.0, 1.15, 0.9];
const WINDOW = [7.55, 5.3, -6.85];
const add = (a, b) => a.map((v, i) => v + b[i]);

export default function landscape(d, { config, overlay }) {
  const duration = 30;

  // ---------- 0–3s: open ----------
  d.fade([{ t: 0, a: 1 }, { t: 1.3, a: 0 }]);
  d.at(0, () => playIntro(), 'whoosh');
  d.caption(0.5, 3.0, [{ text: 'Your team is everywhere.', cls: 'small' }, { text: 'Your office should be too.', cls: 'hl' }]);

  // ---------- 3–7.6s: colleagues arrive ----------
  const arrivals = [['u-maya', 3.0], ['u-leo', 3.3], ['u-aisha', 3.6], ['u-tom', 3.9], ['u-sofia', 4.2], ['u-kenji', 4.5]];
  arrivals.forEach(([id, t]) => d.at(t, () => S.join(id), 'pop'));
  [['u-maya', '☕'], ['u-leo', '🎧'], ['u-aisha', '🚀'], ['u-tom', '🍕'], ['u-sofia', '🌈'], ['u-kenji', '🎯']]
    .forEach(([id, m], i) => d.at(5.0 + i * 0.3, () => S.mood(id, m), 'click'));
  d.caption(3.4, 7.4, [{ text: 'See who’s in.', cls: 'hl' }, { text: 'Everyone live, in one shared 3D office.', cls: 'small' }]);

  liveCard(d, overlay, {
    from: 3.0,
    to: 26.8,
    rows: [
      { ic: '👥', lbl: 'Online now', get: (s) => s.online.size },
      { ic: '🎨', lbl: 'On the wall', get: (s) => s.cols.wall.size + [...s.cols.requests.values()].filter((r) => r.pinned).length },
      { ic: '👍', lbl: 'Votes & likes', get: (s) => [...s.cols.requests.values()].reduce((n, r) => n + r.votes.length, 0) + [...s.cols.shows.values()].reduce((n, x) => n + x.likes.length, 0) },
      { ic: '🎬', lbl: 'Recommendations', get: (s) => s.cols.shows.size + s.cols.podcasts.size + s.cols.music.size + s.cols.books.size },
      { ic: '🕹️', lbl: 'Games played', get: (s) => [...s.cols.games.values()].filter((g) => g.status === 'done').length },
    ],
  });

  // ---------- 8–11.8s: the wall ----------
  d.camera([{ t: 7.6, pos: [0, 4.6, 6.5], look: [0, 4.4, -6.84] }, { t: 8.4, pos: [0, 4.55, 3.4], look: [0, 4.5, -6.84] }, { t: 11.8, pos: [0.6, 4.5, 3.2], look: [0.3, 4.5, -6.84] }]);
  d.at(8.5, () => S.sticker('u-maya', 0, 0.18, 0.7, { rot: -0.2, scale: 1.1 }), 'slap');
  d.at(8.9, () => S.sticker('u-leo', 3, 0.44, 0.34, { rot: 0.15, scale: 1.25 }), 'slap');
  d.at(9.3, () => S.sticker('u-sofia', 1, 0.84, 0.74, { rot: 0.1 }), 'slap');
  d.at(9.7, () => S.sticker('u-kenji', 2, 0.63, 0.58, { rot: -0.12, scale: 1.1 }), 'slap');
  d.at(10.1, () => S.memo('u-tom', 'Pizza Friday? 🍕', 0.24, 0.3, { color: '#ffd6a5', rot: -0.06 }), 'slap');
  let req = null;
  d.at(10.6, () => { req = S.request('u-aisha', 'Standing desks for the 2nd floor, please 🙏', 0.8, 0.3, { rot: 0.05 }); }, 'slap');
  ['u-maya', 'u-leo', 'u-kenji', 'u-tom'].forEach((u, i) => d.at(10.95 + i * 0.18, () => req && S.vote(req.id, u), 'click'));
  d.at(11.25, () => S.sticker('u-maya', 4, 0.52, 0.84, { rot: 0.18, scale: 0.9 }), 'slap');
  d.caption(8.2, 11.8, [{ text: 'Leave your mark.', cls: 'hl' }, { text: 'Stickers, notes and ideas — pinned live.', cls: 'small' }]);

  // ---------- 12–15.8s: recommendations on the TV ----------
  d.at(12.0, () => openRecs('tv'), 'tv');
  d.at(13.1, () => S.like('shows', 'sh-1', 'u-kenji'), 'pop');
  d.at(13.5, () => S.like('shows', 'sh-1', 'u-sofia'), 'pop');
  d.at(14.3, () => S.upsert('shows', { id: 'sh-new', title: 'Ted Lasso', kind: 'series', platform: 'Apple TV+', rating: 5, url: '', note: 'Believe. 💛 Perfect team-night pick.', by: 'u-maya', likes: ['u-leo', 'u-aisha'], comments: [], at: Date.now() }), 'pop');
  d.caption(12.3, 15.6, [{ text: 'Share what you love.', cls: 'hl' }, { text: 'Shows, podcasts, music and books.', cls: 'small' }]);
  d.at(15.8, () => closePanel(), 'whoosh');

  // ---------- 16–19.9s: a birthday ----------
  d.at(16.0, () => S.setBirthdayToday('u-leo', true), 'party');
  d.camera([{ t: 16.0, pos: [0.4, 3.4, 5.2], look: [0.4, 1.6, -1.2] }, { t: 19.9, pos: [-0.6, 3.0, 4.3], look: [0.3, 1.6, -1.2] }]);
  d.at(18.1, () => {
    room.cake.blowOut();
    setTimeout(() => confettiBurst(new THREE.Vector3(0.3, 2.0, -1.15), 260, 7), 450);
  }, 'blow');
  d.sound(18.55, 'party');
  d.caption(16.3, 19.7, [{ text: 'Never miss a birthday.', cls: 'hl' }, { text: 'The whole office celebrates — automatically.', cls: 'small' }]);

  // ---------- 20–23.9s: coffee-break game ----------
  let game = null;
  d.at(19.95, () => {
    S.setBirthdayToday('u-leo', false); // party's over — balloons drift away
    game = S.newGame('c4', ['u-you', 'u-kenji'], { board: Array(42).fill(null), turn: 0, winner: null, line: null, last: null });
    openGames({ gameId: game.id });
  }, 'whoosh');
  [[20.6, 0, 3], [21.0, 1, 3], [21.4, 0, 4], [21.8, 1, 4], [22.2, 0, 5], [22.6, 1, 5], [23.0, 0, 2]]
    .forEach(([t, p, c]) => d.at(t, () => game && S.c4Drop(game.id, p, c), 'dart'));
  d.sound(23.1, 'win');
  d.caption(20.3, 23.7, [{ text: 'Play at the coffee break.', cls: 'hl' }, { text: 'Mini games with your team.', cls: 'small' }]);
  d.at(23.9, () => {
    closePanel();
    clearFocus();
  }, 'whoosh');

  // ---------- 24–26.9s: white-label ----------
  const setBrand = (name) => {
    room.sign.setText(name);
    const b = document.querySelector('.brand b');
    if (b) b.textContent = name;
  };
  config.brandSwap.forEach((name, i) => d.at(24.3 + i * 0.7, () => setBrand(name), 'sign'));
  d.at(24.3 + config.brandSwap.length * 0.7, () => setBrand(config.brand), 'sign');
  d.caption(24.2, 26.8, [{ text: 'Your brand. Your rooms.', cls: 'hl' }, { text: 'Fully customizable · Hosted or self-hosted', cls: 'small' }]);

  // ---------- 27–30s: end card ----------
  endCard(d, overlay, 27.0, config);

  // ---------- the cast's cursors (continuous, motion-capture style) ----------
  d.cursor('u-maya', [
    { t: 3.0, p: OFF_L }, { t: 3.9, p: RADIO, click: true }, { t: 5.4, p: add(RADIO, [0.6, 0.4, 0]) }, { t: 7.6, p: BDAY },
    { t: 8.2, p: bp(0.22, 0.66) }, { t: 8.5, p: bp(0.18, 0.7), click: true }, { t: 9.8, p: bp(0.32, 0.8) },
    { t: 10.95, p: bp(0.78, 0.32), click: true }, { t: 11.25, p: bp(0.52, 0.84), click: true }, { t: 12.4, p: [3.4, 2.9, -4.6] },
    { t: 14.3, p: add(TV, [-0.8, 0.2, 0.2]), click: true }, { t: 16.2, p: add(CAKE, [-1.2, 0.5, 0.6]) }, { t: 18.1, p: add(CAKE, [-0.5, 0.3, 0.2]), click: true },
    { t: 19.8, p: add(CAKE, [-1.4, 0.7, 0.4]) }, { t: 21.2, p: add(ARCADE, [-1.2, 0.2, 0.6]) }, { t: 23.6, p: add(ARCADE, [-1.4, -0.4, 0.8]) },
    { t: 25.0, p: [-3.5, 6.6, -6.85] }, { t: 26.6, p: OFF_L },
  ], { seed: 1 });
  d.cursor('u-leo', [
    { t: 3.3, p: OFF_T }, { t: 4.3, p: bp(0.5, 0.55) }, { t: 5.6, p: WINDOW }, { t: 7.6, p: bp(0.6, 0.9) },
    { t: 8.6, p: bp(0.46, 0.38) }, { t: 8.9, p: bp(0.44, 0.34), click: true }, { t: 10.3, p: bp(0.62, 0.22) }, { t: 11.13, p: bp(0.8, 0.3), click: true },
    { t: 12.6, p: add(TV, [0.4, 0.8, 0.3]) }, { t: 15.4, p: add(TV, [-1.2, -0.3, 0.6]) }, { t: 16.6, p: add(CAKE, [1.1, 0.6, 0.5]) },
    { t: 18.0, p: add(CAKE, [0.5, 0.25, 0.25]) }, { t: 19.9, p: add(CAKE, [1.3, 0.8, 0.2]) }, { t: 21.0, p: add(ARCADE, [-0.6, 0.9, 0.6]) },
    { t: 23.5, p: add(ARCADE, [-0.4, 0.6, 0.7]) }, { t: 25.2, p: [2.2, 8.9, -6.85] }, { t: 26.6, p: OFF_T },
  ], { seed: 2 });
  d.cursor('u-aisha', [
    { t: 3.6, p: OFF_R }, { t: 4.6, p: TV, click: true }, { t: 6.6, p: add(TV, [-0.9, 0.5, 0.2]) }, { t: 8.0, p: bp(0.9, 0.12) },
    { t: 10.3, p: bp(0.82, 0.34) }, { t: 10.6, p: bp(0.8, 0.3), click: true }, { t: 11.7, p: bp(0.95, 0.5) },
    { t: 13.0, p: add(TV, [0.9, -0.2, 0.3]) }, { t: 15.6, p: add(TV, [-0.5, 0.6, 0.4]) }, { t: 17.0, p: add(CAKE, [0.9, -0.1, 0.9]) },
    { t: 19.9, p: add(CAKE, [0.7, 0.2, 0.9]) }, { t: 21.6, p: add(ARCADE, [-2.0, -0.6, 0.6]) }, { t: 23.6, p: add(ARCADE, [-1.8, -0.9, 0.6]) },
    { t: 25.3, p: [6.2, 3.6, -6.85] }, { t: 26.7, p: OFF_R },
  ], { seed: 3 });
  d.cursor('u-tom', [
    { t: 3.9, p: OFF_R }, { t: 4.9, p: ARCADE, click: true }, { t: 6.8, p: add(ARCADE, [-0.6, -0.5, 0.3]) }, { t: 8.3, p: bp(0.1, 0.15) },
    { t: 9.9, p: bp(0.26, 0.32) }, { t: 10.1, p: bp(0.24, 0.3), click: true }, { t: 11.31, p: bp(0.78, 0.28), click: true },
    { t: 13.4, p: add(TV, [-1.6, 0.9, 0.5]) }, { t: 15.6, p: add(TV, [-2.2, 0.2, 0.6]) }, { t: 17.3, p: add(CAKE, [-0.2, 1.2, 0.6]) },
    { t: 19.8, p: add(CAKE, [0.2, 1.0, 0.5]) }, { t: 21.4, p: add(ARCADE, [-2.4, 0.6, 0.4]) }, { t: 23.4, p: add(ARCADE, [-2.2, 0.9, 0.4]) },
    { t: 25.4, p: [5.0, 1.2, -1.0] }, { t: 26.7, p: OFF_R },
  ], { seed: 4 });
  d.cursor('u-sofia', [
    { t: 4.2, p: OFF_L }, { t: 5.2, p: BASKET, click: true }, { t: 7.0, p: add(BASKET, [1.2, 0.8, -0.5]) }, { t: 8.3, p: bp(0.95, 0.9) },
    { t: 9.1, p: bp(0.86, 0.76) }, { t: 9.3, p: bp(0.84, 0.74), click: true }, { t: 11.6, p: bp(0.68, 0.9) },
    { t: 13.5, p: add(TV, [-0.2, -0.5, 0.4]), click: true }, { t: 15.5, p: add(TV, [-1.8, -0.6, 0.6]) }, { t: 16.8, p: add(CAKE, [-0.9, -0.2, 1.0]) },
    { t: 19.7, p: add(CAKE, [-0.6, -0.1, 1.0]) }, { t: 21.8, p: add(ARCADE, [-1.6, 1.4, 0.4]) }, { t: 23.5, p: add(ARCADE, [-1.3, 1.6, 0.4]) },
    { t: 25.5, p: [-5.5, 2.2, -2.0] }, { t: 26.8, p: OFF_L },
  ], { seed: 5 });
  d.cursor('u-kenji', [
    { t: 4.5, p: OFF_T }, { t: 5.5, p: [-9.85, 4.7, 1.2], click: true }, { t: 7.4, p: [-9.0, 3.4, -2.0] }, { t: 8.6, p: bp(0.7, 0.7) },
    { t: 9.5, p: bp(0.65, 0.6) }, { t: 9.7, p: bp(0.63, 0.58), click: true }, { t: 11.07, p: bp(0.81, 0.33), click: true },
    { t: 13.1, p: add(TV, [0.2, 0.3, 0.3]), click: true }, { t: 15.6, p: add(TV, [0.8, -0.4, 0.6]) }, { t: 17.2, p: add(CAKE, [1.4, 0.3, 0.3]) },
    { t: 19.7, p: add(CAKE, [1.6, 0.1, 0.4]) }, { t: 21.0, p: add(ARCADE, [-0.3, 0.1, 0.5]), click: true }, { t: 22.6, p: add(ARCADE, [-0.2, -0.1, 0.5]), click: true },
    { t: 24.6, p: [8.4, 6.6, -6.85] }, { t: 26.6, p: OFF_T },
  ], { seed: 6 });

  return { duration, track: 3 };
}

