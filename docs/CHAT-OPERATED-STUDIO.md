# Chat-operated studio: implementation contract

## Goal

Use Claude as the conversational interface while FORGE owns project structure, tool execution, verification, build orchestration, and artifact delivery. The user should not need Unity, Godot, Flutter, Android Studio, or a desktop IDE installed on their phone.

## Current verified boundary

- The static Studio includes Monaco editing, local browser drafts, sandboxed preview, and feature panels. Some feature panels remain lightweight MVP utilities; they must not be described as a full Android emulator, full Unity/Godot editor, unrestricted shell, or real performance profiler.
- The remote MCP Worker provides authenticated, branch-aware project operations, short-lived terminal/cloud execution, build dispatch/status/logs, and artifact metadata/download links.
- Project edits are isolated under `forge/projects/<name>`; direct writes to `main` are blocked. Branch comparison is available for review before a human merges changes.
- GitHub Actions jobs are manually dispatched on temporary hosted runners for Web, Flutter, Godot 4.4.1, and Unity. Each engine has its own supported output and setup requirements documented in [on-demand environments](ON-DEMAND-ENVIRONMENTS.md).
- R2 asset storage is optional. It keeps binary assets outside Git history, but build workflows do not yet synchronize those objects into project folders automatically.
- A workflow definition, scaffold, or local adapter is not evidence of a successful cloud build or device test.

## Required architecture

### 1. Conversational control plane

The deployed single-owner Cloudflare Worker uses stateless Streamable HTTP and bearer-token authentication. It exposes health, isolated branch management, workspace file operations, preview, terminal/cloud execution, build dispatch, status, logs, and artifact links. It is not a multi-user service; do not share its token or connect untrusted users.

### 2. Build plane

Build jobs run in short-lived GitHub-hosted runners and check out the selected project branch. Web, Flutter, Godot, and Unity jobs are manual/on-demand. Artifacts have short retention. Builds must be explicitly authorized, and a dispatch is not a successful build until its run and outputs are inspected.

### 3. External assets

Optional Cloudflare R2 storage keeps large binary assets out of Git history and Actions artifacts. Uploads are explicitly confirmed and scoped to an isolated project branch/path. Build-time synchronization is not implemented yet. Any future integration must authenticate the runner using GitHub OIDC, verify repository/workflow/ref/run claims server-side, scope access to the selected branch/project, issue short-lived read-only access, and avoid passing long-lived secrets or bearer URLs through workflow inputs and logs.

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
