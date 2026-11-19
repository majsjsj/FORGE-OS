import pytest

from forge_os.core.safety import WorkspaceError, safe_path


def test_valid_relative_path(tmp_path):
    assert safe_path(tmp_path, "src/main.py") == tmp_path / "src" / "main.py"


def test_parent_traversal_blocked(tmp_path):
    with pytest.raises(WorkspaceError):
        safe_path(tmp_path, "../outside.txt")


def test_env_blocked(tmp_path):
    with pytest.raises(WorkspaceError):
        safe_path(tmp_path, ".env")


def test_symlink_traversal_blocked(tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    link = tmp_path / "link"
    try:
        link.symlink_to(outside, target_is_directory=True)
    except OSError:
        pytest.skip("Symlinks are unavailable on this platform.")
    with pytest.raises(WorkspaceError):
        safe_path(tmp_path, "link/secret.txt", for_write=True)
