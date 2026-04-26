import * as Sentry from '@sentry/node';
import { logger } from '../logger.js';

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN_SERVER;
  if (!dsn) {
    logger.info('[sentry] no DSN set — skipping init');
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  });
  logger.info('[sentry] initialized');
}
