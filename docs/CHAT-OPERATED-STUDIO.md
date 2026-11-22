# Chat-operated studio: implementation contract

## Goal
Use Claude as the conversational interface while FORGE owns project structure, tool execution, verification, build orchestration, and artifact delivery. The user should not need Unity, Godot, Flutter, Android Studio, or a desktop IDE installed on their phone.

## Current verified boundary
- The repository includes a local stdio MCP server and Claude Code configuration.
- The on-demand GitHub Actions workflow supports Web checks, Flutter analyze/test plus unsigned APK/AAB builds, Godot headless import and configured Web/Linux exports, and Unity Linux builds gated by a license secret.
- The mobile adapters can invoke Flutter, Gradle, Godot, and Unity when those toolchains are installed in the execution environment.
- A project template or local adapter is not evidence of a successful cloud build.
- The repository now contains a deployable single-owner Cloudflare Worker remote MCP controller and a manual deployment workflow. It is not live until the owner adds Cloudflare/GitHub repository secrets and runs that deployment workflow.
- The controller can edit text files under workspace/, dispatch manual GitHub Actions builds, inspect runs, and return a public read-only interactive preview URL for committed HTML entry files under workspace/. It can also return the latest Godot/Unity Web build URL after the workflow successfully deploys that build to GitHub Pages. The preview gateway proxies only files from the public repository's main branch and supports relative assets and WebAssembly. It is not an arbitrary process runner, a multi-user workspace service, or a per-user secrets vault.

## Required architecture

### 1. Conversational control plane
The first implementation is a single-owner Cloudflare Worker using stateless Streamable HTTP and a bearer token. It exposes workspace text-file operations, build dispatch, build status, logs, artifact metadata, and temporary signed ZIP download URLs. The owner must deploy it and connect it as a Claude custom connector; the local `.mcp.json` stdio entry remains useful for Claude Code. Multi-user OAuth and tenant identity mapping are not implemented.

### 2. Build plane
Build jobs run in short-lived GitHub-hosted runners and check out committed project files from the repository's main branch. They return a run ID, logs, test summaries, and short-lived artifacts. The controller does not yet upload uncommitted browser drafts or create isolated per-project snapshots. Godot Android APK/AAB and Web export jobs are now defined; AAB requires the project's Gradle template, matching export preset, and secure signing secrets. Unity Android APK/AAB and WebGL jobs are now defined and require a valid Unity license; AAB also requires signing secrets. These workflow edits are not yet verified by a cloud build. Flutter APK/AAB builds are unsigned.

### 3. Tenant isolation and secret vault
Every user and project must have an authenticated tenant ID. Secret reads and writes must be authorized server-side for that tenant and project. Encrypt secrets at rest using a managed key or envelope-encryption design; redact values from logs; pass secrets to jobs only at runtime. Do not put credentials in Git, project prompts, ordinary chat, workflow artifacts, or public issue threads.

Signing keys, passwords, AdMob account credentials, and payment-provider secrets require a secure upload/entry flow. Public AdMob app/ad unit IDs are configuration, not a substitute for protecting account credentials. Payment card data must remain with a compliant hosted checkout/provider; FORGE must not collect PAN or CVV.

### 4. Approval policy
Require explicit user confirmation before signing a release, publishing to a store, enabling live ads or payment flows, accessing external accounts, or using any service that may incur charges. Debug builds and test IDs are the default.

### 5. AI and quality
Claude is the initial reasoning engine. Keep the model adapter interface provider-neutral so a future FORGE model can be added without changing studio workflows. Vision QA must use an actual vision-capable model for semantic inspection; pixel diffs are supplemental only. Automated repair must be bounded, test-driven, and report every attempt.

## Delivery gates
1. Flutter cloud APK built, downloaded, installed, and smoke-tested.
2. MCP remote control deployed; create/edit/test/build/status/artifact flow verified from a phone.
3. Godot cloud Android APK and signed AAB export built and verified; Web export opened interactively through the preview gateway.
4. Authenticated tenant isolation and encrypted secret vault tested with two separate users.
5. Unity Android APK/AAB and WebGL export verified under a compliant license and a no-surprise-cost policy.
6. Remote interactive preview tested on a phone with an HTML project and a Godot/Unity Web export.
7. Release signing, ads, and payment integrations added only after secure secret entry and approval gates pass.

## Free-first constraints
Keep the repository public and do not add a paid dependency or paid runner. Free quotas are limited and can change; the system must surface quota limits and fail closed rather than silently switching to paid infrastructure. No unlimited-free-build promise is made.
