"""Bounded, verification-first repair loop. A repair callback must be supplied by a trusted agent."""
from collections.abc import Callable


def repair_loop(run_checks: Callable[[], dict], propose_fix: Callable[[dict, int], dict],
                *, max_attempts: int = 3) -> dict:
    limit = max(1, min(int(max_attempts), 5))
    history=[]
    for attempt in range(1, limit + 1):
        result = run_checks()
        history.append({"attempt": attempt, "check": result})
        if result.get("passed") is True:
            return {"passed": True, "attempts": attempt - 1, "history": history, "status": "verified"}
        if attempt == limit: break
        fix = propose_fix(result, attempt)
        if not isinstance(fix, dict) or fix.get("applied") is not True:
            history[-1]["repair"] = {"applied": False, "reason": "No verified repair was applied."}
            break
        history[-1]["repair"] = fix
    return {"passed": False, "attempts": len(history), "history": history, "status": "needs_human_review"}
