import { Logger } from './logger';

export default function createLogger(logger: Logger, manager: string): Logger {
  const prefix = `[cache-manager:${manager}]`;

  return {
    info: (...args: any[]): void => logger.info(prefix, ...args),
    trace: (...args: any[]): void => logger.trace(prefix, ...args),
    warn: (...args: any[]): void => logger.warn(prefix, ...args),
    error: (...args: any[]): void => logger.error(prefix, ...args)
  };
}
