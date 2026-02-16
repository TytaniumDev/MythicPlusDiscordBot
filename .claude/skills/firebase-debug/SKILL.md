---
name: firebase-debug
description: Query Firestore sessions and inspect WoW Mythic+ group data
user-invocable: true
disable-model-invocation: false
---

# Firebase Debug Skill

Query and debug Firestore session data for the Mythic+ Discord Bot.

## Session Schema

Sessions are stored in Firestore with:
- **session_id**: Unique identifier
- **status**: `lobby | request_spin | spinning | completed`
- **players**: Array of WoWPlayer objects with roles (tankMain, healerMain, dpsMain, etc.)
- **groups**: Array of formed groups (populated after spin)
- **guild_id**: Discord guild ID
- **channel_id**: Discord voice channel ID
- **created_at**: Timestamp
- **updated_at**: Timestamp

## Common Queries

When invoked, use the Firebase MCP to perform queries like:

### List Active Sessions
```
Show all sessions with status "lobby" or "spinning"
```

### Inspect Session Details
```
Get session {session_id} and show:
- Status
- Number of players (with role breakdown)
- Number of groups formed
- Created/updated timestamps
```

### Debug Player Data
```
For session {session_id}, show player array with:
- Player names
- Main roles (tank/healer/dps)
- Offspecs
- Utilities (brez, lust)
```

### Find Recent Sessions
```
List sessions modified in the last {N} hours
Sort by updated_at descending
```

### Check Empty Groups
```
Find sessions with status "completed" but empty groups array
(Indicates a potential spin failure)
```

## Output Format

Format results as readable tables:
```
Session: abc123
Status: lobby
Players: 15 (2 tanks, 3 healers, 10 dps)
Groups: 0
Created: 2026-02-16 14:30 UTC
Updated: 2026-02-16 14:45 UTC
```

For player listings:
```
Players (15):
1. PlayerName (Tank Main, Offhealer) - Brez
2. PlayerName (Healer Main, Offdps-Ranged) - Lust
...
```
