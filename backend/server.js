const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

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

const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: 6379 });

let updateBatch = [];

setInterval(() => {
  if (updateBatch.length > 0) {
    const channel = 'T1:C1:updates';
    io.to(channel).emit('update', updateBatch);
    console.log(`Batch updates sent: ${updateBatch.length}`);
    updateBatch = [];
  }
}, 1000);

async function cacheNode(tenantId, configId, nodePath, value, version) {
  const key = `tenant:${tenantId}:config:${configId}:node:${nodePath}`;
  await redis.setex(key, 3600, JSON.stringify({ value, version }));
  await redis.sadd(`tenant:${tenantId}:config:${configId}:cached_nodes`, nodePath);
}

async function updateMetadata(tenantId, configId, nodePath, dependencies, version) {
  const metadataKey = `tenant:${tenantId}:config:${configId}:metadata:${nodePath}`;
  await redis.hset(metadataKey, {
    version,
    dependencies: JSON.stringify(dependencies || []),
    updated_at: new Date().toISOString(),
    dependents: JSON.stringify([]),
  });

  for (const dep of dependencies) {
    const depMetadataKey = `tenant:${tenantId}:config:${configId}:metadata:${dep}`;
    const currentDependents = JSON.parse((await redis.hget(depMetadataKey, 'dependents')) || '[]');
    if (!currentDependents.includes(nodePath)) {
      currentDependents.push(nodePath);
      await redis.hset(depMetadataKey, 'dependents', JSON.stringify(currentDependents));
    }
  }
}

async function invalidateNode(tenantId, configId, nodePath) {
  const key = `tenant:${tenantId}:config:${configId}:node:${nodePath}`;
  await redis.del(key);
  const metadataKey = `tenant:${tenantId}:config:${configId}:metadata:${nodePath}`;
  const dependencies = JSON.parse((await redis.hget(metadataKey, 'dependencies')) || '[]');
  for (const dep of dependencies) {
    await redis.del(`tenant:${tenantId}:config:${configId}:node:${dep}`);
  }
  const version = (await redis.hget(metadataKey, 'version')) || 'v1';
  updateBatch.push({ path: nodePath, action: 'invalidated', version });
}

app.get('/api/:tenantId/:configId', async (req, res) => {
  const { tenantId, configId } = req.params;
  try {
    const result = await pool.query(
      'SELECT path, value FROM configs WHERE tenant_id = $1 AND config_id = $2',
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
      current[keys[keys.length - 1]] = row.value;
    });
    res.json({ config });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/:tenantId/:configId', async (req, res) => {
  const { tenantId, configId } = req.params;
  const { path, value, dependencies } = req.body;

  try {
    await pool.query(
      'INSERT INTO configs (tenant_id, config_id, path, value, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tenant_id, config_id, path) DO UPDATE SET value = $4, updated_at = $5',
      [tenantId, configId, path, value, new Date()]
    );

    const version = `v${Date.now()}`;
    await cacheNode(tenantId, configId, path, value, version);
    await updateMetadata(tenantId, configId, path, dependencies, version);
    await invalidateNode(tenantId, configId, path);

    res.json({ status: 'updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/metrics/:tenantId/:configId', async (req, res) => {
  const { tenantId, configId } = req.params;
  const { limit = 100, offset = 0 } = req.query;
  try {
    const cachedNodes = await redis.smembers(`tenant:${tenantId}:config:${configId}:cached_nodes`);
    const paginatedNodes = cachedNodes.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    const metrics = await Promise.all(
      paginatedNodes.map(async node => {
        const metadata = await redis.hgetall(`tenant:${tenantId}:config:${configId}:metadata:${node}`);
        metadata.dependencies = JSON.parse(metadata.dependencies || '[]');
        metadata.dependents = JSON.parse(metadata.dependents || '[]');
        return { path: node, metadata };
      })
    );
    res.json({ cachedNodes: paginatedNodes, metrics });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

redis.subscribe('T1:C1:updates');
redis.on('message', (channel, message) => {
  console.log(`Received message on ${channel}: ${message}`);
});

io.engine.on('connection', (socket) => {
  socket.setMaxListeners(10);
  socket.on('join', ({ tenantId, configId }) => {
    const channel = `${tenantId}:${configId}:updates`;
    socket.join(channel);
    console.log(`Client ${socket.id} joined ${channel}`);
  });
});

// Export for testing
module.exports = { app, cacheNode, invalidateNode, updateMetadata };

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  server.listen(3000, () => console.log('Server running on port 3000'));
}