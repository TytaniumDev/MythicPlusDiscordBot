// Lines that tell a bug report what the app was doing. They go to the console,
// so the log buffer and Sentry's breadcrumbs pick them up, in the same
// `[Wheelson] [tag]` shape as `reportError`. Discord IDs are fine to pass: the
// buffer scrubs them, but prefer counts and flags to IDs anyway.

type LogData = Record<string, unknown>;

function line(tag: string, message: string): string {
  return `[Wheelson] [${tag}] ${message}`;
}

/** Something normal happened that a report should show, e.g. a screen change. */
export function logInfo(tag: string, message: string, data?: LogData): void {
  if (data) console.info(line(tag, message), data);
  else console.info(line(tag, message));
}

/** Something went wrong, or looks stuck, but isn't an error worth a Sentry issue. */
export function logWarn(tag: string, message: string, data?: LogData): void {
  if (data) console.warn(line(tag, message), data);
  else console.warn(line(tag, message));
}

/**
 * Run `work` and log how long it took, or how long it ran before failing (as
 * a warning, with the error). The result or error passes through unchanged.
 */
export async function logTimed<T>(tag: string, label: string, work: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const elapsed = () => Math.round(performance.now() - start);
  try {
    const result = await work();
    logInfo(tag, `${label} took ${elapsed()}ms`);
    return result;
  } catch (err) {
    logWarn(tag, `${label} failed after ${elapsed()}ms`, { error: String(err) });
    throw err;
  }
}
