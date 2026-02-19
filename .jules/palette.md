## 2024-03-24 - Canvas Accessibility Pattern
**Learning:** Canvas-based interactive elements can be made accessible by combining `role='img'`, dynamic `aria-label` updates on the canvas itself, and `aria-live` regions for results. This avoids the need for complex fallback DOM structures while providing real-time feedback to screen readers.
**Action:** Apply this pattern to other canvas widgets like charts or games.

## 2024-05-22 - Headless Focus Verification
**Learning:** Headless browsers (like Playwright in CI) may not render `:focus-visible` styles reliably without explicit keyboard interaction simulation, leading to false negatives in visual regression tests.
**Action:** When verifying focus states in headless environments, use `force: true` on locators or programmatically inject a temporary CSS rule to force the focus state for visual confirmation.
