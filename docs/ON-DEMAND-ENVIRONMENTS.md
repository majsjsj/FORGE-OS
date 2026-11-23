# FORGE-OS on-demand environments

## Design principle

No persistent build server. A user/agent starts a short-lived GitHub Actions job only when a project needs checks or a build. Jobs use GitHub-hosted ephemeral runners, bounded timeouts, and short artifact retention. This reduces idle usage; it does not make Actions unlimited or guarantee a free quota.

## Available engine jobs

| Engine | Supported outputs | Important requirements |
|---|---|---|
| Web | `test`, `web` | Node.js 22; npm tests/build scripts when present. Web output packages deployable site files only. |
| Flutter | `test`, `apk`, `aab` | Flutter 3.50.1 and Java 17. Runs analyze and available tests. Android SDK must be present on the runner. AAB signing must be verified for the target project before store release. |
| Godot 4.4.1 | `test`, `apk`, `aab`, `web`, `linux` | Headless editor/import and matching export presets/templates. Android exports install SDK/NDK/CMake components. APK is a debug export; AAB requires the Android Gradle template, matching preset, and release-signing secrets. |
| Unity | `test`, `apk`, `aab`, `web`, `linux` | Valid Unity project and `UNITY_LICENSE` secret. Android AAB additionally requires Android keystore secrets and custom-keystore project settings. WebGL compression is adjusted for the Pages preview. |

The workflow checks project paths and fails closed when required project files, presets, licenses, or signing configuration are missing. A workflow definition is not proof that a particular project has built successfully; verify each requested run and artifact.

## Dispatch

GitHub Actions → **FORGE On-Demand Engine Jobs** → Run workflow. Select exactly one engine, a project path inside the repository, an output supported by that engine, and optionally the isolated project branch. Never put shell commands or secrets in the project path. Only build source you trust because build systems execute project code.

The remote MCP controller can dispatch the same workflow after explicit confirmation. A successful dispatch response only means GitHub accepted the request.

## Artifacts and usage

Build artifacts are retained for three days by the current workflow. Web checks do not upload the source project as an artifact; web output packages only deployable site content. Other engine outputs upload their build output directories. Every run consumes Actions quota and may be subject to account limits or billing. The controller does not switch to paid runners automatically.

## AI operation contract

An agent must:
1. Inspect the project manifest, export presets, and required secrets/configuration.
2. Choose exactly one appropriate engine job.
3. Explain expected quota use and missing setup before dispatch.
4. Dispatch only after the user explicitly requests that specific build/test.
5. Poll the run and inspect job logs/results.
6. Return only verified artifact links and test outcomes.
7. Stop after a failure unless the user authorizes another attempt.

## Important boundaries

- GitHub Actions runners are ephemeral compute, not a persistent interactive terminal or full remote IDE.
- The browser Monaco workspace is a lightweight editor/preview, not VS Code.
- A headless Godot export is not the Godot editor UI; Unity build jobs do not provide an interactive Unity Editor session.
- No Android emulator or physical-device smoke test is implied by a successful APK/AAB export.
- No paid runner, VM, Codespace, or storage service may be activated without approval.
