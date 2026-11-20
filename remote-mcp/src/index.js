const REPO = "majsjsj/FORGE-OS";
const WORKFLOW = "forge-on-demand.yml";
const PROTOCOL_VERSION = "2025-03-26";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function rpc(id, result) {
  return json({ jsonrpc: "2.0", id, result });
}

function rpcError(id, code, message) {
  return json({ jsonrpc: "2.0", id, error: { code, message } }, 400);
}

function validateWorkspacePath(path, allowDirectory = false) {
  if (typeof path !== "string" || !/^workspace(?:\\/[A-Za-z0-9._-]+)*$/.test(path) ||
      path.includes("..") || (!allowDirectory && path === "workspace")) {
    throw new Error("Path must be workspace/ or a safe child path inside workspace/.");
  }
  const blocked = path.split("/").some(part =>
    part === ".git" || part === ".github" || part === ".claude" ||
    /^\\.env($|\\.)/i.test(part) || /\\.(pem|key|p12|pfx|jks|keystore)$/i.test(part) ||
    /(^|\\.)(secrets?|credentials?)(\\.|$)/i.test(part));
  if (blocked) throw new Error("This path is blocked because it may contain credentials or repository control files.");
  return path;
}

function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\\n/g, ""));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function authorized(request, env) {
  const expected = env.FORGE_ACCESS_TOKEN;
  const header = request.headers.get("authorization") || "";
  if (!expected || expected.length < 32 || !header.startsWith("Bearer ")) return false;
  const supplied = header.slice(7);
  if (supplied.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return mismatch === 0;
}

async function github(env, path, options = {}) {
  if (!env.GITHUB_TOKEN) throw new Error("Server is not configured: GITHUB_TOKEN secret is missing.");
  const response = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    ...options,
    headers: {
      "accept": "application/vnd.github+json",
      "authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 1200);
    throw new Error(`GitHub API ${response.status}: ${body}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

const TOOLS = [
  {
    name: "forge_workspace_list",
    description: "List files and folders inside workspace/ in the connected FORGE repository.",
    inputSchema: { type: "object", properties: { path: { type: "string", description: "workspace/ or a subfolder under it." } }, required: ["path"], additionalProperties: false },
  },
  {
    name: "forge_workspace_read",
    description: "Read a UTF-8 project file committed in workspace/. Returns its blob SHA for safe updates.",
    inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false },
  },
  {
    name: "forge_workspace_write",
    description: "Create or update a UTF-8 project file in workspace/ as a Git commit. Requires confirm=true after the user asks you to create or edit project files. For updates, pass the SHA returned by forge_workspace_read.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        expected_sha: { type: "string", description: "Required when updating an existing file; omit only when creating a new file." },
        confirm: { type: "boolean" },
      },
      required: ["path", "content", "confirm"],
      additionalProperties: false,
    },
  },
  {
    name: "forge_health",
    description: "Check that the authenticated FORGE remote controller is online and configured. Does not start a build.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "forge_dispatch_build",
    description: "Start one temporary GitHub Actions build for a project already committed under workspace/. This consumes GitHub Actions quota. Call only after the user explicitly asks to build/test and set confirm=true.",
    inputSchema: {
      type: "object",
      properties: {
        engine: { type: "string", enum: ["web", "flutter", "godot", "unity"] },
        project_path: { type: "string", description: "Repository-relative path, restricted to workspace/<project>." },
        output: { type: "string", enum: ["test", "apk", "aab", "web", "linux"] },
        confirm: { type: "boolean", description: "Must be true only after explicit user authorization for this build." },
      },
      required: ["engine", "project_path", "output", "confirm"],
      additionalProperties: false,
    },
  },
  {
    name: "forge_latest_build",
    description: "Get the latest FORGE on-demand build run status and summary.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "forge_build_details",
    description: "Get a build run's status, jobs, steps, and artifact metadata. Requires a numeric GitHub Actions run_id.",
    inputSchema: {
      type: "object",
      properties: { run_id: { type: "integer" } },
      required: ["run_id"],
      additionalProperties: false,
    },
  },
  {
    name: "forge_build_logs",
    description: "Read the tail of logs for one job belonging to the specified FORGE build run.",
    inputSchema: {
      type: "object",
      properties: { run_id: { type: "integer" }, job_id: { type: "integer" } },
      required: ["run_id", "job_id"],
      additionalProperties: false,
    },
  },
];

async function callTool(name, args, env) {
  if (name === "forge_workspace_list") {
    const path = validateWorkspacePath(args.path, true);
    const entries = await github(env, `contents/${path}`);
    if (!Array.isArray(entries)) throw new Error("The requested path is not a directory.");
    return entries.filter(entry => ![".git", ".github", ".claude"].includes(entry.name))
      .map(entry => ({ name: entry.name, path: entry.path, type: entry.type, size: entry.size, sha: entry.sha }));
  }

  if (name === "forge_workspace_read") {
    const path = validateWorkspacePath(args.path);
    const file = await github(env, `contents/${path}`);
    if (Array.isArray(file) || !file.content || file.encoding !== "base64")
      throw new Error("The requested path is not a readable text file.");
    return { path: file.path, sha: file.sha, content: decodeBase64Utf8(file.content) };
  }

  if (name === "forge_workspace_write") {
    const path = validateWorkspacePath(args.path);
    if (args.confirm !== true) throw new Error("Write not performed: confirm=true is required after the user asks to create or edit project files.");
    if (typeof args.content !== "string" || new TextEncoder().encode(args.content).length > 500000)
      throw new Error("File content must be UTF-8 text no larger than 500 KB.");
    if (args.expected_sha !== undefined && (typeof args.expected_sha !== "string" || !/^[a-f0-9]{40}$/i.test(args.expected_sha)))
      throw new Error("expected_sha must be a valid Git blob SHA.");
    const payload = { message: `FORGE: update ${path}`, content: encodeBase64Utf8(args.content) };
    if (args.expected_sha) payload.sha = args.expected_sha;
    const saved = await github(env, `contents/${path}`, { method: "PUT", body: JSON.stringify(payload) });
    return { saved: true, path: saved.content.path, sha: saved.content.sha,
      commit_sha: saved.commit.sha, html_url: saved.content.html_url };
  }

  if (name === "forge_health") {
    return { ok: true, service: "FORGE Remote Controller", repository: REPO, workflow: WORKFLOW,
      github_token_configured: Boolean(env.GITHUB_TOKEN), build_execution: "on-demand only" };
  }

  if (name === "forge_dispatch_build") {
    const { engine, project_path, output, confirm } = args;
    if (confirm !== true) throw new Error("Build not started: confirm=true is required after explicit user authorization.");
    if (!["web", "flutter", "godot", "unity"].includes(engine)) throw new Error("Unsupported engine.");
    if (typeof project_path !== "string" || !/^workspace\/[A-Za-z0-9._/-]+$/.test(project_path) ||
        project_path.includes("..") || project_path.endsWith("/")) {
      throw new Error("project_path must be a safe path inside workspace/, such as workspace/my-app.");
    }
    const allowed = {
      web: ["test", "web"], flutter: ["test", "apk", "aab"],
      godot: ["test", "web", "linux"], unity: ["linux"],
    };
    if (!allowed[engine].includes(output)) throw new Error(`Output ${output} is not supported for ${engine}.`);
    await github(env, `actions/workflows/${WORKFLOW}/dispatches`, {
      method: "POST",
      body: JSON.stringify({ ref: "main", inputs: { engine, project_path, output } }),
    });
    return { accepted: true, engine, project_path, output,
      message: "GitHub accepted the dispatch request. Query forge_latest_build after a short wait to obtain the run ID and status." };
  }

  if (name === "forge_latest_build") {
    const data = await github(env, `actions/workflows/${WORKFLOW}/runs?per_page=1`);
    const run = data.workflow_runs?.[0];
    if (!run) return { found: false, message: "No workflow runs found yet." };
    return { found: true, run_id: run.id, status: run.status, conclusion: run.conclusion,
      html_url: run.html_url, created_at: run.created_at, updated_at: run.updated_at,
      event: run.event, head_branch: run.head_branch };
  }

  if (name === "forge_build_details") {
    const runId = Number(args.run_id);
    if (!Number.isSafeInteger(runId) || runId <= 0) throw new Error("Invalid run_id.");
    const [run, jobs, artifacts] = await Promise.all([
      github(env, `actions/runs/${runId}`),
      github(env, `actions/runs/${runId}/jobs?per_page=100`),
      github(env, `actions/runs/${runId}/artifacts?per_page=100`),
    ]);
    return {
      run: { id: run.id, status: run.status, conclusion: run.conclusion, html_url: run.html_url,
        created_at: run.created_at, updated_at: run.updated_at },
      jobs: (jobs.jobs || []).map(j => ({ id: j.id, name: j.name, status: j.status,
        conclusion: j.conclusion, html_url: j.html_url,
        steps: (j.steps || []).map(s => ({ name: s.name, status: s.status, conclusion: s.conclusion })) })),
      artifacts: (artifacts.artifacts || []).map(a => ({ id: a.id, name: a.name,
        size_in_bytes: a.size_in_bytes, expired: a.expired, expires_at: a.expires_at })),
    };
  }

  if (name === "forge_build_logs") {
    const runId = Number(args.run_id), jobId = Number(args.job_id);
    if (!Number.isSafeInteger(runId) || runId <= 0 || !Number.isSafeInteger(jobId) || jobId <= 0)
      throw new Error("Invalid run_id or job_id.");
    const jobs = await github(env, `actions/runs/${runId}/jobs?per_page=100`);
    if (!(jobs.jobs || []).some(j => j.id === jobId)) throw new Error("job_id does not belong to this run.");
    const response = await fetch(`https://api.github.com/repos/${REPO}/actions/jobs/${jobId}/logs`, {
      headers: { "authorization": `Bearer ${env.GITHUB_TOKEN}`, "accept": "application/vnd.github+json",
        "x-github-api-version": "2022-11-28" },
    });
    if (!response.ok) throw new Error(`GitHub logs API ${response.status}.`);
    const logs = await response.text();
    return { run_id: runId, job_id: jobId, truncated: logs.length > 16000,
      logs: logs.slice(-16000) };
  }

  throw new Error(`Unknown tool: ${name}`);
}

