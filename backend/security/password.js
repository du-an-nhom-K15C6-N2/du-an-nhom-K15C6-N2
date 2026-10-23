const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const DUMMY_PASSWORD_HASH = `scrypt$${'0'.repeat(32)}$${crypto.scryptSync('dummy-password', Buffer.from('0'.repeat(32), 'hex'), KEY_LENGTH).toString('hex')}`;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

function hashPasswordSync(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, passwordHash) {
  const parts = typeof passwordHash === 'string' ? passwordHash.split('$') : [];
  const hasValidHash = parts.length === 3
    && parts[0] === 'scrypt'
    && /^[a-f0-9]{32}$/.test(parts[1])
    && /^[a-f0-9]{128}$/.test(parts[2]);
  const [, saltHex, keyHex] = hasValidHash
    ? parts
    : DUMMY_PASSWORD_HASH.split('$');

  const expectedKey = Buffer.from(keyHex, 'hex');
  const actualKey = await scrypt(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH);
  const passwordMatches = crypto.timingSafeEqual(expectedKey, actualKey);
  return hasValidHash && passwordMatches;
}

module.exports = { hashPassword, hashPasswordSync, verifyPassword };
