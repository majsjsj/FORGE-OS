# FORGE Remote MCP Controller

This is the first remote-control layer for FORGE-OS. It is a stateless Streamable HTTP MCP endpoint intended for Claude custom connectors. It starts only explicitly requested GitHub Actions jobs; it does not keep a build server running.

## Current scope

- Authenticated MCP endpoint at `/mcp` using a dedicated bearer token.
- Health check.
- Read/list/create/update text files inside `workspace/` through GitHub Contents API commits.
- Manual dispatch of the repository's `forge-on-demand.yml` workflow.
- Latest build status, job/step summaries, artifact metadata, bounded job-log retrieval, and temporary signed artifact download URLs.
- Strict engine/output allowlists, path restrictions, blocked credential-file names, and explicit confirmation flags.
- GitHub token and access token are runtime secrets, never repository files.

This is a **single-owner controller**, not yet a multi-user service. Do not share its bearer token or connect untrusted users. It can create and update text files as commits under `workspace/`; it does not yet upload binary project assets, sync uncommitted browser drafts, download artifact bytes, sign apps, or provide a per-user secret vault.

## Deploy on the Cloudflare Workers free plan

Cloudflare account and free-plan limits apply; check current limits before use. No paid service is enabled by this repository. Deployment is manual-only and uses one short GitHub Actions run; it does not run on every commit.

1. Create a Cloudflare account and open **Manage Account → API Tokens → Create Token**.
2. Choose the **Edit Cloudflare Workers** template and restrict it to the one account that will host FORGE. Cloudflare may require account-level permission to create the first Worker; follow the current Cloudflare token wizard. See the [official GitHub Actions deployment guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).
3. Copy the Cloudflare account ID from the Workers dashboard.
4. Create a GitHub fine-grained personal access token scoped only to `majsjsj/FORGE-OS` with:
   - Actions: Read and write
   - Contents: Read and write
   Do not grant administration, secrets, or unrelated repository access.
5. Generate a separate random `FORGE_ACCESS_TOKEN` with at least 32 characters. Keep it private.
6. In GitHub, open **Settings → Secrets and variables → Actions → New repository secret**. Add these four secrets exactly:
   - `CLOUDFLARE_API_TOKEN` — the Cloudflare Workers deployment token
   - `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID
   - `FORGE_GITHUB_TOKEN` — the fine-grained GitHub token from step 4
   - `FORGE_ACCESS_TOKEN` — the random access token from step 5
7. Open [Deploy FORGE Remote MCP](https://github.com/majsjsj/FORGE-OS/actions/workflows/deploy-remote-mcp.yml), select **Run workflow**, and run it on `main`.
8. Wait for the run to finish successfully. Its log will show the deployed `workers.dev` hostname. The MCP URL is that hostname plus `/mcp`; for example `https://forge-os-remote-mcp.<your-workers-subdomain>.workers.dev/mcp`.
9. The workflow uploads `FORGE_GITHUB_TOKEN` and `FORGE_ACCESS_TOKEN` to Cloudflare as encrypted Worker secrets. It does not print their values.

If the first deployment fails because the API token cannot create a new Worker, use the minimum Cloudflare permission required by its current dashboard/API for initial creation, then narrow the token to Editor access for the existing Worker where supported. Never put credentials in repository files or chat messages.

## Connect Claude

On Claude web, open **Customize → Connectors → Add → Custom → Web** (wording may vary). Enter the Worker URL ending in `/mcp`. Choose fixed request-header authentication and configure:

- Header: `Authorization`
- Value: `Bearer <FORGE_ACCESS_TOKEN>`

Save and connect. Once connected on Claude web, enable the connector in a mobile conversation from the **+ → Connectors** menu. Claude mobile may not offer direct creation of a custom connector; create it on the web first.

## Use safely

- First call `forge_health`.
- Use `forge_workspace_list`, `forge_workspace_read`, and `forge_workspace_write` to create/edit files in `workspace/<project>`. Writes create commits on `main`; updates require the current blob SHA returned by read. Files must be text and no larger than 500 KB.
- The controller does not yet sync uncommitted browser-editor drafts or create isolated branches per project.
- Ask for a build/test explicitly. Only then call `forge_dispatch_build` with `confirm=true`.
- Poll `forge_latest_build` or inspect `forge_build_details`; retrieve logs with `forge_build_logs` if needed.
- Use `forge_artifact_download` with an artifact ID from build details to obtain a temporary ZIP download link. Download links expire; artifacts are retained for only three days.
- A dispatch response means GitHub accepted the request, **not** that the build passed.
- Unity currently supports only Linux output and still requires the repository's `UNITY_LICENSE` secret. Godot cloud Android export is not enabled. Flutter APK/AAB output is unsigned.
- GitHub Actions quotas apply. The controller never switches to paid runners.
- Revoke the GitHub token and rotate `FORGE_ACCESS_TOKEN` immediately if exposed.

## Protocol notes

The Worker implements the stateless JSON response mode of MCP Streamable HTTP for initialize, notifications, ping, tools/list, and tools/call. It intentionally does not implement OAuth, multiple tenants, durable sessions, resource APIs, branch isolation, or artifact binary transfer yet. Keep the Worker updated and review its code before connecting it to an account with write permissions.
