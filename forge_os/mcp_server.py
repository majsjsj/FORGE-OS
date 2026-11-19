"""MCP stdio server for Claude and other MCP clients; tools also serve other MCP hosts."""
import os

from mcp.server.fastmcp import FastMCP

from forge_os.core.director import direct
from forge_os.core.planner import create_plan
from forge_os.core.safety import resolve_workspace
from forge_os.engines.vision import compare_images, image_info
from forge_os.models.gateway import chat, model_status
from forge_os.studios.ads import create_admob_plan
from forge_os.studios.mobile import build_project, discover_toolchains, play_store_package
from forge_os.studios.scaffold import scaffold
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
def forge_direct(brief: str, studio: str = "auto") -> dict:
    """Route a project brief to a studio and specialist agents. Planning only; does not claim agents executed."""
    return direct(brief, studio)


@mcp.tool()
def forge_scaffold_studio(studio: str, destination: str, root: str | None = None) -> dict:
    """Create a non-overwriting starter for web, Android, Flutter, Unity, Godot, game, SaaS, or API."""
    return scaffold(_root(root), studio, destination)


@mcp.tool()
def forge_toolchains() -> dict:
    """Detect installed Flutter, Godot, Unity, Gradle and Android debug bridge tools."""
    return discover_toolchains()


@mcp.tool()
def forge_build_mobile(relative_path: str, target: str, root: str | None = None,
                       timeout_seconds: int = 1800) -> dict:
    """Build a supported local Android project to APK/AAB or invoke Godot/Unity Android export."""
    return build_project(_root(root), relative_path, target, timeout_seconds)


@mcp.tool()
def forge_prepare_play_store(relative_path: str, app_name: str, package_id: str,
                             short_description: str, full_description: str,
                             privacy_policy_url: str = "", root: str | None = None) -> dict:
    """Write Google Play listing metadata and a human-review checklist; never publishes."""
    return play_store_package(_root(root), relative_path, app_name, package_id,
                              short_description, full_description, privacy_policy_url)


@mcp.tool()
def forge_prepare_admob(relative_path: str, platform: str = "android",
                        formats: list[str] | None = None, root: str | None = None) -> dict:
    """Create an AdMob setup plan with test-mode placeholders; does not add live IDs."""
    return create_admob_plan(_root(root), relative_path, platform, formats)


@mcp.tool()
def forge_model_status() -> dict:
    """Report whether a FORGE AI compatible model endpoint is configured."""
    return model_status()


@mcp.tool()
def forge_model_chat(messages: list[dict]) -> dict:
    """Send messages to the configured FORGE model endpoint. Requires explicit local endpoint configuration."""
    return chat(messages)


@mcp.tool()
def forge_image_info(relative_path: str, root: str | None = None) -> dict:
    """Read image dimensions and metadata for a reference or rendered screenshot."""
    return image_info(_root(root), relative_path)


@mcp.tool()
def forge_compare_screenshots(reference: str, rendered: str, output: str = "forge-diff.png",
                              root: str | None = None) -> dict:
    """Compare two screenshots with a basic pixel metric and save a difference image."""
    return compare_images(_root(root), reference, rendered, output)


@mcp.tool()
def forge_run_python_tests(root: str | None = None, timeout_seconds: int = 120) -> dict:
    """Run python -m pytest -q with a maximum 120-second timeout."""
    return run_python_tests(_root(root), timeout_seconds)


def main() -> None:
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
