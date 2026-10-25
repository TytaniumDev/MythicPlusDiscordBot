import * as Sentry from '@sentry/react';
import { isDiscordEmbedded } from './embedded';

const ANONYMOUS_ID_KEY = 'wheelson-anonymous-id';

/**
 * Per-session anonymous identifier so we can correlate multiple errors from
 * the same browser session without capturing the user's Discord ID. Persisted
 * in sessionStorage so it survives page reloads within a tab but not across
 * browser restarts or Discord Activity relaunches.
 */
function getAnonymousId(): string {
  try {
    const existing = sessionStorage.getItem(ANONYMOUS_ID_KEY);
    if (existing) return existing;
    const id = (crypto.randomUUID?.() ?? `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    sessionStorage.setItem(ANONYMOUS_ID_KEY, id);
    return id;
  } catch {
    // intentional: sessionStorage can throw in locked-down browsers
    // (Safari private mode, embedded webviews). Fall back to a throwaway id.
    return `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

let initialized = false;

/** The Developer Portal URL mapping that proxies Sentry's ingest host. */
export const SENTRY_PROXY_PREFIX = '/sentry';

/**
 * Where reports go inside Discord: an activity can only reach hosts in its URL
 * mappings, and Sentry sends with a fetch the SDK's `patchUrlMappings` can't
 * rewrite, so reports are posted to the project's envelope endpoint through
 * the `/sentry` mapping instead. Null when the DSN has no project ID.
 */
export function sentryTunnel(dsn: string): string | null {
  try {
    const projectId = new URL(dsn).pathname.split('/').filter(Boolean).pop();
    return projectId ? `${SENTRY_PROXY_PREFIX}/api/${projectId}/envelope/` : null;
  } catch {
    // intentional: a malformed DSN means no tunnel; Sentry.init reports it
    return null;
  }
}

/**
 * Initialize Sentry. No-op when VITE_SENTRY_DSN is absent (local dev, CI
 * without the secret, preview builds), so the app keeps working without it.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.info('[Wheelson] Sentry disabled (no VITE_SENTRY_DSN set)');
    return;
  }

  Sentry.init({
    dsn,
    tunnel: isDiscordEmbedded() ? sentryTunnel(dsn) ?? undefined : undefined,
    environment: import.meta.env.MODE,
    release: typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : undefined,
    // Keep the payload small — we care about errors, not performance traces.
    tracesSampleRate: 0,
    // Drop benign cancellations bubbled up by Firebase/Discord SDKs through
    // `onunhandledrejection` as bare strings — they have no stacktrace and
    // no actionable signal.
    ignoreErrors: [
      /Non-Error promise rejection captured with value: cancelled/,
    ],
    // Anonymous correlation only. NEVER pass Discord user IDs here.
    initialScope: {
      user: { id: getAnonymousId() },
    },
  });

  initialized = true;
}

/** Whether Sentry is set up, so reports sent to it reach Sentry. */
export function isSentryReady(): boolean {
  return initialized;
}

/**
 * A one-line message for the console. The Discord SDK rejects with plain
 * `{ code, message }` objects, which `String()` turns into "[object Object]".
 */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      // intentional: a circular object falls back to String()
      void 0;
    }
  }
  return String(error);
}

/**
 * Report an error to Sentry with optional tagged context. Also logs to the
 * console so the error is still visible in local development without a DSN.
 */
export function reportError(
  error: unknown,
  context?: { tag?: string; extra?: Record<string, unknown> },
): void {
  const tag = context?.tag ? `[${context.tag}] ` : '';
  console.error(`[Wheelson] ${tag}${describeError(error)}`, error);

  if (!initialized) return;

  Sentry.withScope((scope) => {
    if (context?.tag) scope.setTag('component', context.tag);
    if (context?.extra) {
      for (const [key, value] of Object.entries(context.extra)) {
        scope.setExtra(key, value);
      }
    }
    Sentry.captureException(error);
  });
}

export { Sentry };
