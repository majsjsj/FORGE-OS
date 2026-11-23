# FORGE specialist planning and project orchestration

## What the planner does

The MCP tool `forge_project_plan` turns an approved project brief into a dependency-ordered delivery plan with seven specialist handoff roles:

1. Product analyst — user stories, scope, assumptions, and acceptance criteria.
2. Solution architect — architecture, data boundaries, platform choices, and dependencies.
3. UX and visual design specialist — user flows, visual identity, responsive states, and accessibility.
4. Platform engineer — the selected Web, Android, Flutter, Godot, Unity, game, API, or desktop implementation.
5. QA engineer — automated tests, edge cases, static checks, and honest verification reporting.
6. Security reviewer — permissions, input validation, dependencies, privacy, and secret handling.
7. Release specialist — versioning, app identity, metadata, signing prerequisites, and delivery checklist.

The returned plan includes task IDs, dependencies, deliverables, acceptance criteria, execution policy, and limitations. It can be used by the connected conversational model as a checklist and handoff contract.

## Important execution boundary

This is model-directed orchestration, not a fleet of autonomous AI models. The Worker does not call an LLM provider, spawn agents, execute tasks, write project files, dispatch builds, or invoke paid services when generating a plan. The conversational model performs the specialist reasoning and uses the existing FORGE tools under their normal permissions.

The planner is deterministic and intentionally bounded:
- Project brief: 8–12,000 characters.
- Project type: auto, web, android, flutter, godot, unity, game, api, or desktop.
- Automatic project-type detection is a convenience, not a substitute for reviewing the requested platform.
- The plan is returned to the caller and is not persisted automatically.

## Recommended project lifecycle

1. Ask the user for the product brief, intended audience, target platform, core features, visual identity, and constraints. Clarify material ambiguities before implementation.
2. Call `forge_project_plan` and review its project type, tasks, dependencies, and acceptance criteria. Correct the plan when the brief needs more detail.
3. Call `forge_project_branch_list` to avoid creating a duplicate project. Create or select an isolated `forge/projects/<name>` branch only after the user authorizes project creation.
4. For continuing work, call `forge_project_context_read` before making assumptions. Treat confirmed context as project documentation, not as a source of credentials.
5. Perform specialist handoffs in dependency order. Keep product, design, architecture, engineering, QA, security, and release findings distinct so unresolved issues are visible.
6. Before changing files, read the current contents and use the required SHA for guarded updates. Ask for confirmation before writes.
7. Run read-only inspection and preflight first. Tests, terminal/cloud sessions, and builds that consume quota require separate explicit approval.
8. Update `FORGE_CONTEXT.md` with confirmed decisions, architecture, constraints, and TODOs using `forge_project_context_save`. Never store passwords, tokens, private keys, signing credentials, or sensitive account data.
9. Compare the project branch with main and present the changes for human review. Do not merge automatically.

## Approval and safety gates

- No silent file writes, builds, test sessions, signing, publishing, account access, paid services, or automatic retries.
- No long-lived secrets in source, prompts, context files, logs, or artifacts.
- No claim that a task is complete until the relevant tool result or test evidence confirms it.
- A successful static preflight is not proof that an app or game runs on a real device.
- User decisions and confirmed project facts may be saved to project context; speculative assumptions must be labeled.

## Scope of this implementation

The specialist planner is a real MCP tool with input validation and automated tests. Specialist roles are handoff contracts for the conversational model; they are not separate model instances and do not run in the background. Scheduled automation, autonomous background agents, cross-user memory, and multi-tenant secret storage are not part of this feature.
