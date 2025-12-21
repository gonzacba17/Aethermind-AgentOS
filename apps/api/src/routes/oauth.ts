import express, { Request, Response, NextFunction } from 'express';
import passport from '../config/passport';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

const router: express.Router = express.Router();

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
  
  // Store redirect URL in session for callback
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
      
      const redirect = req.session?.oauthRedirect || process.env.DASHBOARD_URL || 'http://localhost:3000';
      
      // Generate JWT token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          plan: user.plan,
          usageCount: user.usageCount,
          usageLimit: user.usageLimit,
        },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );
      
      logger.info('OAuth login successful', {
        userId: user.id,
        email: user.email,
        provider: 'google',
      });
      
      // Clear session
      if (req.session) {
        req.session.oauthRedirect = undefined;
      }
      
      // Redirect to frontend with token
      res.redirect(`${redirect}?token=${token}`);
    } catch (error) {
      logger.error('OAuth callback error', {
        error: (error as Error).message,
        provider: 'google',
      });
      
      const redirect = req.session?.oauthRedirect || process.env.DASHBOARD_URL || 'http://localhost:3000';
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
      
      const redirect = req.session?.oauthRedirect || process.env.DASHBOARD_URL || 'http://localhost:3000';
      
      // Generate JWT token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          plan: user.plan,
          usageCount: user.usageCount,
          usageLimit: user.usageLimit,
        },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );
      
      logger.info('OAuth login successful', {
        userId: user.id,
        email: user.email,
        provider: 'github',
      });
      
      // Clear session
      if (req.session) {
        req.session.oauthRedirect = undefined;
      }
      
      res.redirect(`${redirect}?token=${token}`);
    } catch (error) {
      logger.error('OAuth callback error', {
        error: (error as Error).message,
        provider: 'github',
      });
      
      const redirect = req.session?.oauthRedirect || process.env.DASHBOARD_URL || 'http://localhost:3000';
      res.redirect(`${redirect}?error=oauth_failed`);
    }
  }
);

/**
 * OAuth error handler
 */
router.get('/oauth-error', (req: Request, res: Response) => {
  const redirect = req.session?.oauthRedirect || process.env.DASHBOARD_URL || 'http://localhost:3000';
  logger.warn('OAuth authentication failed');
  res.redirect(`${redirect}?error=oauth_failed`);
});

export default router;
