# FORGE MOTION — Blender Bridge

## What this is
A first executable, declarative Blender bridge. Claude authors a version-1 scene manifest; the MCP server validates it and can save it as `BLENDER_JOB.json` on an isolated project branch. A Blender installation runs `blender/forge_blender_bridge.py` in background mode to create the scene and render it.

This is not an AI model and does not install Blender. No Blender process is launched by MCP. No cloud worker, render queue, storage bucket, or paid service is provisioned by this change.

## MCP tools
- `forge_blender_job_validate({ job })`: validates the manifest and returns the execution contract without side effects.
- `forge_blender_job_publish({ project_path, branch, job, confirm: true })`: saves `workspace/<project>/BLENDER_JOB.json` on an existing `forge/projects/*` branch. Updating an existing manifest requires `expected_sha` from `forge_workspace_read`.

## Manifest v1
All timing is director-owned. Claude selects frame rate, frame range, camera moves and animation keyframes. The bridge does not impose a creative runtime.

```json
{
  "version": 1,
  "title": "Original product reveal",
  "settings": {
    "fps": 24,
    "width": 1920,
    "height": 1080,
    "frame_start": 1,
    "frame_end": 96,
    "video": true,
    "world_color": [0.02, 0.025, 0.04, 1]
  },
  "materials": [
    {"id": "matte", "name": "Original satin finish", "color": [0.12, 0.3, 0.48, 1], "roughness": 0.32, "metallic": 0.18}
  ],
  "objects": [
    {"id": "hero", "type": "cube", "material": "matte", "location": [0, 0, 0], "scale": [1.2, 1.2, 1.2],
     "keyframes": [
       {"frame": 1, "rotation": [0, 0, 0]},
       {"frame": 96, "rotation": [0, 0, 360]}
     ]}
  ],
  "lights": [
    {"type": "AREA", "location": [4, -4, 6], "energy": 1800, "size": 5},
    {"type": "AREA", "location": [-4, 1, 3], "energy": 900, "size": 3}
  ],
  "camera": {"location": [7, -9, 6], "rotation": [63, 0, 38], "lens": 50}
}
```

Supported primitives: cube, uv_sphere, cylinder, cone, plane, torus, monkey. Object transform keyframes and camera transform keyframes are supported. Materials use Principled BSDF base color, roughness and metallic. Lights: POINT, SUN, SPOT, AREA.

## Run on a machine with Blender installed
From the repository root:

```bash
blender --background --python blender/forge_blender_bridge.py -- --job workspace/my-film/BLENDER_JOB.json --output ./renders
```

For a video render, set `settings.video=true`; Blender's FFmpeg/H.264 support must be available in that Blender build. With `video=false`, the script renders a still image (the current first pass does not yet render a numbered image sequence).

## Security and limits
- Declarative allowlisted primitives only; the manifest cannot supply Python code, shell commands, arbitrary file paths for source assets, or Blender expressions.
- MCP validates bounded counts, IDs, transforms, keyframes, colors, frame ranges and output dimensions.
- The renderer reads only the selected manifest and writes into the caller-selected output directory.
- No downloaded assets, copyrighted references, branded products, franchise characters or living-artist imitation are bundled. Use original, user-owned or properly licensed assets and retain provenance in the FORGE rights ledger.
- The bridge currently creates primitive-based scenes, basic materials, lights, one camera and transform animation. It does not yet support imported models/textures, rigged characters, physics simulations, compositing nodes, audio, transitions between shots, progress/cancellation, remote rendering or studio preview handoff.
- The MCP validator and source syntax are static checks only. Blender has not been installed or executed, and no rendered output has been verified.
