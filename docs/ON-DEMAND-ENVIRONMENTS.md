# FORGE-OS on-demand environments

## Design principle
No persistent build server. A user/agent starts a short-lived GitHub Actions job only when a project needs checks or a build. Jobs run on GitHub-hosted ephemeral runners, have timeouts, read-only repository access, short artifact retention, and stop after completion. This reduces idle usage; it does not make Actions unlimited or guarantee a free quota.

## Environments

- **VS Code**: open the repository in GitHub Codespaces or a compatible Dev Container host. The checked-in `.devcontainer` provides Python, Node.js, Git, common native build utilities, and recommended editor extensions. This is a reproducible development container definition, not a permanently hosted VS Code server. Codespaces availability and billing depend on the user's account; do not start a paid Codespace without approval.
- **Web**: manual workflow job validates a project and runs available npm tests/builds or checks a static entry point.
- **Flutter**: manual workflow installs Java 17 and Flutter stable on a temporary runner, runs analyze/tests, and optionally exports an unsigned APK/AAB.
- **Godot**: manual workflow downloads a pinned Godot headless editor, imports/checks a project, and can export only when the project contains a matching export preset and the required export templates. Android export additionally needs Android SDK/JDK configuration and is not claimed as ready by this workflow.
- **Unity**: manual workflow uses GameCI on a temporary runner. It fails closed unless an authorized Unity license is supplied as the `UNITY_LICENSE` repository secret. The target is Linux standalone; Android/iOS targets require further module, signing, license, and export validation.

## Dispatch
GitHub Actions → **FORGE On-Demand Engine Jobs** → Run workflow. Select an engine, project path inside the repository, and output. Never put shell commands or secrets in the project path. Only run builds for source you trust because build systems execute project code.

## AI operation contract
An agent must:
1. Inspect the project manifest and choose exactly one engine job.
2. Explain any required setup or possible quota use before dispatch.
3. Dispatch only after the user explicitly requests a build/test or has authorized that action.
4. Poll the run and inspect logs/results.
5. Return only verified artifact links and test outcomes.
6. Never silently switch to a paid runner, cloud VM, or hosted service.

## Important boundaries
- GitHub Actions runners are ephemeral compute, not a persistent interactive terminal or a full remote IDE.
- The browser Monaco workspace remains a lightweight editor/preview, not VS Code.
- Unity licensing and runner quotas are external constraints.
- A remote MCP gateway, phone-to-workflow dispatcher, per-user project isolation, and encrypted per-user secrets vault are not included by this workflow alone.
