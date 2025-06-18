const chalk = require('chalk');

const log = (context, message, data = null, level = 'info', durationMs = null) => {
  const timestamp = new Date().toISOString();
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    warn: chalk.yellow,
    error: chalk.red,
  };
  const color = colors[level] || chalk.blue;
  const durationStr = durationMs !== null ? ` [${durationMs.toFixed(2)}ms]` : '';
  console.log(
    color(`[${timestamp}] ${context}: ${message}${durationStr}${data ? ` - ${JSON.stringify(data)}` : ''}`)
  );
};

module.exports = { log };