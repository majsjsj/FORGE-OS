"""FORGE command-line interface."""
import argparse
import json
from forge_os.core.planner import create_plan
from forge_os.tools.project import inspect_project


def main() -> None:
    parser = argparse.ArgumentParser(prog="forge")
    commands = parser.add_subparsers(dest="command", required=True)
    plan = commands.add_parser("plan")
    plan.add_argument("brief")
    plan.add_argument("--type", default="auto", choices=["auto", "web", "android", "game", "api"])
    inspect = commands.add_parser("inspect")
    inspect.add_argument("path")
    args = parser.parse_args()
    result = create_plan(args.brief, args.type) if args.command == "plan" else inspect_project(args.path)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
