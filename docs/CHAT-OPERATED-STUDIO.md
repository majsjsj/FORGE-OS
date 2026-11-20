# Chat-operated studio: implementation contract

## Goal
Use Claude as the conversational interface while FORGE owns project structure, tool execution, verification, build orchestration, and artifact delivery. The user should not need Unity, Godot, Flutter, Android Studio, or a desktop IDE installed on their phone.

## Current verified boundary
- The repository includes a local stdio MCP server and Claude Code configuration.
- The current cloud Android workflow is manually started from GitHub Actions and builds Flutter only.
- The mobile adapters can invoke Flutter, Gradle, Godot, and Unity when those toolchains are installed in the execution environment.
- A project template or local adapter is not evidence of a successful cloud build.
- The repository now contains a deployable single-owner Cloudflare Worker remote MCP controller and a manual deployment workflow. It is not live until the owner adds Cloudflare/GitHub repository secrets and runs that deployment workflow.
- The controller can edit text files under workspace/, dispatch manual GitHub Actions builds, and inspect runs. It is not a multi-user workspace service and has no per-user secrets vault.

## Required architecture

### 1. Conversational control plane
A hosted MCP service must expose authenticated project operations, build dispatch, build status, logs, and artifact retrieval. It must use a supported remote MCP transport and an explicit user-to-tenant identity mapping. The current `.mcp.json` stdio entry remains useful for Claude Code, but is not a mobile remote connection.

### 2. Build plane
Build jobs run in isolated, short-lived workers. Each job receives only the selected project snapshot and the minimum required secret handles. It returns a build ID, structured logs, test results, and verified artifacts. Flutter is the first cloud engine. Godot must pass a real Android export test before being advertised as cloud-supported. Unity must additionally pass license activation and Android build tests without enabling paid infrastructure by default.

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
3. Godot cloud Android export built and verified.
4. Authenticated tenant isolation and encrypted secret vault tested with two separate users.
5. Unity cloud export verified under a compliant license and a no-surprise-cost policy.
6. Release signing, ads, and payment integrations added only after secure secret entry and approval gates pass.

## Free-first constraints
Keep the repository public and do not add a paid dependency or paid runner. Free quotas are limited and can change; the system must surface quota limits and fail closed rather than silently switching to paid infrastructure. No unlimited-free-build promise is made.
