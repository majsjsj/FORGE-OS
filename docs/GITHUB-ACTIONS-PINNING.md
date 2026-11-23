# GitHub Actions dependency pinning

All external actions referenced by the workflows in this repository are pinned to full 40-character commit SHAs rather than movable version tags.

## Verification basis

Each SHA was resolved from the corresponding upstream repository's Git reference for the version tag used by FORGE-OS on 2026-11-23. Annotated tags were dereferenced to their target commit before pinning. The pinned versions are:

| Action | Version tag | Commit SHA |
|---|---|---|
| actions/checkout | v4 | 11d5960a326750d5838078e36cf38b85af677262 |
| actions/setup-node | v4 | 49933ea5288caeca8642d1e84afbd3f7d6820020 |
| actions/setup-python | v5 | a26af69be951a213d495a4c3e4e4022e16d87065 |
| astral-sh/setup-uv | v4 | 38f3f104447c67c051c4a08e39b64a148898af3a |
| actions/configure-pages | v5 | 983d7736d9b0ae728b81ab479565c72886d7745b |
| actions/github-script | v7 | f28e40c7f34bde8b3046d885e986cb6290c5673b |
| actions/upload-pages-artifact | v3 | 56afc609e74202658d3ffba0e8f6dda462b719fa |
| actions/deploy-pages | v4 | d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e |
| actions/setup-java | v4 | cf277c60eb25467037889841efdb72551f06f6c3 |
| subosito/flutter-action | v2 | 1a449444c387b1966244ae4d4f8c696479add0b2 |
| actions/upload-artifact | v4 | ea165f8d65b6e75b540449e92b4886f43607fa02 |
| actions/download-artifact | v4 | d3f86a106a0bac45b974a628896c90dbdf5c8093 |
| game-ci/unity-test-runner | v4 | 32e57712352b500e17974b245a6dce9e11a73213 |
| game-ci/unity-builder | v4 | 4423ee75828dff56037d1d1cfdac6b68e3a6ba00 |
| actions/attest | v4 | 1e69f48acb82d1966a394da916b4c1698aa569d6 |

The repository-local asset verification action was already pinned to a full commit SHA.

## CI enforcement\n\nThe test workflow runs `scripts/verify_actions_pinned.py` against both `.github/workflows/` and `.github/actions/`. It allows repository-local `./...` actions and requires every external action or reusable workflow reference to end in a full 40-character hexadecimal commit SHA. A regression to a movable tag or branch therefore fails CI.\n\n## Maintenance

Dependabot remains configured to check GitHub Actions weekly. Review each update as a dependency change: verify the upstream release and commit, inspect breaking changes, and run the relevant workflow checks before merging. Do not automatically upgrade major versions just to refresh a pin.

## Scope

Pinning makes the referenced action source immutable for a workflow run. It does not prove that the action is vulnerability-free, and it does not automatically pin tools or dependencies downloaded by the action itself.
