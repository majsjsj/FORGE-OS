import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const secret = "test-secret-for-forge-assets-signing-0123456789";
const key = "projects/forge/projects/demo/workspace/demo/icon.svg";

async function signedUrl({ method = "GET", expires = Math.floor(Date.now() / 1000) + 120, signatureOverride } = {}) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const bytes = new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(key + "\\n" + expires)
  ));
  const signature = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  const sig = signatureOverride ?? signature;
  const encodedPath = key.split("/").map(encodeURIComponent).join("/");
  return new Request("https://forge-os-remote-mcp.majsjsj.workers.dev/assets/" + encodedPath +
    "?expires=" + expires + "&sig=" + sig, { method });
}

function environment() {
  let requestedKey = null;
  const object = {
    size: 12,
    body: new Response("<svg></svg>").body,
    httpEtag: '"test-etag"',
    writeHttpMetadata(headers) {
      headers.set("content-type", "image/svg+xml");
      headers.set("content-disposition", "inline");
    }
  };
  return {
    env: {
      FORGE_ACCESS_TOKEN: secret,
      FORGE_ASSETS_BUCKET: {
        async get(value) {
          requestedKey = value;
          return value === key ? object : null;
        }
      }
    },
    getRequestedKey: () => requestedKey
  };
}

test("signed R2 assets are forced to download and cannot execute as active content", async () => {
  const mock = environment();
  const response = await worker.fetch(await signedUrl(), mock.env);
  assert.equal(response.status, 200);
  assert.equal(mock.getRequestedKey(), key);
  assert.match(response.headers.get("content-disposition") || "", /^attachment; filename="icon\.svg"$/);
  assert.equal(response.headers.get("content-security-policy"),
    "sandbox; default-src 'none'; object-src 'none'; base-uri 'none'");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("HEAD returns the same download safety headers without a body", async () => {
  const mock = environment();
  const response = await worker.fetch(await signedUrl({ method: "HEAD" }), mock.env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="icon.svg"');
  assert.equal(await response.text(), "");
});

test("invalid signatures are rejected before reading an R2 object", async () => {
  const mock = environment();
  const response = await worker.fetch(await signedUrl({ signatureOverride: "0".repeat(64) }), mock.env);
  assert.equal(response.status, 403);
  assert.equal(mock.getRequestedKey(), null);
});
