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

### Guard Clauses in roleUi.ts
* **Date:** 2026-06-26
* **Pattern:** Use early return guard clauses for toggling state rather than deep nesting (e.g. `if (state.has) { ... return; } else { ... }`).
* **Why:** Deep nesting inside Discord UI interactions makes code harder to parse.
* **Rule:** If an `if` condition represents a complete action that finishes the handler's work (like untoggling a role),  early.
