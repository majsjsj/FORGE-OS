# FORGE MOTION — production architecture and current status

## Implemented browser-side motion graphics milestone

- Multi-scene sequence editor: add, select, duplicate, delete and reorder scenes; each scene stores its own title, subtitle, metric, chart data/type, template, accent, virtual camera move and duration.
- Full-sequence preview and one-file WebM recording render scenes consecutively in order; the project JSON and local save include the sequence and selected scene.
- Scene transitions are selectable per incoming scene: cut, crossfade, fade through black, dissolve, directional wipes (left/right/up/down), iris reveal, zoom in/out, directional slides (left/right/up/down), blur dissolve and spin reveal, circle and diamond reveals, curtain and center-split reveals, pixel reveal and glitch slices.
- Each incoming scene has its own editable transition duration (0.25–3 seconds) and easing curve (linear, smooth, ease-in, ease-out, sharp and bounce); both settings are stored with that scene and reused in preview and full-sequence WebM recording.
- A visual clip timeline scales each clip by duration and lets the editor select scenes directly.
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

## Multitrack editor milestone

- Six independent timeline lanes: video, narration, music, sound effects, captions and graphics.
- Local video/audio/image import; reusable imported assets can be placed more than once on the timeline.
- Editable clip start, trim-in, trim-out and duration, plus caption and graphic-title text clips.
- Audio volume, fade-in and fade-out controls are applied during local browser playback.
- Play, pause, stop, scrub, video clip preview and timed text overlays.
- Clip metadata and edit settings are saved in project JSON/local storage. Browser media bytes and temporary object URLs are intentionally not embedded; use the media shelf's relink action to reconnect local files after reopening or moving the project.

## Multitrack limitations

This milestone provides a working local timeline and preview, not a frame-accurate nonlinear editor or final compositor. It does not composite multiple video layers, render imported images as overlays, burn captions into output, or export a final mixed MP4/WebM. Audio fades and gain are preview-only; waveform display, media relinking UI, frame-rate timebase, final audio mixdown, compositor/export pipeline and browser QA remain outstanding.


## Local mixed WebM compositor milestone

- Added a browser-side export action that records a 1280×720, 30 fps canvas composition to WebM and combines decoded narration/music/SFX clips into one Opus audio stream through Web Audio.
- Export includes the active video clip, timed caption text, image assets on the graphics lane (when relinked), and editable text-card fallback for graphic title clips.
- Audio clip start offsets, trim in/out, gain, fade-in and fade-out are scheduled in the Web Audio graph for the export.
- The exporter is a first-pass real-time compositor: one active video layer at a time, basic centered image/title overlays, and simple bottom captions. It is not a frame-accurate NLE; no multi-video layer compositing, transitions between imported clips, color grading, keyframe animation, waveform UI, MP4/H.264 encoding, or browser QA are claimed.
- Export requires media files to be available/relinked in the current browser session. The result is a local WebM download; no cloud rendering or paid service is invoked.


## Claude Executive Director contract

- Claude is the production authority for scene count, scene/clip timing, total runtime, frame rate and aspect ratio. The editor treats an applied director plan as the approved source of truth; runtime is no longer inferred from a fixed 60-second ruler when a plan is active.
- `ForgeMotionMultitrack.applyDirectorPlan(plan)` validates and applies a version-1 plan with an explicit positive duration and clips containing track type, start, trim-in and trim-out. Clip timing outside the approved runtime is rejected.
- The browser UI can import/export the plan as JSON and displays the director-approved runtime. A clear action returns the editor to its local/manual timeline mode.
- This is the frontend contract and manual plan handoff. A live Claude-to-studio connection still requires a registered MCP tool/host bridge that calls this API; the current static page does not independently invoke Claude or claim a live connection.
- Plan example:

```json
{
  "version": 1,
  "title": "Claude-directed launch film",
  "duration": 42,
  "fps": 30,
  "aspectRatio": "9:16",
  "clips": [
    {"type":"video","name":"Opening","start":0,"in":0,"out":6},
    {"type":"narration","name":"Voice-over","start":0.5,"in":0,"out":42,"volume":0.9,"fadeIn":0.4,"fadeOut":1.2},
    {"type":"captions","name":"Opening caption","text":"A new story begins","start":1,"in":0,"out":4}
  ]
}
```


## Live Claude Director MCP bridge

