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
