/**
 * Auth routes — OAuth providers
 * 
 * OAuth routes (Google, GitHub) are already in a separate file:
 *   apps/api/src/routes/oauth.ts
 * 
 * This module re-exports them so the auth/ directory is self-contained.
 * The oauth.ts routes are mounted at /auth/google, /auth/github, etc.
 */

export { default } from '../oauth';
