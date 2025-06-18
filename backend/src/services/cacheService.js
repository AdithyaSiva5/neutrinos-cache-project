const { redis, redisSubscriber } = require('../config/redis');
const { log } = require('../utils/logger');
const { io } = require('../config/server');

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
  const metadataKey = `tenant:${tenantId}:config:${configId}:metrics:${nodePath}`;
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
      data: [{ path: nodePath, action: 'invalidated', version, userId }],
    }));
    log('invalidateNode', `Published to config_updates:${tenantId}:${configId}`, null, 'success');
  } catch (err) {
    log('invalidateNode', `Error invalidating ${key}`, err, 'error');
    throw err;
  }
}

module.exports = { cacheNode, updateMetadata, invalidateNode, subscriptionRegistry };