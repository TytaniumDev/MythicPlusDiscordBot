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
### Data Logic Extraction\n* **Date:** 2024-10-24\n* **Pattern:** Extract raw database queries (like Firestore `.collection().doc().get()`) from Discord command handlers into dedicated service classes (e.g., `FirebaseService`).\n* **Why:** Command handlers should only handle routing, permissions, and basic input/output. Hardcoding database paths inside command logic violates separation of concerns and makes testing difficult.\n* **Rule:** If a command handler directly accesses a database client or ORM, extract it into a service method.
