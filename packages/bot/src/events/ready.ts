import { FirebaseService } from '../core/firebaseService.js';
import { getPreferenceService } from '../core/preferenceService.js';
import logger from '../core/logger.js';

/** Age in seconds beyond which abandoned docs are deleted on bot startup (24 hours). */
const FIREBASE_DOC_MAX_AGE_SECONDS = 24 * 60 * 60;

export async function onReady(): Promise<void> {
  // Initialize preference service and load cache from Firestore
  const prefSvc = getPreferenceService();
  await prefSvc.loadCache();

  // Clean up abandoned docs (e.g. frontend closed without completing).
  const firebase = FirebaseService.getInstance();
  if (firebase.isAvailable()) {
    await firebase.deleteOldDocs('guilds', FIREBASE_DOC_MAX_AGE_SECONDS);
    await firebase.deleteOldDocs('channels', FIREBASE_DOC_MAX_AGE_SECONDS);
  }

  logger.info('Bot ready — preference cache loaded and old docs cleaned up.');
}
