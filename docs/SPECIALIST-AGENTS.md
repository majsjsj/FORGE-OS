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

The returned plan includes task IDs, dependencies, deliverables, acceptance criteria, execution policy, and limitations. It can be used by the connected conversational model as a checklist and handoff contract. Plans can also be persisted as `workspace/<project>/FORGE_PLAN.json` on the isolated branch, then read and updated as work progresses.

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
8. Save the reviewed plan with `forge_project_plan_save` after explicit confirmation. Use `forge_project_plan_read` to recover it and `forge_project_task_update` to record each task's pending, in-progress, blocked, or completed status. These writes require confirmation and a current SHA to prevent stale updates.\n9. Update `FORGE_CONTEXT.md` with confirmed decisions, architecture, constraints, and TODOs using `forge_project_context_save`. Never store passwords, tokens, private keys, signing credentials, or sensitive account data.
10. Compare the project branch with main and present the changes for human review. Do not merge automatically.

## Approval and safety gates

- No silent file writes, builds, test sessions, signing, publishing, account access, paid services, or automatic retries.
- No long-lived secrets in source, prompts, context files, logs, or artifacts.
- No claim that a task is complete until the relevant tool result or test evidence confirms it.
- A successful static preflight is not proof that an app or game runs on a real device.
- User decisions and confirmed project facts may be saved to project context; speculative assumptions must be labeled.

## Scope of this implementation

The specialist planner and persistent task tracker are real MCP tools with input validation and automated tests. Plans and task history are stored as ordinary project JSON on the isolated branch, with optimistic concurrency and credential-like value rejection. Specialist roles are handoff contracts for the conversational model; they are not separate model instances and do not run in the background. Scheduled automation, autonomous background agents, cross-user memory, and multi-tenant secret storage are not part of this feature.


## Read-only task monitoring checkpoints

The MCP tool `forge_project_task_monitor` reads the saved plan and classifies tasks as ready, in progress, blocked by unfinished dependencies, or completed. It returns counts, each task's unmet dependencies, the current plan SHA, and a suggested next action. It is safe to call after a task update or at any manual project checkpoint; it does not write files, change statuses, execute specialist work, run tests, dispatch builds, or schedule background jobs.

This is deliberately an on-demand monitor, not an autonomous event listener. No GitHub Actions schedule, Cloudflare Cron Trigger, webhook subscription, or recurring polling has been enabled. Those mechanisms can consume quotas or create unattended activity and must be designed and explicitly enabled separately.
