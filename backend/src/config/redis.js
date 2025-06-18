const Redis = require('ioredis');
const { redis: redisConfig } = require('./env');
const { log } = require('../utils/logger');

const redis = new Redis({
  host: redisConfig.host,
  port: redisConfig.port,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

const redisSubscriber = new Redis({
  host: redisConfig.host,
  port: redisConfig.port,
});

redis.on('error', (err) => log('Redis', `Connection error: ${err.message}`, null, 'error'));
redisSubscriber.on('error', (err) => log('RedisSubscriber', `Connection error: ${err.message}`, null, 'error'));

log('Server Init', 'Redis clients initialized', null, 'success');

module.exports = { redis, redisSubscriber };