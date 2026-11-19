"""Provider-neutral chat gateway for a locally hosted or remote OpenAI-compatible model."""
import json
import os
import urllib.error
import urllib.request


class ModelNotConfigured(RuntimeError):
    pass


def model_status() -> dict:
    base = os.getenv("FORGE_MODEL_BASE_URL", "").rstrip("/")
    name = os.getenv("FORGE_MODEL_NAME", "")
    return {"configured": bool(base and name), "provider": os.getenv("FORGE_MODEL_PROVIDER", "openai-compatible"),
            "base_url": base or None, "model": name or None,
            "api_key_present": bool(os.getenv("FORGE_MODEL_API_KEY")),
            "note": "Use a local OpenAI-compatible endpoint (for example Ollama's OpenAI API) to run without Claude."}


def chat(messages: list[dict], *, timeout: int = 90) -> dict:
    status = model_status()
    if not status["configured"]:
        raise ModelNotConfigured("Set FORGE_MODEL_BASE_URL and FORGE_MODEL_NAME first.")
    if not messages or any(m.get("role") not in {"system", "user", "assistant"} for m in messages):
        raise ValueError("messages must contain system/user/assistant roles.")
    payload = json.dumps({"model": status["model"], "messages": messages, "temperature": 0.2}).encode()
    headers = {"Content-Type": "application/json"}
    key = os.getenv("FORGE_MODEL_API_KEY")
    if key: headers["Authorization"] = f"Bearer {key}"
    request = urllib.request.Request(status["base_url"] + "/v1/chat/completions", data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=max(5, min(timeout, 180))) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read(2000).decode("utf-8", errors="replace")
        raise RuntimeError(f"Model endpoint returned HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Cannot reach model endpoint: {exc.reason}") from exc
    try:
        return {"model": data.get("model", status["model"]), "content": data["choices"][0]["message"]["content"],
                "usage": data.get("usage", {})}
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("Model endpoint returned an unexpected response.") from exc
