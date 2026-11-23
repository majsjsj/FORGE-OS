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
  if (typeof path !== "string" || !/^workspace(?:\/[A-Za-z0-9._-]+)*$/.test(path) ||
      path.includes("..") || (!allowDirectory && path === "workspace")) {
    throw new Error("Path must be workspace or a safe child path inside workspace.");
  }
  const blocked = path.split("/").some(part =>
    part === ".git" || part === ".github" || part === ".claude" ||
    [".npmrc", ".pypirc", "key.properties", "keystore.properties", "id_rsa", "id_ed25519"].includes(part.toLowerCase()) ||
    /^\.env($|\.)/i.test(part) || /\.(pem|key|p12|pfx|jks|keystore|mobileprovision)$/i.test(part) ||
    /(^|\.)(secrets?|credentials?)(\.|$)/i.test(part) || /^service-account.*\.json$/i.test(part));
  if (blocked) throw new Error("This path is blocked because it may contain credentials or repository control files.");
  return path;
}

function validateProjectBranch(branch = "main") {
  if (typeof branch !== "string" || branch.length > 120 ||
      !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) ||
      branch.includes("..") || branch.includes("//") || branch.endsWith("/") ||
      branch.split("/").some(part => !part || part.startsWith(".") || part.endsWith(".") || part.endsWith(".lock"))) {
    throw new Error("Invalid branch name. Project branches must use safe Git ref characters.");
  }
  if (branch !== "main" && !branch.startsWith("forge/projects/"))
    throw new Error("Project branches must be under forge/projects/. Use main only for read-only access.");
  return branch;
}

async function branchHead(env, branch = "main") {
  const safe = validateProjectBranch(branch);
  const result = await github(env, "git/ref/heads/" + safe);
  return result.object.sha;
}

