# FORGE MOTION

FORGE MOTION is the creative-production workspace within FORGE-OS for planning 2D/3D animation, product advertising, cinematic shots, voice-led video concepts, and editable timelines.

## Current implementation

- Standalone studio entry: `studio/motion/index.html`.
- Creative brief with visual style, aspect ratio, target duration and output target.
- Starter storyboard generation from user-provided text (deterministic shot breakdown; not an AI model call).
- Editable scenes with shot descriptions, camera direction, character/object action, lighting, sound cues and duration.
- Scene ordering, duplication, deletion and a visual timeline representation.
- Local browser autosave and JSON project import/export.
- Local audio-file preview and transcript field. The audio is not uploaded or transcribed by this page.
- Explicit planning-mode status so the interface does not misrepresent a storyboard as rendered video.

## Production architecture

The full production system should use provider-neutral adapters and a durable project/asset model:

1. **Director / Claude MCP** — interpret text or transcribed voice, generate script, shot list, character bible, storyboard and production instructions.
2. **Asset & continuity service** — character sheets, reusable props, environments, style references, versioned assets and consistency checks.
3. **2D animation adapter** — rigged vector/cut-out animation and frame-based workflows (including stick figures).
4. **Blender adapter** — headless Blender scene generation, camera rigs, lighting, materials, simulation and rendering.
5. **Video generation adapters** — optional providers for text/image/audio-to-video shots; keep provider keys server-side and make provider choice explicit.
6. **Audio pipeline** — speech-to-text, voice-over/TTS where licensed, dialogue timing, music and sound-effect tracks.
7. **Timeline / compositor** — editable shot timeline, transitions, titles, color and audio mix; render through FFmpeg or another validated compositor.
8. **Render queue** — isolated jobs, quotas, cancellation, progress, artifact storage, retries and per-user access controls.

## Safety, cost and capability gates

- Never send audio, prompts, assets or provider credentials to a third party without a clear user action and disclosure.
- Keep provider API keys server-side; never put secrets in browser JavaScript or public GitHub files.
- Require explicit confirmation before paid generation, cloud rendering or long-running jobs.
- Do not promise a finished video until an end-to-end render has been tested.
- Blender rendering needs a worker with Blender installed; browser GitHub Pages alone cannot render Blender scenes.
- A project JSON export is a production plan, not an MP4, animation file or Blender project.

## Milestones

- [x] Motion workspace foundation and navigation target.
- [x] Editable storyboard and shot metadata.
- [x] Local project persistence and JSON interchange.
- [x] Timeline planning and audio reference preview.
- [ ] MCP tools for create/update/list/export motion projects.
- [ ] Structured script/shot generation through the configured model.
- [ ] Character bible and visual continuity assets.
- [ ] 2D stickman and 2D rigged animation renderer.
- [ ] Blender scene builder and validated render worker.
- [ ] Audio transcription, voice generation and synchronization adapters.
- [ ] Video provider adapters with consent and spend controls.
- [ ] Full timeline compositor, MP4 export and end-to-end quality tests.
