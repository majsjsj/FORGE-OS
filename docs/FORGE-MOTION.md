# FORGE MOTION — production architecture and current status

## Implemented browser-side post-production milestone

- Local rendered-video preview (user selects a video file; no upload).
- Optional external audio track with play/pause/seek synchronization against preview time.
- Caption cue editor with start/end time and text.
- Caption cues and caption design settings are saved with the local project, included in project JSON export/import, and restored when reopening the workspace.
- Clicking a caption row seeks the preview to that cue's start time.
- SRT and WebVTT import/export.
- Caption style controls: font, size, foreground/background colors, opacity, vertical position, entrance effect.
- Optional approximate word-level cue splitting for karaoke-style highlighting.
- Fullscreen preview and local browser-only media handling.

## Timing accuracy

Subtitle cue timing follows the media player's playback clock. Imported SRT/VTT cues retain their timestamps. Splitting a sentence evenly into words is only an approximate convenience, not speech recognition or forced alignment. Frame-accurate/word-accurate alignment requires a speech-to-text/forced-alignment backend, known media frame rate/timebase, and human review. Burned-in subtitles and muxed audio/video require the render/export worker; this UI only previews overlays.

## Full production system — eight delivery tracks

1. **Director and MCP:** structured project schema, model-generated script/shot plan, voice transcription, shot breakdown and revision loop.
2. **Character and asset continuity:** character bible, reference images, reusable props/environments, asset versioning and continuity checks.
3. **2D / Stickman:** rig definitions, keyframes, interpolation, camera layers, SVG/Canvas renderer and export.
4. **Blender / 3D advertising:** Blender Python scene templates, camera rigs, lighting/material presets, product turntables, simulations and headless rendering on an isolated worker.
5. **3D / AI video adapters:** pluggable generation providers, per-shot references, explicit provider selection, server-side keys, user consent and spend estimates.
6. **Audio:** transcription, voice-over/TTS where licensed, dialogue/music/SFX tracks, loudness normalization and forced alignment.
7. **Timeline / compositor:** multitrack video/audio/caption editing, transitions, titles, color pipeline, frame-accurate timebase and subtitle burn-in.
8. **Render queue / delivery:** isolated workers, progress, cancellation, retries, artifact storage, MP4/WebM export and end-to-end QA.

## Not yet implemented or verified

The UI does not itself provide AI transcription, generated video, Blender rendering, 2D/3D character animation, a multitrack compositor, or final MP4 export. Those require backend services, media engines, dependencies and integration tests. No external provider is called and no paid render is started by this workspace.
