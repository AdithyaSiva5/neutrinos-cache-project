const Redis = require('ioredis');
const { Pool } = require('pg');
const request = require('supertest');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');
const { app, cacheNode, invalidateNode, updateMetadata } = require('./server');

jest.mock('ioredis');
jest.mock('pg');

const mockRedis = {
  set: jest.fn().mockResolvedValue(1),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  sadd: jest.fn().mockResolvedValue(1),
  smembers: jest.fn().mockResolvedValue([]),
  hset: jest.fn().mockResolvedValue(1),
  hget: jest.fn().mockResolvedValue(null),
  hgetall: jest.fn().mockResolvedValue({}),
  publish: jest.fn().mockResolvedValue(),
  subscribe: jest.fn().mockResolvedValue(),
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
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
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
    console.log('setex calls:', mockRedis.setex.mock.calls); // Debug
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

  test('should invalidate a node and its dependencies', async () => {
    mockRedis.hget
      .mockResolvedValueOnce(JSON.stringify(['/settings/theme/dark']))
      .mockResolvedValueOnce('v1');
    mockRedis.del
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    await invalidateNode('T1', 'C1', '/settings/theme/color');
    console.log('del calls:', mockRedis.del.mock.calls); // Debug
    expect(mockRedis.del).toHaveBeenCalledWith(
      'tenant:T1:config:C1:node:/settings/theme/color'
    );
    expect(mockRedis.del).toHaveBeenCalledWith(
      'tenant:T1:config:C1:node:/settings/theme/dark'
    );
  });

  test('should fetch config', async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ path: '/settings/theme/color', value: 'blue' }],
      rowCount: 1,
    });
    const response = await request(app).get('/api/T1/C1');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      config: { settings: { theme: { color: 'blue' } } },
    });
  });

  test('should reject invalid path in update', async () => {
    const response = await request(app)
      .post('/api/T1/C1')
      .send({ path: 'invalid', value: 'blue', dependencies: [] });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Path must start with /');
  });

  test('should enforce rate limiting', async () => {
    for (let i = 0; i < 100; i++) {
      await request(app).get('/api/T1/C1');
    }
    const response = await request(app).get('/api/T1/C1');
    expect(response.status).toBe(429); // Too Many Requests
  });
});

describe('Socket.IO', () => {
  let io, serverSocket, clientSocket;

  beforeAll((done) => {
    const httpServer = require('http').createServer();
    io = new Server(httpServer, { cors: { origin: '*' } });
    httpServer.listen(3001, () => {
      io.on('connection', (socket) => {
        serverSocket = socket;
        socket.on('join', ({ tenantId, configId }) => {
          socket.join(`${tenantId}:${configId}:updates`);
        });
      });
      clientSocket = ioClient('http://localhost:3001');
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    if (clientSocket) clientSocket.disconnect();
    if (io) io.close();
  });

  test('should receive update event', (done) => {
    clientSocket.emit('join', { tenantId: 'T1', configId: 'C1' });
    setTimeout(() => {
      clientSocket.on('update', (data) => {
        expect(data).toContainEqual({
          path: '/test',
          action: 'invalidated',
          version: 'v1',
        });
        done();
      });
      serverSocket.to('T1:C1:updates').emit('update', [
        { path: '/test', action: 'invalidated', version: 'v1' },
      ]);
    }, 100);
  }, 10000);
});