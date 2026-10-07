// "Stage hands": mutate the app's store and emit the same events the server would,
// so the real UI (wall, cursors, panels, celebration...) reacts exactly as in production.
import { store, emit } from '/js/net.js';
import { BOARD } from '/js/scene/room.js';

let z = 100;
let seq = 0;
const nid = (p) => `${p}-${++seq}`;

export function upsert(col, item) {
  const prev = store.cols[col].get(item.id);
  store.cols[col].set(item.id, item);
  if (col === 'users' && item.id === store.me?.id) {
    store.me = item;
    emit('me', item);
  }
  emit(`col:${col}`, { type: prev ? 'update' : 'add', item, prev });
  return item;
}

export function patch(col, id, changes) {
  return upsert(col, { ...store.cols[col].get(id), ...changes });
}

export function remove(col, id) {
  const prev = store.cols[col].get(id);
  store.cols[col].delete(id);
  emit(`col:${col}`, { type: 'remove', id, prev });
}

/** World position of a point on the corkboard given board coords u,v in 0..1. */
export const boardPoint = (u, v, lift = 0.05) => [BOARD.x + (u - 0.5) * BOARD.w, BOARD.y + (v - 0.5) * BOARD.h, BOARD.z + lift];

export function sticker(by, stickerIdx, u, v, { rot = 0, scale = 1 } = {}) {
  const s = store.cols.stickers.get(`s-${stickerIdx}`);
  return upsert('wall', { id: nid('w'), stickerId: s.id, url: s.url, by, u, v, rot, scale, z: ++z, at: Date.now() });
}

export function memo(by, text, u, v, { color = '#ffe66d', rot = 0 } = {}) {
  return upsert('wall', { id: nid('m'), text, color, by, u, v, rot, scale: 1, z: ++z, at: Date.now() });
}

export function request(by, text, u, v, { anonymous = false, color = '#caffbf', rot = 0 } = {}) {
  return upsert('requests', {
    id: nid('r'), text, anonymous, authorId: anonymous ? null : by, pinned: true,
    u, v, rot, color, z: ++z, votes: [], status: 'open', at: Date.now(),
  });
}

export function vote(reqId, userId) {
  const r = store.cols.requests.get(reqId);
  if (!r || r.votes.includes(userId)) return;
  patch('requests', reqId, { votes: [...r.votes, userId] });
}

export function join(userId) {
  store.online.add(userId);
  emit('presence', { id: userId, online: true });
}

export function mood(userId, m) {
  patch('users', userId, { mood: m });
}

export function like(col, id, userId) {
  const it = store.cols[col].get(id);
  if (it && !it.likes.includes(userId)) patch(col, id, { likes: [...it.likes, userId] });
}

export function setBirthdayToday(userId, on) {
  const now = new Date();
  patch('users', userId, { birthday: on ? { m: now.getMonth() + 1, d: now.getDate() } : null });
}

// ---------------------------------------------------------------- games
export function newGame(kind, players, state) {
  return upsert('games', { id: nid('g'), kind, players, gone: [], status: 'playing', state, first: 0, rematch: [], createdAt: Date.now(), updatedAt: Date.now() });
}

/** Connect Four: drop a disc for player p in column c, detecting a win like the server does. */
export function c4Drop(gameId, p, c) {
  const g = store.cols.games.get(gameId);
  const s = structuredClone(g.state);
  let row = -1;
  for (let r = 5; r >= 0; r--) {
    if (s.board[r * 7 + c] === null) {
      row = r;
      break;
    }
  }
  if (row < 0) return;
  s.board[row * 7 + c] = p;
  s.last = row * 7 + c;
  s.turn = 1 - p;
  let status = 'playing';
  const at = (r, cc) => (r >= 0 && r < 6 && cc >= 0 && cc < 7 ? s.board[r * 7 + cc] : undefined);
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const cells = [[row, c]];
    for (const dir of [1, -1]) {
      let r = row + dr * dir;
      let cc = c + dc * dir;
      while (at(r, cc) === p) {
        cells.push([r, cc]);
        r += dr * dir;
        cc += dc * dir;
      }
    }
    if (cells.length >= 4) {
      s.winner = p;
      s.line = cells.map(([r, cc]) => r * 7 + cc);
      status = 'done';
    }
  }
  upsert('games', { ...g, state: s, status, updatedAt: Date.now() });
}

const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
function dartScore(x, y) {
  const r = Math.hypot(x, y);
  if (r <= 0.0374) return { s: 50, label: 'Bullseye!' };
  if (r <= 0.0935) return { s: 25, label: 'Outer bull' };
  if (r > 1) return { s: 0, label: 'Miss' };
  const deg = ((Math.atan2(x, -y) * 180) / Math.PI + 360 + 9) % 360;
  const n = SECTORS[Math.floor(deg / 18) % 20];
  if (r >= 0.953) return { s: n * 2, label: `Double ${n}` };
  if (r >= 0.582 && r <= 0.629) return { s: n * 3, label: `Triple ${n}` };
  return { s: n, label: String(n) };
}

/** Darts: player p throws at (x, y) on the unit board. */
export function dartThrow(gameId, p, x, y) {
  const g = store.cols.games.get(gameId);
  const s = structuredClone(g.state);
  const { s: points, label } = dartScore(x, y);
  s.throws[p].push({ x, y, s: points, label });
  s.last = { p, s: points, label };
  s.scores[p] += points;
  s.left--;
  if (s.left === 0) {
    if (p !== g.first) s.round++;
    s.turn = 1 - p;
    s.left = 3;
  }
  upsert('games', { ...g, state: s, updatedAt: Date.now() });
}
