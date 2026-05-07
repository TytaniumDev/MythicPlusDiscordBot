# Avoid list

Things tried and failed. Entries dated within the last 7 days are active. Older entries are pruned by the historian.

Format: `- <YYYY-MM-DD>: <what was tried> failed because <reason>. PR: #<N>.`

- 2026-05-07: T12 (parseSeasonPairs validator) on PR #533 failed because the worktree's base was stale by 30+ minutes and conflicted with sibling merges that touched `firestoreService.ts` and `firebaseService.ts`; `gh pr update-branch` reported "Cannot update PR branch due to conflicts" rather than rebasing. Close+redo on a fresh branch off the latest main was the only fix. Redone as PR #540.
- 2026-05-07: T15 (WoWPlayer construction in utils) abandoned because `WoWPlayer.create` already validates implicitly via intersection with the 10 known Discord-role-name string constants — proposal premise was wrong. Future critics should NOT re-flag the construction question; it's settled. (See style-decisions.md 2026-05-07 entry.)
