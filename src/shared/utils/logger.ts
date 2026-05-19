type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  if (args.length > 0) {
    return `${prefix} ${message} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`;
  }
  return `${prefix} ${message}`;
}

export const logger = {
  info: (message: string, ...args: unknown[]) => console.log(formatMessage('info', message, ...args)),
  warn: (message: string, ...args: unknown[]) => console.warn(formatMessage('warn', message, ...args)),
  error: (message: string, ...args: unknown[]) => console.error(formatMessage('error', message, ...args)),
  debug: (message: string, ...args: unknown[]) => console.debug(formatMessage('debug', message, ...args)),
};
