import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { PrismaClient } from '@prisma/client';
import { findOrCreateOAuthUser } from '../services/OAuthService';
import logger from '../utils/logger';

const prisma = new PrismaClient();

// Configure Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        logger.info('Google OAuth callback received', {
          profileId: profile.id,
          email: profile.emails?.[0]?.value,
        });

        const user = await findOrCreateOAuthUser({
          provider: 'google',
          providerId: profile.id,
          email: profile.emails?.[0]?.value || '',
          name: profile.displayName || profile.emails?.[0]?.value?.split('@')[0] || 'User',
        });

        done(null, user);
      } catch (error) {
        logger.error('Google OAuth error', { error: (error as Error).message });
        done(error as Error);
      }
    }
  )
);

// Configure GitHub OAuth Strategy
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/api/auth/github/callback',
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        logger.info('GitHub OAuth callback received', {
          profileId: profile.id,
          username: profile.username,
        });

        const user = await findOrCreateOAuthUser({
          provider: 'github',
          providerId: profile.id,
          email: profile.emails?.[0]?.value || `${profile.username}@github.local`,
          name: profile.displayName || profile.username || 'User',
        });

        done(null, user);
      } catch (error) {
        logger.error('GitHub OAuth error', { error: (error as Error).message });
        done(error as Error);
      }
    }
  )
);

// Serialize user to session (not really used with JWT, but required by Passport)
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
