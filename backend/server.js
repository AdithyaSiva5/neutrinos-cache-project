const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

// Utility function to log with timestamp
const log = (context, message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${context}: ${message}${data ? ` - Data: ${JSON.stringify(data)}` : ''}`);
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
});

app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each tenant to 100 requests
  keyGenerator: (req) => req.params.tenantId,
});

app.use('/api/:tenantId/:configId', limiter);

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'configs',
  password: 'GPY0VDtPc2zkWrF', // Replace with secure password
  port: 5432,
});

log('Server Init', 'PostgreSQL pool initialized');

const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: 6379 });

log('Server Init', 'Redis client initialized');

let updateBatch = [];

setInterval(() => {
  if (updateBatch.length > 0) {
    const channel = 'T1:C1:updates';
    log('Batch Update', `Sending ${updateBatch.length} updates to channel ${channel}`, updateBatch);
    io.to(channel).emit('update', updateBatch);
    updateBatch = [];
  }
}, 1000);

async function cacheNode(tenantId, configId, nodePath, value, version) {
  log('cacheNode', `Starting for tenant:${tenantId}, config:${configId}, path:${nodePath}`);
  const key = `tenant:${tenantId}:config:${configId}:node:${nodePath}`;
  try {
    log('cacheNode', `Setting Redis key ${key} with value ${value} and version ${version}`);
    const setResult = await redis.setex(key, 3600, JSON.stringify({ value, version }));
    log('cacheNode', `Redis setex result for ${key}`, setResult);
    const saddResult = await redis.sadd(`tenant:${tenantId}:config:${configId}:cached_nodes`, nodePath);
    log('cacheNode', `Redis sadd result for ${nodePath}`, saddResult);
  } catch (err) {
    log('cacheNode', `Error in cacheNode`, err);
    throw err;
  }
}

async function updateMetadata(tenantId, configId, nodePath, dependencies, version) {
  log('updateMetadata', `Starting for tenant:${tenantId}, config:${configId}, path:${nodePath}`);
  const metadataKey = `tenant:${tenantId}:config:${configId}:metadata:${nodePath}`;
  try {
    log('updateMetadata', `Setting metadata for ${metadataKey}`, { version, dependencies });
    const hsetResult = await redis.hset(metadataKey, {
      version,
      dependencies: JSON.stringify(dependencies || []),
      updated_at: new Date().toISOString(),
      dependents: JSON.stringify([]),
    });
    log('updateMetadata', `Redis hset result for ${metadataKey}`, hsetResult);

    for (const dep of dependencies || []) {
      const depMetadataKey = `tenant:${tenantId}:config:${configId}:metadata:${dep}`;
      const currentDependents = JSON.parse((await redis.hget(depMetadataKey, 'dependents')) || '[]');
      log('updateMetadata', `Current dependents for ${depMetadataKey}`, currentDependents);
      if (!currentDependents.includes(nodePath)) {
        currentDependents.push(nodePath);
        const depHsetResult = await redis.hset(depMetadataKey, 'dependents', JSON.stringify(currentDependents));
        log('updateMetadata', `Updated dependents for ${depMetadataKey}`, depHsetResult);
      }
    }
  } catch (err) {
    log('updateMetadata', `Error in updateMetadata`, err);
    throw err;
  }
}

async function invalidateNode(tenantId, configId, nodePath) {
  log('invalidateNode', `Starting for tenant:${tenantId}, config:${configId}, path:${nodePath}`);
  const key = `tenant:${tenantId}:config:${configId}:node:${nodePath}`;
  const metadataKey = `tenant:${tenantId}:config:${configId}:metadata:${nodePath}`;
  try {
    log('invalidateNode', `Deleting Redis key ${key}`);
    const delResult = await redis.del(key);
    log('invalidateNode', `Redis del result for ${key}`, delResult);

    const dependencies = JSON.parse((await redis.hget(metadataKey, 'dependencies')) || '[]');
    log('invalidateNode', `Dependencies for ${metadataKey}`, dependencies);
    for (const dep of dependencies) {
      const depKey = `tenant:${tenantId}:config:${configId}:node:${dep}`;
      log('invalidateNode', `Deleting dependent key ${depKey}`);
      const depDelResult = await redis.del(depKey);
      log('invalidateNode', `Redis del result for ${depKey}`, depDelResult);
    }

    const version = (await redis.hget(metadataKey, 'version')) || 'v1';
    log('invalidateNode', `Adding to updateBatch`, { path: nodePath, action: 'invalidated', version });
    updateBatch.push({ path: nodePath, action: 'invalidated', version });
  } catch (err) {
    log('invalidateNode', `Error in invalidateNode`, err);
    throw err;
  }
}

app.get('/api/:tenantId/:configId', async (req, res) => {
  const { tenantId, configId } = req.params;
  log('GET /api/:tenantId/:configId', `Request received for tenant:${tenantId}, config:${configId}`);
  try {
    log('GET /api/:tenantId/:configId', `Executing query for tenant:${tenantId}, config:${configId}`);
    const result = await pool.query(
      'SELECT path, value FROM configs WHERE tenant_id = $1 AND config_id = $2',
      [tenantId, configId]
    );
    log('GET /api/:tenantId/:configId', `Query result`, result);
    if (!result || typeof result.rows === 'undefined') {
      throw new Error('Invalid query result');
    }
    const config = {};
    log('GET /api/:tenantId/:configId', `Processing ${result.rows.length} rows`);
    result.rows.forEach(row => {
      const keys = row.path.split('/').filter(k => k);
      let current = config;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = current[keys[i]] || {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = row.value;
      log('GET /api/:tenantId/:configId', `Processed row`, { path: row.path, value: row.value });
    });
    log('GET /api/:tenantId/:configId', `Sending response`, config);
    res.json({ config });
  } catch (err) {
    log('GET /api/:tenantId/:configId', `Error fetching config`, err);
    res.status(500).json({ error: `Failed to fetch config: ${err.message}` });
  }
});

app.post('/api/:tenantId/:configId', async (req, res) => {
  const { tenantId, configId } = req.params;
  const { path, value, dependencies } = req.body;
  log('POST /api/:tenantId/:configId', `Request received`, { tenantId, configId, path, value, dependencies });

  if (!path.startsWith('/')) {
    log('POST /api/:tenantId/:configId', `Invalid path: ${path}`);
    return res.status(400).json({ error: 'Path must start with /' });
  }

  try {
    log('POST /api/:tenantId/:configId', `Inserting/updating config`, { tenantId, configId, path, value });
    const queryResult = await pool.query(
      'INSERT INTO configs (tenant_id, config_id, path, value, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tenant_id, config_id, path) DO UPDATE SET value = $4, updated_at = $5',
      [tenantId, configId, path, value, new Date()]
    );
    log('POST /api/:tenantId/:configId', `Query result`, queryResult);

    const version = `v${Date.now()}`;
    log('POST /api/:tenantId/:configId', `Caching node with version ${version}`);
    await cacheNode(tenantId, configId, path, value, version);
    log('POST /api/:tenantId/:configId', `Updating metadata`);
    await updateMetadata(tenantId, configId, path, dependencies, version);
    log('POST /api/:tenantId/:configId', `Invalidating node`);
    await invalidateNode(tenantId, configId, path);

    log('POST /api/:tenantId/:configId', `Sending success response`);
    res.json({ status: 'updated' });
  } catch (err) {
    log('POST /api/:tenantId/:configId', `Error updating config`, err);
    res.status(500).json({ error: `Failed to update config: ${err.message}` });
  }
});

app.get('/metrics/:tenantId/:configId', async (req, res) => {
  const { tenantId, configId } = req.params;
  const { limit = 100, offset = 0 } = req.query;
  log('GET /metrics/:tenantId/:configId', `Request received`, { tenantId, configId, limit, offset });
  try {
    log('GET /metrics/:tenantId/:configId', `Fetching cached nodes`);
    const cachedNodes = await redis.smembers(`tenant:${tenantId}:config:${configId}:cached_nodes`);
    log('GET /metrics/:tenantId/:configId', `Cached nodes`, cachedNodes);
    const paginatedNodes = cachedNodes.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    log('GET /metrics/:tenantId/:configId', `Paginated nodes`, paginatedNodes);
    const metrics = await Promise.all(
      paginatedNodes.map(async node => {
        log('GET /metrics/:tenantId/:configId', `Fetching metadata for ${node}`);
        const metadata = await redis.hgetall(`tenant:${tenantId}:config:${configId}:metadata:${node}`);
        metadata.dependencies = JSON.parse(metadata.dependencies || '[]');
        metadata.dependents = JSON.parse(metadata.dependents || '[]');
        log('GET /metrics/:tenantId/:configId', `Metadata for ${node}`, metadata);
        return { path: node, metadata };
      })
    );
    log('GET /metrics/:tenantId/:configId', `Sending response`, { cachedNodes: paginatedNodes, metrics });
    res.json({ cachedNodes: paginatedNodes, metrics });
  } catch (err) {
    log('GET /metrics/:tenantId/:configId', `Error fetching metrics`, err);
    res.status(500).json({ error: err.message });
  }
});

redis.subscribe('T1:C1:updates');
redis.on('message', (channel, message) => {
  log('Redis', `Received message on ${channel}`, message);
});

io.on('connection', (socket) => {
  log('Socket.IO', `New socket connection: ${socket.id}`);
  socket.setMaxListeners(10);
  socket.on('join', ({ tenantId, configId }) => {
    const channel = `${tenantId}:${configId}:updates`;
    socket.join(channel);
    log('Socket.IO', `Client ${socket.id} joined ${channel}`);
  });
});

// Export for testing
module.exports = { app, cacheNode, invalidateNode, updateMetadata };

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  server.listen(3000, () => log('Server', 'Server running on port 3000'));
}