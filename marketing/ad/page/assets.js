// Fictional cast and props for the ad (no real colleague data is ever used).

function drawAvatar(face, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 192;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(70, 60, 10, 96, 96, 110);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.15, color);
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(96, 96, 96, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '122px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(face, 96, 108);
  return c.toDataURL('image/png');
}

export function emojiImage(emoji, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.font = `${Math.round(size * 0.78)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size * 0.56);
  return c.toDataURL('image/png');
}

const CAST = [
  { id: 'u-you', firstName: 'Alex', lastName: 'Morgan', color: '#4c6ef5', face: '🧑🏻‍💻' },
  { id: 'u-maya', firstName: 'Maya', lastName: 'Chen', color: '#e64980', face: '👩🏻‍💼' },
  { id: 'u-leo', firstName: 'Leo', lastName: 'Rossi', color: '#228be6', face: '🧑🏽‍🎨' },
  { id: 'u-aisha', firstName: 'Aisha', lastName: 'Khan', color: '#12b886', face: '👩🏾‍🔬' },
  { id: 'u-tom', firstName: 'Tom', lastName: 'Becker', color: '#f59f00', face: '🧔🏼' },
  { id: 'u-sofia', firstName: 'Sofia', lastName: 'Alves', color: '#7950f2', face: '👩🏼‍🦰' },
  { id: 'u-kenji', firstName: 'Kenji', lastName: 'Ito', color: '#15aabf', face: '👨🏻‍🚀' },
];

export function buildCast() {
  const now = Date.now();
  return CAST.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    color: c.color,
    avatar: drawAvatar(c.face, c.color),
    mood: '',
    birthday: null,
    createdAt: now - 30 * 864e5,
    lastSeen: now,
    admin: false,
  }));
}

export const STICKER_EMOJI = ['🎉', '❤️', '🔥', '🚀', '⭐', '🍕', '☕', '👏', '🌈', '💯', '🦄', '😂'];

export function buildStickers() {
  return STICKER_EMOJI.map((e, i) => ({ id: `s-${i}`, url: emojiImage(e), name: `emoji ${e}`, by: 'u-maya', at: Date.now() }));
}

export function buildRecs() {
  const at = Date.now() - 3 * 3600e3;
  return {
    shows: [
      { id: 'sh-1', title: 'Severance', kind: 'series', platform: 'Apple TV+', rating: 5, url: '', note: 'The best office show ever made. Ironic, we know.', by: 'u-aisha', likes: ['u-leo', 'u-tom'], comments: [], at },
      { id: 'sh-2', title: 'The Bear', kind: 'series', platform: 'Disney+', rating: 5, url: '', note: 'Yes chef. Watch it with snacks.', by: 'u-leo', likes: ['u-maya'], comments: [], at: at - 1e6 },
      { id: 'sh-3', title: 'Dune: Part Two', kind: 'movie', platform: 'Max', rating: 4, url: '', note: 'Biggest screen you can find.', by: 'u-tom', likes: [], comments: [], at: at - 2e6 },
    ],
    podcasts: [
      { id: 'pc-1', title: 'Design Matters', host: 'Debbie Millman', url: '', note: 'Great for Friday afternoons.', by: 'u-sofia', likes: ['u-maya'], comments: [], at },
    ],
    music: [],
    books: [
      { id: 'bk-1', title: 'Atomic Habits', author: 'James Clear', rating: 4, url: '', note: '', by: 'u-kenji', likes: [], comments: [], at },
      { id: 'bk-2', title: 'Shape Up', author: 'Ryan Singer', rating: 5, url: '', note: '', by: 'u-tom', likes: [], comments: [], at },
    ],
    places: [],
    giveaways: [
      { id: 'gv-1', title: 'Fresh croissants', desc: '', pickup: 'Kitchen', photo: null, by: 'u-sofia', status: 'available', claimedBy: null, at },
      { id: 'gv-2', title: 'Spare monitor', desc: '', pickup: 'Desk 4', photo: null, by: 'u-tom', status: 'available', claimedBy: null, at },
    ],
  };
}
