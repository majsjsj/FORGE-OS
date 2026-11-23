# FORGE Remote MCP Controller

The deployed Cloudflare Worker is a stateless Streamable HTTP MCP endpoint for Claude custom connectors. It starts GitHub Actions jobs only when explicitly requested; it does not keep a build server running.

## Current scope

- Authenticated MCP endpoint at `/mcp` using a dedicated bearer token.
- Health check and isolated project branch lifecycle: create/list/compare branches under `forge/projects/<name>`.
- Branch-aware workspace list/read/inspect/write/batch-write/preview/build operations. Direct writes to `main` are blocked.
- Manual dispatch of the repository's `forge-on-demand.yml` workflow.
- Short one-shot commands through `forge_terminal_run` (up to 180 seconds) and temporary cloud sessions through `forge_cloud_run` (up to 10 minutes). Cloud sessions run without repository secrets; optional saving uses a separate job that saves only changed files to the same isolated branch.
- Build status, job/step summaries, artifact metadata, bounded job-log retrieval, and temporary signed artifact download URLs.
- Optional Cloudflare R2 asset tools: single uploads up to 32 MiB and resumable multipart uploads. R2 is unavailable until the owner configures the optional `FORGE_ASSETS_BUCKET` binding.

The controller is single-owner, not a multi-user service. Do not share its bearer token or connect untrusted users. It does not provide tenant isolation or a per-user secret vault.

## Repository and resource limits

- Single text-file write: up to 4 MB.
- Atomic batch write: up to 150 files, 4 MB per file, and 20 MB total.
- Cloud-session save: up to 250 changed paths and 75 MB total.
- R2 single-request upload: up to 32 MiB per object. Larger objects use sequential multipart uploads (up to 10 MiB per part; non-final parts must be at least 5 MiB).
- Asset download URLs expire after one hour. Treat them as bearer links and do not post them publicly.
- GitHub Actions artifacts are retained for three days by the current build workflow.

Limits are enforced by the service; they are not promises of unlimited storage or execution. Keep binary assets out of Git history when optional external storage is configured.

## Deploy and connect

The Worker is deployed separately from the static Studio. Deployment credentials remain Cloudflare/GitHub secrets and must never be placed in repository files or chat. To rotate or redeploy it, use the repository's manual **Deploy FORGE Remote MCP** workflow and the existing Cloudflare Worker configuration.

On Claude web, add a custom connector using the deployed Worker URL ending in `/mcp`. Configure fixed request-header authentication:

- Header: `Authorization`
- Value: `Bearer <FORGE_ACCESS_TOKEN>`

Save and connect. Once connected on Claude web, enable the connector in a mobile conversation from the **+ → Connectors** menu (wording may vary).

## Safe operating contract

1. Call `forge_health` first.
2. Create or select an isolated project branch before editing project files.
3. Inspect the branch and use current file SHAs for updates. Batch writes are atomic and reject stale versions.
4. Treat terminal/cloud execution as code execution. Never pass credentials in commands; command text may appear in logs.
5. Cloud-session changes are discarded by default. Save only when explicitly requested.
6. Ask before dispatching any build/test. Use `confirm=true` only after the user explicitly authorizes that specific run.
7. A dispatch response means GitHub accepted the request, not that the build passed. Inspect run status and logs.
8. Return only verified artifact links. Temporary download URLs expire; artifacts are short-lived.
9. Never switch to paid runners, persistent VMs, or paid storage without explicit approval.

## Optional external asset storage

See [Asset Storage](ASSET-STORAGE.md) to configure the optional R2 binding. The bucket is not created automatically and may incur charges beyond Cloudflare's current free allowance. Uploaded R2 assets are not yet automatically synchronized into project build folders; upload alone does not make an asset part of an APK/AAB/Web build.

## Capability boundaries

The Worker is not a persistent terminal, full remote IDE, Android emulator, or multi-tenant workspace. GitHub-hosted jobs are temporary runners. The service does not automatically merge project branches, publish to app stores, or sign releases without the required project configuration and secrets.
