const crypto = require('crypto');
const sessionStore = require('./sessionStore');

const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || crypto.randomBytes(32);
const TOKEN_LIFETIME_SECONDS = 24 * 60 * 60;

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(value).digest('base64url');
}

function createToken(user, sessionId = crypto.randomUUID(), lifetimeSeconds = TOKEN_LIFETIME_SECONDS) {
  const now = Math.floor(Date.now() / 1000);

  sessionStore.registerSession(
    user.id,
    sessionId,
    now + lifetimeSeconds
  );
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    sub: user.id,
    role: user.role,
    roles: Array.isArray(user.roles) ? user.roles : [user.role],
    sid: sessionId,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + lifetimeSeconds
  }));
  const value = `${header}.${payload}`;
  return `${value}.${sign(value)}`;
}

function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerPart, payloadPart, signature] = parts;
  const value = `${headerPart}.${payloadPart}`;
  const expectedSignature = sign(value);
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    return null;
  }

  let payload;
  try {
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    if (header.alg !== 'HS256') return null;
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.sub || !payload.sid || !payload.exp || payload.exp <= now) return null;

  const tokenId = crypto.createHash('sha256').update(token).digest('hex');
  if (sessionStore.isRevoked(tokenId, payload.sid, now)) return null;
  return payload;
}

function revokeToken(token, expiresAt) {
  const tokenId = crypto.createHash('sha256').update(token).digest('hex');
  sessionStore.revokeToken(tokenId, expiresAt);
}

function revokeSession(sessionId, expiresAt) {
  sessionStore.revokeSession(sessionId, expiresAt);
}

module.exports = {
  createToken,
  verifyToken,
  revokeToken,
  revokeSession,
  TOKEN_LIFETIME_SECONDS
};
