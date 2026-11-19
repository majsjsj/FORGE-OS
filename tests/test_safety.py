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
