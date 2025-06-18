const { Pool } = require('pg');
const { database } = require('./env');
const { log } = require('../utils/logger');

const pool = new Pool({
  ...database,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

log('Server Init', 'PostgreSQL pool initialized', null, 'success');

module.exports = { pool };