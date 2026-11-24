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
    {"id": "matte", "name": "Original satin finish", "color": [0.12, 0.3, 0.48, 1], "roughness": 0.32, "metallic": 0.18, "base_color_texture": "textures/hero-albedo.png"}
  ],
  "objects": [
    {"id": "hero", "type": "imported_model", "asset": "models/hero.glb", "material": "matte", "location": [0, 0, 0], "scale": [1, 1, 1],
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

Supported primitives: cube, uv_sphere, cylinder, cone, plane, torus, monkey. Imported models: GLB, GLTF and FBX. Textures: one base-color image per declared material (PNG, JPG/JPEG, WebP, TIF/TIFF). Object transform keyframes and camera transform keyframes are supported. Materials use Principled BSDF base color, roughness, metallic and optional base-color texture. Lights: POINT, SUN, SPOT, AREA.

Place approved assets under a dedicated assets directory, preserving the relative paths in the job. Example layout: `assets/models/hero.glb` and `assets/textures/hero-albedo.png`. Run with an explicit assets root:

## Run on a machine with Blender installed
From the repository root:

```bash
blender --background --python blender/forge_blender_bridge.py -- --job workspace/my-film/BLENDER_JOB.json --assets-root ./assets --output ./renders
```

For a video render, set `settings.video=true`; Blender's FFmpeg/H.264 support must be available in that Blender build. With `video=false`, the script renders a still image (the current first pass does not yet render a numbered image sequence).

## Security and limits
- Declarative allowlisted primitives and import formats only; the manifest cannot supply Python code, shell commands, arbitrary absolute file paths, or Blender expressions.
- Model and texture paths are relative to the explicit assets root. The runner resolves each path and rejects traversal, hidden path segments, unsupported extensions, missing files, and individual assets larger than 512 MiB. MCP applies its own relative-path and extension allowlists before publication.
- MCP validates bounded counts, IDs, transforms, keyframes, colors, frame ranges and output dimensions.
- The renderer reads only the selected manifest and writes into the caller-selected output directory.
- No downloaded assets, copyrighted references, branded products, franchise characters or living-artist imitation are bundled. Use original, user-owned or properly licensed assets and retain provenance in the FORGE rights ledger.
- The bridge now imports GLB/GLTF/FBX models and optional base-color image textures, alongside primitive-based scenes, basic materials, lights, one camera and transform animation. It does not yet support rigged-character retargeting, full PBR texture sets (normal/roughness/metallic maps), physics simulations, compositing nodes, audio, transitions between shots, progress/cancellation, remote rendering or studio preview handoff.
- The MCP validator and source syntax are static checks only. Blender has not been installed or executed, and no rendered output has been verified.


## Rigged character animation actions

Imported GLB/GLTF or FBX assets may include an Armature and animation Actions. A manifest can select an existing action by exact Blender action name and place it on an NLA track:

```json
{
  "id": "hero",
  "type": "imported_model",
  "asset": "characters/original-hero.glb",
  "animation": {
    "action": "WalkCycle",
    "target": "Armature",
    "start_frame": 1,
    "end_frame": 49,
    "repeat": 2,
    "speed": 1,
    "blend_in": 4,
    "blend_out": 4
  }
}
```

The action, target and frame range must correspond to data actually present in the supplied asset. The target is an imported Armature object name. This selects and schedules an existing animation; it does not generate, retarget, repair or synthesize motion. Frame values and repetitions are authored by Claude as director. Assets must be original, user-owned or properly licensed.


## Facial expression and shape-key animation

Imported character meshes may animate shape keys (blend shapes) already present in the supplied GLB/GLTF or FBX asset. Add `shape_keys` to an imported model:

```json
{
  "id": "hero",
  "type": "imported_model",
  "asset": "characters/original-hero.glb",
  "shape_keys": [
    {
      "target": "FaceMesh",
      "key": "Smile",
      "keyframes": [
        {"frame": 12, "value": 0},
        {"frame": 20, "value": 0.8},
        {"frame": 36, "value": 0}
      ]
    }
  ]
}
```

The mesh target is optional only when the key name resolves to exactly one imported mesh. The key must already exist in the asset. Values are limited to -1 through 1 and frames must be strictly increasing. This schedules existing blend shapes; it does not create facial geometry, infer emotions, generate phonemes or synchronize lips to audio automatically.


## Asset inspection (no render)

Before authoring a character shot, inspect the actual asset to discover the names Claude can safely target:

```bash
blender --background --python blender/forge_blender_bridge.py -- --inspect-asset characters/original-hero.glb --assets-root ./assets
```

The command prints JSON containing imported object names/types, armature and bone names, mesh material names, existing shape-key names, and animation Actions with their source frame ranges. It does not create a render or video. Use the exact returned Action, Armature, mesh and shape-key names in the scene manifest. Only data imported from that asset is reported; this is not a guarantee that a particular rig is compatible with another character.
