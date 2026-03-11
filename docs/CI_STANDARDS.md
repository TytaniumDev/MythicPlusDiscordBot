# CI/CD & Security Standards

## Secrets in Workflows (GitHub Actions)

When adding or modifying `.github/workflows/*.yml`, follow these rules to prevent secret leaks:

- **Never inline multi-line secrets** (e.g. JSON keys, PEM keys) in `run:` scripts or heredocs. Multi-line values break bash and can be echoed in error messages, leaking secrets in CI logs.
- **Safe pattern for multi-line secrets** passed to remote scripts (e.g. SSH heredocs): encode on the runner (e.g. base64), pass a single-line value via step output or env, decode on the remote.
- **Never echo or log** variables that may contain secrets: do not use `set -x` in steps that use secrets; do not `echo $SECRET_VAR`.
- **Prefer writing secrets to files** on the runner when possible (e.g. `echo "${{ secrets.PI_SSH_KEY }}" > file`), and only pass single-line or base64-encoded values into remote heredocs.

See the shared workflow-lint job for automated checks.

## Logging and Secrets

Log output may be included in bug reports (e.g. "Recent Logs" in GitHub issues). To avoid leaking secrets:

- **Never log** `BOT_TOKEN`, `GITHUB_TOKEN`, `FIREBASE_CREDENTIALS_JSON`, or any env that could be secret.
- **When logging exceptions from external APIs** (GitHub, Firebase, etc.), log only the exception type or HTTP status, not the full message or response body.
- Assume all log output is effectively public when users attach logs to bug reports.
