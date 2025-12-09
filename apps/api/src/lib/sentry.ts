import * as Sentry from '@sentry/node';
// import { ProfilingIntegration } from '@sentry/profiling-node';

export function initSentry(): void {
  const SENTRY_DSN = process.env.SENTRY_DSN;
  
  if (SENTRY_DSN && process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production',
      integrations: [
        // new ProfilingIntegration(),
      ],
      tracesSampleRate: 0.1,
      profilesSampleRate: 0.1,
    });
    console.log(' Sentry initialized for error tracking');
  } else {
    console.log('9 Sentry not initialized (missing SENTRY_DSN or not production)');
  }
}

export { Sentry };
