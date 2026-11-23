const REPO = "majsjsj/FORGE-OS";
const WORKFLOW = "forge-on-demand.yml";
const TERMINAL_WORKFLOW = "forge-terminal.yml";
const CLOUD_WORKFLOW = "forge-cloud-session.yml";
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
        content: { type: "string", description: "UTF-8 text up to 4 MB." },
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
    name: "forge_project_preflight",
    description: "Run a read-only release-readiness preflight against committed project files. Detects missing engine manifests and likely entry points, reports structural warnings, and recommends the next safe action. Does not execute code, install dependencies, consume Actions quota, or build.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: { type: "string", description: "Project directory such as workspace/my-app." },
        branch: { type: "string", description: "Existing project branch; defaults to main." }
      },
      required: ["project_path"],
      additionalProperties: false
    }
  },
  {
    name: "forge_studio_artifact_save",
    description: "Save generated FORGE Design Studio files or a Game Lab level JSON into one existing isolated project directory and branch. Paths must stay inside project_path. Requires confirm=true; never writes main. Existing files require expected_sha from forge_workspace_read. This only commits text files; it does not run tests or build.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: { type: "string", description: "Existing project directory, for example workspace/my-app." },
        branch: { type: "string", description: "Existing forge/projects/ branch." },
        artifact_kind: { type: "string", enum: ["design", "game_level", "project_files"] },
        files: {
          type: "array", minItems: 1, maxItems: 20,
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "Full path under project_path, for example workspace/my-app/src/generated.css." },
              content: { type: "string" },
              expected_sha: { type: "string", pattern: "^[a-fA-F0-9]{40}$" }
            },
            required: ["path", "content"],
            additionalProperties: false
          }
        },
        confirm: { type: "boolean" }
      },
      required: ["project_path", "branch", "artifact_kind", "files", "confirm"],
      additionalProperties: false
    }
  },
  {
    name: "forge_project_context_read",
    description: "Read the project's persistent FORGE_CONTEXT.md notes from an isolated project branch. Use this at the start of a continuing project task to recover architecture, decisions, constraints, and TODOs. Read-only; does not expose repository secrets.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: { type: "string", description: "Project directory, for example workspace/my-app." },
        branch: { type: "string", description: "Existing forge/projects/ branch." }
      },
      required: ["project_path", "branch"],
      additionalProperties: false
    }
  },
  {
    name: "forge_project_context_save",
    description: "Create or update the project's persistent FORGE_CONTEXT.md notes on an isolated branch. Store architecture, decisions, constraints, setup, and TODOs only; never store passwords, tokens, private keys, or credentials. Requires confirm=true and expected_sha when updating an existing file. Does not run code or build.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: { type: "string", description: "Project directory, for example workspace/my-app." },
        branch: { type: "string", description: "Existing forge/projects/ branch." },
        content: { type: "string", description: "Project context notes in Markdown; maximum 256 KiB." },
        expected_sha: { type: "string", pattern: "^[a-fA-F0-9]{40}$" },
        confirm: { type: "boolean" }
      },
      required: ["project_path", "branch", "content", "confirm"],
      additionalProperties: false
    }
  },
  {
    name: "forge_workspace_batch_write",
    description: "Atomically create or update up to 150 UTF-8 project files on a forge/projects/ branch in one Git commit. Direct writes to main are blocked. Requires confirm=true. Existing files require expected_sha from forge_workspace_read; stale updates are rejected.",
    inputSchema: {
      type: "object",
      properties: {
        branch: { type: "string", description: "Project branch; defaults to main." },
        files: {
          type: "array",
          minItems: 1,
          maxItems: 150,
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
    name: "forge_terminal_run",
    description: "Run one user-requested shell command inside the selected project directory on a fresh temporary GitHub-hosted runner. Requires confirm=true. Uses no repository secrets, read-only repository permission, no persisted checkout credentials, and a 180-second command limit. Changes made on the runner are temporary and are not committed. Never put passwords, API keys, or other secrets in the command because command text appears in logs.",
    inputSchema: {
      type: "object",
      properties: {
        branch: { type: "string", description: "Existing forge/projects/ branch; main is not allowed." },
        project_path: { type: "string", description: "Project directory, for example workspace/my-app." },
        command: { type: "string", description: "Shell command to run in the project directory; maximum 4000 characters." },
        confirm: { type: "boolean" }
      },
      required: ["branch", "project_path", "command", "confirm"],
      additionalProperties: false
    }
  },
  {
    name: "forge_terminal_latest",
    description: "Get the latest ephemeral terminal run status and URL.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "forge_terminal_details",
    description: "Get status and job IDs for one ephemeral terminal run.",
    inputSchema: { type: "object", properties: { run_id: { type: "integer" } }, required: ["run_id"], additionalProperties: false }
  },
  {
    name: "forge_terminal_logs",
    description: "Read the tail of logs for a job belonging to an ephemeral terminal run.",
    inputSchema: {
      type: "object",
      properties: { run_id: { type: "integer" }, job_id: { type: "integer" } },
      required: ["run_id", "job_id"],
      additionalProperties: false
    }
  },
  {
    name: "forge_cloud_run",
    description: "Run a user-requested setup, dependency installation, test, or project command in a fresh isolated GitHub-hosted cloud workspace. The runner is temporary, has no repository secrets, and has a 10-minute command limit. Requires confirm=true. Set save_changes=true only when the user explicitly wants resulting project files committed to the same isolated forge/projects/ branch; saved changes are limited to 200 files and 50 MB per session. This consumes GitHub Actions quota.",
    inputSchema: {
      type: "object",
      properties: {
        branch: { type: "string", description: "Existing forge/projects/ branch; main is not allowed." },
        project_path: { type: "string", description: "Project directory inside workspace/." },
        command: { type: "string", description: "Command to run in the project folder, maximum 8000 characters. Never include secrets." },
        save_changes: { type: "boolean", description: "Optional; true commits changed files back to this project branch. Defaults to false." },
        confirm: { type: "boolean" }
      },
      required: ["branch", "project_path", "command", "confirm"],
      additionalProperties: false
    }
  },
  { name: "forge_cloud_latest", description: "Get the latest FORGE cloud execution session status and URL. Read-only.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "forge_cloud_details", description: "Get status and job steps for one cloud execution session.", inputSchema: { type: "object", properties: { run_id: { type: "integer" } }, required: ["run_id"], additionalProperties: false } },
  { name: "forge_cloud_logs", description: "Read the tail of logs for a job belonging to a cloud execution session.", inputSchema: { type: "object", properties: { run_id: { type: "integer" }, job_id: { type: "integer" } }, required: ["run_id", "job_id"], additionalProperties: false } },
  {
    name: "forge_asset_upload",
    description: "Upload one binary asset (image, audio, font, model, archive, or game resource) to the optional Cloudflare R2 asset bucket, outside GitHub. Requires an existing forge/projects/ branch, a path inside the selected workspace project, base64 data, and confirm=true. Maximum decoded size is 32 MiB per upload. Returns a temporary signed download URL. Requires the owner to configure the FORGE_ASSETS_BUCKET R2 binding.",
    inputSchema: { type: "object", properties: {
      branch: { type: "string" },
      project_path: { type: "string", description: "Project directory, for example workspace/my-game." },
      asset_path: { type: "string", description: "Asset file path inside that project, for example assets/characters/hero.png." },
      content_base64: { type: "string", description: "Base64-encoded binary file, up to 32 MiB decoded." },
      content_type: { type: "string", description: "Optional MIME type, e.g. image/png or audio/ogg." },
      confirm: { type: "boolean" }
    }, required: ["branch","project_path","asset_path","content_base64","confirm"], additionalProperties: false }
  },
  {
    name: "forge_asset_multipart_start",
    description: "Start a resumable multipart upload to the optional Cloudflare R2 bucket. Returns an upload_id; keep it until completion. Requires confirm=true and an isolated project branch.",
    inputSchema: { type: "object", properties: {
      branch: { type: "string" }, project_path: { type: "string" }, asset_path: { type: "string" },
      content_type: { type: "string" }
      , confirm: { type: "boolean" }
    }, required: ["branch","project_path","asset_path","confirm"], additionalProperties: false }
  },
  {
    name: "forge_asset_multipart_part",
    description: "Upload one part (1–10 MiB decoded) to an existing R2 multipart upload. Use sequential part numbers starting at 1; retain each returned etag for completion. Requires confirm=true.",
    inputSchema: { type: "object", properties: {
      branch: { type: "string" }, project_path: { type: "string" }, asset_path: { type: "string" },
      upload_id: { type: "string" }, part_number: { type: "integer", minimum: 1, maximum: 10000 },
      content_base64: { type: "string" }, is_last_part: { type: "boolean", description: "Set true only for the final part; all earlier parts must be at least 5 MiB." }, confirm: { type: "boolean" }
    }, required: ["branch","project_path","asset_path","upload_id","part_number","content_base64","is_last_part","confirm"], additionalProperties: false }
  },
  {
    name: "forge_asset_multipart_complete",
    description: "Complete an R2 multipart upload using the exact part_number/etag pairs returned by forge_asset_multipart_part. Requires confirm=true. The completed object becomes available through forge_asset_download_url.",
    inputSchema: { type: "object", properties: {
      branch: { type: "string" }, project_path: { type: "string" }, asset_path: { type: "string" },
      upload_id: { type: "string" },
      parts: { type: "array", minItems: 1, maxItems: 10000, items: { type: "object", properties: {
        part_number: { type: "integer", minimum: 1, maximum: 10000 }, etag: { type: "string" }
      }, required: ["part_number","etag"], additionalProperties: false } },
      confirm: { type: "boolean" }
    }, required: ["branch","project_path","asset_path","upload_id","parts","confirm"], additionalProperties: false }
  },
  {
    name: "forge_asset_multipart_abort",
    description: "Abort an incomplete R2 multipart upload and discard its uploaded parts. Requires confirm=true.",
    inputSchema: { type: "object", properties: {
      branch: { type: "string" }, project_path: { type: "string" }, asset_path: { type: "string" },
      upload_id: { type: "string" }, confirm: { type: "boolean" }
    }, required: ["branch","project_path","asset_path","upload_id","confirm"], additionalProperties: false }
  },
  {
    name: "forge_asset_list",
    description: "List assets stored outside GitHub for one project branch. Requires the optional Cloudflare R2 asset bucket. Read-only.",
    inputSchema: { type: "object", properties: { branch: { type: "string" }, project_path: { type: "string" } }, required: ["branch","project_path"], additionalProperties: false }
  },
  {
    name: "forge_asset_delete",
    description: "Delete one externally stored project asset from Cloudflare R2. Requires confirm=true. This does not delete files from the GitHub project branch.",
    inputSchema: { type: "object", properties: { branch: { type: "string" }, project_path: { type: "string" }, asset_path: { type: "string" }, confirm: { type: "boolean" } }, required: ["branch","project_path","asset_path","confirm"], additionalProperties: false }
  },
  {
    name: "forge_asset_download_url",
    description: "Create a temporary signed URL to download one external project asset. URL expires after one hour. Requires the optional Cloudflare R2 asset bucket.",
    inputSchema: { type: "object", properties: { branch: { type: "string" }, project_path: { type: "string" }, asset_path: { type: "string" } }, required: ["branch","project_path","asset_path"], additionalProperties: false }
  },
  {
    name: "forge_asset_import",
    description: "Copy one asset previously stored in the optional Cloudflare R2 bucket into the matching path under workspace/ on its isolated project branch. This makes the binary file part of the Git project so the next authorized build can package it. Requires confirm=true. Existing project files are never overwritten; choose a new asset_path or handle the conflict explicitly. Maximum imported file size is 16 MiB. Requires the FORGE_ASSETS_BUCKET binding.",
    inputSchema: { type: "object", properties: { branch: { type: "string" }, project_path: { type: "string" }, asset_path: { type: "string" }, confirm: { type: "boolean" } }, required: ["branch","project_path","asset_path","confirm"], additionalProperties: false }
  },
  {
    name: "forge_asset_import_batch",
    description: "Stage up to 20 explicitly selected R2 assets into one isolated project branch commit before a build. Each file is limited to 16 MiB and the batch to 40 MiB total. Requires confirm=true; validates every path, rejects duplicate destinations and existing files, and commits all selected assets together or none. This is a manual pre-build staging step, not automatic build-time R2 access.",
    inputSchema: { type: "object", properties: {
      branch: { type: "string" },
      project_path: { type: "string", description: "Project directory, for example workspace/my-game." },
      assets: { type: "array", minItems: 1, maxItems: 20, items: {
        type: "object", properties: {
          asset_path: { type: "string", description: "Relative path of an asset already stored in this project's R2 namespace." }
        }, required: ["asset_path"], additionalProperties: false
      } },
      confirm: { type: "boolean" }
    }, required: ["branch", "project_path", "assets", "confirm"], additionalProperties: false }
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
    if (typeof args.content !== "string" || new TextEncoder().encode(args.content).length > 4000000)
      throw new Error("File content must be UTF-8 text no larger than 4 MB.");
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

  if (name === "forge_project_preflight") {
    const report = await callTool("forge_project_inspect", {
      project_path: args.project_path,
      branch: args.branch || "main"
    }, env);
    const paths = new Set(report.files.map(file => file.path.slice(report.project_path.length + 1)));
    const has = path => paths.has(path);
    const findings = [];
    const add = (severity, code, message) => findings.push({ severity, code, message });
    if (report.engine === "Godot") {
      if (!has("project.godot")) add("blocker", "godot_manifest_missing", "project.godot is missing.");
      else add("info", "godot_manifest_found", "Godot project manifest is present; verify the configured main scene and export presets in an engine run.");
    } else if (report.engine === "Unity") {
      if (!has("ProjectSettings/ProjectVersion.txt")) add("warning", "unity_version_missing", "ProjectSettings/ProjectVersion.txt was not found; Unity version detection may be unreliable.");
      if (![...paths].some(path => path.startsWith("Assets/"))) add("blocker", "unity_assets_missing", "No Assets/ project content was found.");
      else add("info", "unity_assets_found", "Unity Assets/ content is present.");
    } else if (report.engine === "Flutter") {
      if (!has("pubspec.yaml")) add("blocker", "flutter_manifest_missing", "pubspec.yaml is missing.");
      if (!has("lib/main.dart")) add("blocker", "flutter_entry_missing", "lib/main.dart is missing.");
      else add("info", "flutter_entry_found", "Flutter entry point lib/main.dart is present.");
    } else if (report.engine === "Web" || report.engine === "Web / Node.js") {
      if (!has("index.html") && !has("src/main.js") && !has("src/main.ts") && !has("src/main.tsx") && !has("src/App.jsx") && !has("src/App.tsx"))
        add("blocker", "web_entry_missing", "No common web entry point was found.");
      if (report.engine === "Web / Node.js" && !has("package-lock.json") && !has("pnpm-lock.yaml") && !has("yarn.lock"))
        add("warning", "lockfile_missing", "No dependency lockfile was found; reproducible installs are less reliable.");
      add("info", "web_static_checks_only", "This preflight does not install dependencies, execute tests, or launch a browser.");
    } else {
      add("warning", "engine_unrecognized", "The project engine could not be confidently identified from its committed manifests.");
    }
    if (report.file_count > 250) add("warning", "large_file_inventory", "The project contains more than 250 files; inspect the full inventory before release.");
    if (report.total_source_bytes > 50 * 1024 * 1024) add("warning", "large_source_tree", "The committed project exceeds 50 MiB; consider external asset storage for large binaries.");
    if (!findings.length) add("info", "basic_structure_found", "No missing structural requirements were detected by this limited preflight.");
    const blockers = findings.filter(item => item.severity === "blocker").length;
    const warnings = findings.filter(item => item.severity === "warning").length;
    return {
      project_path: report.project_path,
      branch: report.branch,
      engine: report.engine,
      framework: report.framework,
      readiness: blockers ? "blocked" : warnings ? "ready_with_warnings" : "structurally_ready",
      blockers,
      warnings,
      findings,
      next_actions: blockers
        ? ["Resolve all blocker findings, commit the fixes, then run preflight again."]
        : ["Run the engine-specific test workflow on explicit request.", "Review warnings and verify the application in a real browser or device before release."],
      limitations: ["Read-only structural analysis only.", "No project code was executed.", "No dependencies were installed.", "No build or device test was started."]
    };
  }

  if (name === "forge_studio_artifact_save") {
    if (args.confirm !== true) throw new Error("Artifact save not performed: confirm=true is required.");
    const projectPath = validateWorkspacePath(args.project_path, true);
    if (projectPath === "workspace") throw new Error("project_path must identify a project directory below workspace/.");
    const branch = validateProjectBranch(args.branch);
    if (branch === "main" || !branch.startsWith("forge/projects/"))
      throw new Error("Studio artifacts can only be saved to an existing forge/projects/ branch.");
    if (!["design", "game_level", "project_files"].includes(args.artifact_kind))
      throw new Error("Unsupported artifact_kind.");
    if (!Array.isArray(args.files) || args.files.length < 1 || args.files.length > 20)
      throw new Error("Studio artifact save accepts 1 to 20 files.");
    const prefix = projectPath + "/";
    for (const file of args.files) {
      file.path = validateWorkspacePath(file.path);
      if (!file.path.startsWith(prefix))
        throw new Error("Every artifact path must stay inside project_path: " + file.path);
    }
    const result = await callTool("forge_workspace_batch_write", {
      branch,
      files: args.files,
      confirm: true
    }, env);
    return {
      ...result,
      artifact_kind: args.artifact_kind,
      project_path: projectPath,
      scope: "project-directory-only",
      note: "Committed generated Studio files only; no code execution, tests, or build were started."
    };
  }

  if (name === "forge_project_context_read") {
    const projectPath = validateWorkspacePath(args.project_path, true);
    if (projectPath === "workspace") throw new Error("Choose a project directory below workspace/.");
    const branch = validateProjectBranch(args.branch);
    if (branch === "main" || !branch.startsWith("forge/projects/"))
      throw new Error("Project context can only be read from a forge/projects/ branch.");
    return await callTool("forge_workspace_read", {
      path: projectPath + "/FORGE_CONTEXT.md",
      branch
    }, env);
  }

  if (name === "forge_project_context_save") {
    if (args.confirm !== true) throw new Error("Project context was not saved: confirm=true is required.");
    const projectPath = validateWorkspacePath(args.project_path, true);
    if (projectPath === "workspace") throw new Error("Choose a project directory below workspace/.");
    const branch = validateProjectBranch(args.branch);
    if (branch === "main" || !branch.startsWith("forge/projects/"))
      throw new Error("Project context can only be saved to a forge/projects/ branch.");
    if (typeof args.content !== "string" || new TextEncoder().encode(args.content).length > 256 * 1024)
      throw new Error("Project context must be UTF-8 text no larger than 256 KiB.");
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(args.content) ||
        /(?:api[_-]?key|access[_-]?token|password|client[_-]?secret)\s*[:=]\s*[^\s<>{}]{12,}/i.test(args.content))
      throw new Error("Project context must not contain credential values. Record secret names/references only.");
    return await callTool("forge_workspace_write", {
      path: projectPath + "/FORGE_CONTEXT.md",
      branch,
      content: args.content,
      ...(args.expected_sha ? { expected_sha: args.expected_sha } : {}),
      confirm: true
    }, env);
  }

  if (name === "forge_workspace_batch_write") {
    if (args.confirm !== true) throw new Error("Batch write not performed: confirm=true is required after the user asks for these project edits.");
    if (!Array.isArray(args.files) || args.files.length < 1 || args.files.length > 150)
      throw new Error("files must contain between 1 and 150 file entries.");
    const branch = validateProjectBranch(args.branch || "main");
    if (branch === "main") throw new Error("Direct writes to main are blocked. Create a forge/projects/ branch first.");
    const seen = new Set();
    let totalBytes = 0;
    for (const file of args.files) {
      if (!file || typeof file !== "object") throw new Error("Each file entry must be an object.");
      file.path = validateWorkspacePath(file.path);
      if (seen.has(file.path)) throw new Error("Duplicate path in batch: " + file.path);
      seen.add(file.path);
      if (typeof file.content !== "string" || file.content.includes("\0"))
        throw new Error("Each file must contain valid UTF-8 text without NUL bytes.");
      const size = new TextEncoder().encode(file.content).length;
      if (size > 4000000) throw new Error("Each text file must be no larger than 4 MB: " + file.path);
      totalBytes += size;
      if (file.expected_sha !== undefined && (typeof file.expected_sha !== "string" || !/^[a-f0-9]{40}$/i.test(file.expected_sha)))
        throw new Error("Invalid expected_sha for " + file.path);
    }
    if (totalBytes > 20000000) throw new Error("The complete atomic batch must be no larger than 20 MB. Use multiple batches or a cloud session for larger projects.");
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
    const base = (env.PREVIEW_BASE_URL || "https://forge-os-remote-mcp.majsjsj.workers.dev").replace(/\/$/, "");
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

  if (name === "forge_terminal_run") {
    if (args.confirm !== true) throw new Error("Terminal command not started: confirm=true is required after the user explicitly requests execution.");
    const branch = validateProjectBranch(args.branch);
    if (branch === "main") throw new Error("Terminal execution requires an isolated forge/projects/ branch; main is not allowed.");
    const projectPath = validateWorkspacePath(args.project_path, true);
    if (projectPath === "workspace") throw new Error("Choose a project directory inside workspace/.");
    if (typeof args.command !== "string" || !args.command.trim() || args.command.length > 4000 || args.command.includes("\0"))
      throw new Error("command must be non-empty, contain no NUL bytes, and be no longer than 4000 characters.");
    await branchHead(env, branch);
    await github(env, `actions/workflows/${TERMINAL_WORKFLOW}/dispatches`, {
      method: "POST",
      body: JSON.stringify({ ref: branch, inputs: {
        project_branch: branch, project_path: projectPath, command: args.command
      } })
    });
    return { accepted: true, branch, project_path: projectPath, command_length: args.command.length,
      command_timeout_seconds: 180, workflow: TERMINAL_WORKFLOW,
      message: "GitHub accepted the ephemeral terminal request. Use forge_terminal_latest, then forge_terminal_details and forge_terminal_logs to inspect it. The runner is temporary; filesystem changes are discarded when it ends." };
  }

  if (name === "forge_terminal_latest") {
    const data = await github(env, `actions/workflows/${TERMINAL_WORKFLOW}/runs?per_page=1`);
    const run = data.workflow_runs?.[0];
    if (!run) return { found: false, message: "No terminal runs found yet." };
    return { found: true, run_id: run.id, status: run.status, conclusion: run.conclusion,
      html_url: run.html_url, created_at: run.created_at, updated_at: run.updated_at,
      branch: run.head_branch, head_sha: run.head_sha };
  }

  if (name === "forge_terminal_details") {
    const runId = Number(args.run_id);
    if (!Number.isSafeInteger(runId) || runId <= 0) throw new Error("Invalid run_id.");
    const run = await github(env, `actions/runs/${runId}`);
    if (run.path !== `.github/workflows/${TERMINAL_WORKFLOW}`)
      throw new Error("This run was not created by the FORGE ephemeral terminal workflow.");
    const jobs = await github(env, `actions/runs/${runId}/jobs?per_page=100`);
    return { run: { id: run.id, status: run.status, conclusion: run.conclusion,
      html_url: run.html_url, branch: run.head_branch, head_sha: run.head_sha },
      jobs: (jobs.jobs || []).map(job => ({ id: job.id, name: job.name, status: job.status,
        conclusion: job.conclusion, html_url: job.html_url,
        steps: (job.steps || []).map(step => ({ name: step.name, status: step.status, conclusion: step.conclusion })) })) };
  }

  if (name === "forge_terminal_logs") {
    const runId = Number(args.run_id), jobId = Number(args.job_id);
    if (!Number.isSafeInteger(runId) || runId <= 0 || !Number.isSafeInteger(jobId) || jobId <= 0)
      throw new Error("Invalid run_id or job_id.");
    const run = await github(env, `actions/runs/${runId}`);
    if (run.path !== `.github/workflows/${TERMINAL_WORKFLOW}`)
      throw new Error("This run was not created by the FORGE ephemeral terminal workflow.");
    const jobs = await github(env, `actions/runs/${runId}/jobs?per_page=100`);
    if (!(jobs.jobs || []).some(job => job.id === jobId)) throw new Error("job_id does not belong to this terminal run.");
    const response = await fetch(`https://api.github.com/repos/${REPO}/actions/jobs/${jobId}/logs`, {
      headers: { "user-agent": "FORGE-OS-Remote-Controller/1.0",
        "authorization": `Bearer ${env.GITHUB_TOKEN}`, "accept": "application/vnd.github+json",
        "x-github-api-version": "2022-11-28" }
    });
    if (!response.ok) throw new Error(`GitHub terminal logs API ${response.status}.`);
    const logs = await response.text();
    return { run_id: runId, job_id: jobId, truncated: logs.length > 16000, logs: logs.slice(-16000) };
  }

  if (name === "forge_cloud_run") {
    if (args.confirm !== true) throw new Error("Cloud session not started: confirm=true is required after the user explicitly requests execution.");
    const branch = validateProjectBranch(args.branch);
    if (branch === "main") throw new Error("Cloud execution requires an isolated forge/projects/ branch; main is not allowed.");
    const projectPath = validateWorkspacePath(args.project_path, true);
    if (projectPath === "workspace") throw new Error("Choose a project directory inside workspace/.");
    if (typeof args.command !== "string" || !args.command.trim() || args.command.length > 8000 || args.command.includes("\0"))
      throw new Error("command must be non-empty, contain no NUL bytes, and be no longer than 8000 characters.");
    const saveChanges = args.save_changes === true;
    await branchHead(env, branch);
    await github(env, `actions/workflows/${CLOUD_WORKFLOW}/dispatches`, {
      method: "POST",
      body: JSON.stringify({ ref: branch, inputs: { project_branch: branch, project_path: projectPath, command: args.command, save_changes: String(saveChanges) } })
    });
    return { accepted: true, branch, project_path: projectPath, save_changes: saveChanges, command_timeout_seconds: 600, workflow: CLOUD_WORKFLOW,
      message: saveChanges ? "Cloud session accepted. Changed files will be committed only inside the selected project directory and only to the same isolated branch. Use forge_cloud_latest/details/logs to inspect it." : "Cloud session accepted. Changes are temporary and will be discarded when the runner ends. Use forge_cloud_latest/details/logs to inspect it." };
  }

  if (name === "forge_cloud_latest") {
    const data = await github(env, `actions/workflows/${CLOUD_WORKFLOW}/runs?per_page=1`);
    const run = data.workflow_runs?.[0];
    if (!run) return { found: false, message: "No cloud execution sessions found yet." };
    return { found: true, run_id: run.id, status: run.status, conclusion: run.conclusion, html_url: run.html_url, created_at: run.created_at, updated_at: run.updated_at, branch: run.head_branch, head_sha: run.head_sha };
  }

  if (name === "forge_cloud_details") {
    const runId = Number(args.run_id);
    if (!Number.isSafeInteger(runId) || runId <= 0) throw new Error("Invalid run_id.");
    const run = await github(env, `actions/runs/${runId}`);
    if (run.path !== `.github/workflows/${CLOUD_WORKFLOW}`) throw new Error("This run was not created by the FORGE cloud execution workflow.");
    const jobs = await github(env, `actions/runs/${runId}/jobs?per_page=100`);
    return { run: { id: run.id, status: run.status, conclusion: run.conclusion, html_url: run.html_url, branch: run.head_branch, head_sha: run.head_sha }, jobs: (jobs.jobs || []).map(job => ({ id: job.id, name: job.name, status: job.status, conclusion: job.conclusion, html_url: job.html_url, steps: (job.steps || []).map(step => ({ name: step.name, status: step.status, conclusion: step.conclusion })) })) };
  }

  if (name === "forge_cloud_logs") {
    const runId = Number(args.run_id), jobId = Number(args.job_id);
    if (!Number.isSafeInteger(runId) || runId <= 0 || !Number.isSafeInteger(jobId) || jobId <= 0) throw new Error("Invalid run_id or job_id.");
    const run = await github(env, `actions/runs/${runId}`);
    if (run.path !== `.github/workflows/${CLOUD_WORKFLOW}`) throw new Error("This run was not created by the FORGE cloud execution workflow.");
    const jobs = await github(env, `actions/runs/${runId}/jobs?per_page=100`);
    if (!(jobs.jobs || []).some(job => job.id === jobId)) throw new Error("job_id does not belong to this cloud session.");
    const response = await fetch(`https://api.github.com/repos/${REPO}/actions/jobs/${jobId}/logs`, { headers: { "user-agent": "FORGE-OS-Remote-Controller/1.0", "authorization": `Bearer ${env.GITHUB_TOKEN}`, "accept": "application/vnd.github+json", "x-github-api-version": "2022-11-28" } });
    if (!response.ok) throw new Error(`GitHub cloud logs API ${response.status}.`);
    const logs = await response.text();
    return { run_id: runId, job_id: jobId, truncated: logs.length > 20000, logs: logs.slice(-20000) };
  }

  if (["forge_asset_upload","forge_asset_list","forge_asset_delete","forge_asset_download_url","forge_asset_import","forge_asset_import_batch","forge_asset_multipart_start","forge_asset_multipart_part","forge_asset_multipart_complete","forge_asset_multipart_abort"].includes(name)) {
    const bucket = env.FORGE_ASSETS_BUCKET;
    if (!bucket || typeof bucket.put !== "function") throw new Error("External asset storage is not configured. Create a Cloudflare R2 bucket and bind it to this Worker as FORGE_ASSETS_BUCKET; see docs/ASSET-STORAGE.md. No asset was changed.");
    const branch = validateProjectBranch(args.branch);
    if (branch === "main") throw new Error("External assets require an isolated forge/projects/ branch.");
    const project = validateWorkspacePath(args.project_path, true);
    if (project === "workspace") throw new Error("Choose a project directory inside workspace/.");
    const assetPath = args.asset_path === undefined ? "" : args.asset_path;
    if (assetPath && (typeof assetPath !== "string" || !/^[A-Za-z0-9._/-]+$/.test(assetPath) || assetPath.startsWith("/") || assetPath.includes("..") || assetPath.split("/").some(part => !part || part.startsWith(".") || /secret|credential|service-account/i.test(part) || /\.(pem|key|p12|pfx|jks|keystore|mobileprovision)$/i.test(part))))
      throw new Error("asset_path must be a safe relative path without hidden or traversal segments.");
    const prefix = "projects/" + encodeURIComponent(branch) + "/" + project + "/";
    const key = prefix + assetPath;
    if (name === "forge_asset_import_batch") {
      if (args.confirm !== true) throw new Error("Batch asset staging not performed: confirm=true is required after the user explicitly requests staging the selected assets.");
      if (!Array.isArray(args.assets) || args.assets.length < 1 || args.assets.length > 20)
        throw new Error("Select between 1 and 20 assets for one staging batch.");
      const selected = [];
      const seen = new Set();
      for (const entry of args.assets) {
        const path = entry?.asset_path;
        if (typeof path !== "string" || !path.length || !/^[A-Za-z0-9._/-]+$/.test(path) ||
            path.startsWith("/") || path.includes("..") ||
            path.split("/").some(part => !part || part.startsWith(".") || /secret|credential|service-account/i.test(part) ||
              /\\.(pem|key|p12|pfx|jks|keystore|mobileprovision)$/i.test(part)))
          throw new Error("Every asset_path must be a safe relative path without hidden, traversal, or credential-like segments.");
        if (seen.has(path)) throw new Error("Duplicate asset_path in batch: " + path);
        seen.add(path);
        selected.push({ asset_path: path, destination: validateWorkspacePath(project + "/" + path) });
      }
      const parent = await branchHead(env, branch);
      const currentCommit = await github(env, "git/commits/" + parent);
      const currentTree = await github(env, "git/trees/" + currentCommit.tree.sha + "?recursive=1");
      if (currentTree.truncated) throw new Error("Repository tree is too large to safely stage this asset batch.");
      const existing = new Set((currentTree.tree || []).filter(item => item.type === "blob").map(item => item.path));
      for (const item of selected) {
        if (existing.has(item.destination))
          throw new Error("A destination already exists; no files were overwritten and no commit was created: " + item.destination);
      }
      const staged = [];
      let totalBytes = 0;
      for (const item of selected) {
        const object = await bucket.get(prefix + item.asset_path);
        if (!object) throw new Error("Selected R2 asset not found; no project commit was created: " + item.asset_path);
        if (typeof object.size === "number" && (object.size <= 0 || object.size > 16 * 1024 * 1024))
          throw new Error("Each imported asset must be non-empty and no larger than 16 MiB: " + item.asset_path);
        const bytes = new Uint8Array(await object.arrayBuffer());
        if (!bytes.length || bytes.length > 16 * 1024 * 1024)
          throw new Error("Each imported asset must be non-empty and no larger than 16 MiB: " + item.asset_path);
        totalBytes += bytes.length;
        if (totalBytes > 40 * 1024 * 1024)
          throw new Error("The selected batch exceeds the 40 MiB total limit; no project commit was created.");
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 0x8000)
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
        staged.push({ ...item, bytes: bytes.length, content_type: object.httpMetadata?.contentType || "application/octet-stream",
          binary, sha: null });
      }
      const treeEntries = [];
      for (const item of staged) {
        const blob = await github(env, "git/blobs", {
          method: "POST",
          body: JSON.stringify({ content: btoa(item.binary), encoding: "base64" })
        });
        treeEntries.push({ path: item.destination, mode: "100644", type: "blob", sha: blob.sha });
        delete item.binary;
      }
      const nextTree = await github(env, "git/trees", {
        method: "POST",
        body: JSON.stringify({ base_tree: currentCommit.tree.sha, tree: treeEntries })
      });
      const nextCommit = await github(env, "git/commits", {
        method: "POST",
        body: JSON.stringify({ message: "FORGE: stage " + staged.length + " external assets", tree: nextTree.sha, parents: [parent] })
      });
      await github(env, "git/refs/heads/" + branch, {
        method: "PATCH",
        body: JSON.stringify({ sha: nextCommit.sha, force: false })
      });
      return { imported: true, atomic_commit: true, branch, project_path: project, files: staged.map(item => ({
        asset_path: item.asset_path, destination: item.destination, size_bytes: item.bytes, content_type: item.content_type
      })), file_count: staged.length, total_size_bytes: totalBytes, commit_sha: nextCommit.sha,
        commit_url: nextCommit.html_url,
        note: "All selected assets were committed together to the isolated project branch. The next explicitly authorized build can package these files; no build was started." };
    }
    if (name === "forge_asset_import") {
      if (args.confirm !== true) throw new Error("Asset import not performed: confirm=true is required after the user explicitly requests copying this R2 asset into the project branch.");
      if (!assetPath) throw new Error("asset_path is required.");
      const destination = validateWorkspacePath(project + "/" + assetPath);
      const object = await bucket.get(key);
      if (!object) throw new Error("The selected asset does not exist in R2 for this branch and project.");
      if (typeof object.size === "number" && object.size > 16 * 1024 * 1024)
        throw new Error("One imported asset is limited to 16 MiB.");
      const bytes = new Uint8Array(await object.arrayBuffer());
      if (!bytes.length || bytes.length > 16 * 1024 * 1024) throw new Error("The selected R2 asset must be non-empty and no larger than 16 MiB.");
      const parent = await branchHead(env, branch);
      const currentCommit = await github(env, "git/commits/" + parent);
      const currentTree = await github(env, "git/trees/" + currentCommit.tree.sha + "?recursive=1");
      if (currentTree.truncated) throw new Error("Repository tree is too large to safely import this asset.");
      if ((currentTree.tree || []).some(item => item.path === destination))
        throw new Error("The destination already exists on this branch; no file was overwritten: " + destination);
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      const blob = await github(env, "git/blobs", {
        method: "POST",
        body: JSON.stringify({ content: btoa(binary), encoding: "base64" })
      });
      const nextTree = await github(env, "git/trees", {
        method: "POST",
        body: JSON.stringify({ base_tree: currentCommit.tree.sha, tree: [{ path: destination, mode: "100644", type: "blob", sha: blob.sha }] })
      });
      const nextCommit = await github(env, "git/commits", {
        method: "POST",
        body: JSON.stringify({ message: "FORGE: import asset " + destination, tree: nextTree.sha, parents: [parent] })
      });
      await github(env, "git/refs/heads/" + branch, {
        method: "PATCH",
        body: JSON.stringify({ sha: nextCommit.sha, force: false })
      });
      return { imported: true, branch, project_path: project, asset_path: assetPath, destination,
        size_bytes: bytes.length, commit_sha: nextCommit.sha, commit_url: nextCommit.html_url,
        content_type: object.httpMetadata?.contentType || "application/octet-stream",
        note: "The asset is now committed to the isolated project branch and will be available to the next explicitly requested build." };
    }
    if (name.startsWith("forge_asset_multipart_")) {
      if (args.confirm !== true) throw new Error("Multipart operation not performed: confirm=true is required.");
      if (typeof args.upload_id !== "string" && name !== "forge_asset_multipart_start")
        throw new Error("A valid upload_id is required.");
      if (name === "forge_asset_multipart_start") {
        if (typeof bucket.createMultipartUpload !== "function") throw new Error("This R2 binding does not support multipart uploads.");
        const type = typeof args.content_type === "string" && args.content_type.length <= 128 ? args.content_type : "application/octet-stream";
        const upload = await bucket.createMultipartUpload(key, {
          httpMetadata: { contentType: type },
          customMetadata: { branch, project_path: project, asset_path: assetPath }
        });
        return { started: true, branch, project_path: project, asset_path: assetPath, upload_id: upload.uploadId,
          note: "Keep upload_id and every returned part etag. Upload sequential parts, then call forge_asset_multipart_complete. Incomplete uploads should be completed or explicitly aborted." };
      }
      if (args.upload_id.length < 1 || args.upload_id.length > 2048) throw new Error("Invalid upload_id.");
      if (typeof bucket.resumeMultipartUpload !== "function") throw new Error("This R2 binding does not support multipart uploads.");
      const upload = bucket.resumeMultipartUpload(key, args.upload_id);
      if (name === "forge_asset_multipart_part") {
        const n = Number(args.part_number);
        if (!Number.isInteger(n) || n < 1 || n > 10000) throw new Error("part_number must be between 1 and 10000.");
        if (typeof args.content_base64 !== "string" || !args.content_base64.length || args.content_base64.length > 14913080)
          throw new Error("Each part must contain non-empty base64 data no larger than 10 MiB decoded.");
        const raw = atob(args.content_base64.replace(/\s/g,""));
        if (raw.length > 10 * 1024 * 1024 || raw.length < 1) throw new Error("Each part must be between 1 byte and 10 MiB.");
        if (args.is_last_part !== true && raw.length < 5 * 1024 * 1024)
          throw new Error("Every non-final R2 multipart part must be at least 5 MiB. Set is_last_part=true only for the final part.");
        const bytes = Uint8Array.from(raw, ch => ch.charCodeAt(0));
        const result = await upload.uploadPart(n, bytes);
        return { uploaded: true, part_number: n, etag: result.etag, size_bytes: bytes.length, upload_id: args.upload_id };
      }
      if (name === "forge_asset_multipart_complete") {
        if (!Array.isArray(args.parts) || !args.parts.length || args.parts.length > 10000) throw new Error("Provide 1–10000 uploaded parts.");
        const parts = args.parts.map(p => ({ partNumber: Number(p.part_number), etag: p.etag }));
        for (let i=0;i<parts.length;i++) {
          if (!Number.isInteger(parts[i].partNumber) || parts[i].partNumber !== i+1 || typeof parts[i].etag !== "string" || !parts[i].etag.length || parts[i].etag.length > 256)
            throw new Error("Parts must be sequential from 1 and use the exact etag returned for each part.");
        }
        const result = await upload.complete(parts);
        return { completed: true, branch, project_path: project, asset_path: assetPath, size_bytes: result.size, etag: result.etag,
          note: "Multipart asset is stored in R2. Use forge_asset_download_url to obtain a temporary download URL." };
      }
      if (name === "forge_asset_multipart_abort") {
        await upload.abort();
        return { aborted: true, branch, project_path: project, asset_path: assetPath, upload_id: args.upload_id };
      }
    }
    if (name === "forge_asset_list") {
      const listed = await bucket.list({ prefix, limit: 1000, cursor: typeof args.cursor === "string" ? args.cursor : undefined });
      return { branch, project_path: project, assets: (listed.objects || []).map(o => ({ asset_path: o.key.slice(prefix.length), size_bytes: o.size, uploaded: o.uploaded, etag: o.etag })), truncated: Boolean(listed.truncated), cursor: listed.truncated ? listed.cursor : null };
    }
    if (!assetPath) throw new Error("asset_path is required.");
    if (name === "forge_asset_delete") {
      if (args.confirm !== true) throw new Error("Asset deletion not performed: confirm=true is required after the user explicitly requests deletion.");
      await bucket.delete(key);
      return { deleted: true, branch, project_path: project, asset_path: assetPath };
    }
    if (name === "forge_asset_upload") {
      if (args.confirm !== true) throw new Error("Asset upload not performed: confirm=true is required after the user explicitly requests upload.");
      if (typeof args.content_base64 !== "string" || !args.content_base64.length || args.content_base64.length > 44739244) throw new Error("content_base64 must be a non-empty base64 string representing no more than 32 MiB.");
      const raw = atob(args.content_base64.replace(/\s/g, ""));
      if (raw.length > 32 * 1024 * 1024) throw new Error("One asset upload is limited to 32 MiB decoded. Split or compress the asset before upload.");
      const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
      const type = typeof args.content_type === "string" && args.content_type.length <= 128 ? args.content_type : "application/octet-stream";
      await bucket.put(key, bytes, { httpMetadata: { contentType: type }, customMetadata: { branch, project_path: project, asset_path: assetPath } });
    }
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const secret = env.FORGE_ACCESS_TOKEN;
    if (!secret) throw new Error("FORGE_ACCESS_TOKEN is not configured; cannot sign asset download URLs.");
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(key + "\\n" + expires)))).map(b => b.toString(16).padStart(2,"0")).join("");
    const base = (env.ASSET_BASE_URL || new URL("https://"+(env.WORKER_HOST || "forge-os-remote-mcp.majsjsj.workers.dev")).origin).replace(/\/$/,"");
    return { uploaded: name === "forge_asset_upload", branch, project_path: project, asset_path: assetPath, size_bytes: name === "forge_asset_upload" ? atob(args.content_base64.replace(/\s/g,"")).length : undefined, download_url: base + "/assets/" + key.split("/").map(encodeURIComponent).join("/") + "?expires=" + expires + "&sig=" + signature, expires_at: new Date(expires * 1000).toISOString(), note: "Asset bytes are stored in Cloudflare R2, not in Git history or GitHub Actions artifacts. Add the returned URL to the project configuration or download it during a build." };
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
    if (url.pathname.startsWith("/assets/")) {
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
      const bucket = env.FORGE_ASSETS_BUCKET;
      if (!bucket || typeof bucket.get !== "function") return new Response("Asset storage is not configured.", { status: 503 });
      let key;
      try { key = url.pathname.slice("/assets/".length).split("/").map(decodeURIComponent).join("/"); }
      catch { return new Response("Invalid asset path.", { status: 400 }); }
      if (!key.startsWith("projects/") || key.includes("..") || key.split("/").some(part => !part || part.startsWith(".")))
        return new Response("Invalid asset path.", { status: 400 });
      const expires = Number(url.searchParams.get("expires")), sig = url.searchParams.get("sig") || "";
      if (!Number.isSafeInteger(expires) || expires < Math.floor(Date.now()/1000) || expires > Math.floor(Date.now()/1000)+3600 || !/^[a-f0-9]{64}$/i.test(sig))
        return new Response("Signed URL expired or invalid.", { status: 403 });
      const secret = env.FORGE_ACCESS_TOKEN;
      if (!secret) return new Response("Asset signing is not configured.", { status: 503 });
      const encoder = new TextEncoder();
      const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const expected = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(key + "\\n" + expires)))).map(b => b.toString(16).padStart(2,"0")).join("");
      let mismatch = expected.length ^ sig.length;
      for (let i=0;i<Math.min(expected.length,sig.length);i++) mismatch |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
      if (mismatch) return new Response("Signed URL invalid.", { status: 403 });
      const object = await bucket.get(key);
      if (!object) return new Response("Asset not found.", { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("cache-control", "private, max-age=300");
      headers.set("x-content-type-options", "nosniff");
      return new Response(request.method === "HEAD" ? null : object.body, { headers });
    }
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
        serverInfo: { name: "FORGE-OS Remote Controller", version: "0.8.0" },
        instructions: "FORGE executes only explicitly requested on-demand builds. Project source must be committed under workspace/. Create an isolated forge/projects/<name> branch with forge_project_branch_create before project work; use forge_terminal_run for short disposable commands; use forge_cloud_run for dependency installation, longer tests, and project tasks; cloud sessions use a temporary runner without repository secrets and can save project-only changes to the same isolated branch only when save_changes=true; use forge_project_branch_list to find projects; read forge_project_context_read at the start of a continuing project task and update forge_project_context_save with confirmed architecture, decisions, constraints, and TODOs (never credentials); run forge_project_inspect followed by forge_project_preflight for a read-only structural release check before any explicitly authorized engine test/build; preflight does not execute code or consume Actions quota; use forge_asset_upload/list/delete/download_url for optional Cloudflare R2 assets only when FORGE_ASSETS_BUCKET is configured; use forge_asset_import or forge_asset_import_batch to explicitly stage selected R2 files into the project branch before a separately authorized build. R2 assets are not fetched automatically by GitHub build runners. Pass that branch to forge_project_inspect, forge_workspace_list/read/write/batch_write, forge_preview_url, and forge_dispatch_build. Writes to main are blocked; project changes stay isolated until explicitly reviewed and merged. Existing files require expected_sha from forge_workspace_read. Use forge_preview_url for interactive browser previews of committed HTML projects; use forge_game_preview_url to retrieve the latest successfully deployed Godot/Unity Web build; preview is read-only and auto-refreshes when a new commit touches the project folder. Never claim a build succeeded until forge_build_details confirms it.",
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
