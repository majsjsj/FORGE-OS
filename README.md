# FORGE-OS

**FORGE-OS** is a model-agnostic engineering workspace. It is designed to work with Claude through MCP, or with a locally hosted model through the FORGE AI gateway.

## Current release: 0.3.0

Implemented foundation:
- FORGE Director: deterministic project classification, task breakdown, and specialist-agent routing (planning only).
- Studios: starter scaffolds for web, native Android, Flutter, browser games, Unity, Godot, SaaS, and APIs.
- Mobile/game pipeline: local toolchain detection and guarded APK/AAB build adapters for Gradle/Flutter, plus Unity/Godot Android export entry points.
- Google Play preparation: listing metadata and a human-review release checklist.
- AdMob planning: platform-specific setup plans with test-mode placeholders; no live ad IDs or automatic publishing.
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
uv run forge scaffold flutter ./my-flutter-app
uv run forge scaffold godot ./my-godot-game
uv run forge scaffold unity ./my-unity-game
uv run forge toolchains
uv run forge build ./my-flutter-app apk
uv run forge build ./my-flutter-app aab
uv run forge play-package ./my-flutter-app --name 'My App' --package-id com.example.myapp --short 'A useful app' --description 'Full app description'
uv run forge ads ./my-flutter-app --platform flutter --formats banner,interstitial,rewarded
uv run forge scaffold game ./my-game
uv run forge scaffold saas ./my-saas
uv run forge scaffold api ./my-api
uv run forge inspect ./my-web-app
uv run forge model-status
uv run pytest
```

Scaffolding refuses to overwrite existing files.

## Free-first cloud Android builds

A manual GitHub Actions workflow can build the demo Flutter project into an APK or AAB without installing Android Studio or Flutter on your phone. See [FREE-CLOUD-BUILD.md](docs/FREE-CLOUD-BUILD.md). Flutter is the first cloud target; Godot and Unity cloud exports are not enabled yet. No paid service or billing integration is configured.

## Run your own model (no Claude required)

See [FORGE AI setup](docs/FORGE-AI.md). Configure `FORGE_MODEL_BASE_URL` and `FORGE_MODEL_NAME` for an OpenAI-compatible endpoint such as a local Ollama server. FORGE does not yet ship its own trained foundation-model weights.

## Chat-operated studio roadmap

See [chat-operated studio architecture](docs/CHAT-OPERATED-STUDIO.md) for the required remote MCP control plane, isolated cloud builds, per-user encrypted secret vault, approval gates, and verified engine delivery gates. The `forge-studio` Claude Code skill defines safe project execution and honest capability reporting. Phone-only remote control is not deployed yet: the current MCP configuration is local stdio, and the Flutter workflow still requires a manual GitHub Actions launch.

## MCP tools

The stdio MCP server exposes project inspection, safe file operations, planning/routing, studio scaffolding, model status/chat, screenshot comparison, image metadata, and Python pytest. Open this repository in an MCP-compatible host. The checked-in `.mcp.json` is configured for Claude Code.

## Honest capability boundaries

This release is a functional foundation, not a fully autonomous software factory. Director routing does not yet execute independent agents. Studio templates are starters, not production apps. Vision currently performs pixel-level comparison, not semantic image understanding or automatic image-to-UI conversion. The repair loop needs an external trusted repair callback. The model gateway connects to an existing model; it does not train FORGE weights.

See [mobile and game pipeline](docs/MOBILE-GAME-PIPELINE.md), [architecture](docs/ARCHITECTURE.md), [studios](docs/STUDIOS.md), [vision and repair](docs/VISION-AND-REPAIR.md), and [roadmap](docs/ROADMAP.md).
