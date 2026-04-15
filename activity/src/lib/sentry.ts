import * as Sentry from '@sentry/react';

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
    environment: import.meta.env.MODE,
    release: typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : undefined,
    // Keep the payload small — we care about errors, not performance traces.
    tracesSampleRate: 0,
    // Anonymous correlation only. NEVER pass Discord user IDs here.
    initialScope: {
      user: { id: getAnonymousId() },
    },
  });

  initialized = true;
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
  console.error(`[Wheelson] ${tag}${error instanceof Error ? error.message : String(error)}`, error);

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
