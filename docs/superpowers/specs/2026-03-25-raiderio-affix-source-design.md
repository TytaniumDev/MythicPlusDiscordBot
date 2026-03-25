# Design: Switch affix data source from Battle.net to Raider.IO

## Problem

The `fetchWeeklyAffixes` Cloud Function fetches current M+ affixes from the Battle.net `/data/wow/mythic-keystone/period/{id}` endpoint. This endpoint no longer returns `affix_details` — it only returns `id`, `start_timestamp`, and `end_timestamp`. The function has never successfully populated the Firestore `config/affixes` document because of this.

## Solution

Switch the affix data source to the Raider.IO API, which returns current weekly affixes reliably and requires no authentication:

```
GET https://raider.io/api/v1/mythic-plus/affixes?region=us&locale=en
```

Response includes `affix_details[]` with `id` and `name` for each active affix. Lindormi's Guidance (always active at +2–5) is omitted by Raider.IO and will be injected statically from our metadata.

## Implementation

### `packages/functions/src/fetchWeeklyAffixes.ts`

**Rewrite `fetchAndWriteAffixes()`:**
1. Fetch affixes from Raider.IO (no auth, simple GET)
2. Map each returned affix ID through `resolveAffixDisplay()` — unknown IDs are skipped
3. Inject Lindormi's Guidance from `STATIC_AFFIXES` if not present
4. Sort by keystone level order (Lindormi's → Bargain → Fort → Tyran → Guile)
5. Write to Firestore `config/affixes`

**Remove:** Battle.net client import and all Battle.net API calls from this file. The `BattleNetClient` stays in the codebase for `lookupCharacter`.

**Rework `buildAffixDocument()`:** Accept an array of affix IDs and a region string instead of the Battle.net period response object. Keep it as a pure function for testing.

### `packages/functions/tests/fetchWeeklyAffixes.test.ts`

- Update existing `buildAffixDocument` tests for the new signature (array of IDs)
- Add test: Lindormi's Guidance is injected when not in input
- Add test: both Fortified and Tyrannical are handled (both active this season)
- Existing "skips unknown affix IDs" test adapts to new signature

### No changes needed

- No frontend changes
- No `battlenet.ts` changes (still used by `lookupCharacter`)
- No deploy workflow changes (Battle.net env vars still needed for `lookupCharacter`)
- No `affixMetadata.ts` changes

## Raider.IO API details

- Endpoint: `https://raider.io/api/v1/mythic-plus/affixes?region=us&locale=en`
- Auth: none required
- Rate limits: generous, undocumented but widely used
- Response shape:
  ```json
  {
    "region": "us",
    "title": "Xal'atath's Bargain: Pulsar, Fortified, ...",
    "affix_details": [
      { "id": 162, "name": "Xal'atath's Bargain: Pulsar", ... },
      { "id": 10, "name": "Fortified", ... }
    ]
  }
  ```
