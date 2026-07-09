## 2025-05-15 - [Terminal I/O Bottleneck in Inner Loops]
**Learning:** Terminal printing (stdout) can be an order of magnitude slower than the logic itself when called thousands of times in inner loops. In this codebase, a single `print` statement in the group avoidance logic accounted for ~60% of the execution time for large player sets.
**Action:** Always gate diagnostic prints behind a `DEBUG` flag or remove them from hot paths. Prefer logging to file or batching output for high-frequency events.

## 2025-05-15 - [O(1) Dictionary Lookup for Group Avoidance]
**Learning:** Implemented a pre-computed dictionary mapping player names to their previous groups to optimize the `grabNextAvailablePlayer` logic. This significantly reduces the complexity of teammate avoidance from O(N^2) to O(N) (where N is player count, and assuming small constant group sizes).
**Update:** By stabilizing state management (replacing `lastGroups.clear()` with reassignment) and carefully preserving the search order in the `grabNextAvailablePlayer` function, the O(1) dictionary lookup became fully compatible with existing functional tests while maintaining high performance.
**Action:** Use dictionary-based lookups to avoid nested loops over group history. Ensure references to previous results are handled by reassignment rather than mutation to avoid side effects.

## 2025-05-15 - [JSON File I/O Caching]
**Learning:** Repeatedly reading `player_preferences.json` for every player in a list creates an N+1 performance bottleneck, taking ~0.12s for 1000 reads.
**Action:** Implemented a write-through in-memory cache for preferences. Reads are served from memory (taking ~0.0005s for 1000 reads), while writes immediately update both the cache and the disk to ensure data safety against power loss.

## 2026-02-03 - [Blocking I/O in Async UI Callbacks]
**Learning:** Synchronous file I/O in Discord UI callbacks (specifically JSON read/write in `RoleView.save`) blocked the asyncio event loop for ~200ms per call. In high-concurrency scenarios, this causes the bot to become unresponsive.
**Action:** Offloaded file operations to a separate thread using `asyncio.to_thread`. Guarded `storage.py` writes with `threading.Lock` to prevent race conditions during concurrent access from multiple threads.

## 2026-02-03 - [Infinite Loops in Constrained Selection]
**Learning:** When implementing selection logic with constraints (e.g., avoiding previous teammates), failing to provide a fallback mechanism when all candidates are filtered out can lead to infinite loops. Specifically, `grabNextAvailablePlayer` returned `None` when all available players were filtered, causing the calling loop `while len(usedPlayers) < len(players)` to spin indefinitely because no progress was being made.
**Action:** Always implement a fallback strategy (e.g., relax constraints) when a strict filter returns no results in a resource consumption loop. Ensure `while` loops have a guaranteed exit condition or progress step even in failure modes.

## 2026-02-03 - [Deadlock in Re-entrant Locking]
**Learning:** `threading.Lock` is not re-entrant in Python. Using it in a function (`load_preferences`) that is called by another function (`set_player_preference`) which *also* acquires the same lock results in a deadlock.
**Action:** Use `threading.RLock` for locks that may be acquired recursively by the same thread.

## 2026-02-04 - [Targeted List Removal in Hot Paths]
**Learning:** Blindly iterating over a collection of lists to remove an item (O(N*M)) is inefficient when object properties can strictly identify which lists the item belongs to (O(N*k) where k << M). In `parallel_group_creator.py`, using player role flags reduced group creation time by ~40% for large inputs.
**Action:** When managing items across multiple classification lists, use item properties to target specific lists for removal/updates rather than scanning all lists.
## 2026-03-12 - [O(1) Array Allocations in Group Creation loops]
**Learning:** Found an O(N) intermediate array allocation in an inner loop for selecting players during group creation. By merging the filtering step into the selection step, we eliminate intermediate array allocations and avoid iterating through the entire list to find a single valid player.
**Action:** Always avoid creating intermediate arrays (e.g. `filteredList`) in hot paths where a short-circuit return is possible, especially when iterating over a small subset of elements.
## 2024-05-18 - Replacing O(N) array search inside nested loops with O(1) object properties
**Learning:** During test optimizations, filtering candidate lists (like available tanks or healers) inside a heavy iterative loop using O(N) array checks (e.g. `Array.some()`) creates a severe performance bottleneck.
**Action:** When filtering or excluding object references inside hot paths, prefer using inherent O(1) boolean properties on the object itself rather than building and parsing sub-arrays to check role inclusion.

## 2026-07-09 - [Early Loop Termination for Score Search]
**Learning:** In optimization passes or matching passes that score candidates (like `grabNextAvailablePlayer` in group creation), the algorithm can find a "perfect" or optimal zero-penalty match (`score === 0`). Failing to break out of the loop at this point leads to unnecessary iterations over the entire remaining candidate pool, wasting CPU cycles on a search that cannot mathematically yield a better result.
**Action:** When scanning collections for a minimum/maximum score, always add an early loop termination condition (`break`) if an absolute optimal limit (like `bestScore === 0`) is reached.
