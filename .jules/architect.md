# Architect's Journal

## Refactoring Patterns

### UI Logic Extraction
* **Date:** 2024-10-24
* **Pattern:** Extract complex Discord Embed construction and animation loops into dedicated helper methods (e.g., `_announce_group`).
* **Why:** Services like `GroupService` should focus on business logic (group creation). Mixing in heavy UI logic (especially animated reveals) makes the main logic flow hard to read and test.
* **Rule:** If a loop body is primarily constructing UI elements and is > 20 lines, extract it.

### Embed Animation Extraction
* **Date:** 2024-10-24
* **Pattern:** Extract repeated `embedMessage.edit()` and typing indicator loops into a helper function (e.g. `_animate_update`).
* **Why:** The sequential reveal of complex Discord embeds clutters the main logic loop.
* **Rule:** When multiple sequential embeds updates are tied to typing animations, move the boilerplate into a standalone helper method.

### Module-Level Hot-Path Lookup Objects
* **Date:** 2024-10-24
* **Pattern:** Extract hot-path lookup objects (like `SORT_ORDER`) by initializing them at the module level rather than inside function bodies. Dynamically populate these module-level objects from shared constants during module load.
* **Why:** Re-initializing constant lookup objects inside function bodies that are called frequently or multiple times (like inside an HTTP handler) causes unnecessary overhead.
* **Rule:** When a function initializes a lookup map/object (e.g. `Record<number, number>`) from static constants, extract it to the module level.
