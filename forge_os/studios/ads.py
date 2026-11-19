"""Generate a safe AdMob integration plan without embedding real ad identifiers."""
from pathlib import Path
import json
from forge_os.core.safety import safe_path


def create_admob_plan(root: str, relative_path: str, platform: str = "android",
                      formats: list[str] | None = None) -> dict:
    if platform not in {"android", "flutter", "unity", "godot"}:
        raise ValueError("platform must be android, flutter, unity, or godot")
    allowed = {"banner", "interstitial", "rewarded", "native", "app_open"}
    formats = formats or ["banner", "interstitial", "rewarded"]
    if not formats or any(item not in allowed for item in formats):
        raise ValueError("Unsupported ad format")
    project = safe_path(root, relative_path, for_write=True)
    project.mkdir(parents=True, exist_ok=True)
    path = safe_path(root, str(project.relative_to(Path(root).resolve()) / "admob-plan.json"), for_write=True)
    if path.exists():
        raise FileExistsError(str(path))
    payload = {
        "provider": "Google AdMob", "platform": platform, "formats": formats,
        "app_id": "REPLACE_WITH_YOUR_ADMOB_APP_ID",
        "ad_unit_ids": {kind: f"REPLACE_WITH_{kind.upper()}_AD_UNIT_ID" for kind in formats},
        "test_mode": True,
        "requirements": [
            "Use Google's official SDK/plugin for the selected engine and current supported version",
            "Keep test ad IDs during development; never click your own live ads",
            "Implement consent and privacy disclosures for applicable regions",
            "Declare collected/shared data accurately in Google Play Data safety",
            "Use rewarded ads only after a clear user opt-in and grant the promised reward",
            "Do not show interstitials during gameplay-critical actions or unexpectedly",
        ],
        "status": "configuration_template_only"
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"ok": True, "file": str(path), "status": payload["status"]}
