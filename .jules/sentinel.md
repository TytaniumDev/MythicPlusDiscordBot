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
