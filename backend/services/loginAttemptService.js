const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000;
const LOCK_TIMEOUT_MS = 5000;
const STALE_LOCK_AGE_MS = 60_000;

function getStoreFile() {
  return process.env.LOGIN_ATTEMPT_STORE_FILE
    || require('../config/app.config').LOGIN_ATTEMPT_STORE_FILE;
}

function getLockDirectory(storeFile) {
  return `${storeFile}.lock`;
}

function emailKey(email) {
  if (typeof email !== 'string' || !email.trim()) {
    throw new TypeError('Email phải là chuỗi không rỗng.');
  }
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

function readStore(storeFile) {
  if (!fs.existsSync(storeFile)) return {};

  const store = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
  if (!store || typeof store !== 'object' || Array.isArray(store)) {
    throw new Error(`Kho số lần đăng nhập sai không hợp lệ: ${storeFile}`);
  }

  for (const [key, attempt] of Object.entries(store)) {
    if (
      !/^[a-f0-9]{64}$/.test(key)
      || !attempt
      || !Number.isInteger(attempt.count)
      || attempt.count < 1
      || (attempt.lockedUntil !== null && !Number.isFinite(attempt.lockedUntil))
    ) {
      throw new Error(`Dữ liệu số lần đăng nhập sai không hợp lệ: ${storeFile}`);
    }
  }

  return store;
}

function writeStore(storeFile, store) {
  fs.mkdirSync(path.dirname(storeFile), { recursive: true });
  const temporaryFile = `${storeFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryFile, JSON.stringify(store), { mode: 0o600 });
    fs.renameSync(temporaryFile, storeFile);
  } finally {
    if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
  }
}

function acquireLock(lockDirectory) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < LOCK_TIMEOUT_MS) {
    let lockCreated = false;
    try {
      fs.mkdirSync(lockDirectory, { recursive: false });
      lockCreated = true;
      fs.writeFileSync(
        path.join(lockDirectory, 'owner.json'),
        JSON.stringify({ pid: process.pid, acquiredAt: Date.now() }),
        { flag: 'wx', mode: 0o600 }
      );
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') {
        if (lockCreated) fs.rmSync(lockDirectory, { recursive: true, force: true });
        throw error;
      }

      try {
        if (Date.now() - fs.statSync(lockDirectory).mtimeMs > STALE_LOCK_AGE_MS) {
          fs.rmSync(lockDirectory, { recursive: true, force: true });
          continue;
        }
      } catch (lockError) {
        if (lockError.code !== 'ENOENT') throw lockError;
      }

      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }

  throw new Error(`Hết thời gian chờ khóa kho số lần đăng nhập sai: ${lockDirectory}`);
}

function withStore(operation, now = Date.now()) {
  const storeFile = getStoreFile();
  const lockDirectory = getLockDirectory(storeFile);
  fs.mkdirSync(path.dirname(storeFile), { recursive: true });
  acquireLock(lockDirectory);

  try {
    const store = readStore(storeFile);
    let changed = false;

    for (const [key, attempt] of Object.entries(store)) {
      if (attempt.lockedUntil !== null && attempt.lockedUntil <= now) {
        delete store[key];
        changed = true;
      }
    }

    const result = operation(store, () => {
      changed = true;
    });

    if (changed) writeStore(storeFile, store);
    return result;
  } finally {
    fs.rmSync(lockDirectory, { recursive: true, force: true });
  }
}

function recordFailedAttempt(email, now = Date.now()) {
  const key = emailKey(email);
  return withStore((store, markChanged) => {
    const current = store[key];
    if (current?.lockedUntil && current.lockedUntil > now) {
      return { ...current };
    }

    const count = (current?.count || 0) + 1;
    const attempt = {
      count,
      lockedUntil: count >= MAX_ATTEMPTS ? now + LOCKOUT_TIME : null
    };
    store[key] = attempt;
    markChanged();
    return { ...attempt };
  }, now);
}

function isLocked(email, now = Date.now()) {
  return getLockoutRemainingMs(email, now) > 0;
}

function getLockoutRemainingMs(email, now = Date.now()) {
  const key = emailKey(email);
  return withStore(store => {
    const lockedUntil = store[key]?.lockedUntil;
    return lockedUntil && lockedUntil > now ? lockedUntil - now : 0;
  }, now);
}

function resetAttempts(email) {
  const key = emailKey(email);
  return withStore((store, markChanged) => {
    if (store[key]) {
      delete store[key];
      markChanged();
    }
  });
}

function getAttempts(email, now = Date.now()) {
  const key = emailKey(email);
  return withStore(store => store[key] ? { ...store[key] } : {
    count: 0,
    lockedUntil: null
  }, now);
}

module.exports = {
  MAX_ATTEMPTS,
  LOCKOUT_TIME,
  recordFailedAttempt,
  isLocked,
  getLockoutRemainingMs,
  resetAttempts,
  getAttempts
};
