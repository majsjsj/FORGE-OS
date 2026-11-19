"""Mobile/game engine discovery and guarded build adapters.

FORGE prepares projects and invokes only known toolchain executables with fixed
argument patterns. It never invokes a shell or performs store uploads.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from forge_os.core.safety import safe_path

ENGINE_COMMANDS = {
    "flutter": ("flutter", ["--version"]),
    "godot": ("godot", ["--version"]),
    "unity": ("Unity", ["-version"]),
    "gradle": ("gradle", ["--version"]),
    "adb": ("adb", ["version"]),
}


def discover_toolchains() -> dict:
    found = {}
    for name, (executable, _) in ENGINE_COMMANDS.items():
        path = shutil.which(executable)
        if name == "unity" and not path:
            path = shutil.which("unity")
        found[name] = {"available": bool(path), "executable": path}
    return {"toolchains": found, "note": "Detection only; install missing SDKs/engines separately."}


def _run(args: list[str], cwd: Path, timeout: int) -> dict:
    try:
        result = subprocess.run(args, cwd=str(cwd), capture_output=True, text=True,
                                timeout=timeout, shell=False, check=False)
        return {"ok": result.returncode == 0, "returncode": result.returncode,
                "stdout": result.stdout[-12000:], "stderr": result.stderr[-12000:],
                "command": args}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"Command timed out after {timeout}s", "command": args}
    except OSError as exc:
        return {"ok": False, "error": str(exc), "command": args}


def build_project(root: str, relative_path: str, target: str, timeout: int = 1800) -> dict:
    """Build known project types. Outputs remain inside the selected project."""
    if not 1 <= timeout <= 3600:
        raise ValueError("timeout must be between 1 and 3600 seconds")
    project = safe_path(root, relative_path)
    if not project.is_dir():
        raise NotADirectoryError(str(project))
    if target not in {"apk", "aab", "godot-android-debug", "unity-android"}:
        raise ValueError("Unsupported build target")
    if target in {"apk", "aab"}:
        if (project / "pubspec.yaml").is_file():
            exe = shutil.which("flutter")
            if not exe:
                return {"ok": False, "error": "Flutter SDK not found"}
            args = [exe, "build", target, "--release"]
        elif (project / "gradlew").is_file():
            args = [str(project / "gradlew"), "assembleRelease" if target == "apk" else "bundleRelease"]
        elif (project / "settings.gradle").is_file() or (project / "settings.gradle.kts").is_file():
            exe = shutil.which("gradle")
            if not exe:
                return {"ok": False, "error": "Gradle not found and project has no gradlew wrapper"}
            args = [exe, "assembleRelease" if target == "apk" else "bundleRelease"]
        else:
            return {"ok": False, "error": "No supported Flutter or Gradle Android project detected"}
    elif target == "godot-android-debug":
        exe = shutil.which("godot") or shutil.which("godot4")
        if not exe:
            return {"ok": False, "error": "Godot executable not found"}
        if not (project / "project.godot").is_file():
            return {"ok": False, "error": "project.godot not found"}
        args = [exe, "--headless", "--path", str(project), "--export-debug", "Android", str(project / "build" / "android-debug.apk")]
    else:
        exe = shutil.which("Unity") or shutil.which("unity")
        if not exe:
            return {"ok": False, "error": "Unity Editor executable not found"}
        if not (project / "Assets").is_dir():
            return {"ok": False, "error": "Unity Assets directory not found"}
        output = project / "build" / "forge-android.apk"
        output.parent.mkdir(parents=True, exist_ok=True)
        args = [exe, "-batchmode", "-quit", "-projectPath", str(project),
                "-buildTarget", "Android", "-executeMethod", "BuildScript.BuildAndroid",
                "-logFile", "-"]
    return _run(args, project, timeout)


def play_store_package(root: str, relative_path: str, app_name: str,
                       package_id: str, short_description: str,
                       full_description: str, privacy_policy_url: str = "") -> dict:
    """Write a human-reviewable Play listing checklist; does not publish."""
    import json
    import re
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+", package_id):
        raise ValueError("package_id must be a valid reverse-DNS application ID")
    if len(short_description) > 80:
        raise ValueError("short_description must be 80 characters or fewer")
    if not app_name.strip() or not full_description.strip():
        raise ValueError("app_name and full_description are required")
    project = safe_path(root, relative_path, for_write=True)
    project.mkdir(parents=True, exist_ok=True)
    path = safe_path(root, str(project.relative_to(Path(root).resolve()) / "play-store-listing.json"), for_write=True)
    if path.exists():
        raise FileExistsError(str(path))
    data = {
        "app_name": app_name, "application_id": package_id,
        "short_description": short_description, "full_description": full_description,
        "privacy_policy_url": privacy_policy_url,
        "release_checklist": [
            "Confirm application ID, versionCode, versionName and signing key",
            "Build and test a signed Android App Bundle (AAB)",
            "Prepare 512x512 app icon and required screenshots/feature graphic",
            "Complete content rating, target audience and data safety declarations",
            "Provide a public privacy policy URL and verify all SDK disclosures",
            "Test ads, consent flow, billing and offline/error states",
            "Upload to internal testing before production rollout",
        ],
        "publishing": "manual_review_required",
        "warning": "FORGE creates metadata only. Review current Google Play policies and complete Play Console declarations yourself."
    }
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"ok": True, "file": str(path), "publishing": "not_published"}
