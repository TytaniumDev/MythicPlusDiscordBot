---
name: firebase-debug
description: Inspect production Firestore data (active lobbies, players, formed groups, guild history, preferences) to debug Mythic+ sessions. Read-only.
---

# Firebase Debug

Query Firestore with the bundled read-only script. It needs `npm ci` at the repo root and `FIREBASE_CREDENTIALS_JSON` in the environment (service-account JSON, stored in Doppler). If the variable isn't set, ask the user for access rather than guessing data.

```bash
node .claude/skills/firebase-debug/query.mjs get  <collection> <docId>
node .claude/skills/firebase-debug/query.mjs list <collection> [--status <s>] [--hours <n>] [--limit <n>]
```

Never write to or delete from Firestore from this skill. For data fixes, propose the change and ask first.

## Collections

The source of truth for shapes is `packages/bot/src/core/firebaseService.ts` and `packages/shared/src/types.ts`.

| Collection | Doc ID | Contents |
|---|---|---|
| `channels` | voice channel ID | Session: `status` (`lobby` \| `spinning` \| `completed`), `members` (`{ discordId, name }` in voice, bot-written), `groups`, `guildId`, `channelName`, `isDebug`, `createdAt`, `lastActive` |
| `guilds` | guild ID | `guildName`, `voiceChannels`, group history (`groupHistory`), `seasonPairs`, `lastActive` |
| `preferences` | Discord user ID | Each player's profile (roles, in-game name, character) — the only copy; lobbies join it with `members` |
| `badGroupReports` | auto | User-submitted bad-group reports |
| `issueTracking` | GitHub issue number | Issue-reporter notification state |
| `config` | `season` | Current season config |

Players are serialized `WoWPlayer` dicts (`mainRole`, `offspecs`, `utilities`); decode legacy shapes with `WoWPlayer.fromDict` semantics in mind. Group history uses the wire codec in `@mythicplus/shared` (`decodeGroupHistoryRounds`).

## Common checks

- Active lobbies: `list channels --status lobby`
- Recently active sessions: `list channels --hours 6`
- One session: `get channels <channelId>` → summarize status, player count with role breakdown, group count
- Spin failure: `completed` channel docs with an empty `groups` array
- Guild history: `get guilds <guildId>`

Summarize results as short tables (status, player count by role, group count, lastActive) rather than dumping raw JSON.
