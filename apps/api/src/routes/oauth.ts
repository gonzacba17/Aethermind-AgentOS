import express, { Request, Response, NextFunction } from 'express';
import passport from '../config/passport';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { isValidRedirectUrl, generateUserToken } from '../utils/auth-helpers';
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

  // Store validated redirect URL in session for callback (backup)
  if (req.session) {
    req.session.oauthRedirect = redirect;
  }

  logger.info('Initiating Google OAuth', { redirect });

  // Use state parameter to pass redirect URL (more reliable than sessions)
  // Base64 encode to safely pass in URL
  const state = Buffer.from(JSON.stringify({ redirect })).toString('base64');

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state,
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

      logger.info('[OAuth:Google] Callback handler entered', {
        hasUser: !!user,
        userId: user?.id,
        email: user?.email,
        isTemp: user?.id?.startsWith('temp-'),
        isNewUser: user?._isNewUser,
        hasCompletedOnboarding: user?.hasCompletedOnboarding,
        queryState: !!req.query.state,
        sessionRedirect: req.session?.oauthRedirect,
      });

      if (!user) {
        throw new Error('No user returned from OAuth');
      }

      // Determine redirect destination based on user state
      const dashboardBase = process.env.DASHBOARD_URL || 'https://aethermind-agent-os-dashboard.vercel.app';
      let redirectPath: string;
      if (user._isNewUser === true) {
        redirectPath = '/pricing?checkout=true';
      } else if (user.hasCompletedOnboarding === false) {
        redirectPath = '/home';
      } else {
        redirectPath = '/dashboard';
      }
      const redirect = `${dashboardBase}${redirectPath}`;

      logger.info('[OAuth:Google] Redirect decision', {
        userId: user.id,
        _isNewUser: user._isNewUser,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        redirectPath,
        finalRedirect: redirect,
      });

      // Generate JWT token using centralized helper
      const token = generateUserToken(user);

      // Clear session
      if (req.session) {
        req.session.oauthRedirect = undefined;
      }

      // For cross-domain OAuth (API on Railway, Frontend on Vercel),
      // we must pass the token in the URL since cookies won't work across domains.
      // The frontend will save it to localStorage and clear the URL.
      const redirectUrl = new URL(redirect);
      redirectUrl.searchParams.set('token', token);

      // Also set cookie for same-domain requests
      res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);

      logger.info('[OAuth:Google] Redirecting user', {
        userId: user.id,
        email: user.email,
        redirectUrl: redirectUrl.origin + redirectUrl.pathname,
      });

      res.redirect(redirectUrl.toString());
    } catch (error) {
      logger.error('[OAuth:Google] Callback error', {
        error: (error as Error).message,
        stack: (error as Error).stack?.split('\n').slice(0, 3).join('\n'),
      });

      const dashboardBase = process.env.DASHBOARD_URL || 'https://aethermind-agent-os-dashboard.vercel.app';
      res.redirect(`${dashboardBase}?error=oauth_failed`);
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

  // Store validated redirect URL in session for callback (backup)
  if (req.session) {
    req.session.oauthRedirect = redirect;
  }

  logger.info('Initiating GitHub OAuth', { redirect });

  // Use state parameter to pass redirect URL (more reliable than sessions)
  const state = Buffer.from(JSON.stringify({ redirect })).toString('base64');

  passport.authenticate('github', {
    scope: ['user:email'],
    session: false,
    state,
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

      logger.info('[OAuth:GitHub] Callback handler entered', {
        hasUser: !!user,
        userId: user?.id,
        email: user?.email,
        isTemp: user?.id?.startsWith('temp-'),
        isNewUser: user?._isNewUser,
        hasCompletedOnboarding: user?.hasCompletedOnboarding,
      });

      if (!user) {
        throw new Error('No user returned from OAuth');
      }

      // Determine redirect destination based on user state
      const dashboardBase = process.env.DASHBOARD_URL || 'https://aethermind-agent-os-dashboard.vercel.app';
      let redirectPath: string;
      if (user._isNewUser === true) {
        redirectPath = '/pricing?checkout=true';
      } else if (user.hasCompletedOnboarding === false) {
        redirectPath = '/home';
      } else {
        redirectPath = '/dashboard';
      }
      const redirect = `${dashboardBase}${redirectPath}`;

      // Generate JWT token using centralized helper
      const token = generateUserToken(user);

      logger.info('[OAuth:GitHub] Redirecting user', {
        userId: user.id,
        email: user.email,
        _isNewUser: user._isNewUser,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        redirectPath,
      });

      // Clear session
      if (req.session) {
        req.session.oauthRedirect = undefined;
      }

      // For cross-domain OAuth (API on Railway, Frontend on Vercel),
      // we must pass the token in the URL since cookies won't work across domains.
      const redirectUrl = new URL(redirect);
      redirectUrl.searchParams.set('token', token);

      // Also set cookie for same-domain requests
      res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);

      res.redirect(redirectUrl.toString());
    } catch (error) {
      logger.error('[OAuth:GitHub] Callback error', {
        error: (error as Error).message,
        stack: (error as Error).stack?.split('\n').slice(0, 3).join('\n'),
      });

      const dashboardBase = process.env.DASHBOARD_URL || 'https://aethermind-agent-os-dashboard.vercel.app';
      res.redirect(`${dashboardBase}?error=oauth_failed`);
    }
  }
);

/**
 * OAuth error handler
 */
router.get('/oauth-error', (req: Request, res: Response) => {
  logger.warn('[OAuth] Authentication failed at passport level');
  const dashboardBase = process.env.DASHBOARD_URL || 'https://aethermind-agent-os-dashboard.vercel.app';
  res.redirect(`${dashboardBase}?error=oauth_failed`);
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

// Note: /me endpoint is handled by auth.ts which provides complete user data including apiKey

export { AUTH_COOKIE_NAME };
export default router;
