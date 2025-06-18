const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  keyGenerator: (req) => `${req.params.tenantId}:${req.ip}`,
  message: 'Too many requests, please try again later.',
});

module.exports = { limiter };