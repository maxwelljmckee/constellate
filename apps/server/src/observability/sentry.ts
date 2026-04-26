import * as Sentry from '@sentry/node';

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN_SERVER;
  if (!dsn) {
    console.log('[sentry] no DSN set — skipping init');
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  });
  console.log('[sentry] initialized');
}
