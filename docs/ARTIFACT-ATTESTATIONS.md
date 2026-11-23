# FORGE build artifact attestations

New release artifacts produced by the FORGE on-demand workflow receive a GitHub Artifact Attestation after the selected engine job succeeds.

## What is signed

The workflow already creates `forge-artifact-manifest.json` inside each release artifact. It lists every output file with its relative path, byte size, and SHA-256 digest.

A separate, isolated `attest-artifact` job:
1. Downloads only the artifact produced by the selected engine job.
2. Verifies the manifest format, engine, output type, safe paths, file presence, sizes, and every SHA-256 digest.
3. Uses `actions/attest@v4` to create a Sigstore-backed GitHub Artifact Attestation for the manifest itself.

Signing the manifest binds its list of file hashes to the attestation. A consumer verifies the attestation first, then checks the extracted files against the verified manifest. This avoids signing thousands of individual files and does not require a long-lived private signing key.

## Verify a downloaded artifact

1. Download the artifact ZIP using `forge_artifact_download` or GitHub Actions.
2. Extract the ZIP so that `forge-artifact-manifest.json` is at the artifact root.
3. Install/update the GitHub CLI with attestation support and authenticate to GitHub.
4. Verify the signed manifest:

```bash
gh attestation verify forge-artifact-manifest.json --repo majsjsj/FORGE-OS
```

5. After the signature/provenance check succeeds, verify each file's size and SHA-256 against the `files` entries in the manifest using the repository verifier:

   `python scripts/verify-forge-artifact.py --root /path/to/extracted-artifact`

   Add `--engine flutter --output apk` (or the appropriate values) when you want to enforce the expected build type. The manifest is an integrity index; it is not a malware scan.

## Permissions and scope

- Only the isolated `attest-artifact` job receives `id-token: write`, `attestations: write`, and `artifact-metadata: write`.
- That job does not check out or execute the selected project source and receives no engine license or project secrets.
- The engine jobs do not receive OIDC signing permissions.
- Attestations are generated only for release outputs (APK, AAB, Web, and Linux), not routine `test` runs.
- The repository is public, so GitHub Artifact Attestations are available on current GitHub plans. The public Sigstore signing flow uses short-lived certificates; FORGE does not store a permanent signing private key.
- The attestation establishes provenance and integrity linkage. It does not guarantee that the software is safe, bug-free, or free of malicious dependencies.
