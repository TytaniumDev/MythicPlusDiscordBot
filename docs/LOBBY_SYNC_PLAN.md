# Plan: Lobby Sync Without the Pi

**Status:** Deferred until the next Mythic+ season. Written 2026-09-29. Nothing in this plan is implemented yet.

**Goal:** Stop depending on the Raspberry Pi to keep lobby `members` in sync with voice. The activity reports who is there, and a Cloud Function checks everyone against Discord before writing `members`. If the Pi goes down, the activity keeps working.

**Before starting:** Work through [Revisit checklist](#revisit-checklist). Discord's APIs and Firebase pricing change, and some facts below were not tested.

---

## Decisions already made

| Question | Decision |
|---|---|
| Must the lobby update when nobody has the activity open? | **No.** Most players open the activity, so we assume at least one person has it open. Browser-link users depend on someone in the Discord activity. |
| Who appears in the lobby? | **Activity participants plus the full voice list.** Anyone with the activity open always shows up. People in voice who haven't opened it show up while a signed-in player has the activity open. |
| What happens to `/wheel`? | **It stays on the Pi.** Discord delivers slash commands over the gateway *or* to an HTTP endpoint, never both, so every slash command stays on the Pi. |
| Cost | **Must stay within the free tier.** See [Cost](#cost-free-tier). |

## What changes and what doesn't

**Moves off the Pi:**
- Writing lobby `members` on voice joins and leaves.
- Tracking lobby docs.
- Deleting a lobby when its last human leaves.

**Stays on the Pi:**
- The gateway connection.
- All slash commands (`/wheel`, `/wheelson`, `/bug`, `/featurerequest`, `/test`) and their modals.
- The voice channel list for the picker (`refreshRequest`, which needs live user counts).
- The bad-group-report listener. It can move later; see [Later](#later-not-part-of-this-plan).

**Unchanged in `firestore.rules`:** clients still cannot write `members`. Only the Admin SDK can, and the new function uses it.

## Design

### The APIs this relies on

| API | Where | Needs | Used for |
|---|---|---|---|
| `discordSdk.instanceId` | Activity | nothing | Identifies the activity instance to the function |
| `ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE` event | Activity | no scope | Triggers a sync when someone opens or closes the activity |
| `getChannel({ channel_id })` → `voice_states` | Activity | `guilds` scope + `authenticate` | The full voice list, including people who haven't opened the activity |
| `GET /applications/{app}/activity-instances/{instanceId}` | Function | bot token | Confirms which channel the instance is in; returns participant IDs |
| `GET /guilds/{guild}/voice-states/{user}` | Function | bot token | Confirms one user is in the channel; one call per user (no list endpoint exists) |

### Sign-in changes

Today `discordSignIn` only proves identity. It requests `identify` (`activity/src/discordSdk.ts`), and the access token never leaves the function (`packages/functions/src/discordSignIn.ts`). The activity never calls the SDK's `authenticate`, and every scoped SDK call needs it.

1. Request `['identify', 'guilds']` in `authorizeWithDiscord`. Players who already signed in with `identify` will see Discord's consent screen once more.
2. `discordSignIn` returns `{ customToken, accessToken }`. The activity calls `discordSdk.commands.authenticate({ access_token })`. This reverses the "token never leaves the function" design. It is the player's own token in their own client, and Discord's activity starter template does the same. Update the comments and `ARCHITECTURE.md`.
3. Firebase Auth restores the sign-in on later launches, but the Discord token isn't stored. On launch, a player already signed in with Discord repeats `authorize` silently (`prompt: 'none'`), then `discordSignIn`, then `authenticate`. Rate limit: `discordSignIn` allows 10 calls a minute, which is plenty.

### New callable: `syncLobbyMembers`

`packages/functions/src/syncLobbyMembers.ts`, `onCall`, using secrets `BOT_TOKEN` and `DISCORD_APPLICATION_ID` (both already exist, so no new secret is needed).

**Input:** `{ channelId: string, instanceId: string, voiceUserIds?: string[] }`. Requires `request.auth` (anonymous is fine). Validate that IDs are numeric strings and cap `voiceUserIds` at 50.

**Steps:**
1. Rate limit with the existing `enforceRateLimit` (per uid, for example 20 a minute). Also consider a per-channel limit.
2. Fetch the activity instance. A 404, or a `location.channel_id` that isn't `channelId`, gets `permission-denied`. `location.guild_id` gives the guild.
3. Candidates = the instance's `users` ∪ `voiceUserIds` ∪ the lobby's current `members`. Re-checking current members is how departures are caught, including when the caller only knows about joins.
4. For each candidate, call `GET /guilds/{guild}/voice-states/{user}` (limit how many run at once). Keep users whose `channel_id` is `channelId` and who aren't bots. Build `{ discordId, name }` the same way the bot's `toLobbyMember` does: display name, dots stripped. Move that helper into `@mythicplus/shared` so the bot and the function share it.
5. Write the lobby with the Admin SDK in a transaction, **only if something changed**: `members`, `lastActive`, `expireAt` (24h ahead, as the bot writes it now), and `instanceId`.
6. **New instance, new round:** the Pi no longer deletes a lobby when voice empties, so a lobby can outlive its session. If the stored `instanceId` differs from the incoming one, also reset `status: 'lobby'`, `groups: []`, `revealedGroups: 0`, `sittingOut: []`, and `claimedPlayers: []`. Without this, relaunching within 24 hours would show the previous night's results. The 24h TTL still deletes lobbies nobody reopens.
7. If the lobby doc doesn't exist yet, create it with the same fields `createGuildEntry` writes (the activity normally creates it first).

A caller can't fake the roster. Everyone written has been checked against Discord, and everyone already in the lobby is re-checked. The worst a dishonest client can do is leave out a new joiner, and the next sync from anyone fixes that.

### Activity: `useLobbySync` hook

Runs only when embedded (`setupDiscordSdk` returned a context), in lobby status.

- **Triggers:** launch, `ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE`, and a 60-second poll.
- **Voice list:** if this client ran `authenticate` with `guilds`, read `getChannel(...).voice_states` on each trigger. It's a local SDK call, so polling costs no Firebase usage.
- **Call only when needed:** compute the expected roster (participants, plus the voice list if available). Call `syncLobbyMembers` only when it differs from the lobby's `members`. A client without the voice list can only see participant changes, so it calls when a participant is missing from or extra in `members`.
- **One caller per change:** wait `rank × 1.5s` before calling, where `rank` is this user's position among participant IDs sorted ascending, and signed-in clients go first. Then re-check `members` and skip the call if another client already synced. Also send one 5-minute heartbeat from rank 0, so voice-only departures still get cleaned up when nobody is signed in.
- Report failures through `reportError(err, { tag: 'useLobbySync' })`.

### Pi changes

- Remove the voice-driven sync: the `VoiceStateUpdate` handler in `packages/bot/src/main.ts`, `SessionService.listen` / `onVoiceStateUpdate` / `syncMembers` / `cleanupChannel`, and `listenForChannels` in `FirebaseService` (if nothing else uses it).
- `/wheelson` still creates the guild and channel docs through `getOrCreateSession`, but no longer calls `trackChannel`. The first activity to open fills in `members`.
- Keep the `GuildVoiceStates` intent: `/wheel` and the picker's user counts need it.
- The Pi stops writing `expireAt`, and the function writes it instead.

## Cost (free tier)

The project is already on Blaze: Cloud Functions require it, and five are deployed. Blaze includes the Spark no-cost quotas. The estimate below assumes a busy month: 20 nights × 4 hours × one sync a minute.

| Item | Free each month | This feature, busy month |
|---|---|---|
| Function invocations | 2M | ~5,000 |
| Function compute | 400K GB-s / 200K CPU-s | ~600 GB-s |
| Firestore reads | 50K **per day** | ~10K **per month** |
| Firestore writes | 20K **per day** | fewer than the Pi's today (writes happen only on change) |
| Outbound network | 5 GB | a few MB |

**Guardrails that keep this at $0:**
- Don't set `minInstances` (it defaults to 0). This callable has no 3-second deadline, so cold starts are fine.
- Don't add secrets. Secret Manager's free tier is 6 active secret versions, and there are already 6 (`BOT_TOKEN`, `DISCORD_APPLICATION_ID`, `DISCORD_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`, `BNET_CLIENT_ID`, `BNET_CLIENT_SECRET`). Check that old versions are disabled or destroyed.
- One caller per change (see above), not one call per client.

## Test first (before writing the PR)

Do this with a dev build in a real Discord client, on desktop and mobile:

1. Does `authorize` with `guilds` work for this app? Does `getChannel` on the activity's own voice channel return `voice_states` that include people who haven't opened the activity?
2. Does `GET /activity-instances/{id}` return the expected `location` and `users` with the bot token?
3. Does `GET /guilds/{guild}/voice-states/{user}` include `member`, so it provides a display name? What does it return for a user who isn't in voice (expect a 404)? Does the bot need Connect permission on the channel?
4. Can an activity participant be out of the voice channel (for example on mobile)? This decides whether step 4 of the function must check participants too. The plan assumes yes and checks everyone.
5. Optional: `rpc.voice.read` and `VOICE_STATE_UPDATE`. If the event fires on joins and leaves, it could replace the 60-second poll. Discord's OAuth2 page calls this scope partner-only (for local RPC), yet Discord's activity starter requests it. It isn't needed for this plan.

## Implementation checklist (one PR)

- [ ] `@mythicplus/shared`: move `toLobbyMember` (and its tests) out of `packages/bot/src/core/utils.ts`.
- [ ] `packages/functions/src/syncLobbyMembers.ts`, exported from `index.ts`, with Vitest tests that mock `fetch` and Firestore: verified join, departure, spoofed ID rejected, wrong channel rejected, instance change resets the round, no write when nothing changed.
- [ ] `packages/functions/src/discordSignIn.ts`: return `accessToken`, and update its tests.
- [ ] `activity/src/discordSdk.ts`: add the `guilds` scope, plus `authenticate`, `getVoiceChannelUserIds`, and a participants-update subscription.
- [ ] `activity/src/services/discordAuth.ts`: authenticate after sign-in, and silently re-authorize on launch for Discord-signed-in users.
- [ ] `activity/src/hooks/useLobbySync.ts` + unit tests (diffing, ranking/delay, skip when already synced).
- [ ] Confirm the `/functions` URL mapping still covers the new callable. It already exists in `discordSdk.ts` and the Developer Portal.
- [ ] Bot: remove voice sync and lobby tracking, and update `packages/bot/tests/`.
- [ ] Smoke test (`activity/smoke/`) still seeds `members` with the Admin SDK. The activity isn't embedded there, so the hook doesn't run. Make sure it still passes.
- [ ] Docs: `ARCHITECTURE.md` (data flow, sequence diagram, `members` owner, sign-in token note), `AGENTS.md` (Data Flow steps 3–4, "Only the bot writes `members`"), `FIREBASE_SETUP.md`, `PRIVACY.md` (new `guilds` scope).
- [ ] Verify: `./scripts/verify-ts.sh`, `./scripts/emulator-test.sh`, `./scripts/smoke-test.sh`. Update snapshots via the Update Snapshots workflow if any UI changes.

## Later (not part of this plan)

**Small wins, independent of this plan:**
- Move bad-group reports from the Pi's Firestore listener to a callable function. The reporter ID would be verified when the player signed in with Discord.
- Register slash commands during deploy instead of on every bot startup.
- Drop the unused `GuildMessages` intent. The privileged `GuildMembers` intent is probably unused too; check that voice member names still resolve before removing it.

**Retiring the Pi completely:** this needs `/wheel` to change or be retired. After that, move every slash command to an HTTP interactions endpoint on a Cloud Function. `/wheelson` could answer with `LAUNCH_ACTIVITY` (callback type 12). Watch Discord's 3-second deadline: preventing cold starts needs `minInstances: 1`, which is not free.

**Other APIs from sign-in:**
- `setActivity` (`rpc.activities.write`): Rich Presence, e.g. "In lobby · 7 players".
- Speaking indicators (`rpc.voice.read`).
- `openInviteDialog` and `shareLink` (no scope needed).
- Sharing a results image with `openShareMomentDialog`. The upload needs the player's token.

## Revisit checklist

- [ ] Re-read the Discord docs linked below. Did the endpoints, scopes, or SDK commands change? Is there a newer `@discord/embedded-app-sdk` than 2.5.0?
- [ ] Re-check the Firebase and Secret Manager free quotas, and the current secret count.
- [ ] Are the decisions above still right? (`/wheel` usage, how many players open the activity.)
- [ ] Run [Test first](#test-first-before-writing-the-pr).

## Sources

- [Embedded App SDK reference](https://docs.discord.com/developers/developer-tools/embedded-app-sdk): commands, events, and required scopes
- [Activities: multiplayer experience](https://docs.discord.com/developers/activities/development-guides/multiplayer-experience): `instanceId`, participants, and the activity-instance endpoint
- [Application resource](https://docs.discord.com/developers/resources/application): Get Application Activity Instance
- [Voice resource](https://docs.discord.com/developers/resources/voice): per-user voice state endpoints; there is no list endpoint
- [OAuth2 scopes](https://docs.discord.com/developers/topics/oauth2)
- [Interactions: receiving and responding](https://docs.discord.com/developers/interactions/receiving-and-responding): gateway and HTTP delivery can't be combined, plus the 3-second deadline
- [Webhook events](https://docs.discord.com/developers/events/webhook-events): no voice events
- [Discord activity starter](https://github.com/discord/embedded-app-sdk-examples/blob/main/discord-activity-starter/packages/client/src/main.ts): scopes and token handling
- [Firebase pricing](https://firebase.google.com/pricing)
