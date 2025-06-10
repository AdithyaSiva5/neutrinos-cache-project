const Redis = require('ioredis');
const { Pool } = require('pg');
const request = require('supertest');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');
const { app, cacheNode, invalidateNode } = require('./server');

jest.mock('ioredis');
jest.mock('pg');

const mockRedis = {
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  sadd: jest.fn(),
  smembers: jest.fn(),
  hset: jest.fn(),
  hget: jest.fn(),
  hgetall: jest.fn(),
  publish: jest.fn(),
  subscribe: jest.fn(),
  quit: jest.fn().mockResolvedValue('OK'),
};

const mockPool = {
  query: jest.fn(),
  end: jest.fn().mockResolvedValue(),
};

Redis.mockImplementation(() => mockRedis);
Pool.mockImplementation(() => mockPool);

describe('Cache Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mockRedis.quit();
    await mockPool.end();
  });

  test('should cache a node', async () => {
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.sadd.mockResolvedValue(1);
    await cacheNode('T1', 'C1', '/settings/theme/color', 'blue', 'v1');
    expect(mockRedis.setex).toHaveBeenCalledWith(
      'tenant:T1:config:C1:node:/settings/theme/color',
      3600,
      JSON.stringify({ value: 'blue', version: 'v1' })
    );
    expect(mockRedis.sadd).toHaveBeenCalledWith(
      'tenant:T1:config:C1:cached_nodes',
      '/settings/theme/color'
    );
  });

  test('should invalidate a node', async () => {
    mockRedis.del.mockResolvedValue(1);
    mockRedis.hget
      .mockResolvedValueOnce('[]') // dependencies
      .mockResolvedValueOnce('v1'); // version
    await invalidateNode('T1', 'C1', '/settings/theme/color');
    expect(mockRedis.del).toHaveBeenCalledWith(
      'tenant:T1:config:C1:node:/settings/theme/color'
    );
  });

  test('should fetch config', async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ path: '/settings/theme/color', value: 'blue' }],
    });
    const response = await request(app).get('/api/T1/C1');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      config: { settings: { theme: { color: 'blue' } } },
    });
  });
});

describe('Socket.IO', () => {
  let io, clientSocket;

  beforeAll((done) => {
    io = new Server(3001, { cors: { origin: '*' } });
    io.on('connection', (socket) => {
      socket.on('join', ({ tenantId, configId }) => {
        socket.join(`${tenantId}:${configId}:updates`);
      });
    });
    clientSocket = ioClient('http://localhost:3001');
    clientSocket.on('connect', done);
  });

  afterAll(() => {
    clientSocket.disconnect();
    io.close();
  });

  test('should receive update event', (done) => {
    clientSocket.emit('join', { tenantId: 'T1', configId: 'C1' });
    clientSocket.on('update', (data) => {
      expect(data).toContainEqual({
        path: '/test',
        action: 'invalidated',
        version: 'v1',
      });
      done();
    });
    io.to('T1:C1:updates').emit('update', [
      { path: '/test', action: 'invalidated', version: 'v1' },
    ]);
  });
});