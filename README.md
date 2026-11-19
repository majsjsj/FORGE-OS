# FORGE-OS

**FORGE-OS** is a model-agnostic engineering workspace. It is designed to work with Claude through MCP, or with a locally hosted model through the FORGE AI gateway.

## Current release: 0.2.0

Implemented foundation:
- FORGE Director: deterministic project classification, task breakdown, and specialist-agent routing (planning only).
- Studios: starter scaffolds for web, Android, browser games, SaaS, and APIs.
- FORGE Vision: image metadata and basic screenshot pixel-difference comparison (optional Pillow).
- Repair engine: bounded verification/repair-loop primitive with caller-supplied callbacks.
- FORGE AI gateway: OpenAI-compatible endpoint adapter for local models; Claude is not required for this gateway.
- MCP server, CLI, workspace-scoped file operations, initial tests, and Claude Code skills.

## Install

Requires Python 3.11+ and uv.

```bash
git clone https://github.com/majsjsj/FORGE-OS.git
cd FORGE-OS
uv sync --dev
uv sync --extra vision
```

## CLI

```bash
uv run forge direct "Build an Android habit tracker"
uv run forge scaffold web ./my-web-app
uv run forge scaffold android ./my-android-app
uv run forge scaffold game ./my-game
uv run forge scaffold saas ./my-saas
uv run forge scaffold api ./my-api
uv run forge inspect ./my-web-app
uv run forge model-status
uv run pytest
```

Scaffolding refuses to overwrite existing files.

## Run your own model (no Claude required)

See [FORGE AI setup](docs/FORGE-AI.md). Configure `FORGE_MODEL_BASE_URL` and `FORGE_MODEL_NAME` for an OpenAI-compatible endpoint such as a local Ollama server. FORGE does not yet ship its own trained foundation-model weights.

## MCP tools

The stdio MCP server exposes project inspection, safe file operations, planning/routing, studio scaffolding, model status/chat, screenshot comparison, image metadata, and Python pytest. Open this repository in an MCP-compatible host. The checked-in `.mcp.json` is configured for Claude Code.

## Honest capability boundaries

This release is a functional foundation, not a fully autonomous software factory. Director routing does not yet execute independent agents. Studio templates are starters, not production apps. Vision currently performs pixel-level comparison, not semantic image understanding or automatic image-to-UI conversion. The repair loop needs an external trusted repair callback. The model gateway connects to an existing model; it does not train FORGE weights.

See [architecture](docs/ARCHITECTURE.md), [studios](docs/STUDIOS.md), [vision and repair](docs/VISION-AND-REPAIR.md), and [roadmap](docs/ROADMAP.md).
