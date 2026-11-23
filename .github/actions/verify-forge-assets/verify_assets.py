#!/usr/bin/env python3
"""Verify the integrity and safe paths of explicitly staged FORGE assets."""
from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path, PurePosixPath


def verify_assets(project_path: str, project_branch: str, root: Path | None = None) -> int:
    root = (root or Path.cwd()).resolve()
    project = Path(project_path)
    if project.is_absolute() or ".." in project.parts:
        raise ValueError("Unsafe project path while verifying asset manifest.")
    project_root = (root / project).resolve()
    if not project_root.is_relative_to(root) or not project_root.is_dir():
        raise ValueError("Unsafe or missing project directory while verifying asset manifest.")

    manifest_path = project_root / "forge-assets-manifest.json"
    if not manifest_path.exists() and not manifest_path.is_symlink():
        print("No FORGE external-asset manifest found; nothing to verify.")
        return 0
    if manifest_path.is_symlink() or not manifest_path.is_file():
        raise ValueError("Asset manifest must be a regular, non-symlink file.")

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError(f"Asset manifest is not valid JSON: {exc}") from exc
    if not isinstance(manifest, dict) or manifest.get("format") != "forge-assets-manifest-v1":
        raise ValueError("Unsupported FORGE asset manifest format.")
    if manifest.get("branch") != project_branch or manifest.get("project_path") != project.as_posix():
        raise ValueError("Asset manifest branch/project does not match this build target.")
    entries = manifest.get("files")
    if not isinstance(entries, list) or not entries:
        raise ValueError("Asset manifest has no file entries.")

    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError("Invalid asset manifest entry.")
        rel = entry.get("path")
        expected_size = entry.get("size_bytes")
        expected_hash = entry.get("sha256")
        if not isinstance(rel, str) or not rel or "\\" in rel:
            raise ValueError("Asset manifest contains an invalid relative path.")
        posix = PurePosixPath(rel)
        if posix.is_absolute() or any(part in ("", ".", "..") or part.startswith(".") for part in posix.parts):
            raise ValueError(f"Unsafe asset path in manifest: {rel}")
        if rel in seen:
            raise ValueError(f"Duplicate asset path in manifest: {rel}")
        seen.add(rel)

        raw_target = project_root.joinpath(*posix.parts)
        current = project_root
        for part in posix.parts:
            current = current / part
            if current.is_symlink():
                raise ValueError(f"Staged asset path contains a symlink: {rel}")
        target = raw_target.resolve()
        if not target.is_relative_to(project_root) or not raw_target.is_file():
            raise ValueError(f"Staged asset is missing or unsafe: {rel}")

        if isinstance(expected_size, bool) or not isinstance(expected_size, int) or expected_size <= 0 or target.stat().st_size != expected_size:
            raise ValueError(f"Staged asset size mismatch: {rel}")
        if not isinstance(expected_hash, str) or not re.fullmatch(r"[a-fA-F0-9]{64}", expected_hash):
            raise ValueError(f"Invalid SHA-256 value in manifest: {rel}")
        digest = hashlib.sha256()
        with target.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        if digest.hexdigest() != expected_hash.lower():
            raise ValueError(f"Staged asset SHA-256 mismatch: {rel}")

    print(f"Verified {len(entries)} staged asset(s) against SHA-256 manifest.")
    return len(entries)


if __name__ == "__main__":
    try:
        verify_assets(os.environ["PROJECT_PATH"], os.environ["PROJECT_BRANCH"])
    except (KeyError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
