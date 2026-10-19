import fs from 'node:fs';
import logger from './logger.js';

export const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Touches `file` now and every `intervalMs` while `isConnected()` is true, and
 * returns a function that stops it. The Docker healthcheck marks the container
 * unhealthy once the file is a few intervals old, so a process that stays up
 * after losing its Discord connection shows up in `docker ps`.
 */
export function startHeartbeat(
  isConnected: () => boolean,
  file: string,
  intervalMs: number = HEARTBEAT_INTERVAL_MS,
): () => void {
  const beat = (): void => {
    if (!isConnected()) return;
    try {
      fs.writeFileSync(file, String(Date.now()));
    } catch (err) {
      logger.warn(`Heartbeat write failed: ${err instanceof Error ? err.name : 'unknown error'}`);
    }
  };
  beat();
  const timer = setInterval(beat, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
