from forge_os.core.planner import create_plan


def test_plan_dependencies():
    plan = create_plan("Build a responsive ecommerce website")
    assert plan["project_type"] == "web"
    assert plan["tasks"][1]["depends_on"] == ["T1"]
    assert plan["tasks"][-1]["id"] == "T6"


def test_android_detection():
    assert create_plan("Build an Android habit app")["project_type"] == "android"


def test_short_brief_rejected():
    import pytest
    with pytest.raises(ValueError):
        create_plan("app")