function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\n/g, ""));
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
      "user-agent": "FORGE-OS-Remote-Controller/1.0",
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
    name: "forge_project_branch_create",
    description: "Create an isolated project branch under forge/projects/ from main or another project branch. Does not modify main. Requires confirm=true after the user asks to create a project.",
    inputSchema: {
      type: "object",
      properties: {
        branch: { type: "string", description: "Unique branch name, for example forge/projects/my-game." },
        base_branch: { type: "string", description: "main or another forge/projects/ branch; defaults to main." },
        confirm: { type: "boolean" }
      },
      required: ["branch", "confirm"],
      additionalProperties: false
    }
  },
  {
    name: "forge_project_branch_compare",
    description: "Compare an isolated project branch with main without merging. Returns ahead/behind counts, changed-file summary, and a GitHub compare URL for review. Read-only.",
    inputSchema: {
      type: "object",
      properties: { branch: { type: "string", description: "An existing forge/projects/ branch." } },
      required: ["branch"],
      additionalProperties: false
    }
  },
  {
    name: "forge_project_branch_list",
    description: "List existing isolated project branches under forge/projects/. Read-only.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "forge_workspace_list",
    description: "List files and folders inside workspace/ on a selected project branch (defaults to main).",
    inputSchema: { type: "object", properties: { path: { type: "string", description: "workspace/ or a subfolder under it." }, branch: { type: "string", description: "Project branch; defaults to main." } }, required: ["path"], additionalProperties: false },
  },
  {
    name: "forge_workspace_read",
    description: "Read a UTF-8 project file from a selected branch. Returns its blob SHA for safe updates.",
    inputSchema: { type: "object", properties: { path: { type: "string" }, branch: { type: "string", description: "Project branch; defaults to main." } }, required: ["path"], additionalProperties: false },
  },
  {
    name: "forge_workspace_write",
    description: "Create or update a UTF-8 project file on a forge/projects/ branch as a Git commit. Direct writes to main are blocked. Requires confirm=true. For updates, pass the SHA returned by forge_workspace_read.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        branch: { type: "string", description: "Project branch; defaults to main." },
        content: { type: "string" },
        expected_sha: { type: "string", description: "Required when updating an existing file; omit only when creating a new file." },
        confirm: { type: "boolean" },
      },
      required: ["path", "content", "confirm"],
      additionalProperties: false,
    },
  },
  {
    name: "forge_project_inspect",
    description: "Inspect a committed project directory on a selected branch without running a build. Returns a bounded recursive inventory, detected engine/framework, entry points, and source-size totals.",
    inputSchema: {
      type: "object",
      properties: { project_path: { type: "string", description: "Project directory such as workspace/my-app." }, branch: { type: "string", description: "Project branch; defaults to main." } },
      required: ["project_path"],
      additionalProperties: false
    },
  },
  {
    name: "forge_workspace_batch_write",
    description: "Atomically create or update up to 40 UTF-8 project files on a forge/projects/ branch in one Git commit. Direct writes to main are blocked. Requires confirm=true. Existing files require expected_sha from forge_workspace_read; stale updates are rejected.",
    inputSchema: {
      type: "object",
      properties: {
        branch: { type: "string", description: "Project branch; defaults to main." },
        files: {
          type: "array",
          minItems: 1,
          maxItems: 40,
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
              expected_sha: { type: "string", pattern: "^[a-fA-F0-9]{40}$" }
            },
            required: ["path", "content"],
            additionalProperties: false
          }
        },
        confirm: { type: "boolean" }
      },
      required: ["files", "confirm"],
      additionalProperties: false
    },
  },
  {
    name: "forge_preview_url",
    description: "Return an interactive HTTPS preview URL for a committed HTML entry file inside workspace/. Relative JS, CSS, image, audio, and WebAssembly assets are served from the same project folder. This is a public read-only preview of the public repository; it does not start a build or consume Actions quota.",
    inputSchema: { type: "object", properties: { entry_file: { type: "string", description: "Committed HTML entry file, for example workspace/my-game/index.html or workspace/my-game/build/index.html." }, branch: { type: "string", description: "Project branch; defaults to main." } }, required: ["entry_file"], additionalProperties: false },
  },
  {
    name: "forge_game_preview_url",
    description: "Find the latest successful Godot or Unity Web export workflow that also completed its GitHub Pages deployment, and return the playable browser preview URL. Read-only; does not start a build.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
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
        branch: { type: "string", description: "Project branch to build; defaults to main for legacy projects." },
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
    name: "forge_artifact_download",
    description: "Create a temporary download URL for a ZIP artifact produced by a FORGE on-demand workflow run. The URL expires and the ZIP may contain the APK/AAB or web build.",
    inputSchema: { type: "object", properties: { artifact_id: { type: "integer" } }, required: ["artifact_id"], additionalProperties: false },
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
  if (name === "forge_project_branch_create") {
    if (args.confirm !== true) throw new Error("Branch creation not performed: confirm=true is required after the user asks to create a project.");
    const branch = validateProjectBranch(args.branch);
    if (branch === "main") throw new Error("main cannot be created or replaced as a project branch.");
    const baseBranch = validateProjectBranch(args.base_branch || "main");
    const baseSha = await branchHead(env, baseBranch);
    try {
      await github(env, "git/ref/heads/" + branch);
      throw new Error("Branch already exists: " + branch);
    } catch (error) {
      if (!String(error?.message || error).includes("GitHub API 404")) throw error;
    }
    const created = await github(env, "git/refs", {
      method: "POST",
      body: JSON.stringify({ ref: "refs/heads/" + branch, sha: baseSha })
    });
    return { created: true, branch, base_branch: baseBranch, commit_sha: created.object.sha,
      message: "Project branch created. Subsequent project edits and builds should target this branch, not main." };
  }

  if (name === "forge_project_branch_compare") {
    const branch = validateProjectBranch(args.branch);
    if (branch === "main") throw new Error("Choose a forge/projects/ branch to compare with main.");
    const compare = await github(env, "compare/main..." + branch);
    return {
      branch,
      base_branch: "main",
      status: compare.status,
      ahead_by: compare.ahead_by,
      behind_by: compare.behind_by,
      total_commits: compare.total_commits,
      changed_files: (compare.files || []).slice(0, 100).map(file => ({
        filename: file.filename, status: file.status, additions: file.additions, deletions: file.deletions
      })),
      files_truncated: (compare.files || []).length > 100,
      compare_url: "https://github.com/" + REPO + "/compare/main..." + branch + "?expand=1",
      note: "Read-only comparison. No merge, push to main, or build was performed."
    };
  }

  if (name === "forge_project_branch_list") {
    const data = await github(env, "branches?per_page=100");
    return (data || []).filter(item => item.name.startsWith("forge/projects/"))
      .map(item => ({ branch: item.name, commit_sha: item.commit.sha, protected: item.protected }));
  }
  if (name === "forge_workspace_list") {
    const path = validateWorkspacePath(args.path, true);
    const branch = validateProjectBranch(args.branch || "main");
    const entries = await github(env, `contents/${path}?ref=${encodeURIComponent(branch)}`);
    if (!Array.isArray(entries)) throw new Error("The requested path is not a directory.");
    return entries.filter(entry => ![".git", ".github", ".claude"].includes(entry.name))
      .map(entry => ({ name: entry.name, path: entry.path, type: entry.type, size: entry.size, sha: entry.sha, branch }));
  }

  if (name === "forge_workspace_read") {
    const path = validateWorkspacePath(args.path);
    const branch = validateProjectBranch(args.branch || "main");
    const file = await github(env, `contents/${path}?ref=${encodeURIComponent(branch)}`);
    if (Array.isArray(file) || typeof file.content !== "string" || file.encoding !== "base64")
      throw new Error("The requested path is not a readable text file.");
    return { path: file.path, sha: file.sha, branch, content: decodeBase64Utf8(file.content) };
  }

  if (name === "forge_workspace_write") {
    const path = validateWorkspacePath(args.path);
    const branch = validateProjectBranch(args.branch || "main");
    if (branch === "main") throw new Error("Direct writes to main are blocked. Create a forge/projects/ branch first.");
    if (args.confirm !== true) throw new Error("Write not performed: confirm=true is required after the user asks to create or edit project files.");
    if (typeof args.content !== "string" || new TextEncoder().encode(args.content).length > 500000)
      throw new Error("File content must be UTF-8 text no larger than 500 KB.");
    if (args.expected_sha !== undefined && (typeof args.expected_sha !== "string" || !/^[a-f0-9]{40}$/i.test(args.expected_sha)))
      throw new Error("expected_sha must be a valid Git blob SHA.");
    const payload = { message: `FORGE: update ${path}`, content: encodeBase64Utf8(args.content), branch };
    if (args.expected_sha) payload.sha = args.expected_sha;
    const saved = await github(env, `contents/${path}`, { method: "PUT", body: JSON.stringify(payload) });
    return { saved: true, path: saved.content.path, sha: saved.content.sha, branch,
      commit_sha: saved.commit.sha, html_url: saved.content.html_url };
  }

  if (name === "forge_project_inspect") {
    const projectPath = validateWorkspacePath(args.project_path, true);
    const branch = validateProjectBranch(args.branch || "main");
    if (projectPath === "workspace") throw new Error("Choose a project directory inside workspace/, not the workspace root.");
    const headSha = await branchHead(env, branch);
    const commit = await github(env, "git/commits/" + headSha);
    const tree = await github(env, "git/trees/" + commit.tree.sha + "?recursive=1");
    if (tree.truncated) throw new Error("Repository tree is too large for a complete safe project inventory.");
    const prefix = projectPath + "/";
    const files = (tree.tree || []).filter(item => item.type === "blob" && item.path.startsWith(prefix))
      .filter(item => {
        try { validateWorkspacePath(item.path); return true; }
        catch { return false; }
      });
    if (!files.length) throw new Error("No committed project files were found at " + projectPath);
    const totalBytes = files.reduce((sum, item) => sum + (item.size || 0), 0);
    const names = new Set(files.map(item => item.path.slice(prefix.length)));
    const has = suffix => names.has(suffix);
    const manifests = ["package.json", "pubspec.yaml", "project.godot", "ProjectSettings/ProjectVersion.txt",
      "pyproject.toml", "Cargo.toml", "pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle",
      "settings.gradle.kts", "index.html", "README.md"].filter(has);
    const manifestData = {};
    for (const name of manifests.slice(0, 8)) {
      const item = files.find(file => file.path === prefix + name);
      if (!item || (item.size || 0) > 100000) continue;
      const result = await github(env, "contents/" + item.path + "?ref=" + encodeURIComponent(branch));
      if (result.encoding === "base64" && typeof result.content === "string")
        manifestData[name] = decodeBase64Utf8(result.content);
    }
    let engine = "unknown";
    let framework = "unknown";
    if (has("project.godot")) { engine = "Godot"; framework = "Godot project"; }
    else if (has("ProjectSettings/ProjectVersion.txt") || names.has("Assets") || [...names].some(n => n.startsWith("Assets/"))) {
      engine = "Unity"; framework = "Unity project";
    } else if (has("pubspec.yaml")) {
      engine = "Flutter";
      framework = /sdk:\s*flutter/.test(manifestData["pubspec.yaml"] || "") ? "Flutter" : "Dart";
    } else if (has("package.json")) {
      engine = "Web / Node.js";
      try {
        const pkg = JSON.parse(manifestData["package.json"] || "{}");
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        framework = deps.next ? "Next.js" : deps.vite ? "Vite" : deps.react ? "React" :
          deps.vue ? "Vue" : deps.svelte ? "Svelte" : deps.express ? "Express / Node.js" : "Node.js";
      } catch { framework = "Node.js (invalid package.json)"; }
    } else if (has("pyproject.toml")) { engine = "Python"; framework = "Python project"; }
    else if (has("Cargo.toml")) { engine = "Rust"; framework = "Cargo"; }
    else if (has("build.gradle") || has("build.gradle.kts") || has("settings.gradle") || has("settings.gradle.kts")) {
      engine = "Android / JVM"; framework = "Gradle";
    } else if (has("index.html")) { engine = "Web"; framework = "Static HTML/CSS/JS"; }
    const entryCandidates = ["index.html", "lib/main.dart", "src/main.js", "src/main.ts", "src/main.tsx",
      "src/App.jsx", "src/App.tsx", "main.py", "project.godot", "Assets/Scenes", "app/src/main/AndroidManifest.xml"]
      .filter(has);
    const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
    return {
      project_path: projectPath,
      branch,
      engine,
      framework,
      file_count: files.length,
      total_source_bytes: totalBytes,
      truncated_inventory: sorted.length > 300,
      files: sorted.slice(0, 300).map(item => ({ path: item.path, size: item.size || 0, sha: item.sha })),
      manifests_found: manifests,
      likely_entry_points: entryCandidates,
      note: "Read-only inventory of committed files on the selected branch. No project code was executed and no build was started."
    };
  }

  if (name === "forge_workspace_batch_write") {
    if (args.confirm !== true) throw new Error("Batch write not performed: confirm=true is required after the user asks for these project edits.");
    if (!Array.isArray(args.files) || args.files.length < 1 || args.files.length > 40)
      throw new Error("files must contain between 1 and 40 file entries.");
    const branch = validateProjectBranch(args.branch || "main");
    if (branch === "main") throw new Error("Direct writes to main are blocked. Create a forge/projects/ branch first.");
    const seen = new Set();
    let totalBytes = 0;
    for (const file of args.files) {
      if (!file || typeof file !== "object") throw new Error("Each file entry must be an object.");
      file.path = validateWorkspacePath(file.path);
      if (seen.has(file.path)) throw new Error("Duplicate path in batch: " + file.path);
      seen.add(file.path);
      if (typeof file.content !== "string" || file.content.includes("\\0"))
        throw new Error("Each file must contain valid UTF-8 text without NUL bytes.");
      const size = new TextEncoder().encode(file.content).length;
      if (size > 500000) throw new Error("Each file must be no larger than 500 KB: " + file.path);
      totalBytes += size;
      if (file.expected_sha !== undefined && (typeof file.expected_sha !== "string" || !/^[a-f0-9]{40}$/i.test(file.expected_sha)))
        throw new Error("Invalid expected_sha for " + file.path);
    }
    if (totalBytes > 2000000) throw new Error("The complete batch must be no larger than 2 MB.");
    const parent = await branchHead(env, branch);
    const commit = await github(env, "git/commits/" + parent);
    const tree = await github(env, "git/trees/" + commit.tree.sha + "?recursive=1");
    if (tree.truncated) throw new Error("Repository tree is too large to safely validate this batch.");
    const existing = new Map((tree.tree || []).filter(item => item.type === "blob").map(item => [item.path, item.sha]));
    const entries = [];
    for (const file of args.files) {
      const currentSha = existing.get(file.path);
      if (currentSha && !file.expected_sha)
        throw new Error("Existing file requires expected_sha from forge_workspace_read: " + file.path);
      if (currentSha && currentSha !== file.expected_sha)
        throw new Error("Stale file version; read the latest file before updating: " + file.path);
      if (!currentSha && file.expected_sha)
        throw new Error("expected_sha was supplied for a file that does not exist: " + file.path);
      const blob = await github(env, "git/blobs", {
        method: "POST",
        body: JSON.stringify({ content: file.content, encoding: "utf-8" })
      });
      entries.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const nextTree = await github(env, "git/trees", {
      method: "POST",
      body: JSON.stringify({ base_tree: commit.tree.sha, tree: entries })
    });
    const nextCommit = await github(env, "git/commits", {
      method: "POST",
      body: JSON.stringify({ message: "FORGE: atomic project update (" + entries.length + " files)", tree: nextTree.sha, parents: [parent] })
    });
    await github(env, "git/refs/heads/" + branch, {
      method: "PATCH",
      body: JSON.stringify({ sha: nextCommit.sha, force: false })
    });
    return {
      saved: true,
      atomic: true,
      branch,
      files: entries.map(entry => ({ path: entry.path, sha: entry.sha })),
      file_count: entries.length,
      total_bytes: totalBytes,
      commit_sha: nextCommit.sha,
      commit_url: nextCommit.html_url
    };
  }

  if (name === "forge_preview_url") {
    const entry = validateWorkspacePath(args.entry_file);
    const branch = validateProjectBranch(args.branch || "main");
    if (!entry.toLowerCase().endsWith(".html")) throw new Error("entry_file must point to a committed .html file inside workspace/.");
    const base = (env.PREVIEW_BASE_URL || "https://forge-os-remote-mcp.ma5103032.workers.dev").replace(/\/$/, "");
    const projectDir = entry.slice(0, entry.lastIndexOf("/"));
    return { entry_file: entry, branch, preview_url: base + "/preview/" + entry.split("/").map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(branch),
      version_url: base + "/preview-version/" + projectDir.split("/").map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(branch),
      mode: "interactive-browser-preview", auto_refresh: true, source: "committed " + branch + " branch",
      note: "The preview refreshes after a new commit touching this project folder. This endpoint serves static browser projects and exported Web builds; it does not run native Android APKs." };
  }

  if (name === "forge_game_preview_url") {
    const data = await github(env, `actions/workflows/${WORKFLOW}/runs?per_page=30`);
    for (const run of data.workflow_runs || []) {
      if (run.status !== "completed" || run.conclusion !== "success") continue;
      const jobs = await github(env, `actions/runs/${run.id}/jobs?per_page=100`);
      if (!(jobs.jobs || []).some(job => job.name === "publish-game-preview" && job.conclusion === "success")) continue;
      const result = await github(env, `actions/runs/${run.id}/artifacts?per_page=100`);
      const artifact = (result.artifacts || []).find(a =>
        !a.expired && ["forge-godot-web", "forge-unity-web"].includes(a.name));
      if (!artifact) continue;
      return { found: true, engine: artifact.name.startsWith("forge-godot") ? "Godot" : "Unity",
        run_id: run.id, run_url: run.html_url, artifact_name: artifact.name,
        preview_url: "https://majsjsj.github.io/FORGE-OS/game-preview/",
        note: "This URL serves the latest successful Web build that completed the preview-site deployment. It is interactive in a browser; Android APK/AAB files are not browser previews." };
    }
    return { found: false, message: "No successful Godot or Unity Web build with a completed Pages deployment was found yet. Request an authorized Web build first." };
  }

  if (name === "forge_health") {
    return { ok: true, service: "FORGE Remote Controller", repository: REPO, workflow: WORKFLOW,
      github_token_configured: Boolean(env.GITHUB_TOKEN), build_execution: "on-demand only" };
  }

  if (name === "forge_dispatch_build") {
    const { engine, project_path, output, confirm } = args;
    const branch = validateProjectBranch(args.branch || "main");
    if (confirm !== true) throw new Error("Build not started: confirm=true is required after explicit user authorization.");
    if (!["web", "flutter", "godot", "unity"].includes(engine)) throw new Error("Unsupported engine.");
    if (typeof project_path !== "string" || !/^workspace\/[A-Za-z0-9._/-]+$/.test(project_path) ||
        project_path.includes("..") || project_path.endsWith("/")) {
      throw new Error("project_path must be a safe path inside workspace/, such as workspace/my-app.");
    }
    const allowed = {
      web: ["test", "web"], flutter: ["test", "apk", "aab"],
      godot: ["test", "apk", "aab", "web", "linux"], unity: ["apk", "aab", "web", "linux"],
    };
    if (!allowed[engine].includes(output)) throw new Error(`Output ${output} is not supported for ${engine}.`);
    await github(env, `actions/workflows/${WORKFLOW}/dispatches`, {
      method: "POST",
      body: JSON.stringify({ ref: branch, inputs: { engine, project_path, output, project_branch: branch } }),
    });
    return { accepted: true, engine, project_path, branch, output,
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
      run: { id: run.id, status: run.status, conclusion: run.conclusion, html_url: run.html_url, head_branch: run.head_branch, head_sha: run.head_sha,
        created_at: run.created_at, updated_at: run.updated_at },
      jobs: (jobs.jobs || []).map(j => ({ id: j.id, name: j.name, status: j.status,
        conclusion: j.conclusion, html_url: j.html_url,
        steps: (j.steps || []).map(s => ({ name: s.name, status: s.status, conclusion: s.conclusion })) })),
      artifacts: (artifacts.artifacts || []).map(a => ({ id: a.id, name: a.name,
        size_in_bytes: a.size_in_bytes, expired: a.expired, expires_at: a.expires_at })),
    };
  }

  if (name === "forge_artifact_download") {
    const artifactId = Number(args.artifact_id);
    if (!Number.isSafeInteger(artifactId) || artifactId <= 0) throw new Error("Invalid artifact_id.");
    const artifact = await github(env, `actions/artifacts/${artifactId}`);
    if (artifact.expired) throw new Error("This artifact has expired.");
    const runId = artifact.workflow_run?.id;
    if (!runId) throw new Error("Artifact is not associated with a workflow run.");
    const run = await github(env, `actions/runs/${runId}`);
    if (run.path !== `.github/workflows/${WORKFLOW}`)
      throw new Error("This artifact was not produced by the FORGE on-demand workflow.");
    const response = await fetch(`https://api.github.com/repos/${REPO}/actions/artifacts/${artifactId}/zip`, {
      redirect: "manual",
      headers: { "user-agent": "FORGE-OS-Remote-Controller/1.0", "authorization": `Bearer ${env.GITHUB_TOKEN}`, "accept": "application/vnd.github+json",
        "x-github-api-version": "2022-11-28" },
    });
    if (response.status !== 302) throw new Error(`GitHub artifact download did not return a redirect (HTTP ${response.status}).`);
    const downloadUrl = response.headers.get("location");
    if (!downloadUrl || !downloadUrl.startsWith("https://")) throw new Error("GitHub did not provide a valid temporary download URL.");
    return { artifact_id: artifactId, name: artifact.name, download_url: downloadUrl,
      expires_at: artifact.expires_at, format: "zip",
      note: "Temporary signed GitHub download URL. Download and extract the ZIP to access the build output." };
  }

  if (name === "forge_build_logs") {
    const runId = Number(args.run_id), jobId = Number(args.job_id);
    if (!Number.isSafeInteger(runId) || runId <= 0 || !Number.isSafeInteger(jobId) || jobId <= 0)
      throw new Error("Invalid run_id or job_id.");
    const jobs = await github(env, `actions/runs/${runId}/jobs?per_page=100`);
    if (!(jobs.jobs || []).some(j => j.id === jobId)) throw new Error("job_id does not belong to this run.");
    const response = await fetch(`https://api.github.com/repos/${REPO}/actions/jobs/${jobId}/logs`, {
      headers: { "user-agent": "FORGE-OS-Remote-Controller/1.0", "authorization": `Bearer ${env.GITHUB_TOKEN}`, "accept": "application/vnd.github+json",
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
    const url = new URL(request.url);
    if (url.pathname.startsWith("/preview-version/")) {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      let projectDir;
      try { projectDir = decodeURIComponent(url.pathname.slice("/preview-version/".length)); }
      catch { return new Response("Invalid preview path", { status: 400 }); }
      let branch;
      try {
        validateWorkspacePath(projectDir, true);
        branch = validateProjectBranch(url.searchParams.get("ref") || "main");
        const commits = await github(env, "commits?path=" + encodeURIComponent(projectDir) + "&sha=" + encodeURIComponent(branch) + "&per_page=1");
        return new Response(JSON.stringify({ version: commits[0]?.sha || null, branch }), {
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
            "access-control-allow-origin": "*", "x-content-type-options": "nosniff" }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: String(error?.message || error) }), {
          status: 400, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
            "access-control-allow-origin": "*" }
        });
      }
    }
    if (url.pathname.startsWith("/preview/")) {
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
      let projectFile, branch;
      try {
        projectFile = decodeURIComponent(url.pathname.slice("/preview/".length));
        branch = validateProjectBranch(url.searchParams.get("ref") || "main");
      } catch { return new Response("Invalid preview path or branch", { status: 400 }); }
      if (!/^workspace\/[A-Za-z0-9._/-]+$/.test(projectFile) || projectFile.includes("..") ||
          projectFile.split("/").some(part => !part || part.startsWith("."))) return new Response("Invalid preview path", { status: 400 });
      const rawBranch = branch.split("/").map(encodeURIComponent).join("/");
      const upstream = await fetch("https://raw.githubusercontent.com/" + REPO + "/" + rawBranch + "/" + projectFile.split("/").map(encodeURIComponent).join("/"));
      if (!upstream.ok) return new Response(upstream.status === 404 ? "Preview file not found in the public main branch." : "Preview source unavailable.", { status: upstream.status });
      const ext = projectFile.toLowerCase().split(".").pop();
      const types = { html:"text/html; charset=utf-8", htm:"text/html; charset=utf-8", js:"application/javascript; charset=utf-8",
        css:"text/css; charset=utf-8", json:"application/json; charset=utf-8", wasm:"application/wasm",
        svg:"image/svg+xml", png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", webp:"image/webp", gif:"image/gif",
        ico:"image/x-icon", mp3:"audio/mpeg", ogg:"audio/ogg", wav:"audio/wav", pck:"application/octet-stream",
        data:"application/octet-stream", br:"application/octet-stream", gz:"application/gzip", ttf:"font/ttf", woff:"font/woff", woff2:"font/woff2" };
      const lowerPath = projectFile.toLowerCase();
      let contentType = types[ext] || "application/octet-stream";
      if (lowerPath.endsWith(".wasm.br") || lowerPath.endsWith(".wasm.gz")) contentType = "application/wasm";
      else if (lowerPath.endsWith(".js.br") || lowerPath.endsWith(".js.gz")) contentType = "application/javascript; charset=utf-8";
      else if (lowerPath.endsWith(".css.br") || lowerPath.endsWith(".css.gz")) contentType = "text/css; charset=utf-8";
      const headers = new Headers(upstream.headers);
      headers.set("content-type", contentType);
      headers.set("cache-control", "no-store, max-age=0");
      headers.set("access-control-allow-origin", "*");
      headers.set("cross-origin-resource-policy", "cross-origin");
      headers.set("x-content-type-options", "nosniff");
      if (lowerPath.endsWith(".br")) headers.set("content-encoding", "br");
      else if (lowerPath.endsWith(".gz")) headers.set("content-encoding", "gzip");
      return new Response(request.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
    }
    if (!authorized(request, env)) return json({ error: "Unauthorized" }, 401);
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
        serverInfo: { name: "FORGE-OS Remote Controller", version: "0.4.0" },
        instructions: "FORGE executes only explicitly requested on-demand builds. Project source must be committed under workspace/. Create an isolated forge/projects/<name> branch with forge_project_branch_create before project work; use forge_project_branch_list to find projects. Pass that branch to forge_project_inspect, forge_workspace_list/read/write/batch_write, forge_preview_url, and forge_dispatch_build. Writes to main are blocked; project changes stay isolated until explicitly reviewed and merged. Existing files require expected_sha from forge_workspace_read. Use forge_preview_url for interactive browser previews of committed HTML projects; use forge_game_preview_url to retrieve the latest successfully deployed Godot/Unity Web build; preview is read-only and auto-refreshes when a new commit touches the project folder. Never claim a build succeeded until forge_build_details confirms it.",
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
