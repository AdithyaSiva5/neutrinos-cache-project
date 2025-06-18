const { redis } = require('../config/redis');
const { log } = require('../utils/logger');
const { register, apiLatency, cacheHitRatio, cacheHits, cacheMisses } = require('../utils/metrics');

module.exports = (app) => {
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  app.get('/metrics/:tenantId/:configId', async (req, res) => {
    const end = apiLatency.startTimer({ endpoint: '/metrics/:tenantId/:configId', method: 'GET' });
    const { tenantId, configId } = req.params;
    const { limit = 100, offset = 0 } = req.query;
    if (!/^[A-Za-z0-9]+$/.test(tenantId) || !/^[A-Za-z0-9]+$/.test(configId)) {
      log('GET /metrics/:tenantId/:configId', `Invalid tenantId or configId`, { tenantId, configId }, 'error');
      end();
      return res.status(400).json({ error: 'Tenant ID and Config ID must be alphanumeric' });
    }
    log('GET /metrics/:tenantId/:configId', `Request`, { limit, offset });
    try {
      const cachedNodes = await redis.smembers(`tenant:${tenantId}:config:${configId}:cached_nodes`);
      const paginatedNodes = cachedNodes.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
      const pipeline = redis.pipeline();
      paginatedNodes.forEach(node => {
        pipeline.hgetall(`tenant:${tenantId}:config:${configId}:metadata:${node}`);
      });
      const results = await pipeline.exec();
      const metrics = results.map(([err, metadata], i) => {
        if (err) throw err;
        return {
          path: paginatedNodes[i],
          metadata: {
            ...metadata,
            dependencies: JSON.parse(metadata.dependencies || '[]'),
            dependents: JSON.parse(metadata.dependents || '[]'),
          },
        };
      });
      log('GET /metrics/:tenantId/:configId', `Returning ${metrics.length} metrics`, null, 'success');
      cacheHitRatio.set(cacheHits / (cacheHits + cacheMisses || 1));
      end();
      res.json({ cachedNodes, metrics, cacheStats: { hits: cacheHits, misses: cacheMisses } });
    } catch (err) {
      log('GET /metrics/:tenantId/:configId', `Error: ${err.message}`, err.stack, 'error');
      end();
      res.status(500).json({ error: err.message });
    }
  });
};