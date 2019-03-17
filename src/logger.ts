/**
 * Logger is the simple interface which used by Manager and Cache to log
 * errors and trace/debug information
 */
export interface Logger {
  info(...args: any[]): void;
  trace(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}
