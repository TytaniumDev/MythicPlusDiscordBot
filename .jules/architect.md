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

### TypeScript-first standards for monolithic files
* **Date:** 2026-04-24
* **Pattern:** Extracting monolithic handler functions out of \`main.ts\`
* **Why:** Monolithic entry files like \`main.ts\` should purely handle initialisation and event wire-up. Mixing deep logic (like handling modals, GitHub interactions, and DB updates) breaks the Single Responsibility Principle and bloats the main app file.
* **Rule:** If an event handler exceeds 50 lines in the main entry file, it should be extracted into a dedicated handler module (like \`issues.ts\` or \`handlers/...\`), leaving only the routing logic in \`main.ts\`.
