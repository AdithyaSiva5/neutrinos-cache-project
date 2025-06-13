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

log('Server Init', 'Redis clients initialized', null, 'success');

let updateBatch = {};

setInterval(() => {
  Object.keys(updateBatch).forEach((channel) => {
    if (!Array.isArray(updateBatch[channel])) {
      updateBatch[channel] = []; // Initialize as array if not set
    }
    if (updateBatch[channel].length > 0) {
      log('Batch Update', `Sending ${updateBatch[channel].length} updates to ${channel}`, null, 'success');
      io.to(channel).emit('update', updateBatch[channel]);
      updateBatch[channel] = [];
    }
  });
}, 500);

async function cacheNode(tenantId, configId, nodePath, value, version) {
  const key = `tenant:${tenantId}:config:${configId}:node:${nodePath}`;
  try {
    const pipeline = redis.pipeline();
    pipeline.setex(key, 3600, JSON.stringify({ value, version }));
    pipeline.sadd(`tenant:${tenantId}:config:${configId}:cached_nodes`, nodePath);
    const results = await pipeline.exec();
    log('cacheNode', `Cached ${key} with version ${version}`, results, 'success');
  } catch (err) {
    log('cacheNode', `Error caching ${key}`, err, 'error');
    throw err;
  }
}

async function updateMetadata(tenantId, configId, nodePath, dependencies, version) {
  const metadataKey = `tenant:${tenantId}:config:${configId}:metadata:${nodePath}`;
  try {
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
    const results = await pipeline.exec();
    log('updateMetadata', `Updated metadata for ${metadataKey}`, results, 'success');
  } catch (err) {
    log('updateMetadata', `Error updating metadata for ${metadataKey}`, err, 'error');
    throw err;
  }
}

async function invalidateNode(tenantId, configId, nodePath) {
  const key = `tenant:${tenantId}:config:${configId}:node:${nodePath}`;
  const metadataKey = `tenant:${tenantId}:config:${configId}:metadata:${nodePath}`;
  const channel = `${tenantId}:${configId}:updates`;
  try {
    const pipeline = redis.pipeline();
    pipeline.del(key);
    const dependencies = JSON.parse((await redis.hget(metadataKey, 'dependencies')) || '[]');
    for (const dep of dependencies) {
      pipeline.del(`tenant:${tenantId}:config:${configId}:node:${dep}`);
    }
    const results = await pipeline.exec();
    const version = (await redis.hget(metadataKey, 'version')) || 'v1';
    if (!updateBatch[channel]) updateBatch[channel] = [];
    updateBatch[channel].push({ path: nodePath, action: 'invalidated', version });
    log('invalidateNode', `Invalidated ${key} and dependencies`, results, 'success');
  } catch (err) {
    log('invalidateNode', `Error invalidating ${key}`, err, 'error');
    throw err;
  }
}

app.get('/api/:tenantId/:configId', async (req, res) => {
  console.time('fetchConfigBackend');
  const { tenantId, configId } = req.params;
  const cacheKey = `tenant:${tenantId}:config:${configId}:full`;
  log('GET /api/:tenantId/:configId', `Request for ${tenantId}:${configId}`);
  try {
    const cachedConfig = await redis.get(cacheKey);
    if (cachedConfig) {
      log('GET /api/:tenantId/:configId', `Cache hit for ${cacheKey}`, null, 'success');
      console.timeEnd('fetchConfigBackend');
      return res.json({ config: JSON.parse(cachedConfig) });
    }
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
    log('GET /api/:tenantId/:configId', `Error`, err, 'error');
    console.timeEnd('fetchConfigBackend');
    res.status(500).json({ error: `Failed to fetch config: ${err.message}` });
  }
});

app.post('/api/:tenantId/:configId', async (req, res) => {
  console.time('updateConfigBackend');
  const { tenantId, configId } = req.params;
  const { path, value, dependencies } = req.body;
  log('POST /api/:tenantId/:configId', `Request`, { path, value, dependencies });
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
      await invalidateNode(tenantId, configId, path);
      await redis.del(`tenant:${tenantId}:config:${configId}:full`);
      await client.query('COMMIT');
      log('POST /api/:tenantId/:configId', `Updated ${path}`, null, 'success');
      console.timeEnd('updateConfigBackend');
      res.json({ status: 'updated' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    log('POST /api/:tenantId/:configId', `Error`, err, 'error');
    console.timeEnd('updateConfigBackend');
    res.status(500).json({ error: `Failed to update config: ${err.message}` });
  }
});

app.get('/metrics/:tenantId/:configId', async (req, res) => {
  console.time('fetchMetricsBackend');
  const { tenantId, configId } = req.params;
  const { limit = 100, offset = 0 } = req.query;
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
    res.json({ cachedNodes: paginatedNodes, metrics });
  } catch (err) {
    log('GET /metrics/:tenantId/:configId', `Error`, err, 'error');
    console.timeEnd('fetchMetricsBackend');
    res.status(500).json({ error: err.message });
  }
});

redisSubscriber.subscribe('updates');
redisSubscriber.on('message', (channel, message) => {
  log('Redis', `Message on ${channel}`, message, 'info');
});

io.on('connection', (socket) => {
  log('Socket.IO', `Connected: ${socket.id}`, null, 'success');
  socket.setMaxListeners(15);
  socket.on('join', ({ tenantId, configId }) => {
    const channel = `${tenantId}:${configId}:updates`;
    socket.join(channel);
    log('Socket.IO', `${socket.id} joined ${channel}`, null, 'info');
  });
  socket.on('disconnect', () => {
    log('Socket.IO', `Disconnected: ${socket.id}`, null, 'warn');
  });
});

module.exports = { app, cacheNode, invalidateNode, updateMetadata };

if (process.env.NODE_ENV !== 'test') {
  server.listen(3000, () => log('Server', 'Running on port 3000', null, 'success'));
}