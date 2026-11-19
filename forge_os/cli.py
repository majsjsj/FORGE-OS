"""FORGE command-line interface."""
import argparse
import json
from forge_os.core.director import direct
from forge_os.core.planner import create_plan
from forge_os.models.gateway import model_status
from forge_os.studios.scaffold import scaffold
from forge_os.tools.project import inspect_project


def _print(value: dict) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(prog="forge")
    commands = parser.add_subparsers(dest="command", required=True)
    plan = commands.add_parser("plan")
    plan.add_argument("brief")
    plan.add_argument("--type", default="auto", choices=["auto", "web", "android", "game", "saas", "api"])
    director = commands.add_parser("direct")
    director.add_argument("brief")
    director.add_argument("--studio", default="auto", choices=["auto", "web", "android", "game", "saas", "api"])
    inspect = commands.add_parser("inspect")
    inspect.add_argument("path")
    create = commands.add_parser("scaffold")
    create.add_argument("studio", choices=["web", "android", "game", "saas", "api"])
    create.add_argument("destination")
    status = commands.add_parser("model-status")
    args = parser.parse_args()
    if args.command == "plan":
        result = create_plan(args.brief, args.type)
    elif args.command == "direct":
        result = direct(args.brief, args.studio)
    elif args.command == "inspect":
        result = inspect_project(args.path)
    elif args.command == "scaffold":
        result = scaffold(".", args.studio, args.destination)
    else:
        result = model_status()
    _print(result)


if __name__ == "__main__":
    main()
