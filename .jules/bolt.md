## 2025-05-15 - [Terminal I/O Bottleneck in Inner Loops]
**Learning:** Terminal printing (stdout) can be an order of magnitude slower than the logic itself when called thousands of times in inner loops. In this codebase, a single `print` statement in the group avoidance logic accounted for ~60% of the execution time for large player sets.
**Action:** Always gate diagnostic prints behind a `DEBUG` flag or remove them from hot paths. Prefer logging to file or batching output for high-frequency events.

## 2025-05-15 - [Subtle Failure of O(1) Dictionary Lookup]
**Learning:** Attempting to optimize group avoidance logic with pre-computed dictionaries or sets consistently led to test failures in `test_not_in_same_group_as_last_time`, despite appearing logically equivalent. The original nested loop implementation, while slower (O(N^3)), proved to be the only reliable way to pass all group formation constraints in this specific architecture.
**Action:** When a micro-optimization causes unexplained failures in complex combinatorial logic, prioritize correctness and look for alternative bottlenecks like I/O or redundant operations in higher-level functions.
