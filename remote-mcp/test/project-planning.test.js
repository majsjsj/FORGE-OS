import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const accessToken = "test-forge-access-token-that-is-long-enough-123";

async function callTool(name, args) {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    throw new Error("Planner must not call external services.");
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
    ), { FORGE_ACCESS_TOKEN: accessToken });
    const payload = await response.json();
    const raw = payload.result?.content?.[0]?.text || "";
    let value = raw;
    try { value = raw ? JSON.parse(raw) : null; } catch {}
    return { payload, value, requests };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("specialist planner creates a dependency-ordered web delivery plan", async () => {
  const result = await callTool("forge_project_plan", {
    brief: "Build a responsive booking website for independent studios.",
    project_type: "web"
  });
  assert.equal(result.payload.result.isError, false);
  assert.equal(result.requests, 0);
  assert.equal(result.value.project_type, "web");
  assert.equal(result.value.orchestration_mode, "model-directed specialist handoffs");
  assert.deepEqual(result.value.tasks.map(task => task.id), ["P1", "P2", "P3", "P4", "P5", "P6", "P7"]);
  assert.deepEqual(result.value.tasks[6].depends_on, ["P5", "P6"]);
  assert.equal(result.value.agents.find(agent => agent.id === "engineer").title, "Web application engineer");
  assert.equal(result.value.execution_policy.confirm_builds_and_tests_that_consume_quota, true);
});

test("specialist planner detects Unity and Godot from explicit engine names", async () => {
  const unity = await callTool("forge_project_plan", { brief: "Create a Unity 3D puzzle adventure game." });
  const godot = await callTool("forge_project_plan", { brief: "Create a Godot 2D platform game." });
  assert.equal(unity.value.project_type, "unity");
  assert.equal(unity.value.agents.find(agent => agent.id === "engineer").title, "Unity game engineer");
  assert.equal(godot.value.project_type, "godot");
  assert.equal(godot.value.agents.find(agent => agent.id === "engineer").title, "Godot game engineer");
});

test("specialist planner rejects short, oversized, and unsupported briefs", async () => {
  const short = await callTool("forge_project_plan", { brief: "app" });
  const long = await callTool("forge_project_plan", { brief: "x".repeat(12001) });
  const invalid = await callTool("forge_project_plan", { brief: "Build a desktop tool.", project_type: "unknown" });
  assert.equal(short.payload.result.isError, true);
  assert.match(short.payload.result.content[0].text, /at least 8 characters/);
  assert.equal(long.payload.result.isError, true);
  assert.match(long.payload.result.content[0].text, /12000-character limit/);
  assert.equal(invalid.payload.result.isError, true);
  assert.match(invalid.payload.result.content[0].text, /Unsupported project_type/);
});

test("specialist plan documents that it does not spawn models or execute work", async () => {
  const result = await callTool("forge_project_plan", { brief: "Build a secure REST API for inventory." });
  assert.equal(result.value.project_type, "api");
  assert.ok(result.value.limitations.some(item => item.includes("does not spawn independent AI models")));
  assert.equal(result.value.execution_policy.automatic_retries, false);
  assert.equal(result.requests, 0);
});
