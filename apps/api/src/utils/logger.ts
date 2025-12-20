import winston from 'winston';
import path from 'path';

const { combine, timestamp, json, errors, printf, colorize } = winston.format;

// Custom format for development (human-readable)
const devFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata, null, 2)}`;
  }
  
  return msg;
});

// Format for production (structured JSON)
const prodFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  json()
);

// Determine log directory
const logDir = path.join(process.cwd(), 'logs');

// Create transports array
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' 
      ? prodFormat 
      : combine(colorize(), timestamp({ format: 'HH:mm:ss' }), devFormat),
  }),
];

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: prodFormat,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: prodFormat,
    })
  );
}

// Create the logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: prodFormat,
  transports,
  exitOnError: false,
});

// Stream for Morgan middleware integration
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Helper methods for common logging patterns
export const logRequest = (req: any) => {
  logger.http('HTTP Request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
  });
};

export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error(error.message, {
    stack: error.stack,
    name: error.name,
    ...context,
  });
};

export const logAgentExecution = (data: {
  agentId: string;
  executionId: string;
  status: string;
  duration?: number;
  cost?: number;
  tokensUsed?: number;
}) => {
  logger.info('Agent execution completed', {
    type: 'agent_execution',
    ...data,
  });
};

export const logBudgetAlert = (data: {
  budgetId: string;
  userId: string;
  percentUsed: number;
  severity: 'warning' | 'critical';
}) => {
  logger.warn('Budget alert triggered', {
    type: 'budget_alert',
    ...data,
  });
};

export const logApiKeyValidation = (data: {
  success: boolean;
  userId?: string;
  ip: string;
}) => {
  if (data.success) {
    logger.debug('API key validated', data);
  } else {
    logger.warn('API key validation failed', data);
  }
};

// Export default
export default logger;
