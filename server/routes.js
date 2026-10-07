// HTTP API for one workspace (req.ws is set by the app's workspace resolver).
import express from 'express';
import { newId, newToken, verifySecret, cleanName, personKey } from './util.js';
import { saveDataUrlImage } from './uploads.js';
import { pickColor } from './hub.js';
import { publicConfig } from './config.js';

// Small brute-force guard for workspace passcodes, per IP and workspace.
const failures = new Map();
const tooMany = (key) => {
  const f = failures.get(key);
  return !!f && Date.now() - f.since < 60e3 && f.count >= 8;
};
const fail = (key) => {
  const f = failures.get(key);
  if (!f || Date.now() - f.since > 60e3) failures.set(key, { count: 1, since: Date.now() });
  else f.count++;
};
setInterval(() => {
  for (const [k, f] of failures) if (Date.now() - f.since > 60e3) failures.delete(k);
}, 5 * 60e3).unref();

function userFromReq(req) {
  const auth = req.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const { db } = req.ws.store;
  const session = token && db.sessions[token];
  return session ? db.users[session.userId] : null;
}

export function workspaceApi() {
  const r = express.Router();

  r.get('/config', (req, res) => res.json(publicConfig(req.ws.slug, req.ws.config())));

  r.post('/login', (req, res) => {
    const ws = req.ws;
    const cfg = ws.config();
    const { firstName, lastName, passcode } = req.body || {};
    if (cfg.access.passcodeHash) {
      const key = `${req.ip}|${ws.slug}`;
      if (tooMany(key)) return res.status(429).json({ error: 'Too many attempts — wait a minute and try again.' });
      if (!verifySecret(passcode, cfg.access.passcodeHash)) {
        fail(key);
        return res.status(401).json({ error: 'Wrong office passcode' });
      }
    }
    const first = cleanName(firstName);
    const last = cleanName(lastName);
    if (!first || !last) return res.status(400).json({ error: 'Please enter both your name and your surname' });

    const { db } = ws.store;
    const key = personKey(first, last);
    let user = Object.values(db.users).find((u) => u.key === key);
    const isNew = !user;
    if (!user) {
      if (ws.seatsLeft() <= 0) return res.status(403).json({ error: 'This workspace has reached its seat limit. Ask your admin to add seats.' });
      const now = Date.now();
      user = { id: newId(), key, firstName: first, lastName: last, avatar: null, mood: '', birthday: null, color: pickColor(key), createdAt: now, lastSeen: now };
      db.users[user.id] = user;
      ws.hub.upsert('users', user);
    }
    const token = newToken();
    db.sessions[token] = { userId: user.id, at: Date.now() };
    ws.store.persist();
    res.json({ token, user: ws.hub.publicUser(user), isNew });
  });

  r.get('/me', (req, res) => {
    const user = userFromReq(req);
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    res.json({ user: req.ws.hub.publicUser(user) });
  });

  r.post('/logout', (req, res) => {
    const auth = req.get('authorization') || '';
    delete req.ws.store.db.sessions[auth.replace(/^Bearer /, '')];
    req.ws.store.persist();
    res.json({ ok: true });
  });

  r.post('/upload', (req, res) => {
    const ws = req.ws;
    const user = userFromReq(req);
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    const { kind, dataUrl, name } = req.body || {};
    if (!['avatar', 'sticker', 'photo'].includes(kind)) return res.status(400).json({ error: 'Unknown upload type' });
    if (kind === 'sticker' && !ws.config().features.stickers) return res.status(403).json({ error: 'Stickers are turned off for this workspace' });
    let url;
    try {
      url = saveDataUrlImage(dataUrl, ws.store.uploadDir, ws.slug);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    const { db } = ws.store;
    if (kind === 'avatar') {
      user.avatar = url;
      ws.hub.upsert('users', user);
    }
    if (kind === 'sticker') {
      const sticker = { id: newId(), url, name: cleanName(name) || 'sticker', by: user.id, at: Date.now() };
      db.stickers[sticker.id] = sticker;
      ws.hub.upsert('stickers', sticker);
      ws.store.persist();
      return res.json({ url, sticker });
    }
    ws.store.persist();
    res.json({ url });
  });

  return r;
}
