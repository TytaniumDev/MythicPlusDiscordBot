import type { Page } from '@playwright/test';

/**
 * Hold every Firestore request open. Tests render from `?data=` fixtures with
 * no Firebase config, so these requests can never succeed; letting them fail
 * flips the SDK into offline mode and renders fallbacks (e.g. the static affix
 * bar) depending on how quickly the machine's network rejects them.
 */
export async function stallFirestore(page: Page) {
  await page.route('https://firestore.googleapis.com/**', () => {});
}
