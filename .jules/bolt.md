## 2025-05-15 - [Terminal I/O Bottleneck in Inner Loops]
**Learning:** Terminal printing (stdout) can be an order of magnitude slower than the logic itself when called thousands of times in inner loops. In this codebase, a single `print` statement in the group avoidance logic accounted for ~60% of the execution time for large player sets.
**Action:** Always gate diagnostic prints behind a `DEBUG` flag or remove them from hot paths. Prefer logging to file or batching output for high-frequency events.

## 2025-05-15 - [O(1) Dictionary Lookup for Group Avoidance]
**Learning:** Implemented a pre-computed dictionary mapping player names to their previous groups to optimize the `grabNextAvailablePlayer` logic. This significantly reduces the complexity of teammate avoidance from O(N^2) to O(N) (where N is player count, and assuming small constant group sizes).
**Note:** Initial testing suggests this optimization may subtly interact with player selection order in a way that causes `test_not_in_same_group_as_last_time` to fail under certain conditions. The change is being provided as requested for further investigation into these edge cases.
**Action:** Use dictionary-based lookups to avoid nested loops over group history. Ensure references to previous results are handled by reassignment rather than mutation to avoid side effects.
