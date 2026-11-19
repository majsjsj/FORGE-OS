from forge_os.engines.repair import repair_loop


def test_repair_loop_stops_when_checks_pass():
    calls={"n":0}
    def check():
        calls["n"] += 1
        return {"passed": calls["n"] > 1}
    def fix(result, attempt):
        return {"applied": True, "summary": "test repair"}
    result=repair_loop(check, fix, max_attempts=3)
    assert result["passed"] is True
    assert result["attempts"] == 1


def test_repair_loop_is_bounded():
    result=repair_loop(lambda: {"passed": False}, lambda *_: {"applied": True}, max_attempts=2)
    assert result["passed"] is False
    assert result["attempts"] == 2
