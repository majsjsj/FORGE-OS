import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const accessToken = "test-forge-access-token-that-is-long-enough-123";
const branch = "forge/projects/demo";
const projectPath = "workspace/demo";
const planPath = "workspace/demo/FORGE_PLAN.json";
const fileSha = "a".repeat(40);
const commitSha = "b".repeat(40);

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(text) {
  return new TextDecoder().decode(Uint8Array.from(atob(text), char => char.charCodeAt(0)));
}

function samplePlan() {
  return {
    schema_version: 1,
    project_type: "web",
    brief: "Build a project management web app.",
    agents: [{ id: "product", title: "Product analyst" }],
    tasks: [
      { id: "P1", title: "Clarify scope", depends_on: [] },
      { id: "P2", title: "Implement core flow", depends_on: ["P1"] }
    ]
  };
}

async function callTool(name, args, fetchMock) {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (input, options = {}) => {
    requests += 1;
    return fetchMock(input, options);
  };
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
    const raw = payload.result?.content?.[0]?.text || "";
    let value = raw;
    try { value = raw ? JSON.parse(raw) : null; } catch {}
    return { payload, value, requests };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function apiUrl(input) {
  const url = new URL(input);
  return url.pathname.split("/repos/majsjsj/FORGE-OS/")[1] + url.search;
}

function apiResponse(data, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test("saving a project plan requires confirmation before GitHub access", async () => {
  const result = await callTool("forge_project_plan_save", {
    project_path: projectPath, branch, plan: samplePlan(), confirm: false
  }, async () => apiResponse({}));
  assert.equal(result.payload.result.isError, true);
  assert.match(result.payload.result.content[0].text, /confirm=true/);
  assert.equal(result.requests, 0);
});

test("saving a new project plan creates FORGE_PLAN.json and initializes task statuses", async () => {
  let savedContent = "";
  const result = await callTool("forge_project_plan_save", {
    project_path: projectPath, branch, plan: samplePlan(), confirm: true
  }, async (input, options = {}) => {
    const path = apiUrl(input);
    if (path === `contents/${planPath}?ref=forge%2Fprojects%2Fdemo`)
      return apiResponse({ message: "Not Found" }, 404);
    if (path === `contents/${planPath}` && options.method === "PUT") {
      const body = JSON.parse(options.body);
      assert.equal(body.branch, branch);
      savedContent = decodeBase64(body.content);
      return apiResponse({
        content: { path: planPath, sha: fileSha, html_url: "https://github.com/majsjsj/FORGE-OS/blob/main/" + planPath },
        commit: { sha: commitSha, html_url: "https://github.com/majsjsj/FORGE-OS/commit/" + commitSha }
      });
    }
    assert.fail("Unexpected GitHub request: " + path);
  });
  const saved = JSON.parse(savedContent);
  assert.equal(result.payload.result.isError, false);
  assert.equal(result.value.saved, true);
  assert.equal(result.value.task_count, 2);
  assert.equal(saved.tasks[0].status, "pending");
  assert.equal(saved.tasks[1].status, "pending");
  assert.ok(saved.created_at);
  assert.ok(saved.updated_at);
  assert.equal(result.requests, 2);
});

test("updating an existing plan requires its current SHA", async () => {
  const currentPlan = samplePlan();
  const result = await callTool("forge_project_plan_save", {
    project_path: projectPath, branch, plan: currentPlan, confirm: true
  }, async (input, options = {}) => {
    if ((options.method || "GET") === "GET")
      return apiResponse({ path: planPath, sha: fileSha, encoding: "base64", content: encodeBase64(JSON.stringify(currentPlan)) });
    assert.fail("The stale update must stop before PUT.");
  });
  assert.equal(result.payload.result.isError, true);
  assert.match(result.payload.result.content[0].text, /requires expected_sha/);
  assert.equal(result.requests, 1);
});

test("reading a saved project plan returns task status and the current file SHA", async () => {
  const currentPlan = samplePlan();
  currentPlan.tasks[0].status = "completed";
  const result = await callTool("forge_project_plan_read", {
    project_path: projectPath, branch
  }, async (input, options = {}) => {
    assert.equal(options.method || "GET", "GET");
    return apiResponse({ path: planPath, sha: fileSha, encoding: "base64", content: encodeBase64(JSON.stringify(currentPlan)) });
  });
  assert.equal(result.payload.result.isError, false);
  assert.equal(result.value.tasks[0].status, "completed");
  assert.equal(result.value.storage.sha, fileSha);
  assert.equal(result.requests, 1);
});

test("task update writes a status and bounded progress history using optimistic concurrency", async () => {
  const currentPlan = samplePlan();
  const writes = [];
  const result = await callTool("forge_project_task_update", {
    project_path: projectPath, branch, task_id: "P2", status: "in_progress",
    note: "Core screen implementation started.", expected_sha: fileSha, confirm: true
  }, async (input, options = {}) => {
    const path = apiUrl(input);
    if ((options.method || "GET") === "GET")
      return apiResponse({ path: planPath, sha: fileSha, encoding: "base64", content: encodeBase64(JSON.stringify(currentPlan)) });
    if (path === `contents/${planPath}` && options.method === "PUT") {
      const body = JSON.parse(options.body);
      writes.push(JSON.parse(decodeBase64(body.content)));
      assert.equal(body.sha, fileSha);
      return apiResponse({
        content: { path: planPath, sha: "c".repeat(40), html_url: "https://github.com/majsjsj/FORGE-OS/blob/main/" + planPath },
        commit: { sha: commitSha, html_url: "https://github.com/majsjsj/FORGE-OS/commit/" + commitSha }
      });
    }
    assert.fail("Unexpected GitHub request: " + path);
  });
  assert.equal(result.payload.result.isError, false);
  assert.equal(result.value.task_id, "P2");
  assert.equal(result.value.status, "in_progress");
  assert.equal(writes[0].tasks[1].status, "in_progress");
  assert.equal(writes[0].tasks[1].updates[0].note, "Core screen implementation started.");
  assert.equal(result.requests, 2);
});

test("stale task updates and credential-like notes are rejected", async () => {
  const currentPlan = samplePlan();
  const stale = await callTool("forge_project_task_update", {
    project_path: projectPath, branch, task_id: "P1", status: "completed",
    expected_sha: "d".repeat(40), confirm: true
  }, async () => apiResponse({ path: planPath, sha: fileSha, encoding: "base64", content: encodeBase64(JSON.stringify(currentPlan)) }));
  assert.equal(stale.payload.result.isError, true);
  assert.match(stale.payload.result.content[0].text, /Stale project plan/);
  assert.equal(stale.requests, 1);

  const secret = await callTool("forge_project_task_update", {
    project_path: projectPath, branch, task_id: "P1", status: "completed",
    note: "api_key=abcdefghijklmnop", expected_sha: fileSha, confirm: true
  }, async () => apiResponse({}));
  assert.equal(secret.payload.result.isError, true);
  assert.match(secret.payload.result.content[0].text, /credential values/);
  assert.equal(secret.requests, 0);
});

test("project plan storage rejects main branch and invalid dependency graphs", async () => {
  const main = await callTool("forge_project_plan_save", {
    project_path: projectPath, branch: "main", plan: samplePlan(), confirm: true
  }, async () => apiResponse({}));
  assert.equal(main.payload.result.isError, true);
  assert.match(main.payload.result.content[0].text, /isolated forge\/projects/);
  assert.equal(main.requests, 0);

  const invalidPlan = samplePlan();
  invalidPlan.tasks[1].depends_on = ["missing-task"];
  const invalid = await callTool("forge_project_plan_save", {
    project_path: projectPath, branch, plan: invalidPlan, confirm: true
  }, async () => apiResponse({}));
  assert.equal(invalid.payload.result.isError, true);
  assert.match(invalid.payload.result.content[0].text, /invalid task dependency/);
  assert.equal(invalid.requests, 0);

  const cyclicPlan = samplePlan();
  cyclicPlan.tasks[0].depends_on = ["P2"];
  const cyclic = await callTool("forge_project_plan_save", {
    project_path: projectPath, branch, plan: cyclicPlan, confirm: true
  }, async () => apiResponse({}));
  assert.equal(cyclic.payload.result.isError, true);
  assert.match(cyclic.payload.result.content[0].text, /contain a cycle/);
  assert.equal(cyclic.requests, 0);

  const credentialPlan = samplePlan();
  credentialPlan.metadata = { api_key: "abcdefghijklmnop" };
  const credential = await callTool("forge_project_plan_save", {
    project_path: projectPath, branch, plan: credentialPlan, confirm: true
  }, async () => apiResponse({}));
  assert.equal(credential.payload.result.isError, true);
  assert.match(credential.payload.result.content[0].text, /credential values/);
  assert.equal(credential.requests, 0);
});
