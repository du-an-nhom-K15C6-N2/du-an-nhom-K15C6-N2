const failedAttempts = new Map();

const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 phút

function recordFailedAttempt(email) {
  const key = email.toLowerCase().trim();

  const current = failedAttempts.get(key) || {
    count: 0,
    lockedUntil: null
  };

  current.count += 1;

  if (current.count >= MAX_ATTEMPTS) {
    current.lockedUntil = Date.now() + LOCKOUT_TIME;
  }

  failedAttempts.set(key, current);

  return current;
}

function isLocked(email) {
  const key = email.toLowerCase().trim();
  const data = failedAttempts.get(key);

  if (!data) {
    return false;
  }

  if (data.lockedUntil && Date.now() < data.lockedUntil) {
    return true;
  }

  if (data.lockedUntil && Date.now() >= data.lockedUntil) {
    failedAttempts.delete(key);
  }

  return false;
}

function resetAttempts(email) {
  const key = email.toLowerCase().trim();
  failedAttempts.delete(key);
}

function getAttempts(email) {
  const key = email.toLowerCase().trim();

  return failedAttempts.get(key) || {
    count: 0,
    lockedUntil: null
  };
}

module.exports = {
  MAX_ATTEMPTS,
  LOCKOUT_TIME,
  recordFailedAttempt,
  isLocked,
  resetAttempts,
  getAttempts
};