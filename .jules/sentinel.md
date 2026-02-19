## 2025-02-13 - [Logs in GitHub Issues]
**Vulnerability:** The application was automatically including raw log files in GitHub issues created by users, potentially exposing sensitive environment variables like tokens.
**Learning:** Automated bug reporting features that include system state or logs must sanitize the data before transmission.
**Prevention:** Always use a sanitization layer (like `core.security.sanitize_logs`) when exposing internal logs or configuration to external services.
