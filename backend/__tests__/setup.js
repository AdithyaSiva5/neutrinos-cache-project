const { Pool } = require('pg');
const Redis = require('ioredis');
const { log } = require('../src/utils/logger');

// Mock console.log to suppress logger output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});

// Mock PostgreSQL Pool
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
    connect: jest.fn(() => ({
      query: jest.fn(),
      release: jest.fn(),
    })),
  };
  return { Pool: jest.fn(() => mPool) };
});

// Mock ioredis
jest.mock('ioredis', () => {
  const mRedis = {
    get: jest.fn(),
    setex: jest.fn(),
    sadd: jest.fn(),
    pipeline: jest.fn(() => ({
      setex: jest.fn(),
      sadd: jest.fn(),
      hset: jest.fn(),
      exec: jest.fn(),
    })),
    hget: jest.fn(),
    hgetall: jest.fn(),
    smembers: jest.fn(),
    publish: jest.fn(),
    del: jest.fn(),
    on: jest.fn(),
    psubscribe: jest.fn(),
  };
  return jest.fn(() => mRedis);
});

// Mock logger to prevent actual logging during tests
jest.mock('../src/utils/logger', () => ({
  log: jest.fn(),
}));

// Clear all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

module.exports = {};