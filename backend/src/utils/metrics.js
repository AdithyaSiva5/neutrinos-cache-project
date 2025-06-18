const prom = require('prom-client');

const register = new prom.Registry();

const apiLatency = new prom.Histogram({
  name: 'api_request_latency_seconds',
  help: 'API request latency in seconds',
  labelNames: ['endpoint', 'method'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const cacheHitRatio = new prom.Gauge({
  name: 'cache_hit_ratio',
  help: 'Cache hit ratio',
  registers: [register],
});

let cacheHits = 0;
let cacheMisses = 0;

module.exports = { register, apiLatency, cacheHitRatio, cacheHits, cacheMisses };