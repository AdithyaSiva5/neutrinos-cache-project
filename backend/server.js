const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const chalk = require('chalk');
const prom = require('prom-client');

const app = express();
const server = http.createServer(app);

const log = (context, message, data = null, level = 'info', durationMs = null) => {
  const timestamp = new Date().toISOString();
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    warn: chalk.yellow,
    error: chalk.red,
  };
  const color = colors[level] || chalk.blue;
  const durationStr = durationMs !== null ? ` [${durationMs.toFixed(2)}ms]` : '';
  console.log(
    color(`[${timestamp}] ${context}: ${message}${durationStr}${data ? ` - ${JSON.stringify(data)}` : ''}`)
  );
};

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8,
});

app.use(express.json({ limit: '10kb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  keyGenerator: (req) => `${req.params.tenantId}:${req.ip}`,
  message: 'Too many requests, please try again later.',
});

app.use('/api/:tenantId/:configId', limiter);

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'configs',
  password: 'GPY0VDtPc2zkWrF',
  port: 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

log('Server Init', 'PostgreSQL pool initialized', null, 'success');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

const redisSubscriber = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: 6379,
});

redis.on('error', (err) => log('Redis', `Connection error: ${err.message}`, null, 'error'));
redisSubscriber.on('error', (err) => log('RedisSubscriber', `Connection error: ${err.message}`, null, 'error'));

log('Server Init', 'Redis clients initialized', null, 'success');

const subscriptionRegistry = new Map();

function matchesWildcard(path, pattern) {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\./g, '\\.') + '$');
  return regex.test(path);
}

redisSubscriber.psubscribe('config_updates:*');
redisSubscriber.on('pmessage', (pattern, channel, message) => {
  const { tenantId, configId, data } = JSON.parse(message);
  const socketChannel = `${tenantId}:${configId}:updates`;
  const path = data[0]?.path;
  subscriptionRegistry.forEach((socketIds, subPattern) => {
    if (matchesWildcard(path, subPattern)) {
      socketIds.forEach((socketId) => {
        io.to(socketId).emit('update', data);
      });
    }
  });
  io.to(socketChannel).emit('update', data);
  log('Redis Pub/Sub', `Broadcasted to ${socketChannel}`, data, 'info');
});

let cacheHits = 0;
let cacheMisses = 0;

// Prometheus metrics
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

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

async function cacheNode(tenantId, configId, nodePath, value, version) {
  const key = `tenant:${tenantId}:config:${configId}:node:${nodePath}`;
  const pipeline = redis.pipeline();
  pipeline.setex(key, 3600, JSON.stringify({ value, version }));
  pipeline.sadd(`tenant:${tenantId}:config:${configId}:cached_nodes`, nodePath);
  try {
    await pipeline.exec();
    log('cacheNode', `Cached ${key}`, null, 'success');
  } catch (err) {
    log('cacheNode', `Error caching ${key}`, err, 'error');
    throw err;
  }
}

async function updateMetadata(tenantId, configId, nodePath, dependencies, version) {
  const metadataKey = `tenant:${tenantId}:config:${configId}:metadata:${nodePath}`;
  const pipeline = redis.pipeline();
  pipeline.hset(metadataKey, {
    version,
    dependencies: JSON.stringify(dependencies || []),
    updated_at: new Date().toISOString(),
    dependents: JSON.stringify([]),
  });
  for (const dep of dependencies || []) {
    const depMetadataKey = `tenant:${tenantId}:config:${configId}:metadata:${dep}`;
    const currentDependents = JSON.parse((await redis.hget(depMetadataKey, 'dependents')) || '[]');
    if (!currentDependents.includes(nodePath)) {
      currentDependents.push(nodePath);
      pipeline.hset(depMetadataKey, 'dependents', JSON.stringify(currentDependents));
    }
  }
  try {
    await pipeline.exec();
    log('updateMetadata', `Updated metadata for ${metadataKey}`, null, 'success');
  } catch (err) {
    log('updateMetadata', `Error updating metadata for ${metadataKey}`, err, 'error');
    throw err;
  }
}

