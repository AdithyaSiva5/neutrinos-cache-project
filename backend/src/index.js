const { app, server, io } = require('./config/server');
const { server: serverConfig } = require('./config/env');
const { log } = require('./utils/logger');
const applyConfigRoutes = require('./routes/configRoutes');
const applyMetricsRoutes = require('./routes/metricsRoutes');
const applySocketHandler = require('./sockets/socketHandler');

applyConfigRoutes(app);
applyMetricsRoutes(app);
applySocketHandler(io);

if (serverConfig.nodeEnv !== 'test') {
  server.listen(serverConfig.port, () => {
    log('Server', `Running on port ${serverConfig.port}`, null, 'success');
  });
}

module.exports = { app };