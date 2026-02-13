## 2025-02-18 - Accessibility Refactoring
**Learning:** Adding `aria-busy` to buttons provides semantic loading state that can be targeted with CSS `button[aria-busy="true"]` for consistent visual feedback (cursor: wait).
**Action:** Use `aria-busy` + CSS selector for all async button states instead of manual style manipulation.
