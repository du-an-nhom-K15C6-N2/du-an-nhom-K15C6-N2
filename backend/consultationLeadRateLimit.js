'use strict';

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_REQUESTS = 5;

function createConsultationRateLimiter({
  windowMs = DEFAULT_WINDOW_MS,
  maxRequests = DEFAULT_MAX_REQUESTS,
  now = Date.now
} = {}) {
  const requestsByAddress = new Map();
  const cleanupTimer = setInterval(() => {
    const currentTime = now();
    for (const [address, entry] of requestsByAddress) {
      if (entry.resetAt <= currentTime) requestsByAddress.delete(address);
    }
  }, Math.min(windowMs, 60_000));
  cleanupTimer.unref();

  function middleware(req, res, next) {
    const address = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    const currentTime = now();
    let entry = requestsByAddress.get(address);
    if (!entry || entry.resetAt <= currentTime) {
      entry = { count: 0, resetAt: currentTime + windowMs };
      requestsByAddress.set(address, entry);
    }

    if (entry.count >= maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        success: false,
        code: 'CONSULTATION_RATE_LIMITED',
        message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.'
      });
    }

    entry.count += 1;
    res.set('RateLimit-Limit', String(maxRequests));
    res.set('RateLimit-Remaining', String(maxRequests - entry.count));
    return next();
  }

  middleware.clear = () => requestsByAddress.clear();
  return middleware;
}

const consultationRateLimiter = createConsultationRateLimiter();

module.exports = { consultationRateLimiter, createConsultationRateLimiter };
