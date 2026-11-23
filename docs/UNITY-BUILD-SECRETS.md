# Unity build secrets: isolation and approval plan

## Current risk

The `unity` job in `.github/workflows/forge-on-demand.yml` currently exposes the repository-level `UNITY_LICENSE` secret to GameCI test/build actions. Android AAB builds also receive the Android keystore and passwords. Unity editor scripts, packages, plugins, and project build callbacks execute as part of a Unity build and must be treated as project-controlled code. A malicious or compromised project dependency could therefore attempt to read or exfiltrate credentials available to that job.

The workflow currently uses a GitHub-hosted runner and checks out the selected project branch. `persist-credentials: false` is already set on checkout, but that does not protect secrets explicitly passed to the Unity process.

## Required protected-environment migration

Do this as a coordinated change. Do not delete the existing repository secrets until the workflow has been changed to reference the environment and the environment secrets have been verified.

1. In the repository, open **Settings → Environments → New environment**.
2. Create an environment named exactly `forge-unity-build`.
3. Configure **Required reviewers** and enable **Prevent self-review** where available. Restrict deployment branches/tags to the trusted `main` branch if the workflow dispatch design remains main-only.
4. Add these environment secrets using the exact existing names:
   - `UNITY_LICENSE`
   - `ANDROID_KEYSTORE_BASE64`
   - `ANDROID_KEYSTORE_PASS`
   - `ANDROID_KEYALIAS_NAME`
   - `ANDROID_KEYALIAS_PASS`
5. Only after the workflow's Unity job has `environment: forge-unity-build`, run an explicitly approved Unity job and confirm that approval is required and the job can read the secrets without printing them.
6. After successful verification, delete the duplicate repository-level copies of those five secrets. Keeping repository-level copies means they remain available to any eligible workflow and defeats the intended boundary.

**Important:** Creating an environment alone does not protect anything. Required reviewers must be configured in the GitHub UI, and the job must reference the environment. A workflow-created environment may have no protection rules. Environment secrets are additive; they do not override or remove repository secrets.

## Planned workflow change (not yet applied)

Add this job-level setting to the `unity` job:

```yaml
environment:
  name: forge-unity-build
```

Do not add it until the environment and approval rules are ready, because doing so before the environment secrets are configured will cause Unity jobs to fail for missing credentials. Do not rename the secret keys as part of this migration.

## Scope and limitations

- This gate protects access to Unity license and Android signing secrets; it does not make untrusted Unity project code safe.
- A reviewer must inspect the selected project branch and dependencies before approving a secret-bearing Unity run.
- Keep Unity builds off for untrusted branches until the environment gate is active.
- Do not put secrets in workflow inputs, project files, artifacts, logs, or generated source.
- Prefer APK/test/WebGL/Linux runs without signing secrets where practical, but the Unity license remains a sensitive credential for all Unity editor runs.
- The current workflow does not yet reference this environment. No secrets were moved or deleted by this documentation change.

## GitHub documentation

- [Deployment environments and required reviewers](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [Managing environments and environment secrets](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [OWASP GitHub Actions Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/GitHub_Actions_Security_Cheat_Sheet.html)
