import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import logger from './logger';

/**
 * Type guard to check if error is a Prisma error
 */
export function isPrismaError(
  error: unknown
): error is PrismaClientKnownRequestError {
  return error instanceof PrismaClientKnownRequestError;
}

/**
 * Handle Prisma errors with proper logging and return null
 * @param error - The error to handle
 * @param operation - Description of the operation that failed
 * @returns null (for consistent error handling pattern)
 */
export function handlePrismaError(
  error: unknown,
  operation: string
): null {
  if (!isPrismaError(error)) {
    logger.error(`${operation} failed`, { error });
    return null;
  }

  const { code, meta } = error;

  switch (code) {
    case 'P2002':
      logger.warn(`${operation} failed: Unique constraint violated`, {
        field: meta?.target,
        code,
      });
      break;

    case 'P2025':
      logger.info(`${operation} failed: Record not found`, { code });
      break;

    case 'P2003':
      logger.warn(`${operation} failed: Foreign key constraint`, {
        meta,
        code,
      });
      break;

    case 'P1001':
    case 'P1002':
    case 'P1008':
      logger.error(`${operation} failed: Database connection error`, {
        code,
        shouldRetry: true,
      });
      break;

    case 'P2024':
      logger.error(`${operation} failed: Connection timeout`, {
        code,
        shouldRetry: true,
      });
      break;

    default:
      logger.error(`${operation} failed: Prisma error`, {
        code,
        meta,
        message: error.message,
      });
  }

  return null;
}

/**
 * Get user-friendly error message for Prisma error codes
 */
export function getPrismaErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    P2002: 'A record with this value already exists',
    P2025: 'Record not found',
    P2003: 'Foreign key constraint failed',
    P1001: 'Cannot reach database server',
    P1002: 'Database server timeout',
    P1008: 'Operation timed out',
    P2024: 'Connection pool timeout',
  };

  return messages[code] || 'Database operation failed';
}
