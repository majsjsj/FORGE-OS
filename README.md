# FORGE-OS

**FORGE-OS** is a model-agnostic AI creation workspace. It is designed to work with Claude through MCP, or with a separately hosted model through the FORGE AI gateway.

## Current foundation

- FORGE Director: deterministic project classification, task breakdown, and specialist-agent routing (planning only).
- Project studios and scaffolds for web, Android, Flutter, browser games, Unity, Godot, SaaS, and APIs.
- A clean, project-agnostic browser workspace with Monaco editing, a sandboxed preview, and desktop/mobile viewport sizing.
- **FORGE MOTION:** a creative-production workspace for voice-led video planning, 2D/3D animation, stickman, product advertising, Blender-oriented shot design, camera direction, sound notes, and an editable storyboard/timeline. The current milestone exports a production-plan JSON; it does not yet render finished MP4/video.
- Mobile build pipeline: local toolchain detection and guarded APK/AAB build adapters for Gradle/Flutter, plus Unity/Godot Android export entry points.
- Google Play preparation: listing metadata and a human-review release checklist.
- AdMob planning: platform-specific setup plans with test-mode placeholders; no live ad IDs or automatic publishing.
- FORGE Vision: image metadata and basic screenshot pixel-difference comparison (optional Pillow).
- Repair engine: bounded verification/repair-loop primitive with caller-supplied callbacks.
- FORGE AI gateway: OpenAI-compatible endpoint adapter for local models.
- MCP server, CLI, workspace-scoped file operations, tests, and Claude Code skills.

## FORGE MOTION

Open [FORGE MOTION](studio/motion/index.html) for the creative-production workspace. Read [the production architecture and capability gates](docs/FORGE-MOTION.md) before connecting render services. The workspace currently supports editable briefs, starter shot breakdowns, scene/camera/action/lighting/audio metadata, a timeline view, local persistence, audio reference preview, and JSON project import/export. Speech recognition, AI provider calls, Blender rendering, 2D/3D animation rendering, and final video export are planned integrations and are not yet active.

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

## Universal browser workspace

Open [FORGE Studio](studio/index.html). It starts with a clean, empty HTML/CSS/JavaScript workspace in `workspace/blank-project/`. There is no preloaded sample game or reference app. The AI can generate the project structure and files from the user's brief.

The browser editor uses Monaco (the VS Code editor engine), a sandboxed local preview, and desktop/mobile viewport sizing. Drafts are stored in browser localStorage. Use [GitHub.dev](https://github.dev/majsjsj/FORGE-OS) for repository editing and commits; the embedded Monaco editor does not commit automatically.

## On-demand development environments

See [on-demand environments](docs/ON-DEMAND-ENVIRONMENTS.md). The repository now includes a reproducible VS Code Dev Container definition and a manual-only GitHub Actions workflow for Web, Flutter, Godot headless checks/exports, and Unity Linux builds gated by a `UNITY_LICENSE` secret. Jobs use temporary GitHub-hosted runners, short timeouts, and short artifact retention; they do not run on every push. Godot export requires matching project presets; Android export is not yet enabled here. Unity requires an authorized license. No paid service is activated automatically. GitHub Actions and Codespaces quotas/billing remain account-dependent.

## Run your own model (no Claude required)

See [FORGE AI setup](docs/FORGE-AI.md). Configure `FORGE_MODEL_BASE_URL` and `FORGE_MODEL_NAME` for an OpenAI-compatible endpoint such as a local Ollama server. FORGE does not yet ship its own trained foundation-model weights.

## Remote chat controller

The repository now includes a deployable, authenticated stateless MCP Worker for Claude custom connectors. It can create/edit project files in isolated project branches, run explicitly authorized short terminal commands or 10-minute cloud sessions, optionally save cloud-session changes (up to 200 files / 50 MB) back to the same project branch, dispatch on-demand builds, and inspect run status, jobs, artifacts, and logs. See [remote MCP setup](docs/REMOTE-MCP-SETUP.md) and the manual [deployment workflow](.github/workflows/deploy-remote-mcp.yml). **It is source code only until you add the required GitHub repository secrets and run the deployment workflow.** After deployment, add it as a custom connector in Claude web; the connected tools can then be enabled in Claude mobile. The current controller is single-owner and does not yet sync uncommitted browser drafts, download artifact bytes, or provide multi-user isolation and a per-user secret vault.

See [chat-operated studio architecture](docs/CHAT-OPERATED-STUDIO.md) for the full security and delivery gates. The `forge-studio` Claude Code skill defines safe project execution and honest capability reporting.

## MCP tools

The stdio MCP server exposes project inspection, safe file operations, planning/routing, studio scaffolding, model status/chat, screenshot comparison, image metadata, and Python pytest. Open this repository in an MCP-compatible host. The checked-in `.mcp.json` is configured for Claude Code.

## Honest capability boundaries

This release is a functional foundation, not a fully autonomous software factory. Director routing does not yet execute independent agents. Studio templates are starters, not production apps. Vision currently performs pixel-level comparison, not semantic image understanding or automatic image-to-UI conversion. The repair loop needs an external trusted repair callback. The model gateway connects to an existing model; it does not train FORGE weights.
