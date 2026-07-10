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

### Command Handler Refactoring
* **Date:** 2026-07-10
* **Pattern:** Extract identical inline command handler logic into a shared helper method (e.g., `submitQuickIssue`).
* **Why:** Monolithic switch statements for Discord interaction routing grow unmanageable when complex logic (like truncating strings, interacting with GitHub APIs, and sending DMs) is duplicated inline.
* **Rule:** If two or more commands share more than 10 lines of identical logic inside the main switch statement, extract the logic into a typed standalone function.
