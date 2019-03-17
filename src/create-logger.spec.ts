import createLogger from './create-logger';

describe('createLogger', () => {
  const managerName = 'test';
  const logger = {
    info: jest.fn(),
    trace: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };

  it('creates logger which adds component name to log messages', () => {
    const componentLogger = createLogger(logger, managerName);

    componentLogger.info('info');
    componentLogger.trace('trace');
    componentLogger.warn('warn');
    componentLogger.error('error');

    expect(logger.info).toBeCalledWith('[cache-manager:test]', 'info');
    expect(logger.trace).toBeCalledWith('[cache-manager:test]', 'trace');
    expect(logger.warn).toBeCalledWith('[cache-manager:test]', 'warn');
    expect(logger.error).toBeCalledWith('[cache-manager:test]', 'error');
  });
});
