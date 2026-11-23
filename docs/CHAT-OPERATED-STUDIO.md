# Chat-operated studio: implementation contract

## Goal

Use Claude as the conversational interface while FORGE owns project structure, tool execution, verification, build orchestration, and artifact delivery. The user should not need Unity, Godot, Flutter, Android Studio, or a desktop IDE installed on their phone.

## Current verified boundary

- The static Studio includes Monaco editing, local browser drafts, sandboxed preview, and feature panels. Some feature panels remain lightweight MVP utilities; they must not be described as a full Android emulator, full Unity/Godot editor, unrestricted shell, or real performance profiler.
- The remote MCP Worker provides authenticated, branch-aware project operations, short-lived terminal/cloud execution, build dispatch/status/logs, and artifact metadata/download links.
- Project edits are isolated under `forge/projects/<name>`; direct writes to `main` are blocked. Branch comparison is available for review before a human merges changes.
- GitHub Actions jobs are manually dispatched on temporary hosted runners for Web, Flutter, Godot 4.4.1, and Unity. Each engine has its own supported output and setup requirements documented in [on-demand environments](ON-DEMAND-ENVIRONMENTS.md).
- R2 asset storage is optional. Selected objects can be explicitly staged into an isolated project branch with `forge_asset_import` or the atomic `forge_asset_import_batch` tool before a separately authorized build; automatic runner-to-R2 synchronization is not implemented.
- A workflow definition, scaffold, or local adapter is not evidence of a successful cloud build or device test.

## Required architecture

### 1. Conversational control plane

The deployed single-owner Cloudflare Worker uses stateless Streamable HTTP and bearer-token authentication. It exposes health, isolated branch management, workspace file operations, preview, terminal/cloud execution, build dispatch, status, logs, and artifact links. It is not a multi-user service; do not share its token or connect untrusted users.

### 2. Build plane

Build jobs run in short-lived GitHub-hosted runners and check out the selected project branch. Web, Flutter, Godot, and Unity jobs are manual/on-demand. Artifacts have short retention. Builds must be explicitly authorized, and a dispatch is not a successful build until its run and outputs are inspected.

### 3. External assets

Optional Cloudflare R2 storage keeps large binary assets out of Git history and Actions artifacts. Uploads are explicitly confirmed and scoped to an isolated project branch/path. GitHub Actions runners do not have direct access to the Worker’s R2 binding. The current safe path is explicit pre-build staging: list the project’s R2 objects, select only the needed assets, and import one file or a batch of up to 20 files / 24 MiB into the isolated project branch. Batch import validates paths and conflicts, records file sizes and SHA-256 hashes in `forge-assets-manifest.json` for both single-file and batch imports, and commits the selected files together; each engine workflow verifies that manifest before running project tools. It does not start a build. Automatic runner-to-R2 synchronization remains unimplemented. Any future direct runner integration must authenticate with GitHub OIDC, verify repository/workflow/ref/run claims server-side, scope access to the selected branch/project, issue short-lived read-only access, and avoid passing long-lived secrets or bearer URLs through workflow inputs and logs.

### 4. Tenant isolation and secret vault

The current controller is single-owner. Multi-user operation requires authenticated tenant IDs, server-side authorization for every project/asset/secret, and encrypted per-tenant secret storage. Do not put credentials in Git, project prompts, ordinary chat, workflow artifacts, or public issue threads.

Signing keys, passwords, AdMob account credentials, and payment-provider secrets require a secure upload/entry flow. Public AdMob app/ad unit IDs are configuration, not a substitute for protecting account credentials. Payment card data must remain with a compliant hosted checkout/provider; FORGE must not collect PAN or CVV.

### 5. Approval policy

Require explicit user confirmation before builds/tests that consume Actions quota, release signing, publishing to a store, enabling live ads or payment flows, accessing external accounts, or using any service that may incur charges. Debug/test configuration is the default. Never silently retry a failed build.

### 6. AI and quality

Keep the model adapter provider-neutral. Vision QA must use an actual vision-capable model for semantic inspection; pixel diffs are supplemental only. Automated repair must be bounded, test-driven, and report every attempt.

## Delivery gates

1. Flutter cloud APK built, downloaded, installed, and smoke-tested on a physical device.
2. Remote MCP create/edit/inspect/build/status/artifact flow verified from a phone.
3. Godot Android APK and signed AAB exports built and verified; Web export opened interactively.
4. Unity Android APK/AAB and WebGL exports verified under a compliant license.
5. R2-to-build synchronization implemented and verified without exposing long-lived credentials or public bucket access.
6. Authenticated tenant isolation and encrypted secret vault tested with separate users.
7. Remote interactive preview tested on a phone with HTML and Godot/Unity Web exports.
8. Release signing, ads, and payment integrations added only after secure secret entry and approval gates pass.

