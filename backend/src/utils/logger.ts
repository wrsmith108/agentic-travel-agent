import winston from 'winston';
import path from 'path';
import { env } from '../config/env';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }

    return logMessage;
  })
);

// Create transports array
const transports: winston.transport[] = [];

// Console transport (always enabled in development)
if (env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
} else {
  // Production console transport with JSON format
  transports.push(
    new winston.transports.Console({
      format: logFormat,
    })
  );
}

// File transports
transports.push(
  // Error log file
  new winston.transports.File({
    filename: path.join(env.LOG_DIRECTORY, 'error.log'),
    level: 'error',
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  // Combined log file
  new winston.transports.File({
    filename: path.join(env.LOG_DIRECTORY, 'combined.log'),
    format: logFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 10,
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: logFormat,
  defaultMeta: {
    service: 'agentic-travel-agent',
    environment: env.NODE_ENV,
  },
  transports,
  exitOnError: false,
});

// Add request ID to child logger
export function createRequestLogger(requestId: string): winston.Logger {
  return logger.child({ requestId });
}

// Create service-specific logger
export function createLogger(service: string): winston.Logger {
  return logger.child({ service });
}

// Export as default for backward compatibility
export default createLogger;

// Log unhandled errors
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  // Give logger time to write before exiting
  setTimeout(() => process.exit(1), 1000);
});

// Base logger instance available for direct use
export { logger };

// Convenience methods
export const logInfo = (message: string, meta?: Record<string, unknown>): void => {
  logger.info(message, meta);
};

export const logError = (
  message: string,
  error?: Error | unknown,
  meta?: Record<string, unknown>
): void => {
  if (error instanceof Error) {
    logger.error(message, { error: error.message, stack: error.stack, ...meta });
  } else {
    logger.error(message, { error, ...meta });
  }
};

export const logWarn = (message: string, meta?: Record<string, unknown>): void => {
  logger.warn(message, meta);
};

export const logDebug = (message: string, meta?: Record<string, unknown>): void => {
  logger.debug(message, meta);
};
