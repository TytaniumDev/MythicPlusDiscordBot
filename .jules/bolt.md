## 2025-05-15 - [Terminal I/O Bottleneck in Inner Loops]
**Learning:** Terminal printing (stdout) can be an order of magnitude slower than the logic itself when called thousands of times in inner loops. In this codebase, a single `print` statement in the group avoidance logic accounted for ~60% of the execution time for large player sets.
**Action:** Always gate diagnostic prints behind a `DEBUG` flag or remove them from hot paths. Prefer logging to file or batching output for high-frequency events.

## 2025-05-15 - [O(1) Dictionary Lookup for Group Avoidance]
**Learning:** Implemented a pre-computed dictionary mapping player names to their previous groups to optimize the `grabNextAvailablePlayer` logic. This significantly reduces the complexity of teammate avoidance from O(N^2) to O(N) (where N is player count, and assuming small constant group sizes).
**Update:** By stabilizing state management (replacing `lastGroups.clear()` with reassignment) and carefully preserving the search order in the `grabNextAvailablePlayer` function, the O(1) dictionary lookup became fully compatible with existing functional tests while maintaining high performance.
**Action:** Use dictionary-based lookups to avoid nested loops over group history. Ensure references to previous results are handled by reassignment rather than mutation to avoid side effects.

## 2026-02-03 - [Blocking I/O in Async UI Callbacks]
**Learning:** Synchronous file I/O in Discord UI callbacks (specifically JSON read/write in `RoleView.save`) blocked the asyncio event loop for ~200ms per call. In high-concurrency scenarios, this causes the bot to become unresponsive.
**Action:** Offloaded file operations to a separate thread using `asyncio.to_thread`. Guarded `storage.py` writes with `threading.Lock` to prevent race conditions during concurrent access from multiple threads.