## Free-first constraints

Keep workflows manual and short-lived. GitHub Actions, Codespaces, and Cloudflare quotas are account-dependent and can change. The system must surface quota/cost implications and fail closed rather than silently switching to paid infrastructure. No unlimited-free-build promise is made.

## Visual design, game level editing, and QA tools

- **Visual Design Studio** is a browser-side component editor for hero sections, text, buttons, and cards. It exports HTML/CSS or applies generated files directly to the local Monaco/fallback workspace and refreshes the sandboxed preview. It does not write to GitHub by itself; project-branch persistence still requires an explicitly authorized FORGE MCP write.
- **Advanced Game Lab** is a 12×8 tile-map editor with terrain, walls, water, start/goal markers, enemies, and collectibles. It exports a versioned engine-neutral JSON level description. It is a level-data authoring tool, not a Godot/Unity runtime or full scene editor.
- **Quality Assurance** parses the current HTML, compiles JavaScript for syntax validation without executing it, parses CSS using the browser CSS parser, and checks common accessibility and markup risks. It produces a downloadable JSON report. It is static local QA, not a full browser automation, device test, dependency audit, or security certification.
- These tools run locally in the browser, add no external libraries, do not invoke cloud builds, and do not incur service charges.


## Read-only release preflight

The MCP tool `forge_project_preflight` runs a bounded structural check against committed files on the selected branch. It reuses the project inventory and reports a readiness state, blockers, warnings, and next actions for common Web, Flutter, Godot, and Unity layouts. It does not install packages, execute project code, start a browser, dispatch a workflow, or consume Actions quota. A structurally ready result is not evidence that the project runs; engine-specific tests and device verification remain separate approval-gated steps.


## Saving generated Studio artifacts to cloud projects

The MCP tool `forge_studio_artifact_save` commits Design Studio output, Game Lab level JSON, or a bounded set of generated project text files into an existing `forge/projects/*` branch. Every file path is constrained to remain below the selected `project_path`; writes to `main` are rejected. The operation requires explicit `confirm=true`, and existing files require their current SHA from `forge_workspace_read` to prevent stale overwrites. It delegates to the existing atomic batch writer and does not execute code, run tests, dispatch builds, or upload binary assets. After saving, use project inspection/preflight and the branch-aware preview tools as appropriate.


## Persistent per-project context

The MCP tools `forge_project_context_read` and `forge_project_context_save` provide a small Markdown memory file at `workspace/<project>/FORGE_CONTEXT.md` on the isolated project branch. Agents should read it before continuing work and update it with confirmed architecture, user decisions, constraints, setup notes, and TODOs. Saves require explicit confirmation and the current file SHA for updates; the file is limited to 256 KiB and credential-like values/private keys are rejected. Do not store passwords, tokens, private keys, or other secrets in project context. This is repository-backed project documentation, not private model memory.


## Specialist project orchestration

The MCP tool `forge_project_plan` returns a dependency-ordered plan and role contracts for product, architecture, UX, platform engineering, QA, security, and release. It is a deterministic planning tool for the connected conversational model; it does not spawn independent models or execute project work. Approved plans can be saved as `FORGE_PLAN.json` with `forge_project_plan_save`, recovered with `forge_project_plan_read`, and tracked through `forge_project_task_update`. See [specialist planning and project orchestration](SPECIALIST-AGENTS.md) for the lifecycle and approval boundaries.

## Inline interactive preview inside Claude

The Remote MCP Worker exposes a standard MCP Apps UI resource at `ui://forge-os/live-preview.html`, linked to both `forge_preview_url` and `forge_game_preview_url`. In Claude clients with MCP Apps enabled, calling either tool renders an interactive preview directly in the conversation; clients without MCP Apps support retain the existing text/URL result.

- HTML/Web projects are loaded from the committed branch through the existing public preview endpoint.
- The latest successfully deployed Godot/Unity Web export is served through a fixed-origin, build-ID-scoped GitHub Pages proxy so relative engine assets load inside the chat preview.
- The preview app polls HTML project versions every 60 seconds and reloads after a new commit. Game previews use a build-specific URL and are refreshed when Claude calls the game preview tool after a successful deployment.
- Untrusted project HTML runs in a nested sandboxed iframe with scripts enabled but no same-origin access, forms, popups, or top-level navigation. Only the FORGE preview origin is allowed for project network/assets.
- This is a browser/Web export preview, not an Android emulator. Native APK/AAB files still require installation on a device. Single-threaded Godot/Unity Web exports are the baseline; threaded builds requiring cross-origin isolation are not guaranteed.
- Preview reads and proxying do not dispatch GitHub Actions. Any build needed to create a new preview remains approval-gated and consumes the normal build quota.
