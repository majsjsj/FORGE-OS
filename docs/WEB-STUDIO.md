# FORGE Universal Web Studio

FORGE Studio is a project-agnostic browser workspace. It does not ship with a sample game, demo app, or reference project.

## Clean starter workspace

The editor opens three intentionally minimal files from `workspace/blank-project/`:
- `index.html`
- `styles.css`
- `script.js`

These are blank starter files, not a finished project. An AI agent can create additional files, directories, and project structure according to the user's request.

## Browser editor

Open `studio/index.html`. It loads Monaco (the editor engine used by VS Code) from a public CDN, provides HTML/CSS/JavaScript editing, a sandboxed live preview, and desktop/mobile viewport sizing.

- Drafts are saved in browser localStorage only.
- Local preview runs in a sandboxed iframe in the browser. A second **OPEN COMMITTED PREVIEW** control loads a committed HTML entry file from the authenticated FORGE preview gateway (for example `workspace/my-game/index.html`).
- The preview gateway is read-only and serves only files under this public repository's `workspace/` tree. Relative JS, CSS, images, audio, and WebAssembly assets load from the same project folder. It does not run arbitrary server processes.
- Use the MCP tool `forge_preview_url` to get the same HTTPS URL in Claude. Changes become visible after Claude commits the updated files and the preview is refreshed.
- For Godot/Unity, preview browser-compatible exports (Web/WebGL) by placing the exported entry HTML and its adjacent assets under `workspace/`; native APK/AAB files cannot run inside an iframe.
- The editor does not yet commit changes to GitHub automatically. Use [GitHub.dev](https://github.dev/majsjsj/FORGE-OS) to edit and commit repository files.
- Monaco requires internet access; a basic text editor fallback is provided.

## AI operation

The repository also contains the FORGE agent skills, MCP server, project tools, planning, build, and QA components. The browser editor is currently a standalone front end; connecting its editing session directly to the agent requires the chat/MCP integration described in the architecture docs.

## Current limits

This is an evolving development environment, not a complete hosted VS Code instance. The local preview does not provide arbitrary server processes, native mobile emulators, or full Unity/Godot/Flutter runtimes. Cloud build workflows are separate and must be explicitly triggered where applicable.

## Publish on GitHub Pages

The workflow publishes the landing page, editor, and blank starter workspace on GitHub Pages. Enable **Settings → Pages → Build and deployment → Source: GitHub Actions** in the repository. The deployment is considered live only after the Pages workflow succeeds.
