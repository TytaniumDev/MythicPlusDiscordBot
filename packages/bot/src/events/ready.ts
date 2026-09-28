import { FirebaseService } from '../core/firebaseService.js';
import logger from '../core/logger.js';

/** Age in seconds beyond which abandoned channel docs are deleted on bot startup (24 hours). */
const FIREBASE_DOC_MAX_AGE_SECONDS = 24 * 60 * 60;

export async function onReady(): Promise<void> {
  // Clean up abandoned lobbies (e.g. frontend closed without completing).
  // Guild docs are durable — they hold group history and season pair counts.
  const firebase = FirebaseService.getInstance();
  if (firebase.isAvailable()) {
    await firebase.deleteOldDocs('channels', FIREBASE_DOC_MAX_AGE_SECONDS);
  }

  logger.info('Bot ready — old lobby docs cleaned up.');
}
