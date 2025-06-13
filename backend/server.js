const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const chalk = require('chalk');

const app = express();
const server = http.createServer(app);

const log = (context, message, data = null, level = 'info') => {
  const timestamp = new Date().toISOString();
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    warn: chalk.yellow,
    error: chalk.red,
  };
  const color = colors[level] || chalk.blue;
  console.log(
    color(`[${timestamp}] ${context}: ${message}${data ? ` - ${JSON.stringify(data)}` : ''}`)
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
  console.time('fetchConfigBackend');
  const { tenantId, configId } = req.params;
  if (!/^[A-Za-z0-9]+$/.test(tenantId) || !/^[A-Za-z0-9]+$/.test(configId)) {
    log('GET /api/:tenantId/:configId', `Invalid tenantId or configId`, { tenantId, configId }, 'error');
    console.timeEnd('fetchConfigBackend');
    return res.status(400).json({ error: 'Tenant ID and Config ID must be alphanumeric' });
  }
  const cacheKey = `tenant:${tenantId}:config:${configId}:full`;
  log('GET /api/:tenantId/:configId', `Request for ${tenantId}:${configId}`);
  try {
    const cachedConfig = await redis.get(cacheKey);
    if (cachedConfig) {
      cacheHits++;
      log('GET /api/:tenantId/:configId', `Cache hit for ${cacheKey}`, null, 'success');
      console.timeEnd('fetchConfigBackend');
      return res.json({ config: JSON.parse(cachedConfig) });
    }
    cacheMisses++;
    log('GET /api/:tenantId/:configId', `Cache miss, querying DB`);
    const result = await pool.query(
      'SELECT path, value FROM configs WHERE tenant_id = $1 AND config_id = $2 ORDER BY path',
      [tenantId, configId]
    );
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
    log('GET /api/:tenantId/:configId', `Cached and returning config`, null, 'success');
    console.timeEnd('fetchConfigBackend');
    res.json({ config });
  } catch (err) {
    log('GET /api/:tenantId/:configId', `Error: ${err.message}`, err.stack, 'error');
    console.timeEnd('fetchConfigBackend');
    res.status(500).json({ error: `Failed to fetch config: ${err.message}` });
  }
});

app.post('/api/:tenantId/:configId', async (req, res) => {
  console.time('updateConfigBackend');
  const { tenantId, configId } = req.params;
  const { path, value, dependencies, userId } = req.body;
  if (!/^[A-Za-z0-9]+$/.test(tenantId) || !/^[A-Za-z0-9]+$/.test(configId)) {
    log('POST /api/:tenantId/:configId', `Invalid tenantId or configId`, { tenantId, configId }, 'error');
    console.timeEnd('updateConfigBackend');
    return res.status(400).json({ error: 'Tenant ID and Config ID must be alphanumeric' });
  }
  log('POST /api/:tenantId/:configId', `Request by ${userId || 'Unknown'}`, { path, value, dependencies });
  if (!path.startsWith('/')) {
    log('POST /api/:tenantId/:configId', `Invalid path`, null, 'error');
    console.timeEnd('updateConfigBackend');
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
      await redis.del(`tenant:${tenantId}:config:${configId}:full`);
      await client.query('COMMIT');
      log('POST /api/:tenantId/:configId', `Updated ${path}`, null, 'success');
      console.timeEnd('updateConfigBackend');
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
    console.timeEnd('updateConfigBackend');
    res.status(500).json({ error: `Failed to update config: ${err.message}` });
  }
});

app.get('/metrics/:tenantId/:configId', async (req, res) => {
  console.time('fetchMetricsBackend');
  const { tenantId, configId } = req.params;
  const { limit = 100, offset = 0 } = req.query;
  if (!/^[A-Za-z0-9]+$/.test(tenantId) || !/^[A-Za-z0-9]+$/.test(configId)) {
    log('GET /metrics/:tenantId/:configId', `Invalid tenantId or configId`, { tenantId, configId }, 'error');
    console.timeEnd('fetchMetricsBackend');
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
    console.timeEnd('fetchMetricsBackend');
    res.json({ cachedNodes, metrics, cacheStats: { hits: cacheHits, misses: cacheMisses } });
  } catch (err) {
    log('GET /metrics/:tenantId/:configId', `Error: ${err.message}`, err.stack, 'error');
    console.timeEnd('fetchMetricsBackend');
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