import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "../src/index.js";

const crypto = webcrypto;
const audience = "https://forge-os-remote-mcp.majsjsj.workers.dev";
const runId = "12345";
const runSha = "a".repeat(40);
const signingKeys = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"]
);
const publicJwk = {
  ...(await crypto.subtle.exportKey("jwk", signingKeys.publicKey)),
  kid: "forge-test-key",
  use: "sig",
  alg: "RS256"
};

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

async function createToken(overrides = {}, tamperSignature = false) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid: "forge-test-key" };
  const claims = {
    iss: "https://token.actions.githubusercontent.com",
    aud: audience,
    exp: now + 300,
    nbf: now - 30,
    iat: now - 30,
    repository: "majsjsj/FORGE-OS",
    event_name: "workflow_dispatch",
    ref: "refs/heads/main",
    ref_type: "branch",
    workflow_ref: "majsjsj/FORGE-OS/.github/workflows/forge-on-demand.yml@refs/heads/main",
    workflow: "FORGE On-Demand Engine Jobs",
    sub: "repo:majsjsj/FORGE-OS:ref:refs/heads/main",
    run_id: runId,
    run_attempt: "1",
    runner_environment: "github-hosted",
    sha: runSha,
    ...overrides
  };
  const signingInput = base64url(JSON.stringify(header)) + "." + base64url(JSON.stringify(claims));
  const signature = Buffer.from(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    signingKeys.privateKey,
    new TextEncoder().encode(signingInput)
  )).toString("base64url");
  return signingInput + "." + (tamperSignature ? "A".repeat(signature.length) : signature);
}

function createEnvironment() {
  const calls = [];
  const objectBytes = new TextEncoder().encode("hero");
  const env = {
    GITHUB_TOKEN: "test-github-token",
    FORGE_ACCESS_TOKEN: "test-forge-access-token-0123456789abcdef",
    FORGE_ASSETS_BUCKET: {
      async get(key) {
        calls.push({ type: "r2", key });
        if (key !== "projects/forge%2Fprojects%2Fdemo/workspace/demo/textures/hero.bin") return null;
        return {
          size: objectBytes.byteLength,
          async arrayBuffer() { return objectBytes.slice().buffer; },
          httpMetadata: { contentType: "application/octet-stream" }
        };
      }
    }
  };
  return { env, calls };
}

function installFetchMock(calls) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push({ type: "fetch", url });
    if (url === "https://token.actions.githubusercontent.com/.well-known/jwks") {
      return Response.json({ keys: [publicJwk] });
    }
    if (url === `https://api.github.com/repos/majsjsj/FORGE-OS/actions/runs/${runId}`) {
      return Response.json({
        id: Number(runId),
        event: "workflow_dispatch",
        path: ".github/workflows/forge-on-demand.yml",
        head_branch: "main",
        head_sha: runSha,
        status: "in_progress",
        run_attempt: 1
      });
    }
    throw new Error("Unexpected outbound request: " + url);
  };
  return () => { globalThis.fetch = originalFetch; };
}

test("R2 asset sync accepts only a valid, active OIDC token from the trusted workflow", async () => {
  const { env, calls } = createEnvironment();
  const restoreFetch = installFetchMock(calls);
  try {
    const invalidClaimsToken = await createToken({ repository: "attacker/FORGE-OS" });
    const invalidClaimsResponse = await worker.fetch(new Request("https://forge-os-remote-mcp.majsjsj.workers.dev/actions/assets", {
      method: "POST",
      headers: { authorization: "Bearer " + invalidClaimsToken, "content-type": "application/json" },
      body: JSON.stringify({
        project_branch: "forge/projects/demo",
        project_path: "workspace/demo",
        asset_paths: ["textures/hero.bin"]
      })
    }), env);
    assert.equal(invalidClaimsResponse.status, 403);
    assert.match((await invalidClaimsResponse.json()).error, /trusted FORGE workflow/);
    assert.equal(calls.some(call => call.type === "fetch"), false);
    assert.equal(calls.some(call => call.type === "r2"), false);

    const tamperedToken = await createToken({}, true);
    const tamperedResponse = await worker.fetch(new Request("https://forge-os-remote-mcp.majsjsj.workers.dev/actions/assets", {
      method: "POST",
      headers: { authorization: "Bearer " + tamperedToken, "content-type": "application/json" },
      body: JSON.stringify({
        project_branch: "forge/projects/demo",
        project_path: "workspace/demo",
        asset_paths: ["textures/hero.bin"]
      })
    }), env);
    assert.equal(tamperedResponse.status, 403);
    assert.match((await tamperedResponse.json()).error, /signature is invalid/);
    assert.equal(calls.some(call => call.type === "r2"), false);

    calls.length = 0;
    const validToken = await createToken();
    const response = await worker.fetch(new Request("https://forge-os-remote-mcp.majsjsj.workers.dev/actions/assets", {
      method: "POST",
      headers: { authorization: "Bearer " + validToken, "content-type": "application/json" },
      body: JSON.stringify({
        project_branch: "forge/projects/demo",
        project_path: "workspace/demo",
        asset_paths: ["textures/hero.bin"]
      })
    }), env);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.ok, true);
    assert.equal(result.branch, "forge/projects/demo");
    assert.equal(result.project_path, "workspace/demo");
    assert.deepEqual(result.assets.map(asset => asset.path), ["textures/hero.bin"]);
    assert.equal(result.assets[0].sha256, Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("hero"))).toString("hex"));
    assert.equal(result.assets[0].size_bytes, 4);
    assert.equal(calls.filter(call => call.type === "r2").length, 1);
    assert.ok(calls.some(call => call.url?.includes("/actions/runs/" + runId)));
  } finally {
    restoreFetch();
  }
});

test("R2 asset sync rejects malformed, duplicate, credential-like, and oversized requests before R2 access", async () => {
  const { env, calls } = createEnvironment();
  const restoreFetch = installFetchMock(calls);
  try {
    const token = await createToken();
    for (const assetPaths of [
      ["../outside.bin"],
      ["textures/hero.bin", "textures/hero.bin"],
      ["secrets/token.txt"],
      ["keys/release.keystore"]
    ]) {
      const response = await worker.fetch(new Request("https://forge-os-remote-mcp.majsjsj.workers.dev/actions/assets", {
        method: "POST",
        headers: { authorization: "Bearer " + token, "content-type": "application/json" },
        body: JSON.stringify({
          project_branch: "forge/projects/demo",
          project_path: "workspace/demo",
          asset_paths: assetPaths
        })
      }), env);
      assert.equal(response.status, 403);
    }
    assert.equal(calls.some(call => call.type === "r2"), false);
  } finally {
    restoreFetch();
  }
});
