import json
import pytest
from forge_os.studios.ads import create_admob_plan
from forge_os.studios.mobile import play_store_package


def test_play_listing_is_written(tmp_path):
    result = play_store_package(str(tmp_path), ".", "Demo", "com.example.demo",
                                "A short app description", "A longer app description")
    data = json.loads((tmp_path / "play-store-listing.json").read_text())
    assert result["publishing"] == "not_published"
    assert data["application_id"] == "com.example.demo"


def test_play_short_description_limit(tmp_path):
    with pytest.raises(ValueError):
        play_store_package(str(tmp_path), ".", "Demo", "com.example.demo",
                           "x" * 81, "Description")


def test_admob_uses_placeholders(tmp_path):
    create_admob_plan(str(tmp_path), ".", "flutter", ["banner", "rewarded"])
    data = json.loads((tmp_path / "admob-plan.json").read_text())
    assert data["test_mode"] is True
    assert data["ad_unit_ids"]["banner"].startswith("REPLACE_WITH_")
