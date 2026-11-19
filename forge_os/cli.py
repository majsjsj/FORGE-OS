"""FORGE command-line interface."""
import argparse
import json

from forge_os.core.director import direct
from forge_os.core.planner import create_plan
from forge_os.models.gateway import model_status
from forge_os.studios.ads import create_admob_plan
from forge_os.studios.mobile import build_project, discover_toolchains, play_store_package
from forge_os.studios.scaffold import scaffold
from forge_os.tools.project import inspect_project


def _print(value: dict) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(prog="forge")
    commands = parser.add_subparsers(dest="command", required=True)
    plan = commands.add_parser("plan")
    plan.add_argument("brief")
    plan.add_argument("--type", default="auto", choices=["auto", "web", "android", "flutter", "game", "godot", "unity", "saas", "api"])
    director = commands.add_parser("direct")
    director.add_argument("brief")
    director.add_argument("--studio", default="auto", choices=["auto", "web", "android", "flutter", "game", "godot", "unity", "saas", "api"])
    inspect = commands.add_parser("inspect")
    inspect.add_argument("path")
    create = commands.add_parser("scaffold")
    create.add_argument("studio", choices=["web", "android", "flutter", "game", "godot", "unity", "saas", "api"])
    create.add_argument("destination")
    build = commands.add_parser("build")
    build.add_argument("path")
    build.add_argument("target", choices=["apk", "aab", "godot-android-debug", "unity-android"])
    build.add_argument("--timeout", type=int, default=1800)
    commands.add_parser("toolchains")
    play = commands.add_parser("play-package")
    play.add_argument("path")
    play.add_argument("--name", required=True)
    play.add_argument("--package-id", required=True)
    play.add_argument("--short", required=True)
    play.add_argument("--description", required=True)
    play.add_argument("--privacy-policy-url", default="")
    ads = commands.add_parser("ads")
    ads.add_argument("path")
    ads.add_argument("--platform", choices=["android", "flutter", "unity", "godot"], default="android")
    ads.add_argument("--formats", default="banner,interstitial,rewarded")
    commands.add_parser("model-status")
    args = parser.parse_args()
    if args.command == "plan":
        result = create_plan(args.brief, args.type)
    elif args.command == "direct":
        result = direct(args.brief, args.studio)
    elif args.command == "inspect":
        result = inspect_project(args.path)
    elif args.command == "scaffold":
        result = scaffold(".", args.studio, args.destination)
    elif args.command == "build":
        result = build_project(".", args.path, args.target, args.timeout)
    elif args.command == "toolchains":
        result = discover_toolchains()
    elif args.command == "play-package":
        result = play_store_package(".", args.path, args.name, args.package_id,
                                    args.short, args.description, args.privacy_policy_url)
    elif args.command == "ads":
        result = create_admob_plan(".", args.path, args.platform, args.formats.split(","))
    else:
        result = model_status()
    _print(result)


if __name__ == "__main__":
    main()
