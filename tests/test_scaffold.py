from forge_os.studios.scaffold import scaffold


def test_scaffold_web(tmp_path):
    result=scaffold(str(tmp_path), "web", "demo")
    assert result["status"] == "scaffolded"
    assert (tmp_path / "demo/index.html").exists()


def test_scaffold_does_not_overwrite(tmp_path):
    (tmp_path / "demo").mkdir()
    (tmp_path / "demo/index.html").write_text("keep")
    import pytest
    with pytest.raises(FileExistsError):
        scaffold(str(tmp_path), "web", "demo")
