import * as Sentry from '@sentry/node';
import { SENTRY_DSN, GIT_SHA } from './config.js';

export function initSentry() {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    release: GIT_SHA ?? 'unknown',
    environment: process.env.NODE_ENV ?? 'production',
    tracesSampleRate: 0,
  });
}

export { Sentry };
