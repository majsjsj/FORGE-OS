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

- `forge_asset_upload`: upload one base64-encoded binary file to the selected project's external asset namespace. Requires `confirm=true`; maximum decoded size is 32 MiB per call.
- `forge_asset_multipart_start`: create a resumable R2 multipart upload and return an `upload_id`.
- `forge_asset_multipart_part`: upload one part (up to 10 MiB decoded) and return its `etag`. Use sequential part numbers starting at 1. Set `is_last_part=true` only on the final part. R2 requires every non-final part to be at least 5 MiB; use 8 MiB parts for a safe default and a smaller final part if needed.
- `forge_asset_multipart_complete`: finalize the object using the exact ordered part-number/etag pairs returned by the part tool.
- `forge_asset_multipart_abort`: explicitly discard an incomplete upload.
- `forge_asset_list`: list up to 1,000 objects for a project (with a cursor when more remain).
- `forge_asset_download_url`: create an HMAC-signed, read-only URL that expires after one hour.
- `forge_asset_import`: explicitly copy one selected R2 asset into the matching `workspace/` path on the isolated project branch. Requires `confirm=true`, refuses to overwrite existing files, and supports up to 16 MiB per imported file. After import, the asset is part of the Git project and can be included in the next explicitly requested build.
- `forge_asset_delete`: explicitly delete one object; requires `confirm=true`.

Objects are namespaced by isolated project branch and project path. They are not committed to GitHub, included in repository clones, or stored as GitHub Actions artifacts. The signed download endpoint streams the object from R2 and does not expose the bucket publicly. URLs are bearer links: anyone who receives one can download that asset until it expires, so do not post them publicly.

## Important current boundary

External storage remains an optional independent asset store; builds do not automatically synchronize every R2 object. To include an uploaded asset in a build, explicitly call `forge_asset_import` for that file. The tool commits the binary into the selected isolated project branch under `workspace/`; the next explicitly requested build can then package it. A successful upload alone does not make the asset available inside an APK/AAB/Web build.

The single-request upload API accepts up to 32 MiB per file per call. Larger files can use R2 multipart uploads: start once, upload sequential parts, then complete with the returned etags. Keep the `upload_id` and etags until completion; if an upload is no longer needed, call the abort tool. Incomplete multipart uploads may remain billable until aborted or removed by an owner-configured R2 lifecycle rule. The implementation does not yet provide automatic deduplication, automatic lifecycle cleanup, per-user quotas, or multi-tenant isolation. The Worker remains a single-owner service. Monitor R2 usage in Cloudflare and delete unused objects deliberately.
