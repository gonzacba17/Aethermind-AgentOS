/**
 * Auth routes — central index
 * 
 * Mounts all auth sub-routers on a single Express Router.
 * Each sub-module handles a specific auth concern.
 * 
 * Structure:
 *   signup.ts    → POST /auth/signup + POST /auth/verify-email
 *   login.ts     → POST /auth/login + POST /auth/logout
 *   password.ts  → POST /auth/forgot-password + POST /auth/reset-password
 *   plan.ts      → POST /auth/update-plan
 *   profile.ts   → GET /auth/me + PATCH /auth/me + POST /auth/regenerate-api-key
 *   session.ts   → POST /auth/create-temp-session + POST /auth/session + PATCH /auth/onboarding
 *   oauth.ts     → re-exports routes/oauth.ts (GET /auth/google, /auth/github + callbacks)
 */

import { Router } from 'express';

import signupRoutes from './signup';
import loginRoutes from './login';
import passwordRoutes from './password';
import planRoutes from './plan';
import profileRoutes from './profile';
import sessionRoutes from './session';

const router = Router();

// Mount sub-routers — order matters for route precedence
router.use(signupRoutes);
router.use(loginRoutes);
router.use(passwordRoutes);
router.use(planRoutes);
router.use(profileRoutes);
router.use(sessionRoutes);

export default router;
