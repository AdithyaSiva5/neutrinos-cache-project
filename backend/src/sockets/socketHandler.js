const { log } = require('../utils/logger');
const { subscriptionRegistry } = require('../services/cacheService');

module.exports = (io) => {
  io.on('connection', (socket) => {
    const startTime = performance.now();
    log('Socket.IO', `Connected: ${socket.id}`, null, 'success', performance.now() - startTime);
    socket.setMaxListeners(15);

    socket.on('subscribe', ({ tenantId, configId, pathPattern }) => {
      const subStart = performance.now();
      if (!/^[A-Za-z0-9]+$/.test(tenantId) || !/^[A-Za-z0-9]+$/.test(configId)) {
        log('Socket.IO', `Invalid tenantId or configId in subscription`, { tenantId, configId }, 'error');
        return;
      }
      const socketChannel = `${tenantId}:${configId}:updates`;
      socket.join(socketChannel);
      if (pathPattern) {
        const key = `${tenantId}:${configId}:${pathPattern}`;
        if (!subscriptionRegistry.has(key)) {
          subscriptionRegistry.set(key, new Set());
        }
        subscriptionRegistry.get(key).add(socket.id);
        log('Socket.IO', `${socket.id} subscribed to ${key}`, null, 'success', performance.now() - subStart);
      }
      log('Socket.IO', `${socket.id} joined ${socketChannel}`, null, 'info', performance.now() - subStart);
    });

    socket.on('disconnect', () => {
      subscriptionRegistry.forEach((socketIds, key) => {
        socketIds.delete(socket.id);
        if (socketIds.size === 0) subscriptionRegistry.delete(key);
      });
      log('Socket.IO', `Disconnected: ${socket.id}`, null, 'warn');
    });
  });
};