import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, validateSlug, featureForAction, publicConfig, ConfigError, FEATURES } from '../server/config.js';
import { verifySecret } from '../server/util.js';

test('defaults: every feature on, brand falls back to the workspace name', () => {
  const c = normalizeConfig({ name: 'Acme Studio' });
  assert.equal(c.brand.name, 'Acme Studio');
  assert.equal(c.brand.sign, 'Acme Studio');
  assert.ok(Object.keys(FEATURES).every((f) => c.features[f] === true));
  assert.equal(c.seats, 0);
  assert.equal(c.access.passcodeHash, null);
});

test('passcodes are stored only as a salted hash', () => {
  const c = normalizeConfig({ name: 'A', access: { passcode: 'open-sesame' } });
  assert.ok(!JSON.stringify(c).includes('open-sesame'));
  assert.ok(verifySecret('open-sesame', c.access.passcodeHash));
  assert.ok(!verifySecret('wrong', c.access.passcodeHash));
  // Updating something else keeps the passcode; clearing it removes it.
  const kept = normalizeConfig({ brand: { tagline: 'hi' } }, c);
  assert.equal(kept.access.passcodeHash, c.access.passcodeHash);
  assert.equal(normalizeConfig({ access: { passcode: '' } }, c).access.passcodeHash, null);
});

test('rejects bad input with a readable error', () => {
  assert.throws(() => normalizeConfig({}), ConfigError);
  assert.throws(() => normalizeConfig({ name: 'A', theme: { accent: 'purple' } }), /theme.accent/);
  assert.throws(() => normalizeConfig({ name: 'A', features: { teleporter: true } }), /Unknown feature/);
  assert.throws(() => normalizeConfig({ name: 'A', domains: ['not a domain'] }), /not a valid domain/);
  assert.throws(() => normalizeConfig({ name: 'A', seats: -1 }), /seats/);
  assert.throws(() => normalizeConfig({ name: 'A', access: { passcode: '12' } }), /Passcode/);
});

test('workspace ids', () => {
  assert.equal(validateSlug('acme-studio'), 'acme-studio');
  for (const bad of ['', 'Acme', 'a_b', '-acme', 'acme-', 'a'.repeat(41), '../x']) assert.throws(() => validateSlug(bad), ConfigError, bad);
  assert.throws(() => validateSlug('api'), /reserved/);
  assert.equal(validateSlug('default', { allowReserved: true }), 'default');
});

test('server actions map to the feature that owns them', () => {
  assert.equal(featureForAction('wall.add'), 'stickers');
  assert.equal(featureForAction('wall.addNote'), 'notes');
  assert.equal(featureForAction('wall.update'), null); // moving your own item is always allowed
  assert.equal(featureForAction('music.comment'), 'radio');
  assert.equal(featureForAction('game.move'), 'games');
  assert.equal(featureForAction('profile.update'), null);
});

test('public config never exposes access details', () => {
  const c = normalizeConfig({ name: 'A', access: { passcode: 'secret1', admins: ['Jane Doe'] } });
  const p = publicConfig('a', c);
  assert.equal(p.passcodeRequired, true);
  assert.equal('access' in p, false);
  assert.ok(!JSON.stringify(p).includes('scrypt'));
});
