const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { applyCors } = require('../middleware/cors');
const { server: serverConfig } = require('./env');
const { log } = require('../utils/logger');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8,
});

applyCors(app);
app.use(express.json({ limit: '10kb' }));

module.exports = { app, server, io };