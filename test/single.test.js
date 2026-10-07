// Single-workspace (dedicated) mode, including upgrading an existing Office Board install.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, tempDir } from './helpers.js';

test('seeds the default workspace from environment variables', async () => {
  const srv = await startServer({ mode: 'single', env: { OFFICE_NAME: 'Studio North', OFFICE_PASSCODE: 'north-pass', OFFICE_ADMINS: 'Jane Doe' } });
  try {
    const cfg = await srv.api('GET', '/api/config');
    assert.equal(cfg.json.officeName, 'Studio North');
    assert.equal(cfg.json.passcodeRequired, true);
    assert.match((await srv.api('GET', '/')).text, /"slug":"default","base":"\/"/);
    assert.equal((await srv.api('GET', '/w/default/')).status, 404, 'path routing is a hosted-mode feature');
    const jane = await srv.api('POST', '/api/login', { body: { firstName: 'Jane', lastName: 'Doe', passcode: 'north-pass' } });
    assert.equal(jane.status, 200);
    assert.equal(jane.json.user.admin, true);
    const s = await srv.socket('default', jane.json.token);
    assert.equal(s.init.me.firstName, 'Jane');
  } finally {
    await srv.close();
  }
});

test('imports an existing Office Board data folder and fixes its image links', async () => {
  const dataDir = tempDir();
  fs.mkdirSync(path.join(dataDir, 'uploads'));
  fs.writeFileSync(path.join(dataDir, 'uploads', 'abc123.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
  const legacy = {
    users: { u1: { id: 'u1', key: 'sara|bianchi', firstName: 'Sara', lastName: 'Bianchi', avatar: '/uploads/abc123.png', color: '#228be6', createdAt: 1, lastSeen: 1 } },
    sessions: {}, stickers: {}, wall: {}, requests: {}, podcasts: {}, shows: {}, giveaways: {}, mail: {}, meta: { z: 5 },
  };
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify(legacy));
  const srv = await startServer({ mode: 'single', dataDir });
  try {
    const sara = await srv.api('POST', '/api/login', { body: { firstName: 'sara', lastName: 'BIANCHI' } });
    assert.equal(sara.json.isNew, false, 'existing people keep their accounts');
    assert.equal(sara.json.user.avatar, '/u/default/abc123.png');
    assert.equal((await fetch(srv.base + sara.json.user.avatar)).status, 200);
    assert.ok(fs.existsSync(path.join(dataDir, 'db.json')), 'original data is left untouched');
  } finally {
    await srv.close();
  }
});