- Added MCP tools `forge_motion_plan_read` and `forge_motion_plan_save`. Claude writes the approved version-1 plan to `workspace/<project>/FORGE_MOTION_PLAN.json` on an existing `forge/projects/<name>` branch. Updates use the latest file SHA to reject stale writes.
- Added a read-only Worker endpoint `GET /motion-plan?project=workspace/<project>&ref=forge%2Fprojects%2F<name>`. The static studio polls it every five seconds after the user connects the project branch and path. New committed plans are validated by the browser and applied through `ForgeMotionMultitrack.applyDirectorPlan`.
- This uses the existing GitHub-backed project storage and existing Worker binding; it creates no new database, bucket, or paid service. The browser stores only the selected project path/branch, never the MCP bearer token.
- The public endpoint exposes only the explicitly selected plan file from the public repository's isolated project branch; it is read-only and constrained to `workspace/` and `forge/projects/`. CORS is restricted to the FORGE GitHub Pages origin.
- This is near-real-time polling, not a bidirectional socket. Claude publishes plans through MCP; the browser applies them. The current plan contract controls total runtime and six track types. Local media bytes remain in the browser and are not uploaded by this bridge.
- The Worker source and studio files are committed to the feature branch only. Worker deployment, Pages publication, CI, and browser end-to-end testing have not been run.


## Claude-directed visual scene sequences

- MCP plans may include a top-level `scenes` array for the Motion Graphics renderer. Each scene can specify title/subtitle/metric/data/copy, template, chart, virtual camera, accent, transition, transition duration/easing, and its own `duration`.
- The sum of Claude-selected visual scene durations must equal the plan's total runtime. The Worker validates this before publishing, and the browser imports the complete scene sequence into `ForgeMotionGraphics` when a new plan arrives.
- Removed the renderer's former 4–60 second per-scene clamp for director-supplied plans. Scene and transition durations now follow Claude's plan, subject only to positive-value and practical payload validation. The manual controls no longer impose a 60-second maximum.


## Word-level caption timing

- Claude can attach `words` to a captions clip. Each item is `{ text, start, end }`, with times relative to the caption clip's trimmed source range (seconds).
- The Worker validates ordered, non-overlapping word intervals, text length, and that every word fits inside its caption clip. Invalid alignment is rejected before saving and again on studio reads.
- The studio preview highlights the currently active word as the playhead advances. The WebM compositor burns in the same word highlight based on the render clock.
- This is playback of supplied word timestamps, not automatic speech recognition or forced alignment. Accurate word timing must be generated by Claude from suitable source/transcript evidence or by a future speech-alignment engine; no ASR service was added.


## Local audio intelligence (browser-only)

- The multitrack editor can analyze the selected linked narration/music/SFX file locally with Web Audio decode. It draws a 240-bin peak waveform, estimates a tempo candidate (60–180 BPM) by autocorrelation of positive RMS-energy changes, identifies onset candidates, and groups active-energy regions.
- The analysis metadata is stored with the media asset in the local project and included in the JSON director handoff as `audioAnalysis`. The original audio bytes are not uploaded by this feature.
- BPM, onsets and active regions are heuristic signal-analysis outputs, not reliable beat tracking, speech recognition, transcript alignment, emotion recognition or semantic scene understanding. Claude reviews the measurements and remains responsible for the final creative timing.


## Voice segmentation and scene direction handoff

- The Audio & Voice panel can split a user-provided transcript into ordered spoken units while preserving the exact text. This is transcript segmentation only; it does not infer word timestamps, speaker identity, emotion or audio semantics.
- The director JSON handoff includes these units as `voiceSegments`. Claude can assign final start/end times, speaker labels and visual scene intent, then publish the approved production plan through MCP.
- The Worker validates transcript unit count, text, optional speaker/scene intent, and optional paired timing within the approved runtime. Untimed segments remain untimed until Claude directs them. No duration is auto-assigned by the studio.


## Claude visual story direction

- The Storyboard panel now includes a read-only shot-by-shot direction sheet populated from the approved Claude MCP plan. It displays scene intent, shot size, camera move, lighting, transition, infographic/graphics direction, sound cue and optional voice-segment link.
- Supported structured enums are validated by the Worker for shotType, cameraMove and transition. Descriptive direction fields are length-limited. Visual scenes are preserved with the approved director plan in the local multitrack project.
- This is a director-plan viewer and metadata contract, not a new 3D renderer or AI video-generation backend. The existing motion-graphics renderer still supports its documented Canvas 2D scene vocabulary; other shot directions are instructions for future or external rendering engines.

- Continuity metadata supported per scene: `continuityNote`, `environment`, `wardrobe`, `props[]`, and `characterRefs[]`. These help Claude and downstream renderers preserve character, costume, location and prop consistency across cuts; they are direction metadata, not automatic character-reference generation.