async function invalidateNode(tenantId, configId, nodePath, userId) {
  const key = `tenant:${tenantId}:config:${configId}:node:${nodePath}`;
  const metadataKey = `tenant:${tenantId}:config:${configId}:metadata:${nodePath}`;
  const pipeline = redis.pipeline();
  pipeline.del(key);
  const dependencies = JSON.parse((await redis.hget(metadataKey, 'dependencies')) || '[]');
  for (const dep of dependencies) {
    pipeline.del(`tenant:${tenantId}:config:${configId}:node:${dep}`);
  }
  try {
    await pipeline.exec();
    const version = (await redis.hget(metadataKey, 'version')) || 'v1';
    await redis.publish(`config_updates:${tenantId}:${configId}`, JSON.stringify({
      tenantId,
      configId,
      data: [{ path: nodePath, action: 'invalidated', version, userId }]
    }));
    log('invalidateNode', `Published to config_updates:${tenantId}:${configId}`, null, 'success');
  } catch (err) {
    log('invalidateNode', `Error invalidating ${key}`, err, 'error');
    throw err;
  }
}

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
  const cacheKey = `tenant:${tenantId}:config:${configId}:full${path ? `:${path}` : ''}`;
  log('GET /api/:tenantId/:configId', `Request for ${tenantId}:${configId}${path ? ` path=${path}` : ''}`, null, 'info');
  try {
    const cachedConfig = await redis.get(cacheKey);
    if (cachedConfig) {
      cacheHits++;
      log('GET /api/:tenantId/:configId', `Cache hit for ${cacheKey}`, null, 'success', performance.now() - startTime);
      cacheHitRatio.set(cacheHits / (cacheHits + cacheMisses || 1));
      end();
      return res.json({ config: JSON.parse(cachedConfig) });
    }
    cacheMisses++;
    log('GET /api/:tenantId/:configId', `Cache miss, querying DB`, null, 'warn');
    const query = path
      ? 'SELECT path, value FROM configs WHERE tenant_id = $1 AND config_id = $2 AND path LIKE $3 ORDER BY path'
      : 'SELECT path, value FROM configs WHERE tenant_id = $1 AND config_id = $2 ORDER BY path';
    const params = path ? [tenantId, configId, path + '%'] : [tenantId, configId];
    const dbStart = performance.now();
    const result = await pool.query(query, params);
    log('GET /api/:tenantId/:configId', `DB query completed`, null, 'success', performance.now() - dbStart);
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
    log('GET /api/:tenantId/:configId', `Cached and returning config`, null, 'success', performance.now() - startTime);
    cacheHitRatio.set(cacheHits / (cacheHits + cacheMisses || 1));
    end();
    res.json({ config });
  } catch (err) {
    log('GET /api/:tenantId/:configId', `Error: ${err.message}`, err.stack, 'error', performance.now() - startTime);
    end();
    res.status(500).json({ error: `Failed to fetch config: ${err.message}` });
  }
});

