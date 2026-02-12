## 2024-05-23 - [Log Sanitization]
**Vulnerability:** Raw logs were being read from disk and directly included in GitHub issue bodies via `core/issues.py`, potentially exposing secrets if they were accidentally logged.
**Learning:** Even with strict "no logging secrets" policies, defense-in-depth requires sanitizing any logs that leave the system boundary (e.g. to GitHub).
**Prevention:** Implemented `core.security.sanitize_logs` which strips known config secrets and common patterns before upload.
