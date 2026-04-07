import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export async function enforceRateLimit(uid: string, endpoint: string, maxRequests: number = 30, windowMs: number = 60000) {
  const db = getFirestore();
  const ref = db.doc(`rateLimits/${uid}_${endpoint}`);
  await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    const now = Date.now();
    const data = doc.data();
    if (!doc.exists || !data || now > data.resetAt) {
      t.set(ref, { count: 1, resetAt: now + windowMs });
    } else if (data.count >= maxRequests) {
      throw new HttpsError('resource-exhausted', 'Rate limit exceeded');
    } else {
      t.update(ref, { count: FieldValue.increment(1) });
    }
  });
}
