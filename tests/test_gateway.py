from forge_os.models.gateway import model_status


def test_gateway_is_optional_without_env(monkeypatch):
    monkeypatch.delenv("FORGE_MODEL_BASE_URL", raising=False)
    monkeypatch.delenv("FORGE_MODEL_NAME", raising=False)
    assert model_status()["configured"] is False
