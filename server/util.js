import crypto from 'node:crypto';

export const newId = () => Date.now().toString(36) + crypto.randomBytes(5).toString('hex');
export const newToken = () => crypto.randomBytes(24).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

/** Constant-time string comparison (hashes both sides so lengths never leak). */
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const hb = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Salted scrypt hash for workspace passcodes, stored as "scrypt$salt$hash". */
export function hashSecret(secret) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = crypto.scryptSync(String(secret), salt, 32).toString('base64url');
  return `scrypt$${salt}$${hash}`;
}

export function verifySecret(secret, stored) {
  if (typeof stored !== 'string' || !stored.startsWith('scrypt$')) return false;
  const [, salt, hash] = stored.split('$');
  const test = crypto.scryptSync(String(secret ?? ''), salt, 32);
  const expected = Buffer.from(hash, 'base64url');
  return expected.length === test.length && crypto.timingSafeEqual(test, expected);
}

export const cleanName = (s) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ').slice(0, 40) : '');
export const personKey = (first, last) => `${first}|${last}`.toLocaleLowerCase('en').normalize('NFKC');
