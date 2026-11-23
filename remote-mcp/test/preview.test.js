import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const originalFetch = globalThis.fetch;

test("HTML previews run scripts in an opaque sandboxed origin", async () => {
  globalThis.fetch = async () => new Response("<!doctype html><script>window.started = true</script>", {
    status: 200,
    headers: { "content-type": "text/plain" }
  });
  try {
    const response = await worker.fetch(new Request(
      "https://forge-os-remote-mcp.majsjsj.workers.dev/preview/workspace/demo/index.html?ref=main"
    ), { GITHUB_TOKEN: "test-token" });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(response.headers.get("content-security-policy"), "sandbox allow-scripts");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("non-HTML game assets are not given an HTML document sandbox policy", async () => {
  globalThis.fetch = async () => new Response(new Uint8Array([0, 1, 2, 3]), { status: 200 });
  try {
    const response = await worker.fetch(new Request(
      "https://forge-os-remote-mcp.majsjsj.workers.dev/preview/workspace/demo/game.wasm?ref=main"
    ), { GITHUB_TOKEN: "test-token" });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/wasm");
    assert.equal(response.headers.get("content-security-policy"), null);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("preview rejects traversal before fetching project content", async () => {
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; return new Response("unexpected"); };
  try {
    const response = await worker.fetch(new Request(
      "https://forge-os-remote-mcp.majsjsj.workers.dev/preview/workspace/%252e%252e/secret.html?ref=main"
    ), { GITHUB_TOKEN: "test-token" });
    assert.equal(response.status, 400);
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const accessToken = "mcp-app-test-token-with-more-than-32-characters";

async function mcpRequest(method, params = {}, id = 1) {
  const response = await worker.fetch(new Request("https://forge-os-remote-mcp.majsjsj.workers.dev/mcp", {
    method: "POST",
    headers: { authorization: "Bearer " + accessToken, "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
  }), { FORGE_ACCESS_TOKEN: accessToken });
  return { response, body: response.status === 202 ? null : await response.json() };
}

test("MCP Apps preview resource is discoverable and safely bundled", async () => {
  const initialized = await mcpRequest("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" }
  });
  assert.equal(initialized.response.status, 200);
  assert.equal(initialized.body.result.capabilities.resources.listChanged, false);

  const listed = await mcpRequest("resources/list", {}, 2);
  assert.equal(listed.response.status, 200);
  assert.equal(listed.body.result.resources[0].uri, "ui://forge-os/live-preview.html");
  assert.equal(listed.body.result.resources[0].mimeType, "text/html;profile=mcp-app");

  const read = await mcpRequest("resources/read", { uri: "ui://forge-os/live-preview.html" }, 3);
  assert.equal(read.response.status, 200);
  const resource = read.body.result.contents[0];
  assert.equal(resource.mimeType, "text/html;profile=mcp-app");
  assert.match(resource.text, /globalThis\.ExtApps/);
  assert.match(resource.text, /sandbox", "allow-scripts allow-pointer-lock"/);
  assert.match(resource.text, /setInterval\(checkVersion,60000\)/);
  assert.doesNotMatch(resource.text, /__EXT_APPS_BUNDLE__/);
  assert.equal(resource._meta.ui.prefersBorder, false);

  const tools = await mcpRequest("tools/list", {}, 4);
  const preview = tools.body.result.tools.find(tool => tool.name === "forge_preview_url");
  assert.equal(preview._meta.ui.resourceUri, "ui://forge-os/live-preview.html");
  const gamePreview = tools.body.result.tools.find(tool => tool.name === "forge_game_preview_url");
  assert.equal(gamePreview._meta.ui.resourceUri, "ui://forge-os/live-preview.html");
});

test("MCP Apps resource rejects unknown UI resource URIs", async () => {
  const result = await mcpRequest("resources/read", { uri: "ui://forge-os/unknown.html" }, 5);
  assert.equal(result.response.status, 400);
  assert.match(result.body.error.message, /Unknown UI resource URI/);
});

test("deployed game previews are proxied from the fixed Pages origin", async () => {
  let requested = "";
  globalThis.fetch = async (input, init) => {
    requested = String(input);
    assert.equal(init.redirect, "error");
    return new Response("<!doctype html><title>Game</title>", {
      status: 200,
      headers: { "content-type": "text/html" }
    });
  };
  try {
    const response = await worker.fetch(new Request(
      "https://forge-os-remote-mcp.majsjsj.workers.dev/game-preview/123/index.html"
    ), {});
    assert.equal(response.status, 200);
    assert.equal(requested, "https://majsjsj.github.io/FORGE-OS/game-preview/index.html");
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.equal(response.headers.get("content-security-policy"), "sandbox allow-scripts");
    assert.equal(await response.text(), "<!doctype html><title>Game</title>");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("game preview proxy rejects traversal and hidden paths", async () => {
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; return new Response("unexpected"); };
  try {
    const response = await worker.fetch(new Request(
      "https://forge-os-remote-mcp.majsjsj.workers.dev/game-preview/%252e%252e/secret.html"
    ), {});
    assert.equal(response.status, 400);
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
