const crypto = require('crypto');
const { clientIp } = require('../utils/clientIp');

// Simple in-memory store with sliding window (for serverless, use Vercel KV/Upstash Redis in production)
class RateLimitStore {
  constructor() {
    this.windows = new Map(); // key -> { count, resetTime, requests: [{time, count}] }
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    if (this.cleanupInterval && this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.windows.entries()) {
      if (data.resetTime < now) {
        this.windows.delete(key);
      }
    }
  }

  increment(key, windowMs, maxRequests) {
    const now = Date.now();
    let data = this.windows.get(key);
    
    if (!data || data.resetTime < now) {
      data = { count: 0, resetTime: now + windowMs, requests: [] };
      this.windows.set(key, data);
    }
    
    // Sliding window: remove old requests
    data.requests = data.requests.filter(r => r.time > now - windowMs);
    data.requests.push({ time: now, count: 1 });
    data.count = data.requests.length;
    
    return {
      allowed: data.count <= maxRequests,
      remaining: Math.max(0, maxRequests - data.count),
      resetTime: data.resetTime,
      total: data.count
    };
  }

  // For testing/manual reset
  reset(key) {
    this.windows.delete(key);
  }
}

const store = new RateLimitStore();

function createRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes default
    maxRequests = 100, // 100 requests per window
    keyGenerator = (req) => clientIp(req),
    message = 'Terlalu banyak permintaan, coba lagi nanti',
    statusCode = 429,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    handler = null
  } = options;

  return async function rateLimiter(req, res, next) {
    const key = `rl:${keyGenerator(req)}`;
    const result = store.increment(key, windowMs, maxRequests);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);
      
      if (handler) {
        return handler(req, res, next);
      }
      
      return res.status(statusCode).json({ 
        error: message,
        retryAfter,
        limit: maxRequests,
        remaining: 0
      });
    }

    next();
  };
}

// Specific limiters for auth endpoints
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 attempts per 15 min per IP
  keyGenerator: (req) => `auth:${clientIp(req)}`,
  message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.'
});

const editorLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  keyGenerator: (req) => `editor-login:${clientIp(req)}`,
  message: 'Terlalu banyak percobaan login karyawan. Coba lagi dalam 15 menit.'
});

// Per-user rate limiter for mutating endpoints
const userMutationLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 mutations per minute per user
  keyGenerator: (req) => {
    const userId = req.isAdmin ? 'admin' : req.editor ? 'editor:' + req.editor.id : clientIp(req);
    return `mutation:${userId}:${req.method}:${req.path}`;
  },
  message: 'Terlalu banyak aksi mutasi. Tunggu sebentar.'
});

// Idempotency key store (in-memory, use Redis in production)
const idempotencyStore = new Map();
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours

function checkIdempotency(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (!key) return next();
  
  const cached = idempotencyStore.get(key);
  if (cached && cached.expires > Date.now()) {
    return res.status(cached.status).json(cached.body);
  }
  
  // Store original send to capture response
  const originalSend = res.send;
  res.send = function(body) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyStore.set(key, {
        status: res.statusCode,
        body: JSON.parse(body),
        expires: Date.now() + IDEMPOTENCY_TTL
      });
    }
    return originalSend.call(this, body);
  };
  
  next();
}

// Cleanup idempotency store periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of idempotencyStore.entries()) {
    if (val.expires < now) idempotencyStore.delete(key);
  }
}, 3600000).unref(); // Every hour

module.exports = {
  createRateLimiter,
  authLimiter,
  editorLoginLimiter,
  userMutationLimiter,
  checkIdempotency,
  store,
  idempotencyStore
};