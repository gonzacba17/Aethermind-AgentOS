/**
 * Centralized authentication utilities
 * Eliminates code duplication across auth routes and middleware
 */

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

// =============================================================================
// Types
// =============================================================================

export interface JWTPayload {
  userId?: string;
  id?: string;
  email: string;
  name?: string;
  plan?: string;
  usageCount?: number;
  usageLimit?: number;
  iat?: number;
  exp?: number;
}

export interface AuthError extends Error {
  status: number;
  code: string;
}

// =============================================================================
// JWT Secret Management
// =============================================================================

let cachedJWTSecret: string | null = null;

/**
 * Get JWT secret with validation
 * Throws if not configured properly in production
 */
export function getJWTSecret(): string {
  if (cachedJWTSecret) return cachedJWTSecret;

  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error('SECURITY: JWT_SECRET must be set and be at least 32 characters');
  }

  if (secret === 'your-super-secret-jwt-key-change-in-production' ||
      secret === 'your-jwt-secret-change-in-production-min-32-chars') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SECURITY: Default JWT_SECRET cannot be used in production');
    }
  }

  cachedJWTSecret = secret;
  return secret;
}

// =============================================================================
// Token Extraction
// =============================================================================

/**
 * Extract JWT token from request
 * Checks Authorization header, cookies, and query params
 */
export function extractTokenFromRequest(req: Request): string | null {
  // 1. Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // 2. Check cookies
  const cookieToken = req.cookies?.auth_token;
  if (cookieToken) {
    return cookieToken;
  }

  // 3. Check query params (for specific flows like email verification)
  const queryToken = req.query.token as string;
  if (queryToken) {
    return queryToken;
  }

  return null;
}

/**
 * Extract and validate token presence, sending error response if missing
 * Returns token if present, null if error response was sent
 */
export function requireToken(req: Request, res: Response): string | null {
  const token = extractTokenFromRequest(req);

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'MISSING_TOKEN',
      message: 'Authentication token is required',
    });
    return null;
  }

  return token;
}

// =============================================================================
// JWT Verification
// =============================================================================

/**
 * Verify JWT token and return decoded payload
 * Throws AuthError on failure
 */
export function verifyJWT(token: string): JWTPayload {
  try {
    const secret = getJWTSecret();
    const decoded = jwt.verify(token, secret) as JWTPayload;
    return decoded;
  } catch (error) {
    const authError = new Error('Invalid or expired token') as AuthError;

    if (error instanceof jwt.TokenExpiredError) {
      authError.message = 'Token has expired';
      authError.code = 'TOKEN_EXPIRED';
    } else if (error instanceof jwt.JsonWebTokenError) {
      authError.message = 'Invalid token';
      authError.code = 'INVALID_TOKEN';
    } else {
      authError.code = 'TOKEN_ERROR';
    }

    authError.status = 401;
    throw authError;
  }
}

/**
 * Verify JWT and send error response if invalid
 * Returns decoded payload if valid, null if error response was sent
 */
export function verifyJWTOrRespond(token: string, res: Response): JWTPayload | null {
  try {
    return verifyJWT(token);
  } catch (error) {
    const authError = error as AuthError;
    res.status(authError.status || 401).json({
      error: 'Unauthorized',
      code: authError.code || 'AUTH_ERROR',
      message: authError.message,
    });
    return null;
  }
}

// =============================================================================
// Token Generation
// =============================================================================

export interface TokenOptions {
  expiresIn?: string | number;
}

/**
 * Generate JWT token for a user
 */
export function generateToken(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  options: TokenOptions = {}
): string {
  const secret = getJWTSecret();
  return jwt.sign(payload as object, secret, {
    expiresIn: options.expiresIn ?? '7d',
  } as jwt.SignOptions);
}

/**
 * Generate JWT token with standard user fields
 */
export function generateUserToken(user: {
  id: string;
  email: string;
  plan?: string;
  usageCount?: number;
  usageLimit?: number;
}): string {
  return generateToken({
    userId: user.id,
    id: user.id,
    email: user.email,
    plan: user.plan,
    usageCount: user.usageCount,
    usageLimit: user.usageLimit,
  });
}

// =============================================================================
// User ID Extraction
// =============================================================================

/**
 * Get user ID from JWT payload (handles both 'userId' and 'id' fields)
 */
export function getUserIdFromPayload(payload: JWTPayload): string | null {
  return payload.userId || payload.id || null;
}

/**
 * Extract user ID from request (assumes token was already verified)
 */
export function extractUserIdFromRequest(req: Request): string | null {
  const token = extractTokenFromRequest(req);
  if (!token) return null;

  try {
    const payload = verifyJWT(token);
    return getUserIdFromPayload(payload);
  } catch {
    return null;
  }
}

// =============================================================================
// Response Formatters
// =============================================================================

/**
 * Format standard auth response with token and user data
 */
export function formatAuthResponse(user: {
  id: string;
  email: string;
  name?: string | null;
  plan?: string;
  apiKey?: string;
  emailVerified?: boolean;
  usageCount?: number;
  usageLimit?: number;
}, token: string) {
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      apiKey: user.apiKey,
      emailVerified: user.emailVerified,
      usageCount: user.usageCount,
      usageLimit: user.usageLimit,
    },
  };
}

// =============================================================================
// URL Validation
// =============================================================================

import { ALLOWED_OAUTH_REDIRECTS } from '../config/constants';

/**
 * Validate redirect URL against whitelist
 * Prevents open redirect vulnerabilities
 */
export function isValidRedirectUrl(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const origin = `${parsed.protocol}//${parsed.host}`;

    return ALLOWED_OAUTH_REDIRECTS.some(allowed => {
      // Check if the URL starts with an allowed origin
      return url.startsWith(allowed) || origin === allowed;
    });
  } catch {
    // Invalid URL
    return false;
  }
}

/**
 * Get safe redirect URL, falling back to default if invalid
 */
export function getSafeRedirectUrl(url: string | undefined): string {
  const defaultUrl = process.env.FRONTEND_URL ||
                     process.env.DASHBOARD_URL ||
                     'https://aethermind-page.vercel.app';

  if (!url) return defaultUrl;

  return isValidRedirectUrl(url) ? url : defaultUrl;
}
