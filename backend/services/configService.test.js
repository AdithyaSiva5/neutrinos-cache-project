const { cacheNode, updateMetadata, invalidateNode } = require('../../src/services/cacheService');
const { redis } = require('../../src/config/redis');
const { log } = require('../../src/utils/logger');

describe('Cache Service', () => {
  describe('cacheNode', () => {
    test('should cache node successfully', async () => {
      const tenantId = 'tenant1';
      const configId = 'config1';
      const nodePath = '/test/key';
      const value = 'value1';
      const version = 'v1';
      const pipeline = {
        setex: jest.fn(),
        sadd: jest.fn(),
        exec: jest.fn().mockResolvedValue([]),
      };
      redis.pipeline.mockReturnValue(pipeline);

      await cacheNode(tenantId, configId, nodePath, value, version);

      expect(pipeline.setex).toHaveBeenCalledWith(
        `tenant:${tenantId}:config:${configId}:node:${nodePath}`,
        3600,
        JSON.stringify({ value, version })
      );
      expect(pipeline.sadd).toHaveBeenCalledWith(
        `tenant:${tenantId}:config:${configId}:cached_nodes`,
        nodePath
      );
      expect(pipeline.exec).toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith(
        'cacheNode',
        `Cached tenant:${tenantId}:config:${configId}:node:${nodePath}`,
        null,
        'success'
      );
    });

    test('should throw error on cache failure', async () => {
      const tenantId = 'tenant1';
      const configId = 'config1';
      const nodePath = '/test/key';
      const value = 'value1';
      const version = 'v1';
      const pipeline = {
        setex: jest.fn(),
        sadd: jest.fn(),
        exec: jest.fn().mockRejectedValue(new Error('Redis error')),
      };
      redis.pipeline.mockReturnValue(pipeline);

      await expect(cacheNode(tenantId, configId, nodePath, value, version)).rejects.toThrow('Redis error');
      expect(log).toHaveBeenCalledWith(
        'cacheNode',
        `Error caching tenant:${tenantId}:config:${configId}:node:${nodePath}`,
        expect.any(Error),
        'error'
      );
    });
  });

  describe('updateMetadata', () => {
    test('should update metadata successfully', async () => {
      const tenantId = 'tenant1';
      const configId = 'config1';
      const nodePath = '/test/key';
      const dependencies = ['/test/dep'];
      const version = 'v1';
      const pipeline = {
        hset: jest.fn(),
        exec: jest.fn().mockResolvedValue([]),
      };
      redis.pipeline.mockReturnValue(pipeline);
      redis.hget.mockResolvedValue('[]');

      await updateMetadata(tenantId, configId, nodePath, dependencies, version);

      expect(pipeline.hset).toHaveBeenCalledWith(
        `tenant:${tenantId}:config:${configId}:metrics:${nodePath}`,
        {
          version,
          dependencies: JSON.stringify(dependencies),
          updated_at: expect.any(String),
          dependents: JSON.stringify([]),
        }
      );
      expect(pipeline.hset).toHaveBeenCalledWith(
        `tenant:${tenantId}:config:${configId}:metadata:${dependencies[0]}`,
        'dependents',
        JSON.stringify([nodePath])
      );
      expect(pipeline.exec).toHaveBeenCalled();
    });
  });

  describe('invalidateNode', () => {
    test('should invalidate node and publish update', async () => {
      const tenantId = 'tenant1';
      const configId = 'config1';
      const nodePath = '/test/key';
      const userId = 'user1';
      const pipeline = {
        del: jest.fn(),
        exec: jest.fn().mockResolvedValue([]),
      };
      redis.pipeline.mockReturnValue(pipeline);
      redis.hget.mockResolvedValue('[]');
      redis.publish.mockResolvedValue();

      await invalidateNode(tenantId, configId, nodePath, userId);

      expect(pipeline.del).toHaveBeenCalledWith(`tenant:${tenantId}:config:${configId}:node:${nodePath}`);
      expect(redis.publish).toHaveBeenCalledWith(
        `config_updates:${tenantId}:${configId}`,
        JSON.stringify({
          tenantId,
          configId,
          data: [{ path: nodePath, action: 'invalidated', version: 'v1', userId }],
        })
      );
    });
  });
});