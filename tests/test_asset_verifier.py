import hashlib
import importlib.util
import json
from pathlib import Path

MODULE = Path(__file__).parents[1] / ".github/actions/verify-forge-assets/verify_assets.py"
SPEC = importlib.util.spec_from_file_location("forge_asset_verifier", MODULE)
assert SPEC and SPEC.loader
verifier = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verifier)


def write_manifest(project: Path, rel: str, data: bytes, **overrides):
    target = project / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    entry = {"path": rel, "size_bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    entry.update(overrides)
    (project / "forge-assets-manifest.json").write_text(json.dumps({
        "format": "forge-assets-manifest-v1",
        "branch": "forge/projects/demo",
        "project_path": "workspace/demo",
        "files": [entry],
    }), encoding="utf-8")


def test_valid_manifest_verifies(tmp_path):
    project = tmp_path / "workspace/demo"
    project.mkdir(parents=True)
    write_manifest(project, "assets/image.bin", b"safe asset")
    assert verifier.verify_assets("workspace/demo", "forge/projects/demo", tmp_path) == 1


def test_internal_symlink_is_rejected(tmp_path):
    project = tmp_path / "workspace/demo"
    project.mkdir(parents=True)
    (project / "real.bin").write_bytes(b"safe asset")
    (project / "alias.bin").symlink_to(project / "real.bin")
    data = b"safe asset"
    (project / "forge-assets-manifest.json").write_text(json.dumps({
        "format": "forge-assets-manifest-v1", "branch": "forge/projects/demo",
        "project_path": "workspace/demo", "files": [{
            "path": "alias.bin", "size_bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest()
        }]
    }), encoding="utf-8")
    try:
        verifier.verify_assets("workspace/demo", "forge/projects/demo", tmp_path)
    except ValueError as exc:
        assert "symlink" in str(exc)
    else:
        raise AssertionError("Internal symlink should be rejected")


def test_symlinked_parent_directory_is_rejected(tmp_path):
    project = tmp_path / "workspace/demo"
    project.mkdir(parents=True)
    real = project / "real"
    real.mkdir()
    data = b"safe asset"
    (real / "image.bin").write_bytes(data)
    (project / "alias").symlink_to(real, target_is_directory=True)
    (project / "forge-assets-manifest.json").write_text(json.dumps({
        "format": "forge-assets-manifest-v1", "branch": "forge/projects/demo",
        "project_path": "workspace/demo", "files": [{
            "path": "alias/image.bin", "size_bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest()
        }]
    }), encoding="utf-8")
    try:
        verifier.verify_assets("workspace/demo", "forge/projects/demo", tmp_path)
    except ValueError as exc:
        assert "symlink" in str(exc)
    else:
        raise AssertionError("Symlinked parent should be rejected")


def test_boolean_size_is_rejected(tmp_path):
    project = tmp_path / "workspace/demo"
    project.mkdir(parents=True)
    write_manifest(project, "asset.bin", b"x", size_bytes=True)
    try:
        verifier.verify_assets("workspace/demo", "forge/projects/demo", tmp_path)
    except ValueError as exc:
        assert "size mismatch" in str(exc)
    else:
        raise AssertionError("Boolean is not a valid byte count")


def test_malformed_sha256_is_rejected(tmp_path):
    project = tmp_path / "workspace/demo"
    project.mkdir(parents=True)
    write_manifest(project, "asset.bin", b"x", sha256="z" * 64)
    try:
        verifier.verify_assets("workspace/demo", "forge/projects/demo", tmp_path)
    except ValueError as exc:
        assert "SHA-256" in str(exc)
    else:
        raise AssertionError("Malformed SHA-256 must be rejected")
