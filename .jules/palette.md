## 2024-03-24 - Canvas Accessibility Pattern
**Learning:** Canvas-based interactive elements can be made accessible by combining `role='img'`, dynamic `aria-label` updates on the canvas itself, and `aria-live` regions for results. This avoids the need for complex fallback DOM structures while providing real-time feedback to screen readers.
**Action:** Apply this pattern to other canvas widgets like charts or games.

## 2026-02-20 - Custom Card Focus States
**Learning:** Using `:focus-visible` with `outline` and `outline-offset` combined with background color changes provides a clear, high-contrast focus indicator that respects the dark theme and gold accent color scheme.
**Action:** Use this pattern for other interactive cards or list items to maintain consistent keyboard navigation feedback.

## 2025-05-20 - Visual-Only Indicators Accessibility
**Learning:** Purely visual indicators (like colored dots) exclude screen reader users and rely on color perception. Adding a `title` tooltip alongside `aria-label` and `role="img"` is a low-effort pattern that simultaneously benefits mouse users (hover text) and assistive technology users (screen reader text) without changing the visual design.
**Action:** Audit other visual-only status indicators (e.g., online/offline dots, difficulty icons) and apply this pattern.

## 2026-03-01 - Interactive Non-Button Elements
**Learning:** Adding `cursor: pointer` to elements like `<h1>` that act as navigation isn't enough for accessibility. They need `role="button"`, `tabindex="0"`, a descriptive `aria-label`, a `:focus-visible` state, and a `keydown` handler (for Enter/Space) so keyboard and screen reader users can discover and trigger them properly.
**Action:** Always verify that custom interactive elements (that aren't native `<button>` or `<a>` tags) implement the full suite of keyboard and ARIA support.

## 2026-10-24 - Semantic HTML Structure for Accessibility
**Learning:** The structure of HTML elements like landmarks (`<aside>`, `<main>`) and headings (`<h1>`, `<h2>`, `<h3>`) directly dictates the navigation experience for screen reader users. Axe-core rules often catch invalid nesting (like `<aside>` inside non-top-level layouts) or skipped heading levels, which confuse users navigating by headings. Fixing these HTML semantics allows enabling previously disabled Axe rules and provides a more robust tree.
**Action:** Always ensure heading levels increment sequentially and avoid wrapping landmark elements (`<aside>`, `<nav>`, `<header>`) inside other layout containers unless structurally appropriate.
