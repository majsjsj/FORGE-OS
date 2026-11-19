"""Deterministic planning baseline; no model API is required."""
from dataclasses import asdict, dataclass


@dataclass
class Task:
    id: str
    title: str
    description: str
    acceptance_criteria: list[str]
    depends_on: list[str]
    status: str = "pending"


def create_plan(brief: str, project_type: str = "auto") -> dict:
    clean = " ".join(brief.split())
    if len(clean) < 8:
        raise ValueError("Provide a project brief of at least 8 characters.")
    if project_type == "auto":
        lowered = clean.lower()
        if any(x in lowered for x in ("android", "apk", "mobile app")):
            project_type = "android"
        elif any(x in lowered for x in ("game", "unity", "godot", "3d")):
            project_type = "game"
        elif any(x in lowered for x in ("api", "backend", "service")):
            project_type = "api"
        else:
            project_type = "web"
    tasks = [
        Task("T1", "Clarify requirements", "Define user stories, constraints, and non-goals.", ["Requirements and ambiguities are documented."], []),
        Task("T2", "Design architecture", f"Choose a maintainable {project_type} architecture and module boundaries.", ["Architecture decisions are documented."], ["T1"]),
        Task("T3", "Build vertical slice", "Implement one end-to-end core user journey.", ["Primary journey works locally."], ["T2"]),
        Task("T4", "Add automated tests", "Cover core logic, edge cases, and failure states.", ["Relevant automated tests pass."], ["T3"]),
        Task("T5", "Quality and security review", "Review accessibility, performance, dependencies, and secrets handling.", ["No known critical defects or committed secrets."], ["T3", "T4"]),
        Task("T6", "Prepare delivery", "Document setup, configuration, limitations, and release steps.", ["A fresh developer can run and verify the project."], ["T5"]),
    ]
    return {"project_type": project_type, "brief": clean,
            "planning_note": "Deterministic starter plan; refine against the real repository.",
            "tasks": [asdict(task) for task in tasks]}
