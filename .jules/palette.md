## 2025-02-18 - Missing form labels in custom views
**Learning:** Raw input fields like `<input>` and `<textarea>` in views (like `ResultsView.tsx`) often bypass generic wrapped UI components (like `TextInput`), meaning they easily miss standard accessibility provisions such as `aria-label` when placeholders are relied upon visually.
**Action:** Always scan for unwrapped native inputs (`<input>`, `<textarea>`) in view components and ensure they have explicit `aria-label` attributes if `<label>` tags are missing.

## 2026-04-12 - Focus Visible Styles
**Learning:** In custom components, applying global `:focus-visible` to interactive elements improves keyboard accessibility natively without specific component overrides.
**Action:** Use global pseudo selectors for standard interactive elements if component-level focus states are missing, ensuring accessibility without bloat.

## 2026-08-02 - Custom Toggle Groups and Inputs Accessibility
**Learning:** Custom UI groups (like multiple role buttons) and visually custom form fields in `RoleEditor.tsx` can lack proper semantics. Without `role="group"` and `aria-label` for button clusters, or `<label htmlFor>` paired with `id` for inputs, screen reader users miss crucial context.
**Action:** When building or modifying custom form elements and custom button clusters, ensure they are semantically grouped and properly labeled using React's `useId` and standard ARIA grouping patterns.
