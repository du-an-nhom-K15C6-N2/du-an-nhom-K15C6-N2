const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config/app.config');

const STORE_FILE = config.SESSION_STORE_FILE;
const LOCK_DIR = `${STORE_FILE}.lock`;
const LOCK_TIMEOUT_MS = 5000;
const STALE_LOCK_AGE_MS = 60_000;

function emptyStore() {
  return {
    revokedTokens: {},
    revokedSessions: {},
    activeSessions: {}
  };
}

function readStore() {
  if (!fs.existsSync(STORE_FILE)) return emptyStore();
  const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  if (
    !parsed
    || typeof parsed !== 'object'
    || !parsed.revokedTokens
    || typeof parsed.revokedTokens !== 'object'
    || !parsed.revokedSessions
    || typeof parsed.revokedSessions !== 'object'
  ) {
    throw new Error(`Kho phiên không hợp lệ: ${STORE_FILE}`);
  }
  return parsed;
}

function acquireLock() {
  const startedAt = Date.now();
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });

  while (Date.now() - startedAt < LOCK_TIMEOUT_MS) {
    try {
      fs.mkdirSync(LOCK_DIR);
      fs.writeFileSync(
        path.join(LOCK_DIR, 'owner.json'),
        JSON.stringify({ pid: process.pid, acquiredAt: Date.now() }),
        { flag: 'wx', mode: 0o600 }
      );
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;

      try {
        const lockAge = Date.now() - fs.statSync(LOCK_DIR).mtimeMs;
        if (lockAge > STALE_LOCK_AGE_MS) {
          fs.rmSync(LOCK_DIR, { recursive: true, force: true });
          continue;
        }
      } catch (lockError) {
        if (lockError.code !== 'ENOENT') throw lockError;
      }

      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }

  throw new Error(`Hết thời gian chờ khóa kho phiên: ${STORE_FILE}`);
}

function withStoreLock(operation) {
  acquireLock();
  try {
    return operation();
  } finally {
    fs.rmSync(LOCK_DIR, { recursive: true, force: true });
  }
}

function writeStore(store) {
  const temporaryFile = `${STORE_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(store), { mode: 0o600 });
  fs.renameSync(temporaryFile, STORE_FILE);
}

function pruneExpired(store, now) {
  let changed = false;
  for (const [tokenId, expiry] of Object.entries(store.revokedTokens)) {
    if (!Number.isFinite(expiry) || expiry <= now) {
      delete store.revokedTokens[tokenId];
      changed = true;
    }
  }
  for (const [sessionId, expiry] of Object.entries(store.revokedSessions)) {
    if (!Number.isFinite(expiry) || expiry <= now) {
      delete store.revokedSessions[sessionId];
      changed = true;
    }
  }
  return changed;
}

function isRevoked(tokenId, sessionId, now) {
  return withStoreLock(() => {
    const store = readStore();
    const changed = pruneExpired(store, now);
    const revoked = Boolean(store.revokedTokens[tokenId] || store.revokedSessions[sessionId]);
    if (changed) writeStore(store);
    return revoked;
  });
}

function revokeToken(tokenId, expiresAt) {
  withStoreLock(() => {
    const store = readStore();
    const now = Math.floor(Date.now() / 1000);
    pruneExpired(store, now);
    store.revokedTokens[tokenId] = expiresAt;
    writeStore(store);
  });
}

function revokeSession(sessionId, expiresAt) {
  withStoreLock(() => {
    const store = readStore();
    const now = Math.floor(Date.now() / 1000);
    pruneExpired(store, now);
    store.revokedSessions[sessionId] = expiresAt;
    writeStore(store);
  });
}
function registerSession(userId, sessionId, expiresAt) {
  withStoreLock(() => {
    const store = readStore();

    if (!store.activeSessions || typeof store.activeSessions !== 'object') {
      store.activeSessions = {};
    }

    if (!store.activeSessions[userId]) {
      store.activeSessions[userId] = {};
    }

    store.activeSessions[userId][sessionId] = expiresAt;

    writeStore(store);
  });
}

function revokeAllSessions(userId) {
  return withStoreLock(() => {
    const store = readStore();
    const now = Math.floor(Date.now() / 1000);
    pruneExpired(store, now);

    if (!store.activeSessions || typeof store.activeSessions !== 'object') {
      store.activeSessions = {};
    }
    if (!store.revokedSessions || typeof store.revokedSessions !== 'object') {
      store.revokedSessions = {};
    }

    const userSessions = store.activeSessions[userId] || {};
    let revokedCount = 0;

    for (const [sessionId, expiresAt] of Object.entries(userSessions)) {
      if (Number.isFinite(expiresAt) && expiresAt > now) {
        store.revokedSessions[sessionId] = expiresAt;
        revokedCount += 1;
      }
    }

    delete store.activeSessions[userId];
    writeStore(store);
    return revokedCount;
  });
}

function revokeOtherSessions(userId, currentSessionId) {
  withStoreLock(() => {
    const store = readStore();

    if (!store.activeSessions || typeof store.activeSessions !== 'object') {
      store.activeSessions = {};
    }

    const userSessions = store.activeSessions[userId] || {};

    for (const [sessionId, expiresAt] of Object.entries(userSessions)) {
      if (sessionId !== currentSessionId) {
        store.revokedSessions[sessionId] = expiresAt;
        delete userSessions[sessionId];
      }
    }

    store.activeSessions[userId] = userSessions;

    writeStore(store);
  });
}
module.exports = {
  isRevoked,
  revokeToken,
  revokeSession,
  registerSession,
  revokeAllSessions,
  revokeOtherSessions
};
