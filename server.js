const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for Express
// app.use(cors({
//   origin: ['http://localhost:3000', 'http://localhost:3001', 'http://192.168.0.122:3001'],
//   methods: ['GET', 'POST', 'OPTIONS'], // Include OPTIONS for preflight requests
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true // If your app uses credentials (e.g., cookies)
// }));

// // Configure CORS for Socket.IO
// const io = socketIo(server, {
//   cors: {
//     origin: ['http://localhost:3000', 'http://localhost:3001', 'http://192.168.0.122:3001'],
//     methods: ['GET', 'POST'],
//     credentials: true
//   },
// });

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
});
app.use(express.json());



// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'configs',
  password: 'GPY0VDtPc2zkWrF', 
  port: 5432,
});

// Redis connection (Docker)
const redis = new Redis({ host: 'localhost', port: 6379 });

// Cache a node
async function cacheNode(tenantId, configId, nodePath, value, version) {
  const key = `${tenantId}:${configId}:${nodePath}`;
  await redis.set(key, JSON.stringify({ value, version }));
  await redis.sadd(`${tenantId}:${configId}:cached_nodes`, nodePath);
}

// Store metadata in Smart Registry
async function updateMetadata(tenantId, configId, nodePath, dependencies, version) {
  const metadataKey = `${tenantId}:${configId}:metadata:${nodePath}`;
  await redis.hset(metadataKey, {
    version,
    dependencies: JSON.stringify(dependencies || []),
    updated_at: new Date().toISOString(),
  });
}

// Invalidate a node and its dependencies
async function invalidateNode(tenantId, configId, nodePath) {
  const key = `${tenantId}:${configId}:${nodePath}`;
  await redis.del(key);
  const metadataKey = `${tenantId}:${configId}:metadata:${nodePath}`;
  const dependencies = JSON.parse((await redis.hget(metadataKey, 'dependencies')) || '[]');
  for (const dep of dependencies) {
    await redis.del(`${tenantId}:${configId}:${dep}`);
  }
  const version = (await redis.hget(metadataKey, 'version')) || 'v1';
  const channel = `${tenantId}:${configId}:updates`;
  redis.publish(
    channel,
    JSON.stringify({ path: nodePath, action: 'invalidated', version })
  );
  console.log(`Invalidated node ${nodePath} on channel ${channel}`);
}

// API to get config
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
    res.status(500).json({ error: err.message });
  }
});

// API to update a node
app.post('/api/:tenantId/:configId', async (req, res) => {
  const { tenantId, configId } = req.params;
  const { path, value, dependencies } = req.body;

  try {
    // Update in PostgreSQL
    await pool.query(
      'INSERT INTO configs (tenant_id, config_id, path, value, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tenant_id, config_id, path) DO UPDATE SET value = $4, updated_at = $5',
      [tenantId, configId, path, value, new Date()]
    );

    // Cache and update metadata
    const version = `v${Date.now()}`;
    await cacheNode(tenantId, configId, path, value, version);
    await updateMetadata(tenantId, configId, path, dependencies, version);

    // Invalidate cache
    await invalidateNode(tenantId, configId, path);

    res.json({ status: 'updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API for visualization metrics
app.get('/metrics/:tenantId/:configId', async (req, res) => {
  const { tenantId, configId } = req.params;
  try {
    const cachedNodes = await redis.smembers(`${tenantId}:${configId}:cached_nodes`);
    const metrics = await Promise.all(
      cachedNodes.map(async node => ({
        path: node,
        metadata: await redis.hgetall(`${tenantId}:${configId}:metadata:${node}`),
      }))
    );
    const stats = await redis.info('stats');
    res.json({ cachedNodes, metrics, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Socket.IO for real-time updates
redis.subscribe('T1:C1:updates'); // Adjust based on tenantId and configId
redis.on('message', (channel, message) => {
  console.log(`Received message on ${channel}: ${message}`);
  io.to(channel).emit('update', JSON.parse(message));
});
io.on('connection', (socket) => {
  socket.on('join', ({ tenantId, configId }) => {
    const channel = `${tenantId}:${configId}:updates`;
    socket.join(channel);
    console.log(`Client joined channel ${channel}`);
  });
});

server.listen(3000, () => console.log('Server running on port 3000'));