export default {
  async fetch(request, env) {
    if (!authorized(request, env)) return json({ error: "Unauthorized" }, 401);
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET")
      return json({ ok: true, service: "FORGE Remote Controller" });
    if (url.pathname === "/mcp" && request.method !== "POST")
      return json({ error: "MCP endpoint accepts POST requests only." }, 405);
    if (url.pathname !== "/mcp")
      return json({ error: "Not found." }, 404);

    let message;
    try { message = await request.json(); }
    catch { return rpcError(null, -32700, "Parse error"); }

    if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string")
      return rpcError(message?.id ?? null, -32600, "Invalid Request");

    if (message.method === "notifications/initialized") return new Response(null, { status: 202 });
    if (message.method === "initialize") {
      return rpc(message.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "FORGE-OS Remote Controller", version: "0.1.0" },
        instructions: "FORGE executes only explicitly requested on-demand builds. Project source must already be committed under workspace/. Never claim a build succeeded until forge_build_details confirms it.",
      });
    }
    if (message.method === "ping") return rpc(message.id, {});
    if (message.method === "tools/list") return rpc(message.id, { tools: TOOLS });
    if (message.method === "tools/call") {
      const name = message.params?.name;
      const args = message.params?.arguments || {};
      try {
        const result = await callTool(name, args, env);
        return rpc(message.id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: false });
      } catch (error) {
        return rpc(message.id, { content: [{ type: "text", text: String(error?.message || error) }], isError: true });
      }
    }
    if (message.method.startsWith("notifications/")) return new Response(null, { status: 202 });
    return rpcError(message.id ?? null, -32601, "Method not found");
  },
};
