from pathlib import Path

from scripts.verify_actions_pinned import find_unpinned_references


def test_accepts_full_sha_and_local_actions(tmp_path: Path) -> None:
    workflow_dir = tmp_path / ".github" / "workflows"
    action_dir = tmp_path / ".github" / "actions" / "local"
    workflow_dir.mkdir(parents=True)
    action_dir.mkdir(parents=True)
    (workflow_dir / "ci.yml").write_text(
        "steps:\\n"
        "  - uses: actions/checkout@"
        + "a" * 40
        + "\\n"
        "  - uses: ./.github/actions/local\\n",
        encoding="utf-8",
    )
    (action_dir / "action.yml").write_text(
        "runs:\\n  using: composite\\n",
        encoding="utf-8",
    )

    assert find_unpinned_references(tmp_path) == []


def test_rejects_tags_and_non_sha_refs(tmp_path: Path) -> None:
    workflow_dir = tmp_path / ".github" / "workflows"
    workflow_dir.mkdir(parents=True)
    (workflow_dir / "ci.yml").write_text(
        "steps:\\n"
        "  - uses: actions/checkout@v4\\n"
        "  - uses: owner/repo@main\\n",
        encoding="utf-8",
    )

    failures = find_unpinned_references(tmp_path)

    assert len(failures) == 2
    assert "actions/checkout@v4" in failures[0]
    assert "owner/repo@main" in failures[1]


def test_checks_composite_action_manifests(tmp_path: Path) -> None:
    action_dir = tmp_path / ".github" / "actions" / "nested"
    action_dir.mkdir(parents=True)
    (action_dir / "action.yaml").write_text(
        "runs:\\n  using: composite\\n"
        "  steps:\\n    - uses: actions/checkout@v4\\n",
        encoding="utf-8",
    )

    failures = find_unpinned_references(tmp_path)

    assert len(failures) == 1
    assert "action.yaml:4" in failures[0]
