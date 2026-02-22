## 2024-03-24 - Canvas Accessibility Pattern
**Learning:** Canvas-based interactive elements can be made accessible by combining `role='img'`, dynamic `aria-label` updates on the canvas itself, and `aria-live` regions for results. This avoids the need for complex fallback DOM structures while providing real-time feedback to screen readers.
**Action:** Apply this pattern to other canvas widgets like charts or games.

## 2026-02-20 - Custom Card Focus States
**Learning:** Using `:focus-visible` with `outline` and `outline-offset` combined with background color changes provides a clear, high-contrast focus indicator that respects the dark theme and gold accent color scheme.
**Action:** Use this pattern for other interactive cards or list items to maintain consistent keyboard navigation feedback.

## 2025-05-20 - Visual-Only Indicators Accessibility
**Learning:** Purely visual indicators (like colored dots) exclude screen reader users and rely on color perception. Adding a `title` tooltip alongside `aria-label` and `role="img"` is a low-effort pattern that simultaneously benefits mouse users (hover text) and assistive technology users (screen reader text) without changing the visual design.
**Action:** Audit other visual-only status indicators (e.g., online/offline dots, difficulty icons) and apply this pattern.

## 2026-02-22 - Clipboard Integration Feedback
**Learning:** Adding a "Copy to Clipboard" action requires clear visual feedback (e.g., text change to "Copied!", success color) to confirm the action to the user, especially for invisible operations like clipboard writes.
**Action:** Always include temporary state changes for invisible actions.
