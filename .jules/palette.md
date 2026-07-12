## 2025-02-18 - Missing form labels in custom views
**Learning:** Raw input fields like `<input>` and `<textarea>` in views (like `ResultsView.tsx`) often bypass generic wrapped UI components (like `TextInput`), meaning they easily miss standard accessibility provisions such as `aria-label` when placeholders are relied upon visually.
**Action:** Always scan for unwrapped native inputs (`<input>`, `<textarea>`) in view components and ensure they have explicit `aria-label` attributes if `<label>` tags are missing.

## 2026-04-12 - Focus Visible Styles
**Learning:** In custom components, applying global `:focus-visible` to interactive elements improves keyboard accessibility natively without specific component overrides.
**Action:** Use global pseudo selectors for standard interactive elements if component-level focus states are missing, ensuring accessibility without bloat.

## 2026-07-12 - Unwrapped Native Form Inputs need explicit ARIA labels
**Learning:** In custom views (like `RoleEditor.tsx` or `ReportBadGroupDialog.tsx`), raw inputs (`<input>`, `<textarea>`) often bypass generic wrapped components, causing them to lack proper accessibility. Specifically, depending solely on the `placeholder` attribute makes them less reliable for screen readers.
**Action:** When working with raw `input` or `textarea` elements, always check for an explicit `aria-label` or an associated `id`/`<label>`. Add `aria-label` if they are missing.
