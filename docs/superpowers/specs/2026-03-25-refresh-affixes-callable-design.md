# Design: On-demand affix refresh callable

## Problem

The `fetchWeeklyAffixes` Cloud Function runs on a weekly schedule (Tuesdays 17:00 UTC). When the function is first deployed — or if it fails — the Firestore `config/affixes` document doesn't exist, and the frontend falls back to `STATIC_AFFIXES` which only shows 2 of 4 affixes.

There is no way to manually trigger a refresh without waiting for the next Tuesday.

## Solution

Add a `refreshAffixes` Firebase `onCall` callable that reuses the existing `buildAffixDocument()` logic to fetch current affixes from the Battle.net API and write them to Firestore on demand.

## Implementation

### Changes

1. **`packages/functions/src/fetchWeeklyAffixes.ts`** — Extract the shared fetch-and-write logic into a helper function. Add `refreshAffixes` as an `onCall` export that calls the helper. Refactor `fetchWeeklyAffixes` to also call the helper.

2. **`packages/functions/src/index.ts`** — Add `export { refreshAffixes }` alongside the existing exports.

3. **`packages/functions/tests/fetchWeeklyAffixes.test.ts`** — Add a test verifying the shared helper logic (core logic is already tested via `buildAffixDocument` tests).

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
