// =============================================================================
// Database Configuration
// =============================================================================
export const DB_POOL_MAX = parseInt(process.env['DB_POOL_MAX'] || '20', 10);

// =============================================================================
// LLM Configuration
// =============================================================================
export const LLM_TIMEOUT_MS = parseInt(process.env['LLM_TIMEOUT_MS'] || '30000', 10);

// =============================================================================
// Queue Configuration
// =============================================================================
export const QUEUE_CONCURRENCY = parseInt(process.env['QUEUE_CONCURRENCY'] || '10', 10);

// =============================================================================
// Rate Limiting Configuration
// =============================================================================
export const RATE_LIMIT_WINDOW_MS = parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10);
export const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10);

// Auth-specific rate limits
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const PASSWORD_RESET_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
export const PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS = 3;
export const EMAIL_VERIFY_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const EMAIL_VERIFY_RATE_LIMIT_MAX_ATTEMPTS = 5;

// =============================================================================
// Server Configuration
// =============================================================================
export const CONFIG_WATCHER_DEBOUNCE_MS = parseInt(process.env['CONFIG_WATCHER_DEBOUNCE_MS'] || '300', 10);
export const REQUEST_BODY_LIMIT = process.env['REQUEST_BODY_LIMIT'] || '10mb';
export const DEFAULT_PORT = parseInt(process.env['PORT'] || '3001', 10);

// =============================================================================
// Authentication Configuration
// =============================================================================
export const JWT_EXPIRES_IN = '7d';
export const PASSWORD_MIN_LENGTH = 8;
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// =============================================================================
// Alert & Budget Configuration
// =============================================================================
export const ALERT_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const BUDGET_RESET_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// =============================================================================
// Query Limits
// =============================================================================
export const DEFAULT_QUERY_LIMIT = 100;
export const MAX_QUERY_LIMIT = 1000;

// =============================================================================
// CORS Origins - strict whitelist in production
// =============================================================================
export const CORS_ORIGINS = process.env.NODE_ENV === 'production'
  ? [
      'https://aethermind-page.vercel.app',
      'https://aethermind-agent-os-dashboard.vercel.app',
      'https://dashboard.aethermind.io',
    ]
  : process.env['CORS_ORIGINS']?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'https://aethermind-page.vercel.app',
      'https://aethermind-agent-os-dashboard.vercel.app'
    ];

// =============================================================================
// OAuth Redirect Whitelist - SECURITY: Only allow redirects to known domains
// =============================================================================
export const ALLOWED_OAUTH_REDIRECTS = process.env.NODE_ENV === 'production'
  ? [
      'https://aethermind-page.vercel.app',
      'https://aethermind-agent-os-dashboard.vercel.app',
      'https://dashboard.aethermind.io',
    ]
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'https://aethermind-page.vercel.app',
      'https://aethermind-agent-os-dashboard.vercel.app',
    ];

// =============================================================================
// Redis Configuration
// =============================================================================
export const REDIS_URL = process.env['REDIS_URL'];
