"""Safe project operations exposed through MCP."""
import subprocess
import sys
from forge_os.core.safety import MAX_READ_BYTES, MAX_WRITE_BYTES, WorkspaceError, resolve_workspace, safe_path


def inspect_project(root: str) -> dict:
    base = resolve_workspace(root)
    markers = ["pyproject.toml", "package.json", "Cargo.toml", "go.mod", "build.gradle",
               "settings.gradle", "AndroidManifest.xml", "README.md", "vite.config.ts", "next.config.js"]
    found = [name for name in markers if (base / name).is_file()]
    items = [{"name": p.name, "kind": "directory" if p.is_dir() else "file"}
             for p in sorted(base.iterdir(), key=lambda p: p.name.lower())
             if p.name not in {".git", ".venv", "node_modules", "__pycache__"}]
    hints = []
    if "pyproject.toml" in found: hints.append("Python")
    if "package.json" in found: hints.append("JavaScript/TypeScript")
    if any(x in found for x in ("build.gradle", "settings.gradle", "AndroidManifest.xml")): hints.append("Android/Gradle")
    if "Cargo.toml" in found: hints.append("Rust")
    if "go.mod" in found: hints.append("Go")
    return {"workspace": str(base), "detected_markers": found, "top_level": items[:100],
            "project_hints": hints or ["Unknown; inspect source tree."]}


def list_files(root: str, relative_path: str = ".", max_entries: int = 200) -> dict:
    base = resolve_workspace(root)
    target = base if relative_path == "." else safe_path(base, relative_path)
    if not target.exists() or not target.is_dir(): raise WorkspaceError("Directory does not exist.")
    entries = []
    for item in sorted(target.iterdir(), key=lambda p: p.name.lower()):
        try: safe_path(base, str(item.relative_to(base)))
        except WorkspaceError: continue
        entries.append({"path": str(item.relative_to(base)), "kind": "directory" if item.is_dir() else "file"})
        if len(entries) >= max(1, min(max_entries, 500)): break
    return {"directory": relative_path, "entries": entries}


def read_file(root: str, relative_path: str) -> dict:
    path = safe_path(root, relative_path)
    if not path.is_file(): raise WorkspaceError("File does not exist or is not regular.")
    if path.stat().st_size > MAX_READ_BYTES: raise WorkspaceError("File exceeds read-size limit.")
    try: content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc: raise WorkspaceError("Only UTF-8 text files are supported.") from exc
    return {"path": relative_path, "content": content}


def write_file(root: str, relative_path: str, content: str) -> dict:
    path = safe_path(root, relative_path, for_write=True)
    size = len(content.encode("utf-8"))
    if size > MAX_WRITE_BYTES: raise WorkspaceError("Content exceeds write-size limit.")
    if path.exists() and not path.is_file(): raise WorkspaceError("Target is not a regular file.")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return {"path": relative_path, "bytes_written": size}


def run_python_tests(root: str, timeout_seconds: int = 120) -> dict:
    base = resolve_workspace(root)
    timeout = max(1, min(timeout_seconds, 120))
    command = [sys.executable, "-m", "pytest", "-q"]
    try:
        result = subprocess.run(command, cwd=base, capture_output=True, text=True,
                                timeout=timeout, shell=False, check=False)
    except subprocess.TimeoutExpired:
        return {"passed": False, "timed_out": True, "timeout_seconds": timeout}
    return {"passed": result.returncode == 0, "return_code": result.returncode,
            "stdout": result.stdout[-12000:], "stderr": result.stderr[-12000:],
            "command": command,
            "warning": "Pytest executes project code; use an isolated environment for untrusted projects."}
