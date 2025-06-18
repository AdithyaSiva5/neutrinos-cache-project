const { limiter } = require('../middleware/rateLimit');
const { log } = require('../utils/logger');
const { apiLatency, cacheHitRatio, cacheHits, cacheMisses } = require('../utils/metrics');
const { getConfig, updateConfig } = require('../services/configService');
const { cacheNode, updateMetadata, invalidateNode } = require('../services/cacheService');

module.exports = (app) => {
  app.use('/api/:tenantId/:configId', limiter);

  app.get('/api/:tenantId/:configId', async (req, res) => {
    const startTime = performance.now();
    const end = apiLatency.startTimer({ endpoint: '/api/:tenantId/:configId', method: 'GET' });
    const { tenantId, configId } = req.params;
    const { path } = req.query;
    if (!/^[A-Za-z0-9]+$/.test(tenantId) || !/^[A-Za-z0-9]+$/.test(configId)) {
      log('GET /api/:tenantId/:configId', `Invalid tenantId or configId`, { tenantId, configId }, 'error');
      end();
      return res.status(400).json({ error: 'Tenant ID and Config ID must be alphanumeric' });
    }
    try {
      const config = await getConfig(tenantId, configId, path);
      cacheHitRatio.set(cacheHits / (cacheHits + cacheMisses || 1));
      end();
      res.json({ config });
    } catch (err) {
      log('GET /api/:tenantId/:configId', `Error: ${err.message}`, err.stack, 'error', performance.now() - startTime);
      end();
      res.status(500).json({ error: `Failed to fetch config: ${err.message}` });
    }
  });

  app.post('/api/:tenantId/:configId', async (req, res) => {
    const end = apiLatency.startTimer({ endpoint: '/api/:tenantId/:configId', method: 'POST' });
    const { tenantId, configId } = req.params;
    const { path, value, dependencies, userId } = req.body;
    if (!/^[A-Za-z0-9]+$/.test(tenantId) || !/^[A-Za-z0-9]+$/.test(configId)) {
      log('POST /api/:tenantId/:configId', `Invalid tenantId or configId`, { tenantId, configId }, 'error');
      end();
      return res.status(400).json({ error: 'Tenant ID and Config ID must be alphanumeric' });
    }
    if (!path.startsWith('/')) {
      log('POST /api/:tenantId/:configId', `Invalid path`, null, 'error');
      end();
      return res.status(400).json({ error: 'Path must start with /' });
    }
    try {
      const version = `v${Date.now()}`;
      await cacheNode(tenantId, configId, path, value, version);
      await updateMetadata(tenantId, configId, path, dependencies, version);
      await invalidateNode(tenantId, configId, path, userId);
      const result = await updateConfig(tenantId, configId, path, value, dependencies, userId);
      end();
      res.json(result);
    } catch (err) {
      log('POST /api/:tenantId/:configId', `Error: ${err.message}`, err.stack, 'error');
      end();
      res.status(500).json({ error: `Failed to update config: ${err.message}` });
    }
  });
};