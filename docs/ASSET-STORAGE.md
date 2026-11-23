# FORGE external asset storage

FORGE can keep binary assets outside Git history using an optional Cloudflare R2 bucket. This is opt-in: the repository does not create a bucket, enable billing, or configure a paid Cloudflare service automatically.

## Configure the optional binding

1. In Cloudflare Dashboard, create an R2 bucket (for example, `forge-os-assets`). Review the account's current R2 free allowance, storage, operation, and egress terms before use; usage beyond any free allowance may be billable.
2. Open **Workers & Pages → forge-os-remote-mcp → Settings → Bindings**.
3. Add an **R2 bucket** binding with variable name exactly `FORGE_ASSETS_BUCKET` and select the bucket.
4. Save and redeploy the Worker if the dashboard requests it. No bucket credentials or R2 API keys are placed in GitHub.
5. Reload the FORGE-OS Claude connector so it refreshes the MCP tool list.

If the binding is absent, the asset tools return a clear configuration error and do not silently fall back to GitHub.

## Asset tools

- `forge_asset_upload`: upload one base64-encoded binary file to the selected project's external asset namespace. Requires `confirm=true`; maximum decoded size is 16 MiB per call.
- `forge_asset_list`: list up to 1,000 objects for a project (with a cursor when more remain).
- `forge_asset_download_url`: create an HMAC-signed, read-only URL that expires after one hour.
- `forge_asset_delete`: explicitly delete one object; requires `confirm=true`.

Objects are namespaced by isolated project branch and project path. They are not committed to GitHub, included in repository clones, or stored as GitHub Actions artifacts. The signed download endpoint streams the object from R2 and does not expose the bucket publicly. URLs are bearer links: anyone who receives one can download that asset until it expires, so do not post them publicly.

## Important current boundary

External storage is now available as an optional independent asset store, but the build workflows do not yet automatically synchronize R2 assets into a project before compiling. For a build that needs an asset, download it into the project workspace first and commit it to the project branch, or use a future build-sync integration. Do not assume a successful upload alone makes an asset available inside an APK/AAB/Web build.

The current upload API accepts up to 16 MiB per file per call. It does not yet implement resumable multipart uploads, automatic deduplication, lifecycle cleanup, per-user quotas, or multi-tenant isolation. The Worker remains a single-owner service. Monitor R2 usage in Cloudflare and delete unused objects deliberately.
