# FORGE MOTION — production architecture and current status

## Implemented browser-side motion graphics milestone

- Multi-scene sequence editor: add, select, duplicate, delete and reorder scenes; each scene stores its own title, subtitle, metric, chart data/type, template, accent, virtual camera move and duration.
- Full-sequence preview and one-file WebM recording render scenes consecutively in order; the project JSON and local save include the sequence and selected scene.
- Scene transitions are selectable per incoming scene: cut, fade, wipe and zoom. A visual clip timeline scales each clip by duration and lets the editor select scenes directly.
- Dedicated motion graphics panel with editable title, subtitle, metric, supporting copy, chart values, visual template, accent color and virtual camera move.
- Canvas animation renders animated typography, infographic line charts, bar charts or connected-node paths, data points, grid/particles and camera push, pull, pan, drift or static framing. The sequence includes an opening reveal and end fade.
- Preview animation and real-time local WebM recording through the browser MediaRecorder API, with a 30 fps canvas stream.
- Motion graphics settings are persisted with the project and included in JSON project import/export.
- This browser renderer exports WebM video only; it does not yet mux audio, encode MP4, or provide a full multitrack editor.

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

The UI does not itself provide AI transcription, generated video, Blender rendering, 2D/3D character animation, a multitrack compositor, audio-mixed final export, or final MP4 export. The motion-graphics canvas is a real local 2D renderer with WebM recording, not an AI video generator or 3D engine. Those require backend services, media engines, dependencies and integration tests. No external provider is called and no paid render is started by this workspace.
