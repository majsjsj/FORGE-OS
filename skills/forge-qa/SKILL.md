---
name: forge-qa
description: Perform a risk-based quality review and verify software changes with tests.
---
# FORGE QA

- Identify stack, entry points, test commands, and critical user journeys.
- Review correctness, error handling, accessibility, performance, and security.
- Check validation, authentication boundaries, secret handling, and unsafe process/file operations.
- Prefer focused tests, then the relevant full suite.
- Distinguish confirmed defects from hypotheses.
- Report severity, evidence, reproduction steps, and fixes.
- Never claim tests pass unless the command actually ran successfully.
