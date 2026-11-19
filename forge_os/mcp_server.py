"""MCP stdio server for Claude and other MCP clients."""
import os
from mcp.server.fastmcp import FastMCP
from forge_os.core.planner import create_plan
from forge_os.core.safety import resolve_workspace
from forge_os.tools.project import inspect_project, list_files, read_file, run_python_tests, write_file

mcp = FastMCP("FORGE-OS")
DEFAULT_ROOT = os.environ.get("FORGE_WORKSPACE", ".")


def _root(root: str | None) -> str:
    return str(resolve_workspace(root or DEFAULT_ROOT))


@mcp.tool()
def forge_inspect_project(root: str | None = None) -> dict:
    """Inspect project structure and detect common stacks without changing files."""
    return inspect_project(_root(root))


@mcp.tool()
def forge_list_files(relative_path: str = ".", root: str | None = None, max_entries: int = 200) -> dict:
    """List files in the configured workspace, omitting blocked directories."""
    return list_files(_root(root), relative_path, max_entries)


@mcp.tool()
def forge_read_file(relative_path: str, root: str | None = None) -> dict:
    """Read a UTF-8 text file in the workspace. Secret files are blocked."""
    return read_file(_root(root), relative_path)


@mcp.tool()
def forge_write_file(relative_path: str, content: str, root: str | None = None) -> dict:
    """Create or replace a text file inside the configured workspace."""
    return write_file(_root(root), relative_path, content)


@mcp.tool()
def forge_create_plan(brief: str, project_type: str = "auto") -> dict:
    """Create a structured implementation plan for a software project."""
    return create_plan(brief, project_type)


@mcp.tool()
def forge_run_python_tests(root: str | None = None, timeout_seconds: int = 120) -> dict:
    """Run python -m pytest -q with a maximum 120-second timeout."""
    return run_python_tests(_root(root), timeout_seconds)


def main() -> None:
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
