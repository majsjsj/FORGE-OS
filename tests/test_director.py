from forge_os.core.director import detect_studio, direct


def test_director_routes_android():
    result = direct("Build an Android app")
    assert result["studio"] == "android"
    assert next(x for x in result["assignments"] if x["task_id"] == "T3")["agent"] == "android"


def test_director_routes_games():
    assert detect_studio("Create a 3D game") == "game"


def test_director_routes_engine_specific_studios():
    from forge_os.core.director import direct

    assert direct("Build a Flutter application", "flutter")["studio"] == "flutter"
    assert direct("Build a Flutter application")["studio"] == "flutter"
    assert direct("Build a Godot game", "godot")["studio"] == "godot"
    assert direct("Build a Godot game")["studio"] == "godot"
    assert direct("Build a Unity game", "unity")["studio"] == "unity"
