# FORGE Remote MCP Controller

This is the first remote-control layer for FORGE-OS. It is a stateless Streamable HTTP MCP endpoint intended for Claude custom connectors. It starts only explicitly requested GitHub Actions jobs; it does not keep a build server running.

## Current scope

- Authenticated MCP endpoint at `/mcp` using a dedicated bearer token.
- Health check.
- Read/list/create/update text files inside `workspace/` through GitHub Contents API commits.
- Manual dispatch of the repository's `forge-on-demand.yml` workflow.
- Latest build status, job/step summaries, artifact metadata, and bounded job-log retrieval.
- Strict engine/output allowlists, path restrictions, blocked credential-file names, and explicit confirmation flags.
- GitHub token and access token are runtime secrets, never repository files.

This is a **single-owner controller**, not yet a multi-user service. Do not share its bearer token or connect untrusted users. It does not yet upload project files, create commits, download artifact bytes, sign apps, or provide a per-user secret vault.

## Deploy on the Cloudflare Workers free plan

Cloudflare account and free-plan limits apply; check current limits before use. No paid service is enabled by this repository.

1. Install Node.js 22+ on a computer or use a trusted browser-based development environment.
2. Clone this repository and run:
   `cd remote-mcp && npm install`
3. Create a fine-grained GitHub token scoped only to `majsjsj/FORGE-OS` with:
   - Actions: Read and write
   - Contents: Read and write
   Do not grant administration, secrets, or unrelated repository access.
4. Deploy the Worker:
   `npx wrangler login`
   `npx wrangler deploy`
5. Add secrets without putting them in source control:
   `npx wrangler secret put GITHUB_TOKEN`
   Paste the fine-grained token into the secure terminal prompt.
   Generate a separate random secret of at least 32 characters, then:
   `npx wrangler secret put FORGE_ACCESS_TOKEN`
   Never paste either secret into Claude chat or commit them to Git.
6. The deployed endpoint will be:
   `https://forge-os-remote-mcp.<your-workers-subdomain>.workers.dev/mcp`
7. Test the protected health endpoint:
   `curl -H "Authorization: Bearer <FORGE_ACCESS_TOKEN>" https://<worker-host>/health`

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
- A dispatch response means GitHub accepted the request, **not** that the build passed.
- Unity currently supports only Linux output and still requires the repository's `UNITY_LICENSE` secret. Godot cloud Android export is not enabled. Flutter APK/AAB output is unsigned.
- GitHub Actions quotas apply. The controller never switches to paid runners.
- Revoke the GitHub token and rotate `FORGE_ACCESS_TOKEN` immediately if exposed.

## Protocol notes

The Worker implements the stateless JSON response mode of MCP Streamable HTTP for initialize, notifications, ping, tools/list, and tools/call. It intentionally does not implement OAuth, multiple tenants, durable sessions, resource APIs, branch isolation, or artifact binary transfer yet. Keep the Worker updated and review its code before connecting it to an account with write permissions.
