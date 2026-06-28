## 2025-02-18 - Missing form labels in custom views
**Learning:** Raw input fields like `<input>` and `<textarea>` in views (like `ResultsView.tsx`) often bypass generic wrapped UI components (like `TextInput`), meaning they easily miss standard accessibility provisions such as `aria-label` when placeholders are relied upon visually.
**Action:** Always scan for unwrapped native inputs (`<input>`, `<textarea>`) in view components and ensure they have explicit `aria-label` attributes if `<label>` tags are missing.

## 2026-04-12 - Focus Visible Styles
**Learning:** In custom components, applying global `:focus-visible` to interactive elements improves keyboard accessibility natively without specific component overrides.
**Action:** Use global pseudo selectors for standard interactive elements if component-level focus states are missing, ensuring accessibility without bloat.
## 2026-06-28 - Missing form labels in custom views
**Learning:** Raw input fields like `<input>` and `<textarea>` in views often bypass generic wrapped UI components, meaning they easily miss standard accessibility provisions such as `aria-label` when placeholders are relied upon visually.
**Action:** Always scan for unwrapped native inputs (`<input>`, `<textarea>`) in view components and ensure they have explicit `aria-label` attributes if `<label>` tags are missing.
