"""Verify a FORGE artifact manifest and every file it describes."""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path, PurePosixPath


def fail(message: str) -> None:
    raise SystemExit(message)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="Extracted artifact directory (default: current directory)")
    parser.add_argument("--engine", help="Require this engine name in the manifest")
    parser.add_argument("--output", help="Require this output type in the manifest")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not root.is_dir():
        fail(f"Artifact root is not a directory: {root}")
    manifest_path = root / "forge-artifact-manifest.json"
    if manifest_path.is_symlink() or not manifest_path.is_file():
        fail("Artifact manifest is missing or unsafe.")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError, UnicodeDecodeError) as exc:
        fail(f"Artifact manifest is not valid JSON: {exc}")
    if not isinstance(manifest, dict) or manifest.get("format") != "forge-artifact-manifest-v1":
        fail("Unsupported artifact manifest format.")
    if args.engine and manifest.get("engine") != args.engine:
        fail(f"Engine mismatch: expected {args.engine}, found {manifest.get('engine')}.")
    if args.output and manifest.get("output") != args.output:
        fail(f"Output mismatch: expected {args.output}, found {manifest.get('output')}.")
    entries = manifest.get("files")
    if not isinstance(entries, list) or not entries or len(entries) > 10000:
        fail("Artifact manifest must contain between 1 and 10,000 entries.")

    seen = set()
    for entry in entries:
        if not isinstance(entry, dict):
            fail("Invalid artifact manifest entry.")
        rel = entry.get("path")
        if not isinstance(rel, str) or not rel or "\\" in rel:
            fail("Invalid artifact relative path.")
        posix = PurePosixPath(rel)
        if posix.is_absolute() or posix.as_posix() != rel or any(part in ("", ".", "..") for part in posix.parts):
            fail(f"Unsafe artifact path: {rel}")
        if rel in seen:
            fail(f"Duplicate artifact path: {rel}")
        seen.add(rel)

        raw_target = root / Path(*posix.parts)
        target = raw_target.resolve()
        if raw_target.is_symlink() or not target.is_relative_to(root) or not target.is_file():
            fail(f"Artifact file is missing or unsafe: {rel}")
        expected_size = entry.get("size")
        expected_hash = entry.get("sha256")
        if isinstance(expected_size, bool) or not isinstance(expected_size, int) or expected_size < 0 or target.stat().st_size != expected_size:
            fail(f"Artifact size mismatch: {rel}")
        if not isinstance(expected_hash, str) or not re.fullmatch(r"[a-f0-9]{64}", expected_hash):
            fail(f"Invalid SHA-256 in artifact manifest: {rel}")
        digest = hashlib.sha256()
        with target.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        if digest.hexdigest() != expected_hash:
            fail(f"Artifact SHA-256 mismatch: {rel}")

    print(
        f"Verified {len(entries)} artifact file(s) for "
        f"{manifest.get('engine', 'unknown')}/{manifest.get('output', 'unknown')}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
