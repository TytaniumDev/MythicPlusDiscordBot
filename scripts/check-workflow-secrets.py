#!/usr/bin/env python3
"""
Check GitHub Actions workflow files for unsafe inline of multi-line secrets in heredocs.

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

# Secrets known to be multi-line (JSON, PEM). Inlining these in heredocs is forbidden.
MULTILINE_SECRET_NAMES = frozenset({"FIREBASE_CREDENTIALS_JSON", "PI_SSH_KEY"})

# Pattern for any secrets.X in workflow expressions (used inside heredocs).
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

    # Find all heredocs in the file (run blocks with << DELIMITER)
    i = 0
    while i < len(lines):
        line = lines[i]
        match = re.search(r"<<\s*([A-Za-z0-9_]+)\s*$", line)
        if match:
            delim = match.group(1)
            heredoc_start = i + 1
            i += 1
            body_lines: list[str] = []
            while i < len(lines):
                if re.match(rf"^\s*{re.escape(delim)}\s*$", lines[i]):
                    break
                body_lines.append(lines[i])
                i += 1
            body = "\n".join(body_lines)
            for m in SECRET_INLINE_PATTERN.finditer(body):
                secret_name = m.group(1)
                if is_multiline_secret(secret_name):
                    line_offset = body[: m.start()].count("\n")
                    file_line = heredoc_start + line_offset
                    errors.append(
                        f"{file_path}:{file_line}: "
                        f"Multi-line secret '{secret_name}' must not be inlined in heredoc. "
                        "Use base64 encode on the runner and decode on the remote (see AGENTS.md)."
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
