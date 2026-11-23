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
