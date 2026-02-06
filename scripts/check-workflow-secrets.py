#!/usr/bin/env python3
"""
Check GitHub Actions workflow files for unsafe inline of multi-line secrets in run scripts and heredocs.

Multi-line secrets (JSON, PEM keys) must never be inlined in run scripts or heredocs;
they break bash and can leak in error messages. Use base64 encode on the runner and
decode on the remote instead.

Usage: python scripts/check-workflow-secrets.py [workflow_files...]
If no files given, checks .github/workflows/*.yml
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

# Secrets known to be multi-line (JSON, PEM). Inlining these in run scripts is forbidden.
MULTILINE_SECRET_NAMES = frozenset({"FIREBASE_CREDENTIALS_JSON", "PI_SSH_KEY"})

# Pattern for any secrets.X in workflow expressions.
SECRET_INLINE_PATTERN = re.compile(r"\$\{\{\s*secrets\.([A-Za-z0-9_]+)\s*\}\}")


def get_workflow_files(paths: list[str] | None) -> list[Path]:
    """Resolve paths to workflow YAML files."""
    if paths:
        return [Path(p) for p in paths if Path(p).suffix in (".yml", ".yaml")]
    workflows_dir = Path(".github/workflows")
    if not workflows_dir.exists():
        return []
    return sorted(workflows_dir.glob("*.yml")) + sorted(workflows_dir.glob("*.yaml"))


def is_multiline_secret(secret_name: str) -> bool:
    """True if this secret is known or likely to be multi-line."""
    if secret_name in MULTILINE_SECRET_NAMES:
        return True
    if "_CREDENTIALS" in secret_name or secret_name.endswith("_KEY"):
        return True
    return False


def check_file(file_path: Path) -> list[str]:
    """Check a single workflow file. Returns list of error messages."""
    errors: list[str] = []
    content = file_path.read_text()
    lines = content.splitlines()

    # Find all 'run:' blocks
    i = 0
    while i < len(lines):
        line = lines[i]
        # Match 'run:' followed by optional '|' or '>' or just the command
        run_match = re.search(r"^\s*run:\s*([|>]-?)?.*$", line)
        if run_match:
            run_start_idx = i
            indicator = run_match.group(1)
            body_lines = []

            if indicator:
                # Multiline run block
                indent = len(line) - len(line.lstrip())
                i += 1
                while i < len(lines):
                    if lines[i].strip() and not lines[i].startswith(" " * (indent + 1)):
                        break
                    body_lines.append(lines[i])
                    i += 1
                i -= 1  # Step back so the outer loop doesn't skip the next line
            else:
                # Single line run block
                body_lines.append(line.split("run:", 1)[1])

            body = "\n".join(body_lines)
            for m in SECRET_INLINE_PATTERN.finditer(body):
                secret_name = m.group(1)
                if is_multiline_secret(secret_name):
                    # Estimate line number
                    line_offset = body[: m.start()].count("\n")
                    file_line = run_start_idx + line_offset + 1
                    errors.append(
                        f"{file_path}:{file_line}: "
                        f"Multi-line secret '{secret_name}' must not be inlined in run script. "
                        "Use an env: block and reference it as a shell variable (e.g. $VAR) instead."
                    )
        i += 1

    return errors


def main() -> int:
    paths = sys.argv[1:] or None
    files = get_workflow_files(paths)
    if not files:
        print("No workflow files to check.", file=sys.stderr)
        return 0

    all_errors: list[str] = []
    for f in files:
        all_errors.extend(check_file(f))

    if all_errors:
        for e in all_errors:
            print(e)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
