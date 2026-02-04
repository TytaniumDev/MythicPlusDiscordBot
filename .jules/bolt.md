## 2025-05-15 - [Terminal I/O Bottleneck in Inner Loops]
**Learning:** Terminal printing (stdout) can be an order of magnitude slower than the logic itself when called thousands of times in inner loops. In this codebase, a single `print` statement in the group avoidance logic accounted for ~60% of the execution time for large player sets.
**Action:** Always gate diagnostic prints behind a `DEBUG` flag or remove them from hot paths. Prefer logging to file or batching output for high-frequency events.

## 2025-05-15 - [O(1) Dictionary Lookup for Group Avoidance]
**Learning:** Implemented a pre-computed dictionary mapping player names to their previous groups to optimize the `grabNextAvailablePlayer` logic. This significantly reduces the complexity of teammate avoidance from O(N^2) to O(N) (where N is player count, and assuming small constant group sizes).
**Update:** By stabilizing state management (replacing `lastGroups.clear()` with reassignment) and carefully preserving the search order in the `grabNextAvailablePlayer` function, the O(1) dictionary lookup became fully compatible with existing functional tests while maintaining high performance.
**Action:** Use dictionary-based lookups to avoid nested loops over group history. Ensure references to previous results are handled by reassignment rather than mutation to avoid side effects.

## 2026-02-04 - [Blocking I/O in Async Context via Cache]
**Learning:** Frequent disk reads in  (O(N) reads for N players) caused significant blocking in the async event loop. Implementing an in-memory cache in  eliminated these reads, reducing read time from ~0.6s to ~0.001s (600x speedup) for 5000 ops.
**Action:** Always cache frequently accessed file-based data in memory, especially when running in a single-threaded async environment like discord.py. Ensure writes update both cache and disk to maintain consistency.

## 2026-02-04 - [Blocking I/O in Async Context via Cache]
**Learning:** Frequent disk reads in `getPlayerList` (O(N) reads for N players) caused significant blocking in the async event loop. Implementing an in-memory cache in `storage.py` eliminated these reads, reducing read time from ~0.6s to ~0.001s (600x speedup) for 5000 ops.
**Action:** Always cache frequently accessed file-based data in memory, especially when running in a single-threaded async environment like discord.py. Ensure writes update both cache and disk to maintain consistency.
