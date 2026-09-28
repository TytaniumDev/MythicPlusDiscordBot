#!/usr/bin/env node
// Read-only Firestore inspector for the firebase-debug skill.
// Usage:
//   node .claude/skills/firebase-debug/query.mjs get <collection> <docId>
//   node .claude/skills/firebase-debug/query.mjs list <collection> [--status <s>] [--hours <n>] [--limit <n>]
// Requires FIREBASE_CREDENTIALS_JSON (service-account JSON) in the environment.
import admin from 'firebase-admin';

const [cmd, collection, ...rest] = process.argv.slice(2);
if (!cmd || !collection || !['get', 'list'].includes(cmd)) {
  console.error('Usage: query.mjs get <collection> <docId> | list <collection> [--status s] [--hours n] [--limit n]');
  process.exit(1);
}
if (!process.env.FIREBASE_CREDENTIALS_JSON) {
  console.error('FIREBASE_CREDENTIALS_JSON is not set.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_CREDENTIALS_JSON)),
});
const db = admin.firestore();

const flag = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};

// Convert Firestore Timestamps to ISO strings for readable output.
const plain = (value) => {
  if (value instanceof admin.firestore.Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
};

if (cmd === 'get') {
  const snap = await db.collection(collection).doc(rest[0]).get();
  console.log(JSON.stringify(snap.exists ? { id: snap.id, ...plain(snap.data()) } : null, null, 2));
} else {
  let query = db.collection(collection);
  const status = flag('status');
  const hours = flag('hours');
  if (status) query = query.where('status', '==', status);
  if (hours) query = query.where('lastActive', '>=', new Date(Date.now() - Number(hours) * 3600_000));
  const snap = await query.limit(Number(flag('limit') ?? 50)).get();
  console.log(JSON.stringify(snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) })), null, 2));
}
