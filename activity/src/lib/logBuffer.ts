import { obfuscatePii } from '@mythicplus/shared';

// The last few hundred console lines, kept in memory so a bug report can carry
// what happened before it. Discord IDs and names are scrubbed when the lines
// are read out, not when they're written, so logging stays cheap.

export type LogLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';

export interface LogEntry {
  /** Milliseconds since the epoch. */
  time: number;
  level: LogLevel;
  message: string;
}

const LEVELS: LogLevel[] = ['debug', 'log', 'info', 'warn', 'error'];
export const LOG_BUFFER_SIZE = 300;
const MESSAGE_MAX = 2000;

const entries: LogEntry[] = [];
let installed = false;

/** One console argument as text. Errors keep their stack; objects become JSON. */
function describeArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.stack ?? `${arg.name}: ${arg.message}`;
  if (typeof arg === 'object' && arg !== null) {
    try {
      return JSON.stringify(arg);
    } catch {
      // intentional: a circular object falls back to String()
      return String(arg);
    }
  }
  return String(arg);
}

/** Add a line to the buffer, dropping the oldest once it's full. */
export function recordLog(level: LogLevel, args: unknown[]): void {
  const message = args.map(describeArg).join(' ').slice(0, MESSAGE_MAX);
  entries.push({ time: Date.now(), level, message });
  if (entries.length > LOG_BUFFER_SIZE) entries.splice(0, entries.length - LOG_BUFFER_SIZE);
}

/**
 * Copy every console call into the buffer. The original console methods still
 * run, so the browser console is unchanged. Safe to call more than once.
 */
export function installLogBuffer(): void {
  if (installed) return;
  installed = true;
  for (const level of LEVELS) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      recordLog(level, args);
      original(...args);
    };
  }
}

/** The buffered lines, oldest first, as scrubbed text for a report. */
export function formatLogs(): string {
  return entries
    .map((e) => `${new Date(e.time).toISOString()} [${e.level}] ${obfuscatePii(e.message)}`)
    .join('\n');
}

/** Empty the buffer. For tests. */
export function clearLogs(): void {
  entries.length = 0;
}
