import express, { Request, Response, NextFunction } from 'express';
import passport from '../config/passport';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { isValidRedirectUrl, getSafeRedirectUrl, generateUserToken } from '../utils/auth-helpers';
import { AUTH_COOKIE_MAX_AGE_MS } from '../config/constants';

const router: express.Router = express.Router();

// Cookie configuration for auth tokens
const AUTH_COOKIE_NAME = 'auth_token';
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: AUTH_COOKIE_MAX_AGE_MS,
  domain: process.env.COOKIE_DOMAIN || undefined,
  path: '/',
};

// Extend Express Request type for session
declare module 'express-session' {
  interface SessionData {
    oauthRedirect?: string;
  }
}

/**
 * Google OAuth - Initiate authentication
 * GET /api/auth/google?redirect={redirect_url}
 */
router.get('/google', (req: Request, res: Response, next: NextFunction) => {
  const redirect = req.query.redirect as string;

  if (!redirect) {
    return res.status(400).json({
      error: 'missing_redirect',
      message: 'Please provide ?redirect={callback_url} parameter',
    });
  }

  // SECURITY: Validate redirect URL against whitelist to prevent open redirect
  if (!isValidRedirectUrl(redirect)) {
    logger.warn('OAuth rejected: invalid redirect URL', { redirect });
    return res.status(400).json({
      error: 'invalid_redirect',
      message: 'Redirect URL is not in the allowed list',
    });
  }

  // Store validated redirect URL in session for callback
  if (req.session) {
    req.session.oauthRedirect = redirect;
  }

  logger.info('Initiating Google OAuth', { redirect });

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })(req, res, next);
});

/**
 * Google OAuth - Callback handler
 * GET /api/auth/google/callback
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/api/auth/oauth-error',
  }),
  (req: Request, res: Response) => {
    try {
      const user = req.user as any;

      if (!user) {
        throw new Error('No user returned from OAuth');
      }

      // SECURITY: Get safe redirect URL (validated against whitelist)
      const redirect = getSafeRedirectUrl(req.session?.oauthRedirect);

      // Generate JWT token using centralized helper
      const token = generateUserToken(user);

      logger.info('OAuth login successful', {
        userId: user.id,
        email: user.email,
        provider: 'google',
        redirectingTo: redirect,
      });

      // Clear session
      if (req.session) {
        req.session.oauthRedirect = undefined;
      }

      // Set httpOnly cookie instead of URL param (security: prevents XSS token theft)
      res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);

      // Redirect without token in URL
      res.redirect(redirect);
    } catch (error) {
      logger.error('OAuth callback error', {
        error: (error as Error).message,
        provider: 'google',
      });

      // SECURITY: Use safe redirect and generic error message
      const redirect = getSafeRedirectUrl(req.session?.oauthRedirect);
      res.redirect(`${redirect}?error=oauth_failed`);
    }
  }
);

/**
 * GitHub OAuth - Initiate authentication
 * GET /api/auth/github?redirect={redirect_url}
 */
router.get('/github', (req: Request, res: Response, next: NextFunction) => {
  const redirect = req.query.redirect as string;

  if (!redirect) {
    return res.status(400).json({
      error: 'missing_redirect',
      message: 'Please provide ?redirect={callback_url} parameter',
    });
  }

  // SECURITY: Validate redirect URL against whitelist to prevent open redirect
  if (!isValidRedirectUrl(redirect)) {
    logger.warn('OAuth rejected: invalid redirect URL', { redirect });
    return res.status(400).json({
      error: 'invalid_redirect',
      message: 'Redirect URL is not in the allowed list',
    });
  }

  if (req.session) {
    req.session.oauthRedirect = redirect;
  }

  logger.info('Initiating GitHub OAuth', { redirect });

  passport.authenticate('github', {
    scope: ['user:email'],
    session: false,
  })(req, res, next);
});

/**
 * GitHub OAuth - Callback handler
 * GET /api/auth/github/callback
 */
router.get(
  '/github/callback',
  passport.authenticate('github', {
    session: false,
    failureRedirect: '/api/auth/oauth-error',
  }),
  (req: Request, res: Response) => {
    try {
      const user = req.user as any;

      if (!user) {
        throw new Error('No user returned from OAuth');
      }

      // SECURITY: Get safe redirect URL (validated against whitelist)
      const redirect = getSafeRedirectUrl(req.session?.oauthRedirect);

      // Generate JWT token using centralized helper
      const token = generateUserToken(user);

      logger.info('OAuth login successful', {
        userId: user.id,
        email: user.email,
        provider: 'github',
        redirectingTo: redirect,
      });

      // Clear session
      if (req.session) {
        req.session.oauthRedirect = undefined;
      }

      // Set httpOnly cookie instead of URL param (security: prevents XSS token theft)
      res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);

      // Redirect without token in URL
      res.redirect(redirect);
    } catch (error) {
      logger.error('OAuth callback error', {
        error: (error as Error).message,
        provider: 'github',
      });

      // SECURITY: Use safe redirect and generic error message
      const redirect = getSafeRedirectUrl(req.session?.oauthRedirect);
      res.redirect(`${redirect}?error=oauth_failed`);
    }
  }
);

/**
 * OAuth error handler
 */
router.get('/oauth-error', (req: Request, res: Response) => {
  // SECURITY: Use safe redirect URL
  const redirect = getSafeRedirectUrl(req.session?.oauthRedirect);
  logger.warn('OAuth authentication failed');
  res.redirect(`${redirect}?error=oauth_failed`);
});

/**
 * Logout endpoint - clears auth cookie
 * POST /api/auth/logout
 */
router.post('/logout', (req: Request, res: Response) => {
  // Clear the auth cookie
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: '/',
  });

  // Clear session if exists
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        logger.error('Error destroying session', { error: err.message });
      }
    });
  }

  logger.info('User logged out successfully');
  res.status(200).json({ message: 'Logged out successfully' });
});

/**
 * Check auth status - returns current user from cookie
 * GET /api/auth/me
 */
router.get('/me', (req: Request, res: Response) => {
  // This endpoint is protected by authMiddleware which attaches user to req
  const user = (req as any).user;

  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    plan: user.plan,
    usageCount: user.usageCount,
    usageLimit: user.usageLimit,
  });
});

export { AUTH_COOKIE_NAME };
export default router;
