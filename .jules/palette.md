## 2024-03-24 - Canvas Accessibility Pattern
**Learning:** Canvas-based interactive elements can be made accessible by combining `role='img'`, dynamic `aria-label` updates on the canvas itself, and `aria-live` regions for results. This avoids the need for complex fallback DOM structures while providing real-time feedback to screen readers.
**Action:** Apply this pattern to other canvas widgets like charts or games.

## 2026-02-20 - Custom Card Focus States
**Learning:** Using `:focus-visible` with `outline` and `outline-offset` combined with background color changes provides a clear, high-contrast focus indicator that respects the dark theme and gold accent color scheme.
**Action:** Use this pattern for other interactive cards or list items to maintain consistent keyboard navigation feedback.
