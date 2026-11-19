# FORGE-OS

Model-agnostic agentic software engineering workspace. This first MVP provides a Python CLI, MCP server, safe workspace file tools, deterministic project planning, tests, and Claude Code skills.

## Install
Requires Python 3.11+ and uv.
```bash
git clone https://github.com/majsjsj/FORGE-OS.git
cd FORGE-OS
uv sync --dev
```

## Use
```bash
uv run forge plan "Build a responsive task manager"
uv run forge inspect /absolute/path/to/project
uv run pytest
```

## Claude Code
Open this repository in Claude Code. The .mcp.json starts the FORGE MCP server. Set FORGE_WORKSPACE to the project directory to work on; the checked-in config defaults to this repository.

MCP tools: inspect project, list/read/write workspace files, create a structured plan, and run Python pytest.

## Safety
No arbitrary shell execution is exposed. File operations are confined to the configured workspace; common secret files and dependency directories are blocked. Tests execute project code, so use a disposable environment for untrusted repositories.

## Status
This is a working foundation, not the finished autonomous studio. Visual screenshot comparison, Android/game builders, autonomous repair loops, and the first-party FORGE model are roadmap items. See docs/ROADMAP.md.
