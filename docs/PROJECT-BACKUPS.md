# FORGE project backups and recovery

FORGE provides explicit point-in-time Git snapshots for isolated project branches. A snapshot is a new Git branch ref pointing at the exact commit currently checked out by the selected project branch. It does not copy files, create a GitHub Actions artifact, run a build, or use external storage.

## Tools

- `forge_project_backup_create`: create a snapshot of one existing `forge/projects/...` branch. Requires `confirm=true`.
- `forge_project_backup_list`: list snapshots belonging to that exact project branch. Read-only.
- `forge_project_backup_restore`: create a new isolated `forge/projects/...` branch from one selected snapshot. Requires `confirm=true`; the original branch is never rewound or overwritten.
- `forge_project_backup_delete`: delete one exact snapshot ref. Requires `confirm=true`; the live project branch is not affected.

## Retention and naming

- Up to 25 backup refs are retained per project branch.
- Creating a 26th snapshot is refused until an old snapshot is explicitly deleted.
- Backup refs are stored under `forge/backups/<project-fingerprint>/<timestamp>-<id>`. The fingerprint keeps branch names short and avoids collisions between similar project names.
- FORGE never automatically deletes old snapshots. The repository owner can still change or delete Git refs directly in GitHub; backup refs are protected by FORGE's tool behavior, not by a GitHub immutable-storage guarantee.

## Safe recovery procedure

1. Call `forge_project_backup_list` for the affected `forge/projects/...` branch.
2. Select the exact snapshot commit and confirm it is the intended recovery point.
3. Call `forge_project_backup_restore` with a new, unused project branch name.
4. Inspect the new branch with `forge_project_inspect` and `forge_project_preflight`.
5. Preview or test the restored branch as needed. Any build or test run still requires its own explicit authorization.
6. Compare the recovered branch with the current project branch before deciding whether to merge it.

## Scope and limitations

- Backups capture committed Git content at the selected branch head only.
- Uncommitted browser IndexedDB assets, unimported R2 objects, local files, and GitHub Actions artifacts are not included.
- The backup tools do not create a second repository, enable GitHub billing, or consume Actions minutes.
- There is no automatic schedule or background backup. Create a snapshot explicitly before risky edits, major imports, or release preparation.
- Restoring creates a new branch; it does not replace the original branch or automatically merge the restored state.
