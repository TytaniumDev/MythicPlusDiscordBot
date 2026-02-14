## 2024-05-22 - [SPA Accessibility Gaps]
**Learning:** Dynamic Single Page Applications (SPAs) that update content via JavaScript often leave screen reader users behind. Without `aria-live` regions, status updates are silent. Without programmatic focus management, view changes (e.g., Lobby -> Game) are disorienting.
**Action:** Always include `role="status"` and `aria-live="polite"` for dynamic message containers. Always manage focus by shifting it to the new view's primary heading (`tabindex="-1"`) when the view changes.
