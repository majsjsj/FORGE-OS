from forge_os.core.director import direct, detect_studio


def test_director_routes_android():
    result = direct("Build an Android app")
    assert result["studio"] == "android"
    assert next(x for x in result["assignments"] if x["task_id"] == "T3")["agent"] == "android"


def test_director_routes_games():
    assert detect_studio("Create a 3D game") == "game"
