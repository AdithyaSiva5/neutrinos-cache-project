const { pool } = require('../config/database');
const { redis } = require('../config/redis');
const { log } = require('../utils/logger');

async function getConfig(tenantId, configId, path) {
  const startTime = performance.now();
  const cacheKey = `tenant:${tenantId}:config:${configId}:full${path ? `:${path}` : ''}`;
  const cachedConfig = await redis.get(cacheKey);
  if (cachedConfig) {
    log('getConfig', `Cache hit for ${cacheKey}`, null, 'success', performance.now() - startTime);
    return JSON.parse(cachedConfig);
  }
  log('getConfig', `Cache miss, querying DB`, null, 'warn');
  const query = path
    ? 'SELECT path, value FROM configs WHERE tenant_id = $1 AND config_id = $2 AND path LIKE $3 ORDER BY path'
    : 'SELECT path, value FROM configs WHERE tenant_id = $1 AND config_id = $2 ORDER BY path';
  const params = path ? [tenantId, configId, path + '%'] : [tenantId, configId];
  const dbStart = performance.now();
  const result = await pool.query(query, params);
  log('getConfig', `DB query completed`, null, 'success', performance.now() - dbStart);
  const config = {};
  result.rows.forEach(row => {
    const keys = row.path.split('/').filter(k => k);
    let current = config;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = current[keys[i]] || {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = { value: row.value };
  });
  await redis.setex(cacheKey, 3600, JSON.stringify(config));
  log('getConfig', `Cached and returning config`, null, 'success', performance.now() - startTime);
  return config;
}

async function updateConfig(tenantId, configId, path, value, dependencies, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO configs (tenant_id, config_id, path, value, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tenant_id, config_id, path) DO UPDATE SET value = $4, updated_at = $5',
      [tenantId, configId, path, value, new Date()]
    );
    const cacheKey = `tenant:${tenantId}:config:${configId}:full`;
    let config = {};
    const cachedConfig = await redis.get(cacheKey);
    if (cachedConfig) {
      config = JSON.parse(cachedConfig);
    } else {
      const result = await pool.query(
        'SELECT path, value FROM configs WHERE tenant_id = $1 AND config_id = $2 ORDER BY path',
        [tenantId, configId]
      );
      result.rows.forEach(row => {
        const keys = row.path.split('/').filter(k => k);
        let current = config;
        for (let i = 0; i < keys.length - 1; i++) {
          current[keys[i]] = current[keys[i]] || {};
          current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = { value: row.value };
      });
    }
    const keys = path.split('/').filter(k => k);
    let current = config;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = current[keys[i]] || {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = { value };
    await redis.setex(cacheKey, 3600, JSON.stringify(config));
    await client.query('COMMIT');
    log('updateConfig', `Updated ${path} and full cache`, null, 'success');
    return { status: 'updated' };
  } catch (err) {
    await client.query('ROLLBACK');
    log('updateConfig', `Transaction error: ${err.message}`, err.stack, 'error');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getConfig, updateConfig };