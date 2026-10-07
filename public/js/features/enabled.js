// Which workspace features are switched on (from /api/config). Mirrors server/config.js FEATURES.
let features = {};

export function setFeatures(f) {
  features = f || {};
}

/** True unless the workspace explicitly turned the feature off. */
export const isOn = (feature) => features[feature] !== false;

/** UI entry points (dock buttons, props, actions) → the feature they need. */
const NEEDS = {
  radio: ['radio'],
  tv: ['tv'],
  books: ['books'],
  places: ['places'],
  basket: ['giveaways'],
  birthdays: ['birthdays'],
  cake: ['birthdays'],
  requests: ['requests'],
  games: ['games'],
  darts: ['games'],
  jukebox: ['jukebox'],
  mail: ['stickers'],
  send: ['stickers'],
  stickers: ['stickers', 'notes'], // the tray holds both
  trash: ['stickers', 'notes'],
};

/** Can this UI entry point be used? (any one of its features is enough) */
export const canOpen = (name) => !NEEDS[name] || NEEDS[name].some(isOn);
