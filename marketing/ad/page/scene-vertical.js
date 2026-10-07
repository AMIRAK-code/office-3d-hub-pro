// 9:16 vertical "live" cut for Reels / TikTok / Shorts — 30 seconds, real phone layout.
import { clearFocus } from '/js/scene/core.js';
import { room } from '/js/scene/room.js';
import { confettiBurst } from '/js/scene/fx.js';
import { openGames } from '/js/features/games.js';
import { closePanel } from '/js/ui/kit.js';
import * as THREE from 'three';
import * as S from './stage.js';
import { liveCard, endCard } from './common.js';

const bp = S.boardPoint;
const add = (a, b) => a.map((v, i) => v + b[i]);
const OFF_L = [-12, 4, 4];
const OFF_R = [12, 4, 4];
const OFF_B = [0, -4, 6];
const CAKE = [0.3, 1.7, -1.15];
const JUKE = [-9.0, 1.3, -2.0];
const DART = [-9.8, 4.7, 1.2];

export default function vertical(d, { config, overlay }) {
  const duration = 30;
  let parties = 0;
  let gamesStarted = 0;

  // ---------- 0–2.6s: hook ----------
  d.fade([{ t: 0, a: 1 }, { t: 0.4, a: 0.72 }, { t: 2.3, a: 0.72 }, { t: 3.0, a: 0 }]);
  d.camera([{ t: 0, pos: [0, 6.4, 13], look: [0, 6.2, -6.9] }, { t: 3.0, pos: [0, 6.0, 9.5], look: [0, 4.9, -6.9] }]);
  d.caption(0.3, 2.6, [{ text: 'Remote work', cls: '' }, { text: 'feels quiet?', cls: 'hl' }], { pos: 'center' });
  d.sound(0.2, 'whoosh');
  d.at(2.6, () => room.sign.setText(config.brand), 'sign');

  // ---------- 2.8–6s: everyone arrives ----------
  ['u-maya', 'u-leo', 'u-aisha', 'u-tom', 'u-sofia', 'u-kenji'].forEach((id, i) => d.at(3.0 + i * 0.22, () => S.join(id), 'pop'));
  [['u-maya', '☕'], ['u-leo', '🎧'], ['u-aisha', '🚀'], ['u-tom', '🍕'], ['u-sofia', '🌈'], ['u-kenji', '🎯']]
    .forEach(([id, m], i) => d.at(4.4 + i * 0.18, () => S.mood(id, m), 'click'));
  d.at(3.0, () => clearFocus());
  d.caption(3.1, 5.9, [{ text: 'Bring the office', cls: '' }, { text: 'back to life.', cls: 'hl' }], { pos: 'bottom-left' });
  liveCard(d, overlay, {
    from: 2.9,
    to: 24.9,
    rows: [
      { ic: '👥', lbl: 'Online', get: (s) => s.online.size },
      { ic: '🎨', lbl: 'Wall', get: (s) => s.cols.wall.size + [...s.cols.requests.values()].filter((r) => r.pinned).length },
      { ic: '👍', lbl: 'Votes', get: (s) => [...s.cols.requests.values()].reduce((n, r) => n + r.votes.length, 0) },
      { ic: '🎉', lbl: 'Parties', get: () => parties },
      { ic: '🕹️', lbl: 'Games', get: () => gamesStarted },
    ],
  });

  // ---------- 6–10s: the wall fills up (panning shot) ----------
  d.camera([{ t: 6.0, pos: [-2.4, 4.7, 3.2], look: [-2.4, 4.6, -6.84] }, { t: 13.2, pos: [2.4, 4.6, 3.2], look: [2.4, 4.5, -6.84], linear: true }]);
  const slaps = [
    ['u-maya', 0, 0.12, 0.72, -0.2], ['u-leo', 3, 0.26, 0.42, 0.15], ['u-sofia', 1, 0.34, 0.8, 0.1], ['u-kenji', 2, 0.44, 0.3, -0.1],
    ['u-tom', 5, 0.55, 0.7, 0.2], ['u-aisha', 9, 0.6, 0.38, -0.15], ['u-maya', 7, 0.7, 0.8, 0.12], ['u-leo', 4, 0.9, 0.78, -0.1],
  ];
  slaps.forEach(([u, s, x, y, r], i) => d.at(6.4 + i * 0.42, () => S.sticker(u, s, x, y, { rot: r, scale: 1.15 }), 'slap'));
  d.at(8.9, () => S.memo('u-tom', 'Pizza Friday? 🍕', 0.48, 0.52, { color: '#ffd6a5', rot: -0.06 }), 'slap');
  d.caption(6.2, 9.9, [{ text: 'Real people.', cls: '' }, { text: 'Real time.', cls: 'hl' }], { pos: 'top-center' });

  // ---------- 10–13.2s: ideas get pinned and voted ----------
  let idea = null;
  d.at(10.2, () => { idea = S.request(null, '4-day week pilot? 👀', 0.78, 0.4, { anonymous: true, color: '#d0bfff', rot: 0.05 }); }, 'slap');
  ['u-maya', 'u-leo', 'u-aisha', 'u-tom', 'u-sofia', 'u-kenji', 'u-you'].forEach((u, i) => d.at(10.8 + i * 0.2, () => idea && S.vote(idea.id, u), 'click'));
  d.caption(10.3, 13.1, [{ text: 'Ideas get pinned.', cls: '' }, { text: 'Even anonymously.', cls: 'hl' }], { pos: 'top-center' });

  // ---------- 13.4–16.6s: lo-fi jukebox ----------
  d.camera([{ t: 13.3, pos: [-4.2, 2.3, 0.6], look: [-9.4, 1.35, -2.0] }, { t: 16.6, pos: [-5.0, 2.6, 1.2], look: [-9.4, 1.3, -2.0] }]);
  d.at(13.6, () => room.jukebox.bounce(), 'chime');
  d.caption(13.6, 16.4, [{ text: 'Lo-fi for the', cls: '' }, { text: 'whole team.', cls: 'hl' }], { pos: 'top-center' });

  // ---------- 16.6–20.6s: birthday ----------
  d.at(16.7, () => {
    parties++;
    S.setBirthdayToday('u-sofia', true);
  }, 'party');
  d.camera([{ t: 16.6, pos: [0.4, 3.4, 5.6], look: [0.3, 1.5, -1.2] }, { t: 20.6, pos: [0.2, 2.9, 4.4], look: [0.3, 1.6, -1.2] }]);
  d.at(18.7, () => {
    room.cake.blowOut();
    setTimeout(() => confettiBurst(new THREE.Vector3(0.3, 2.0, -1.15), 260, 7), 450);
  }, 'blow');
  d.sound(19.15, 'party');
  d.caption(17.0, 20.4, [{ text: 'Birthdays?', cls: '' }, { text: 'Celebrated.', cls: 'hl' }], { pos: 'bottom-left' });
  d.at(20.5, () => S.setBirthdayToday('u-sofia', false));

  // ---------- 20.6–25s: darts at the coffee break ----------
  let game = null;
  d.at(20.6, () => {
    gamesStarted++;
    game = S.newGame('darts', ['u-you', 'u-maya'], { scores: [0, 0], turn: 0, left: 3, round: 1, rounds: 3, throws: [[], []], last: null, winner: null });
    openGames({ gameId: game.id, focus: 'darts' });
  }, 'whoosh');
  [[21.5, 0, 0.0, -0.6], [22.0, 0, 0.01, 0.0], [22.5, 0, 0.04, -0.61], [23.2, 1, 0.3, 0.45], [23.6, 1, -0.5, -0.2], [24.0, 1, 0.0, 0.07]]
    .forEach(([t, p, x, y]) => d.at(t, () => game && S.dartThrow(game.id, p, x, y), 'dart'));
  d.caption(20.8, 24.7, [{ text: 'Coffee-break', cls: '' }, { text: 'games.', cls: 'hl' }], { pos: 'top-center' });
  d.at(25.0, () => {
    closePanel();
    clearFocus();
  });

  // ---------- 25.2–30s: end card ----------
  endCard(d, overlay, 25.2, config);

  // ---------- cursors ----------
  const crowd = [
    ['u-maya', OFF_L, 1], ['u-leo', OFF_R, 2], ['u-aisha', OFF_B, 3], ['u-tom', OFF_R, 4], ['u-sofia', OFF_L, 5], ['u-kenji', OFF_B, 6],
  ];
  crowd.forEach(([id, from, seed], i) => {
    const mine = slaps.map((s, k) => ({ s, k })).filter(({ s }) => s[0] === id);
    const keys = [{ t: 3.0 + i * 0.22, p: from }, { t: 4.2 + i * 0.2, p: bp(0.2 + i * 0.12, 0.25 + (i % 3) * 0.2, 2) }];
    mine.forEach(({ s, k }) => {
      const t = 6.4 + k * 0.42;
      keys.push({ t: t - 0.35, p: bp(s[2] + 0.03, s[3] + 0.05) }, { t, p: bp(s[2], s[3]), click: true });
    });
    keys.push({ t: 10.8 + i * 0.2, p: bp(0.78 + (i - 2.5) * 0.02, 0.4 + (i % 2) * 0.04), click: true });
    keys.push({ t: 13.0, p: bp(0.7 + i * 0.03, 0.2 + i * 0.1) });
    keys.push({ t: 14.4 + i * 0.1, p: add(JUKE, [0.4 + (i % 3) * 0.3, -0.4 + i * 0.25, 0.6 - i * 0.2]) });
    keys.push({ t: 16.3, p: add(JUKE, [0.6 + (i % 2) * 0.4, 0.2 + (i % 3) * 0.3, -0.4 + i * 0.15]) });
    keys.push({ t: 17.4 + i * 0.1, p: add(CAKE, [-0.9 + i * 0.36, -0.35 + (i % 2) * 0.25, 0.5]) });
    keys.push({ t: 18.7, p: add(CAKE, [-0.5 + i * 0.2, -0.15, 0.3]), click: i === 1 });
    keys.push({ t: 20.4, p: add(CAKE, [-1.0 + i * 0.4, -0.3, 0.6]) });
    keys.push({ t: 21.6, p: add(DART, [0.6, -1.5 + (i % 3) * 0.2, -0.9 + i * 0.35]) });
    keys.push({ t: 24.4, p: add(DART, [0.7, -1.4 + (i % 3) * 0.2, -0.8 + i * 0.3]) });
    keys.push({ t: 25.1, p: from });
    d.cursor(id, keys, { seed });
  });

  return { duration, track: 4 };
}
