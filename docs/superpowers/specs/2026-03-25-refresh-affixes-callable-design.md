# Design: On-demand affix refresh callable

## Problem

The `fetchWeeklyAffixes` Cloud Function runs on a weekly schedule (Tuesdays 17:00 UTC). When the function is first deployed — or if it fails — the Firestore `config/affixes` document doesn't exist, and the frontend falls back to `STATIC_AFFIXES` which only shows 2 of 4 affixes.

There is no way to manually trigger a refresh without waiting for the next Tuesday.

## Solution

Add a `refreshAffixes` Firebase `onCall` callable that reuses the existing `buildAffixDocument()` logic to fetch current affixes from the Battle.net API and write them to Firestore on demand.

## Implementation

### Changes

1. **`packages/functions/src/fetchWeeklyAffixes.ts`** — Extract the shared fetch-and-write logic into a `fetchAndWriteAffixes()` helper. Add `refreshAffixes` as an `onCall` export (with auth guard) that calls the helper. Refactor `fetchWeeklyAffixes` to also call the helper.

2. **`packages/functions/src/index.ts`** — Add `export { refreshAffixes }` alongside the existing exports.

No new tests needed — `fetchAndWriteAffixes` is a thin orchestrator over `buildAffixDocument` (already tested) + Battle.net client + Firestore. Testing it would require mocking both external services for minimal value.

### No changes needed

- No frontend changes
- No deploy pipeline changes
- No new dependencies

## Invocation

After deploy:
```bash
npx firebase-tools@14 functions:call refreshAffixes
```

Or via Firebase console > Functions > refreshAffixes > Test.
