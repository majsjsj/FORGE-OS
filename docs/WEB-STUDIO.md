# FORGE Web Studio

The first browser-game project is **ECHO//ME**, a solo time-loop puzzle platformer.

## Try the game
Open `workspace/web-game/index.html` in a static web server or use the FORGE Studio preview. The game is plain HTML, CSS, and JavaScript and needs no Unity, Godot, Flutter, or local game-engine install.

Controls:
- A / D or arrow keys: move
- Space / W / Up: jump
- E: record and replay the current timeline as an echo
- R: restart
- Touch buttons are available on narrow screens

The core puzzle is to record a past run that stands on the floor switch, then move as the present player while the echo replays and opens the exit.

## Browser code editor
Open `studio/index.html`. It loads the Monaco editor (the editor engine used by VS Code) from a public CDN, exposes the game's HTML/CSS/JS files, and runs the current contents in a sandboxed iframe. Desktop/mobile preview sizing is included.

- Drafts are saved in browser localStorage only.
- The preview is local to the page; it does not execute code on a server.
- Use [GitHub.dev](https://github.dev/majsjsj/FORGE-OS) to edit and commit repository files in the browser.
- GitHub.dev is GitHub's browser editor, not a hosted VS Code server managed by FORGE.
- Monaco requires internet access to load its CDN assets; a plain-text fallback is shown if it cannot load.

## Current limits
This is an early prototype, not a production game or a complete cloud IDE. The editor does not yet commit files, run a full browser automation suite, or provide remote multiplayer. Visual QA still needs a human pass on real desktop and mobile browsers.

## Publish on GitHub Pages

The `.github/workflows/deploy-web-studio.yml` workflow publishes the landing page, editor, and game for free on GitHub Pages whenever these web files change. Enable **Settings → Pages → Build and deployment → Source: GitHub Actions** once in the repository. After the first successful deployment, the public URLs are:
- `https://majsjsj.github.io/FORGE-OS/` — web lab landing page
- `https://majsjsj.github.io/FORGE-OS/studio/` — code editor and live preview
- `https://majsjsj.github.io/FORGE-OS/workspace/web-game/` — game

The deployment URL is not considered live until the Pages workflow succeeds.
