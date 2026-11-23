"""Fail CI when a GitHub Actions dependency is not pinned to a full commit SHA."""

from __future__ import annotations

import re
import sys
from pathlib import Path

USES_PATTERN = re.compile(r"^\s*(?:-\s*)?uses:\s*([^\s#]+)")
PINNED_REFERENCE = re.compile(
    r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:/[^@\s]+)?@[0-9a-fA-F]{40}$"
)


def find_unpinned_references(root: Path) -> list[str]:
    github_dir = root / ".github"
    scan_dirs = [github_dir / "workflows", github_dir / "actions"]
    failures: list[str] = []
    files = sorted(
        path
        for directory in scan_dirs
        if directory.exists()
        for path in directory.rglob("*")
        if path.is_file() and path.suffix.lower() in {".yml", ".yaml"}
    )

    for path in files:
        for line_number, line in enumerate(
            path.read_text(encoding="utf-8").splitlines(), start=1
        ):
            match = USES_PATTERN.match(line)
            if not match:
                continue
            reference = match.group(1).strip("'\\\"")
            if reference.startswith("./"):
                continue
            if not PINNED_REFERENCE.fullmatch(reference):
                relative = path.relative_to(root)
                failures.append(
                    f"{relative}:{line_number}: external action must use a full "
                    f"40-character commit SHA (found {reference!r})"
                )
    return failures


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    failures = find_unpinned_references(root)
    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    print("All external GitHub Actions references are pinned to full commit SHAs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
