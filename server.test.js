const Redis = require('ioredis');
const redis = new Redis({ host: 'redis', port: 6379 });

async function cacheNode(tenantId, configId, nodePath, value, version) {
  const key = `${tenantId}:${configId}:${nodePath}`;
  await redis.set(key, JSON.stringify({ value, version }));
  await redis.sadd(`${tenantId}:${configId}:cached_nodes`, nodePath);
}

async function invalidateNode(tenantId, configId, nodePath) {
  const key = `${tenantId}:${configId}:${nodePath}`;
  await redis.del(key);
}

test('Invalidate node', async () => {
  await cacheNode('T1', 'C1', '/settings/theme/color', 'blue', 'v1');
  await invalidateNode('T1', 'C1', '/settings/theme/color');
  expect(await redis.get('T1:C1:/settings/theme/color')).toBeNull();
});