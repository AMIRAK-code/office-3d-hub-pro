// One JSON-file store per workspace: everything in memory, flushed to disk shortly after
// each change with an atomic write. Fine for offices of up to a few hundred people.
import fs from 'node:fs';
import path from 'node:path';

const COLLECTIONS = ['users', 'sessions', 'stickers', 'wall', 'requests', 'podcasts', 'music', 'shows', 'books', 'places', 'giveaways', 'mail'];
const open = new Set();

export function openStore(dir) {
  const file = path.join(dir, 'db.json');
  const uploadDir = path.join(dir, 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });

  let db = {};
  try {
    db = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      const backup = `${file}.corrupt-${Date.now()}`;
      console.error(`Could not read ${file} (${err.message}). Backed it up to ${backup}; starting fresh.`);
      fs.copyFileSync(file, backup);
      db = {};
    }
  }
  for (const c of COLLECTIONS) db[c] ||= {};
  db.meta ||= { z: 1 };

  let timer = null;
  const store = {
    db,
    dir,
    uploadDir,
    persist() {
      if (!timer) timer = setTimeout(store.flush, 400);
    },
    flush() {
      clearTimeout(timer);
      timer = null;
      const json = JSON.stringify(db);
      const tmp = `${file}.tmp`;
      try {
        fs.writeFileSync(tmp, json);
        fs.renameSync(tmp, file);
      } catch {
        // Windows can refuse the rename while another process (antivirus, backup) holds the file.
        fs.writeFileSync(file, json);
      }
    },
    close() {
      if (timer) store.flush();
      open.delete(store);
    },
  };
  // Drop sessions older than ~6 months, and sessions of deleted users.
  const ttl = 180 * 24 * 3600e3;
  for (const [token, s] of Object.entries(db.sessions)) {
    if (Date.now() - s.at > ttl || !db.users[s.userId]) delete db.sessions[token];
  }
  open.add(store);
  return store;
}

export function flushAll() {
  for (const s of open) s.flush();
}
