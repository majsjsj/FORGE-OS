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
- `forge_asset_import`: explicitly copy one selected R2 asset into the matching `workspace/` path on the isolated project branch. Requires `confirm=true`, refuses to overwrite existing files, and supports up to 16 MiB per imported file. After import, the asset is part of the Git project and can be included in the next explicitly requested build. The tool also records its SHA-256 in `forge-assets-manifest.json` for pre-build verification.
- `forge_asset_import_batch`: explicitly stage 1–20 selected R2 assets into one atomic Git commit on the isolated project branch. Each file is limited to 16 MiB and the total batch to 24 MiB. It validates every destination before creating the commit, rejects duplicate paths and existing project files, and never overwrites. It also creates or updates `forge-assets-manifest.json` with each imported file's relative path, byte size, content type, and SHA-256 digest. Requires `confirm=true`.
- `forge_asset_delete`: explicitly delete one object; requires `confirm=true`.

Objects are namespaced by isolated project branch and project path. They are not committed to GitHub, included in repository clones, or stored as GitHub Actions artifacts. The signed download endpoint streams the object from R2 and does not expose the bucket publicly. URLs are bearer links: anyone who receives one can download that asset until it expires, so do not post them publicly.

## Important current boundary

External storage remains an optional independent asset store; builds do not automatically synchronize R2 objects, and GitHub Actions runners do not have direct access to the Worker’s R2 binding. To include uploaded assets in a build, first review `forge_asset_list`, then explicitly call `forge_asset_import` for one file or `forge_asset_import_batch` for a selected group. The import tool commits the binaries into the selected isolated project branch under `workspace/`; the next separately authorized build can then package them. A successful upload alone does not make an asset available inside an APK/AAB/Web build. Batch staging is a deliberate pre-build step, not an automatic background sync.

### Optional GitHub Actions OIDC sync\n\nThe on-demand workflow supports `sync_assets` (default `false`) and a newline-separated `asset_paths` list. Dispatch the workflow from `main`, set `project_branch` to the target isolated `forge/projects/...` branch, and select only the exact R2 object paths needed for that run. The dedicated `sync-assets` job has the only `id-token: write` permission and does not check out or execute project code. The Worker verifies the RS256 GitHub OIDC signature, issuer, audience, repository, `workflow_dispatch` event, `main` ref, exact workflow identity, and matching active run before issuing per-object download URLs that expire after five minutes. Only requested paths are returned; limits are 20 files, 16 MiB per file, and 24 MiB total. The sync job verifies each download SHA-256 and transfers the staged files as a one-day GitHub Actions artifact. The selected engine job refuses to overwrite existing project files, merges new entries into the project manifest, and runs the normal pre-build verifier. No permanent R2 credentials are exposed to the runner. This does not create a bucket, enable billing, or start a build by itself. Keep `sync_assets=false` unless the user explicitly selects assets for that run.\n\nThe single-request upload API accepts up to 32 MiB per file per call. Larger files can use R2 multipart uploads: start once, upload sequential parts, then complete with the returned etags. Keep the `upload_id` and etags until completion; if an upload is no longer needed, call the abort tool. Incomplete multipart uploads may remain billable until aborted or removed by an owner-configured R2 lifecycle rule. The implementation does not yet provide automatic deduplication, automatic lifecycle cleanup, per-user quotas, or multi-tenant isolation. The Worker remains a single-owner service. Monitor R2 usage in Cloudflare and delete unused objects deliberately.


## Recommended pre-build asset staging

1. Confirm that the optional `FORGE_ASSETS_BUCKET` binding is configured; if it is absent, keep assets in the local browser library or project repository instead.
2. Call `forge_asset_list` for the exact project branch and directory, and inspect the returned paths and sizes. Follow the returned cursor if the listing is truncated.
3. Select only the files needed by the project. Use `forge_asset_import_batch` for up to 20 files / 24 MiB total, or the single-file import for a file up to 16 MiB. Confirm the destination paths and that no existing project file will be overwritten.
4. Verify the new commit and inspect the project files. Only then, if the user separately requests it, dispatch the required engine build.

The batch operation validates all selected objects and destinations before committing. It creates one Git tree and one commit for the whole batch, including the updated integrity manifest; if validation or object retrieval fails, the project branch is not advanced. When a later engine workflow checks out the project, a shared pre-build step verifies every manifest path, size, and SHA-256 before tests or packaging. Projects without a FORGE asset manifest are unaffected. Unreferenced Git blobs may exist if GitHub accepts some blob uploads but a later API operation fails; they are not reachable from the project branch. The operation does not create an R2 bucket, change billing, start a build, or delete the source R2 objects.


## Asset integrity verification in builds

Assets staged with `forge_asset_import_batch` are recorded in `workspace/<project>/forge-assets-manifest.json`. The manifest is scoped to the exact isolated branch and project path. Each selected engine job (Web, Flutter, Godot, Unity) runs the shared `verify-forge-assets` action immediately after checkout. If the manifest exists, the action rejects unsafe paths, missing files, symlinks, size mismatches, duplicate entries, branch/project mismatches, and SHA-256 mismatches before engine setup or project execution. If no manifest exists, the step exits successfully without changing the project. This is an integrity check, not a digital signature or malware scan. Single-file `forge_asset_import` now adds entries to this manifest. The optional OIDC workflow sync also writes manifest entries and verifies them before engine execution.