io.on('connection', (socket) => {
  const startTime = performance.now();
  log('Socket.IO', `Connected: ${socket.id}`, null, 'success', performance.now() - startTime);
  socket.setMaxListeners(15);
  socket.on('subscribe', ({ tenantId, configId, pathPattern }) => {
    const subStart = performance.now();
    if (!/^[A-Za-z0-9]+$/.test(tenantId) || !/^[A-Za-z0-9]+$/.test(configId)) {
      log('Socket.IO', `Invalid tenantId or configId in subscription`, { tenantId, configId }, 'error');
      return;
    }
    const socketChannel = `${tenantId}:${configId}:updates`;
    socket.join(socketChannel);
    if (pathPattern) {
      const key = `${tenantId}:${configId}:${pathPattern}`;
      if (!subscriptionRegistry.has(key)) {
        subscriptionRegistry.set(key, new Set());
      }
      subscriptionRegistry.get(key).add(socket.id);
      log('Socket.IO', `${socket.id} subscribed to ${key}`, null, 'success', performance.now() - subStart);
    }
    log('Socket.IO', `${socket.id} joined ${socketChannel}`, null, 'info', performance.now() - subStart);
  });
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
  log('POST /api/:tenantId/:configId', `Request by ${userId || 'Unknown'}`, { path, value, dependencies });
  if (!path.startsWith('/')) {
    log('POST /api/:tenantId/:configId', `Invalid path`, null, 'error');
    end();
    return res.status(400).json({ error: 'Path must start with /' });
  }
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO configs (tenant_id, config_id, path, value, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tenant_id, config_id, path) DO UPDATE SET value = $4, updated_at = $5',
        [tenantId, configId, path, value, new Date()]
      );
      const version = `v${Date.now()}`;
      await cacheNode(tenantId, configId, path, value, version);
      await updateMetadata(tenantId, configId, path, dependencies, version);
      await invalidateNode(tenantId, configId, path, userId);
      // Update full config cache incrementally
      const cacheKey = `tenant:${tenantId}:config:${configId}:full`;
      let config = {};
      const cachedConfig = await redis.get(cacheKey);
      if (cachedConfig) {
        config = JSON.parse(cachedConfig);
      } else {
        // Fetch from DB if cache miss to ensure consistency
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
      // Merge new node into config
      const keys = path.split('/').filter(k => k);
      let current = config;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = current[keys[i]] || {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = { value };
      await redis.setex(cacheKey, 3600, JSON.stringify(config));
      await client.query('COMMIT');
      log('POST /api/:tenantId/:configId', `Updated ${path} and full cache`, null, 'success');
      end();
      res.json({ status: 'updated' });
    } catch (err) {
      await client.query('ROLLBACK');
      log('POST /api/:tenantId/:configId', `Transaction error: ${err.message}`, err.stack, 'error');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    log('POST /api/:tenantId/:configId', `Error: ${err.message}`, err.stack, 'error');
    end();
    res.status(500).json({ error: `Failed to update config: ${err.message}` });
  }
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

io.on('connection', (socket) => {
  log('Socket.IO', `Connected: ${socket.id}`, null, 'success');
  socket.setMaxListeners(15);
  socket.on('subscribe', ({ tenantId, configId, pathPattern }) => {
    if (!/^[A-Za-z0-9]+$/.test(tenantId) || !/^[A-Za-z0-9]+$/.test(configId)) {
      log('Socket.IO', `Invalid tenantId or configId in subscription`, { tenantId, configId }, 'error');
      return;
    }
    const socketChannel = `${tenantId}:${configId}:updates`;
    socket.join(socketChannel);
    if (pathPattern) {
      const key = `${tenantId}:${configId}:${pathPattern}`;
      if (!subscriptionRegistry.has(key)) {
        subscriptionRegistry.set(key, new Set());
      }
      subscriptionRegistry.get(key).add(socket.id);
      log('Socket.IO', `${socket.id} subscribed to ${key}`, null, 'info');
    }
    log('Socket.IO', `${socket.id} joined ${socketChannel}`, null, 'info');
  });
  socket.on('disconnect', () => {
    subscriptionRegistry.forEach((socketIds, key) => {
      socketIds.delete(socket.id);
      if (socketIds.size === 0) subscriptionRegistry.delete(key);
    });
    log('Socket.IO', `Disconnected: ${socket.id}`, null, 'warn');
  });
});

module.exports = { app, cacheNode, invalidateNode, updateMetadata };

if (process.env.NODE_ENV !== 'test') {
  server.listen(3000, () => log('Server', 'Running on port 3000', null, 'success'));
}