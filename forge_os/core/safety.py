"""Workspace path validation and sensitive-file protections."""
from pathlib import Path

BLOCKED_PARTS = {".git", ".ssh", ".aws", ".azure", ".gnupg", "__pycache__", ".venv", "venv", "node_modules"}
BLOCKED_NAMES = {".env", ".env.local", ".env.production", "id_rsa", "id_ed25519", "credentials", "secrets.json"}
MAX_READ_BYTES = 200_000
MAX_WRITE_BYTES = 200_000


class WorkspaceError(ValueError):
    """Raised when an operation violates workspace policy."""


def resolve_workspace(root: str | Path) -> Path:
    path = Path(root).expanduser().resolve()
    if not path.exists() or not path.is_dir():
        raise WorkspaceError(f"Workspace directory does not exist: {path}")
    return path


def safe_path(root: str | Path, relative_path: str, *, for_write: bool = False) -> Path:
    base = resolve_workspace(root)
    if not relative_path or chr(0) in relative_path:
        raise WorkspaceError("A valid relative path is required.")
    supplied = Path(relative_path)
    if supplied.is_absolute():
        raise WorkspaceError("Absolute paths are not allowed.")
    lexical = base / supplied
    # Reject symlinks in every existing component before resolving; otherwise resolve()
    # would hide the fact that the caller traversed a symlink.
    current = base
    for part in supplied.parts:
        if part in {"", "."}: continue
        if part == "..": raise WorkspaceError("Parent traversal is not allowed.")
        current = current / part
        if current.is_symlink():
            raise WorkspaceError("Symbolic links are not allowed in workspace paths.")
    candidate = lexical.resolve()
    try:
        candidate.relative_to(base)
    except ValueError as exc:
        raise WorkspaceError("Path escapes the configured workspace.") from exc
    parts = candidate.relative_to(base).parts
    if any(part in BLOCKED_PARTS for part in parts):
        raise WorkspaceError("Access to this directory is blocked.")
    name = candidate.name.lower()
    if name in BLOCKED_NAMES or name.startswith(".env"):
        raise WorkspaceError("Access to secret/configuration files is blocked.")
    return candidate
