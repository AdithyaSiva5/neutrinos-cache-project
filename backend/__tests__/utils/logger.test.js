const { log } = require('../../src/utils/logger');
const chalk = require('chalk');

describe('Logger Utility', () => {
  let consoleLogSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test('should log info message with timestamp and context', () => {
    const context = 'Test';
    const message = 'This is a test log';
    log(context, message);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(`[${new Date().toISOString().split('.')[0]}] ${context}: ${message}`)
    );
  });

  test('should log success message with data and duration', () => {
    const context = 'Test';
    const message = 'Success log';
    const data = { key: 'value' };
    const durationMs = 123.45;
    log(context, message, data, 'success', durationMs);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `[${new Date().toISOString().split('.')[0]}] ${context}: ${message} [${durationMs.toFixed(2)}ms] - ${JSON.stringify(data)}`
      )
    );
  });

  test('should use correct color for error level', () => {
    const context = 'Test';
    const message = 'Error log';
    log(context, message, null, 'error');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(chalk.red(`[${new Date().toISOString().split('.')[0]}] ${context}: ${message}`))
    );
  });
});