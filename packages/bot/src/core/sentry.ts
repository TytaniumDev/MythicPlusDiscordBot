import * as Sentry from '@sentry/node';
import logger from './logger.js';
import { SENTRY_DSN, GIT_SHA } from './config.js';

export function initSentry(): void {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    release: GIT_SHA ? `mythicplus-bot@${GIT_SHA}` : undefined,
    environment: process.env.NODE_ENV ?? 'production',
    tracesSampleRate: 0.1,
  });
}

export interface ReportErrorContext {
  tags?: Record<string, string | undefined>;
  user?: { id: string; username: string };
  extra?: Record<string, unknown>;
}

/**
 * Log an error to winston and forward it to Sentry with optional context.
 * Mirrors the activity frontend's `reportError(err, { tag })` wrapper so
 * both surfaces share a single error-reporting entrypoint.
 */
export function reportError(err: unknown, context?: ReportErrorContext): void {
  const handler = context?.tags?.handler;
  logger.error(handler ? `[${handler}] ${err}` : `${err}`);
  Sentry.captureException(err, context);
}

export { Sentry };
