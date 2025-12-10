import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  environment: process.env.NODE_ENV,

  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  ignoreErrors: [
    "NetworkError",
    "Network request failed",
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
  ],

  beforeSend(event, hint) {
    return event;
  },
});
