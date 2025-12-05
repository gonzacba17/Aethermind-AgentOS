export const DB_POOL_MAX = parseInt(process.env['DB_POOL_MAX'] || '20', 10);

export const LLM_TIMEOUT_MS = parseInt(process.env['LLM_TIMEOUT_MS'] || '30000', 10);

export const QUEUE_CONCURRENCY = parseInt(process.env['QUEUE_CONCURRENCY'] || '10', 10);

export const RATE_LIMIT_WINDOW_MS = parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10);

export const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10);

export const CONFIG_WATCHER_DEBOUNCE_MS = parseInt(process.env['CONFIG_WATCHER_DEBOUNCE_MS'] || '300', 10);

export const REQUEST_BODY_LIMIT = process.env['REQUEST_BODY_LIMIT'] || '10mb';

export const DEFAULT_PORT = parseInt(process.env['PORT'] || '3001', 10);

export const CORS_ORIGINS = process.env['CORS_ORIGINS']?.split(',') || [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://aethermind-page.vercel.app',
  'https://aethermind-agent-os-dashboard.vercel.app'
];

export const REDIS_URL = process.env['REDIS_URL'] || 'redis://localhost:6379';
