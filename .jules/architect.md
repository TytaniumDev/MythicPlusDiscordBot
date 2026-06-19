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

### Modal Handlers Extraction
* **Date:** 2024-10-24
* **Pattern:** Extract modal interaction logic from monolithic  into distinct helper methods (e.g.,  and ).
* **Why:** Monolithic handlers for commands or modals obscure the logic flow, increase cognitive load, and reduce maintainability. Separating logic by the domain of the interaction creates cleaner entry points.
* **Rule:** If a handler uses a switch or multiple if statements to manage completely unrelated domains (e.g. general bugs vs specific bad groups), extract each domain into its own helper function.

### Modal Handlers Extraction
* **Date:** 2024-10-24
* **Pattern:** Extract modal interaction logic from monolithic handleModalSubmit into distinct helper methods (e.g., handleBugFeatureModal and handleBadGroupModal).
* **Why:** Monolithic handlers for commands or modals obscure the logic flow, increase cognitive load, and reduce maintainability. Separating logic by the domain of the interaction creates cleaner entry points.
* **Rule:** If a handler uses a switch or multiple if statements to manage completely unrelated domains (e.g. general bugs vs specific bad groups), extract each domain into its own helper function.
