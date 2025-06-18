const request = require('supertest');
const { app } = require('../../src/index');
const { getConfig } = require('../../src/services/configService');
const { log } = require('../../src/utils/logger');

jest.mock('../../src/services/configService');
jest.mock('../../src/utils/logger');

describe('Config Routes', () => {
  describe('GET /api/:tenantId/:configId', () => {
    test('should return config for valid tenantId and configId', async () => {
      const tenantId = 'tenant1';
      const configId = 'config1';
      const config = { test: { value: 'data' } };
      getConfig.mockResolvedValue(config);

      const response = await request(app).get(`/api/${tenantId}/${configId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ config });
      expect(getConfig).toHaveBeenCalledWith(tenantId, configId, undefined);
    });

    test('should return 400 for invalid tenantId', async () => {
      const tenantId = 'tenant@1';
      const configId = 'config1';

      const response = await request(app).get(`/api/${tenantId}/${configId}`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Tenant ID and Config ID must be alphanumeric' });
      expect(log).toHaveBeenCalledWith(
        'GET /api/:tenantId/:configId',
        `Invalid tenantId or configId`,
        { tenantId, configId },
        'error'
      );
    });

    test('should return 500 on service error', async () => {
      const tenantId = 'tenant1';
      const configId = 'config1';
      getConfig.mockRejectedValue(new Error('Service error'));

      const response = await request(app).get(`/api/${tenantId}/${configId}`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to fetch config: Service error' });
    });
  });

  describe('POST /api/:tenantId/:configId', () => {
    test('should update config for valid request', async () => {
      const tenantId = 'tenant1';
      const configId = 'config1';
      const body = {
        path: '/test/key',
        value: 'newValue',
        dependencies: ['/test/dep'],
        userId: 'user1',
      };
      const mockResult = { status: 'updated' };
      jest.spyOn(require('../../src/services/configService'), 'updateConfig').mockResolvedValue(mockResult);
      jest.spyOn(require('../../src/services/cacheService'), 'cacheNode').mockResolvedValue();
      jest.spyOn(require('../../src/services/cacheService'), 'updateMetadata').mockResolvedValue();
      jest.spyOn(require('../../src/services/cacheService'), 'invalidateNode').mockResolvedValue();

      const response = await request(app).post(`/api/${tenantId}/${configId}`).send(body);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
    });

    test('should return 400 for invalid path', async () => {
      const tenantId = 'tenant1';
      const configId = 'config1';
      const body = {
        path: 'test/key', // Missing leading slash
        value: 'newValue',
        dependencies: [],
        userId: 'user1',
      };

      const response = await request(app).post(`/api/${tenantId}/${configId}`).send(body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Path must start with /' });
    });
  });
});