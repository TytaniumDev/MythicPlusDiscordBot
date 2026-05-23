## 2025-02-13 - [Logs in GitHub Issues]
**Vulnerability:** The application was automatically including raw log files in GitHub issues created by users, potentially exposing sensitive environment variables like tokens.
**Learning:** Automated bug reporting features that include system state or logs must sanitize the data before transmission.
**Prevention:** Always use a sanitization layer (like `core.security.sanitize_logs`) when exposing internal logs or configuration to external services.
## 2024-03-14 - [Secrets in GitHub Issues Logs]
**Vulnerability:** The `SENTRY_DSN` and `DISCORD_APPLICATION_ID` configuration values were not being redacted from the raw logs automatically included in user-created GitHub bug reports, potentially exposing sensitive application infrastructure details.
**Learning:** Newly added sensitive environment variables must be manually appended to the redaction logic in `core.security.sanitizeLogs`.
**Prevention:** Whenever a new secret or sensitive configuration variable is introduced to `config.ts`, immediately update the `sanitizeLogs` function in `security.ts` and its corresponding tests to ensure it is systematically redacted before transmission.
## 2025-02-14 - [Input Validation Bypass]
**Vulnerability:** A missing strict type check in Firebase Callable Functions could allow callers to pass non-string arguments (like arrays or objects) which would bypass regex validation and cause unhandled `TypeError` exceptions when string methods like `.toLowerCase()` are called.
**Learning:** Always validate that inputs are strictly strings before running regex patterns or string operations, especially in external endpoints like Cloud Functions.
**Prevention:** Use `typeof input !== 'string'` prior to regex validation and throw structured HTTP errors for invalid arguments.
## 2026-04-07 - [DO NOT enforce App Check on `lookupCharacter`]
**Non-vulnerability:** `enforceAppCheck: true` on the `lookupCharacter` callable (`packages/functions/src/lookupCharacter.ts`) has been reverted twice (PR #382, and will be again after #389). The activity frontend does not call `initializeAppCheck()`, so enforcement silently rejects every call: the function body never runs, `mediaUrl` is never returned, and character portraits vanish from the lobby with no visible error because callable errors come back as HTTP 200 bodies and the frontend swallows them.
**Learning:** App Check enforcement only helps when the client actually provides an App Check token. Enabling server-side enforcement without a matching client init is equivalent to taking the endpoint offline.
**Prevention:** Do NOT add `enforceAppCheck: true` to `lookupCharacter` (or any other callable) until `activity/src/firebase.ts` calls `initializeAppCheck(...)` with a reCAPTCHA v3 (or equivalent) provider and debug token support for local dev. The endpoint is already protected by anonymous-auth + per-user rate limiting (`enforceRateLimit(..., 30, 60000)`), which is sufficient for a non-sensitive read-only lookup.
## 2025-02-14 - [Timing Attack in Signature Verification]
**Vulnerability:** `crypto.timingSafeEqual` throws an error if buffers are different lengths, which exposes the application to timing attacks because the error throwing takes a different amount of time than a successful byte-by-byte comparison.
**Learning:** Always check buffer lengths before calling `timingSafeEqual`. To ensure constant time regardless of length, compare the expected buffer to itself when lengths don't match.
**Prevention:** Compare lengths first, and use a dummy `timingSafeEqual(expected, expected)` on mismatch to mitigate timing leaks.
## 2026-05-23 - URL Interpolation Vulnerabilities
**Vulnerability:** User-supplied input (`region`, `realmSlug`, `characterName`) was interpolated directly into Battle.net API request URLs in `packages/functions/src/battlenet.ts` without URL encoding.
**Learning:** This is a classic injection vector that can lead to Server-Side Request Forgery (SSRF) and Path Traversal if the attacker provides input containing characters like `/` or `?`.
**Prevention:** Always wrap dynamic user inputs with `encodeURIComponent()` before interpolating them into HTTP paths or query parameters.
