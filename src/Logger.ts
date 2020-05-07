/**
 * Logger is the simple interface which used by Manager and Cache to log
 * errors and trace/debug information
 */
export interface Logger {
  info(...args: unknown[]): void;
  trace(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}
