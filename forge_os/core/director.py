"""FORGE Director: deterministic task decomposition and specialist routing."""
from dataclasses import asdict, dataclass

from forge_os.core.planner import create_plan

AGENTS = {
    "architect": {"skills": ["requirements", "architecture"], "studio": ["web", "android", "game", "saas", "api"]},
    "frontend": {"skills": ["ui", "accessibility", "responsive"], "studio": ["web", "saas"]},
    "backend": {"skills": ["api", "database", "auth"], "studio": ["api", "saas"]},
    "android": {"skills": ["gradle", "android", "mobile"], "studio": ["android"]},
    "game_developer": {"skills": ["gameplay", "physics", "rendering"], "studio": ["game"]},
    "qa": {"skills": ["testing", "verification"], "studio": ["web", "android", "game", "saas", "api"]},
    "security": {"skills": ["threat_model", "secrets", "dependencies"], "studio": ["web", "android", "game", "saas", "api"]},
}

ROUTES = {
    "T1": "architect", "T2": "architect", "T3": "frontend",
    "T4": "qa", "T5": "security", "T6": "qa",
}


@dataclass
class Assignment:
    task_id: str
    agent: str
    rationale: str


def detect_studio(brief: str, requested: str = "auto") -> str:
    if requested != "auto":
        if requested not in {"web", "android", "flutter", "game", "godot", "unity", "saas", "api"}:
            raise ValueError("Unsupported studio.")
        return requested
    s = brief.lower()
    if any(x in s for x in ("android", "apk", "aab", "mobile app")): return "android"
    if any(x in s for x in ("game", "unity", "godot", "2d", "3d")): return "game"
    if any(x in s for x in ("saas", "subscription", "multi-tenant")): return "saas"
    if any(x in s for x in ("api", "backend", "microservice")): return "api"
    return "web"


def direct(brief: str, studio: str = "auto") -> dict:
    selected = detect_studio(brief, studio)
    plan = create_plan(brief, selected)
    assignments = []
    for task in plan["tasks"]:
        agent = ROUTES.get(task["id"], "architect")
        if selected in {"android", "flutter"} and task["id"] == "T3": agent = "android"
        if selected in {"game", "godot", "unity"} and task["id"] == "T3": agent = "game_developer"
        if selected in {"api", "saas"} and task["id"] == "T3": agent = "backend"
        assignments.append(asdict(Assignment(task["id"], agent, f"{agent} owns the {task['title'].lower()} workstream.")))
    return {"director": "FORGE DIRECTOR", "studio": selected, "brief": plan["brief"],
            "tasks": plan["tasks"], "assignments": assignments,
            "agents": AGENTS, "execution_mode": "plan_only",
            "notice": "Planning and routing are active. Autonomous code execution requires a configured model provider and explicit tool permissions."}
