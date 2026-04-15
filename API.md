# Cloud Functions API Reference

This document outlines the Firebase Cloud Functions deployed in the `packages/functions` directory. These functions provide the backend infrastructure for the Discord bot and Activity frontend, handling tasks that are better suited for a serverless environment than a long-running Discord bot process.

## Architecture & Invocation Types

The project utilizes Firebase Functions (v2) exposing different invocation methods based on the specific use case:

1.  **Scheduled Functions (`onSchedule`)**: Run automatically at predefined intervals.
2.  **Callable Functions (`onCall`)**: HTTP endpoints explicitly called by clients (like the Activity frontend). These automatically verify Firebase Authentication tokens.
3.  **Webhook Functions (`onRequest`)**: Standard HTTP endpoints used to receive external events (e.g., from GitHub).

---

## Deployed Functions

### 1. `lookupCharacter`

**Purpose:** Fetches character data (class, spec, role, utilities, portrait) from the Battle.net API.
**Type:** Callable (`onCall`)
**Location:** `packages/functions/src/lookupCharacter.ts`

**Details:**
- **Input:** `{ name: string, realm: string, region: string }`
- **Output:** `CharacterResult` object containing formatted character details.
- **Features:**
  - **Caching:** Caches results in Firestore (`characters/{region}/{realm}/{name}`) for 24 hours to minimize external API calls and latency.
  - **Rate Limiting:** Enforces per-user rate limits (30 requests per minute) to prevent abuse of the Battle.net API.
  - **Security:** Requires Firebase Authentication. *Note: App Check enforcement is deliberately disabled here to allow the frontend to load portraits without initializing App Check.*

### 2. `fetchWeeklyAffixes`

**Purpose:** Automatically synchronizes current Mythic+ affixes from Raider.IO into the shared Firestore configuration.
**Type:** Scheduled (`onSchedule`)
**Location:** `packages/functions/src/fetchWeeklyAffixes.ts`

**Details:**
- **Trigger:** Runs every Tuesday at 17:00 UTC (after the NA weekly reset).
- **Behavior:**
  - Fetches affix data from the Raider.IO API.
  - Maps the raw IDs to the internal `AffixDisplay` format.
  - Injects statically required affixes (like Lindormi's Guidance) if they are missing from the API response.
  - Sorts the affixes by their keystone level appearance.
  - Writes the final document to the Firestore `config/affixes` path.

### 3. `refreshAffixes`

**Purpose:** Provides an on-demand mechanism to trigger the affix synchronization logic.
**Type:** Callable (`onCall`)
**Location:** `packages/functions/src/fetchWeeklyAffixes.ts`

**Details:**
- **Behavior:** Reuses the core logic of `fetchWeeklyAffixes` (`fetchAndWriteAffixes`) to manually update the Firestore affix document.
- **Use Cases:** Triggering an immediate update after deploying new code or recovering from a failed scheduled run.
- **Security:** Requires Authentication and enforces rate limiting (5 calls per minute). Includes App Check enforcement.

### 4. `onGithubIssueWebhook`

**Purpose:** Receives webhook events from GitHub to track issue status updates and notify Discord users.
**Type:** Webhook (`onRequest`)
**Location:** `packages/functions/src/githubWebhook.ts`

**Details:**
- **Behavior:** Listens for GitHub issue events (specifically when issues are closed or assigned).
- **Processing:** Translates the external GitHub event into a notification payload and writes it to the internal `notifications` Firestore collection.
- **Integration:** The Discord bot listens to this `notifications` collection and handles the final step of sending direct messages to the subscribed users.
