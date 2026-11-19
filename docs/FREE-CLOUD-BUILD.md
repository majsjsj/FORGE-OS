# FORGE Cloud Build (free-first)

FORGE can build a Flutter Android package on a GitHub-hosted runner. Your phone is only the control/download device; Flutter and the Android build toolchain run in GitHub Actions.

## Current support

- Flutter Android APK: supported by this workflow.
- Flutter Android AAB: supported by this workflow.
- Godot and Unity: not enabled in this workflow yet. They need separate verified export/licensing setup.
- The workflow is manual-only (workflow_dispatch); it does not run on every push.
- No signing secrets, cloud VM, paid API, or billing integration is configured.

## Prepare a project

1. Add a Flutter project to this repository, for example at workspace/mobile-app.
2. Ensure that folder contains pubspec.yaml and lib/main.dart.
3. Open the repository's Actions tab.
4. Select FORGE Cloud Build and press Run workflow.
5. Enter the project path, choose apk or aab, then run it.
6. When the run succeeds, open its Artifacts section and download the ZIP. Extract it on your phone.

If the Flutter project does not contain an android/ directory, the workflow generates the Android platform files in the temporary runner workspace. Those generated files are not committed back to the repository.

## Safety and cost controls

- The workflow accepts only a relative path to an existing directory inside the checked-out repository and requires pubspec.yaml.
- It never accepts or executes a user-supplied shell command.
- It has read-only repository permissions and does not receive signing secrets.
- The job timeout is 35 minutes and artifact retention is 7 days.
- Building third-party or untrusted Flutter source executes project build tooling. Use only source you trust. Public repositories are visible to everyone; do not store passwords, API keys, signing keys, or private data in them.
- GitHub Actions usage is subject to GitHub's current plan limits and fair-use rules. No paid service is enabled by FORGE; check account billing settings and usage before relying on a free allowance.

## Known limitations

This produces an unsigned release APK/AAB unless a separate signing configuration is deliberately added. It does not publish to Google Play and does not integrate live AdMob ads. Those steps require separate credentials and explicit setup.
