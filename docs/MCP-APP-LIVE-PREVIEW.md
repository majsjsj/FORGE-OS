# FORGE-OS MCP App: interactive project preview

The Remote MCP Worker exposes a `ui://forge-os/live-preview.html` MCP App resource and attaches it to `forge_preview_url`. Claude clients that support MCP Apps render the tool result in an interactive chat view; clients without MCP Apps support continue to receive the ordinary JSON/text preview URL.

The view fetches only the committed public HTML preview from the FORGE Worker and renders it in a nested iframe with `sandbox="allow-scripts"` (no same-origin privilege). The project page is untrusted content: forms, popups, top-level navigation, arbitrary external requests, and access to the parent/host DOM are not granted. The view polls the existing read-only preview-version endpoint every 15 seconds and reloads after a new project commit.

The SDK browser bundle is built from the pinned `@modelcontextprotocol/ext-apps` dependency by `npm run build:preview-app`; the generated `src/preview-app-bundle.js` is a build artifact and must exist before the Worker is bundled. Deployment and test workflows build it before Wrangler or Node tests.

Scope: this first integration covers committed HTML projects and exported Web projects served through the existing FORGE preview endpoint. It does not embed native APK/AAB execution, nor does it claim full Godot/Unity WebGL compatibility inside every Claude mobile view. Game engine preview embedding requires separate host/device verification.
