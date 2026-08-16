## 2026-08-16 - [A11y ARIA Missing Labels]
**Learning:** Native `<input>` and `<select>` fields without explicitly associated labels or `<label htmlFor>` pairs are functionally invisible to screen readers, violating WCAG standards.
**Action:** When creating text boxes or dropdown menus, verify there is an explicit descriptive `aria-label` attribute if no visual label is present to explicitly bind them.
