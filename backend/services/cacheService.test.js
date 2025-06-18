const { getConfig, updateConfig } = require('../../src/services/configService');
const { pool } = require('../../src/config/database');
const { redis } = require('../../src/config/redis');
const { log } = require('../../src/utils/logger');

describe('Config Service', () => {
  describe('getConfig', () => {
    test('should return cached config if available', async () => {
      const tenantId = 'tenant1';
      const configId = 'config1';
      const path = '/test';
      const cachedConfig = { test: { value: 'cached' } };
      redis.get.mockResolvedValue(JSON.stringify(cachedConfig));

      const result = await getConfig(tenantId, configId, path);

      expect(redis.get).toHaveBeenCalledWith(`tenant:${tenantId}:config:${configId}:full:${path}`);
      expect(result).toEqual(cachedConfig);
      expect(log).toHaveBeenCalledWith(
        'getConfig',
        `Cache hit for tenant:${tenantId}:config:${configId}:full:${path}`,
        null,
        'success',
        expect.any(Number)
      );
    });

    test('should query database and cache result on cache miss', async () => {
      const tenantId = 'tenant1';
      const configId = 'config1';
      const path = null;
      const dbResult = {
        rows: [
          { path: '/test/key', value: 'value1' },
          { path: '/test/sub/key2', value: 'value2' },
        ],
      };
      redis.get.mockResolvedValue(null);
      pool.query.mockResolvedValue(dbResult);
      redis.setex.mockResolvedValue();

      const result = await getConfig(tenantId, configId, path);

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT path, value FROM configs WHERE tenant_id = $1 AND config_id = $2 ORDER BY path',
        [tenantId, configId]
      );
      expect(redis.setex).toHaveBeenCalledWith(
        `tenant:${tenantId}:config:${configId}:full`,
        3600,
        JSON.stringify({
          test: {
            key: { value: 'value1' },
            sub: { key2: { value: 'value2' } },
          },
        })
      );
      expect(result).toEqual({
        test: {
          key: { value: 'value1' },
          sub: { key2: { value: 'value2' } },
        },
      });
    });
  });

  describe('updateConfig', () => {
    test('should update config and cache', async () => {
      const tenantId = 'tenant1';
      const configId = 'config1';
      const path = '/test/key';
      const value = 'newValue';
      const dependencies = ['/test/dep'];
      const userId = 'user1';
      const client = {
        query: jest.fn(),
        release: jest.fn(),
      };
      pool.connect.mockResolvedValue(client);
      redis.get.mockResolvedValue(null);
      pool.query.mockResolvedValue({ rows: [] });
      redis.setex.mockResolvedValue();

      const result = await updateConfig(tenantId, configId, path, value, dependencies, userId);

      expect(client.query).toHaveBeenCalledWith('BEGIN');
      expect(client.query).toHaveBeenCalledWith(
        'INSERT INTO configs (tenant_id, config_id, path, value, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tenant_id, config_id, path) DO UPDATE SET value = $4, updated_at = $5',
        [tenantId, configId, path, value, expect.any(Date)]
      );
      expect(client.query).toHaveBeenCalledWith('COMMIT');
      expect(redis.setex).toHaveBeenCalledWith(
        `tenant:${tenantId}:config:${configId}:full`,
        3600,
        JSON.stringify({ test: { key: { value } } })
      );
      expect(result).toEqual({ status: 'updated' });
    });

    test('should rollback on error', async () => {
      const tenantId = 'tenant1';
      const configId = 'config1';
      const path = '/test/key';
      const value = 'newValue';
      const dependencies = ['/test/dep'];
      const userId = 'user1';
      const client = {
        query: jest.fn().mockRejectedValueOnce(new Error('DB error')),
        release: jest.fn(),
      };
      pool.connect.mockResolvedValue(client);

      await expect(updateConfig(tenantId, configId, path, value, dependencies, userId)).rejects.toThrow('DB error');
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});