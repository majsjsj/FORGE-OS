(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const editor = $("blenderJobJson");
  const status = $("blenderJobStatus");
  if (!editor || !status) return;

  const starter = {
    version: 1,
    title: "Original 3D scene",
    settings: { fps: 24, width: 1920, height: 1080, frame_start: 1, frame_end: 48, video: true, world_color: [0.02, 0.025, 0.04, 1] },
    materials: [{ id: "hero_finish", name: "Original satin finish", color: [0.12, 0.3, 0.48, 1], roughness: 0.32, metallic: 0.18 }],
    objects: [{ id: "hero", name: "Hero object", type: "cube", material: "hero_finish", location: [0, 0, 0], scale: [1.2, 1.2, 1.2],
      keyframes: [{ frame: 1, rotation: [0, 0, 0] }, { frame: 48, rotation: [0, 0, 360] }] }],
    lights: [{ type: "AREA", location: [4, -4, 6], energy: 1800, size: 5 }, { type: "AREA", location: [-4, 1, 3], energy: 900, size: 3 }],
    camera: { location: [7, -9, 6], rotation: [63, 0, 38], lens: 50 }
  };

  function validate(job) {
    if (!job || typeof job !== "object" || Array.isArray(job) || job.version !== 1) throw new Error("Expected a version-1 Blender job object.");
    const s = job.settings || {};
    const fps = Number(s.fps ?? 24), w = Number(s.width ?? 1920), h = Number(s.height ?? 1080);
    if (!Number.isInteger(fps) || fps < 1 || fps > 120 || !Number.isInteger(w) || !Number.isInteger(h) || w < 16 || h < 16 || w > 8192 || h > 8192) throw new Error("Invalid fps or output dimensions.");
    if (!Array.isArray(job.objects) || job.objects.length > 300) throw new Error("Objects must be an array with at most 300 entries.");
    if (!Array.isArray(job.materials || []) || (job.materials || []).length > 300) throw new Error("Too many materials.");
    if (!Array.isArray(job.lights || []) || (job.lights || []).length > 100) throw new Error("Too many lights.");
    const ids = new Set(), objectIds = new Set();
    const vector = (v) => Array.isArray(v) && v.length === 3 && v.every(n => Number.isFinite(Number(n)));
    for (const m of job.materials || []) {
      if (!m || typeof m.id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(m.id) || ids.has(m.id)) throw new Error("Invalid or duplicate material id.");
      ids.add(m.id);
    }
    for (const o of job.objects) {
      if (!o || typeof o.id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(o.id) || objectIds.has(o.id)) throw new Error("Invalid or duplicate object id.");
      objectIds.add(o.id);
      if (!["cube", "uv_sphere", "cylinder", "cone", "plane", "torus", "monkey"].includes(o.type)) throw new Error("Unsupported object primitive: " + o.type);
      for (const field of ["location", "rotation", "scale"]) if (o[field] !== undefined && !vector(o[field])) throw new Error("Invalid " + field + " vector on " + o.id);
      if (o.material && !ids.has(o.material)) throw new Error("Unknown material reference on " + o.id);
      if (o.keyframes !== undefined) {
        if (!Array.isArray(o.keyframes) || o.keyframes.length > 200) throw new Error("Invalid keyframe list on " + o.id);
        let last = 0;
        for (const k of o.keyframes) {
          if (!Number.isInteger(Number(k.frame)) || Number(k.frame) <= last) throw new Error("Keyframes must be positive and strictly ordered.");
          last = Number(k.frame);
          for (const field of ["location", "rotation", "scale"]) if (k[field] !== undefined && !vector(k[field])) throw new Error("Invalid keyframe " + field + " vector.");
        }
      }
    }
    for (const l of job.lights || []) {
      if (!["POINT", "SUN", "SPOT", "AREA"].includes(l.type)) throw new Error("Unsupported light type.");
      if (l.location !== undefined && !vector(l.location)) throw new Error("Invalid light location.");
    }
    const start = Number(s.frame_start ?? 1), end = Number(s.frame_end ?? 120);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end - start > 1000000) throw new Error("Invalid frame range.");
    return { objects: job.objects.length, materials: (job.materials || []).length, lights: (job.lights || []).length, fps, resolution: w + "×" + h, frames: start + "–" + end };
  }

  function show(job, label) {
    const summary = validate(job);
    editor.value = JSON.stringify(job, null, 2);
    status.textContent = label + " · Valid manifest · " + summary.objects + " objects · " + summary.materials + " materials · " + summary.lights + " lights · " + summary.fps + " fps · " + summary.resolution + " · frames " + summary.frames + ". Blender execution is not started.";
  }

  $("blenderJobTemplate")?.addEventListener("click", () => {
    try { show(starter, "Starter loaded"); } catch (error) { status.textContent = error.message; }
  });
  $("blenderJobImport")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { status.textContent = "File exceeds the 1 MiB import limit."; event.target.value = ""; return; }
    try { show(JSON.parse(await file.text()), "Imported " + file.name); }
    catch (error) { status.textContent = "Import failed: " + error.message; }
    event.target.value = "";
  });
  $("blenderJobExport")?.addEventListener("click", () => {
    try {
      const job = JSON.parse(editor.value);
      const summary = validate(job);
      const blob = new Blob([JSON.stringify(job, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "BLENDER_JOB.json"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = "Exported BLENDER_JOB.json · " + summary.objects + " objects · no render was started.";
    } catch (error) { status.textContent = "Cannot export: " + error.message; }
  });
  window.ForgeBlenderBridge = { validate, exportData: () => JSON.parse(editor.value) };
})();
