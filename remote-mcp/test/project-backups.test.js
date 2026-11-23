import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const accessToken = "test-forge-access-token-that-is-long-enough-123";
const sourceSha = "a".repeat(40);
const backupSha = "b".repeat(40);
const projectBranch = "forge/projects/demo";

async function backupPrefix(branch) {
  const digest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(branch)
  ));
  const fingerprint = Array.from(digest).slice(0, 16)
    .map(value => value.toString(16).padStart(2, "0")).join("");
  return `forge/backups/${fingerprint}/`;
}

async function callTool(name, args, fetchMock) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock;
  try {
    const response = await worker.fetch(new Request(
      "https://forge-os-remote-mcp.majsjsj.workers.dev/mcp",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name, arguments: args }
        })
      }
    ), { FORGE_ACCESS_TOKEN: accessToken, GITHUB_TOKEN: "mock-github-token" });
    const payload = await response.json();
    const text = payload.result?.content?.[0]?.text || "";
    return { payload, value: text ? JSON.parse(text) : null };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function githubResponse(data, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test("backup creation requires explicit confirmation and makes no GitHub request otherwise", async () => {
  let requests = 0;
  const result = await callTool("forge_project_backup_create", {
    branch: projectBranch,
    confirm: false
  }, async () => {
    requests += 1;
    return githubResponse({});
  });

  assert.equal(result.payload.error, true);
  assert.match(result.payload.content[0].text, /confirm=true/);
  assert.equal(requests, 0);
});

test("backup creation pins the isolated branch's current commit without changing it", async () => {
  const calls = [];
  const prefix = await backupPrefix(projectBranch);
  const result = await callTool("forge_project_backup_create", {
    branch: projectBranch,
    confirm: true
  }, async (input, options = {}) => {
    const url = new URL(input);
    const path = url.pathname.split("/repos/majsjsj/FORGE-OS/")[1];
    calls.push({ path, method: options.method || "GET", body: options.body });
    if (path === `git/ref/heads/${projectBranch}`)
      return githubResponse({ object: { sha: sourceSha } });
    if (path === `git/matching-refs/heads/${prefix}`)
      return githubResponse([]);
    if (path.startsWith(`git/ref/heads/${prefix}`))
      return githubResponse({ message: "Not Found" }, 404);
    if (path === "git/refs" && options.method === "POST") {
      const body = JSON.parse(options.body);
      assert.equal(body.sha, sourceSha);
      assert.ok(body.ref.startsWith(`refs/heads/${prefix}`));
      return githubResponse({ object: { sha: sourceSha } });
    }
    assert.fail(`Unexpected GitHub request: ${options.method || "GET"} ${path}`);
  });

  assert.equal(result.payload.error, undefined);
  assert.equal(result.value.created, true);
  assert.equal(result.value.commit_sha, sourceSha);
  assert.equal(result.value.project_branch, projectBranch);
  assert.ok(calls.some(call => call.path === `git/ref/heads/${projectBranch}`));
  assert.equal(calls.filter(call => call.method === "POST").length, 1);
});

test("restore rejects a backup ref belonging to a different project before GitHub access", async () => {
  const foreignPrefix = await backupPrefix("forge/projects/another-project");
  let requests = 0;
  const result = await callTool("forge_project_backup_restore", {
    branch: projectBranch,
    backup_branch: `${foreignPrefix}1795450000000-a1b2c3d4`,
    new_branch: "forge/projects/demo-recovered",
    confirm: true
  }, async () => {
    requests += 1;
    return githubResponse({});
  });

  assert.equal(result.payload.error, true);
  assert.match(result.payload.content[0].text, /does not belong to the selected project/);
  assert.equal(requests, 0);
});

test("restore creates a new isolated branch at the selected snapshot and never updates the source", async () => {
  const prefix = await backupPrefix(projectBranch);
  const backupBranch = `${prefix}1795450000000-a1b2c3d4`;
  const newBranch = "forge/projects/demo-recovered";
  const calls = [];
  const result = await callTool("forge_project_backup_restore", {
    branch: projectBranch,
    backup_branch: backupBranch,
    new_branch: newBranch,
    confirm: true
  }, async (input, options = {}) => {
    const url = new URL(input);
    const path = url.pathname.split("/repos/majsjsj/FORGE-OS/")[1];
    calls.push({ path, method: options.method || "GET" });
    if (path === `git/ref/heads/${backupBranch}`)
      return githubResponse({ object: { sha: backupSha } });
    if (path === `git/ref/heads/${newBranch}`)
      return githubResponse({ message: "Not Found" }, 404);
    if (path === "git/refs" && options.method === "POST") {
      const body = JSON.parse(options.body);
      assert.equal(body.ref, `refs/heads/${newBranch}`);
      assert.equal(body.sha, backupSha);
      return githubResponse({ object: { sha: backupSha } });
    }
    assert.fail(`Unexpected GitHub request: ${options.method || "GET"} ${path}`);
  });

  assert.equal(result.payload.error, undefined);
  assert.equal(result.value.restored, true);
  assert.equal(result.value.restored_commit_sha, backupSha);
  assert.equal(result.value.new_branch, newBranch);
  assert.equal(calls.some(call => call.path === `git/ref/heads/${projectBranch}`), false);
  assert.equal(calls.filter(call => call.method === "POST").length, 1);
});

test("restore refuses main and the original branch as destinations", async () => {
  const prefix = await backupPrefix(projectBranch);
  const backupBranch = `${prefix}1795450000000-a1b2c3d4`;
  for (const newBranch of ["main", projectBranch]) {
    let requests = 0;
    const result = await callTool("forge_project_backup_restore", {
      branch: projectBranch,
      backup_branch: backupBranch,
      new_branch: newBranch,
      confirm: true
    }, async () => {
      requests += 1;
      return githubResponse({});
    });
    assert.equal(result.payload.error, true);
    assert.match(result.payload.content[0].text, /different isolated/);
    assert.equal(requests, 0);
  }
});
