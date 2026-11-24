#!/usr/bin/env python3
"""FORGE MOTION declarative Blender renderer. Run with Blender's bundled Python."""
import argparse
import json
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Euler

PRIMITIVES = {
    "cube": lambda: bpy.ops.mesh.primitive_cube_add(size=2),
    "uv_sphere": lambda: bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16),
    "cylinder": lambda: bpy.ops.mesh.primitive_cylinder_add(vertices=48),
    "cone": lambda: bpy.ops.mesh.primitive_cone_add(vertices=48),
    "plane": lambda: bpy.ops.mesh.primitive_plane_add(size=2),
    "torus": lambda: bpy.ops.mesh.primitive_torus_add(major_segments=48, minor_segments=12),
    "monkey": lambda: bpy.ops.mesh.primitive_monkey_add(),
}

def vec(value, default):
    return tuple(float(x) for x in (value if value is not None else default))

def safe_name(value, fallback):
    text = str(value or fallback)
    return "".join(c if c.isalnum() or c in "-_ " else "_" for c in text)[:80] or fallback

def asset_file(relative_path, assets_root, allowed_extensions):
    if not isinstance(relative_path, str) or not relative_path or "\\" in relative_path:
        raise ValueError("Asset paths must be non-empty relative paths.")
    rel = Path(relative_path)
    if rel.is_absolute() or any(part in ("", ".", "..") or part.startswith(".") for part in rel.parts):
        raise ValueError("Unsafe asset path: %s" % relative_path)
    if rel.suffix.lower() not in allowed_extensions:
        raise ValueError("Unsupported asset extension: %s" % rel.suffix)
    root = Path(assets_root).resolve()
    target = (root / rel).resolve()
    if os.path.commonpath((str(root), str(target))) != str(root) or not target.is_file():
        raise FileNotFoundError("Asset is missing or outside the assets root: %s" % relative_path)
    if target.stat().st_size > 512 * 1024 * 1024:
        raise ValueError("Asset exceeds the 512 MiB per-file limit: %s" % relative_path)
    return str(target)

def build_materials(job, assets_root):
    result = {}
    for item in job.get("materials", []):
        mat = bpy.data.materials.new(name=safe_name(item.get("name"), item["id"]))
        mat.diffuse_color = vec(item.get("color"), (0.8, 0.8, 0.8, 1.0))
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = mat.diffuse_color
            bsdf.inputs["Roughness"].default_value = float(item.get("roughness", 0.5))
            bsdf.inputs["Metallic"].default_value = float(item.get("metallic", 0.0))
            if item.get("base_color_texture"):
                image_path = asset_file(item["base_color_texture"], assets_root, {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"})
                image = bpy.data.images.load(image_path, check_existing=True)
                texture = mat.node_tree.nodes.new("ShaderNodeTexImage")
                texture.image = image
                mat.node_tree.links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
        result[item["id"]] = mat
    return result

def animate(obj, keyframes):
    for item in keyframes or []:
        frame = int(item["frame"])
        for field, attr in (("location", "location"), ("rotation", "rotation_euler"), ("scale", "scale")):
            if field in item:
                value = vec(item[field], (0, 0, 0))
                if field == "rotation":
                    value = tuple(math.radians(x) for x in value)
                setattr(obj, attr, value)
                obj.keyframe_insert(data_path=attr, frame=frame)

def import_model(item, assets_root):
    path = asset_file(item["asset"], assets_root, {".glb", ".gltf", ".fbx"})
    before = set(bpy.data.objects)
    extension = Path(path).suffix.lower()
    if extension in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif extension == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    imported = [obj for obj in bpy.data.objects if obj not in before]
    if not imported:
        raise RuntimeError("Importer produced no objects for asset: %s" % item["asset"])
    root = bpy.data.objects.new(safe_name(item.get("name"), item["id"]), None)
    bpy.context.scene.collection.objects.link(root)
    for obj in imported:
        world = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_world = world
    root.location = vec(item.get("location"), (0, 0, 0))
    root.rotation_euler = tuple(math.radians(x) for x in vec(item.get("rotation"), (0, 0, 0)))
    root.scale = vec(item.get("scale"), (1, 1, 1))
    animation = item.get("animation")
    if animation:
        action = bpy.data.actions.get(animation["action"])
        if action is None:
            raise ValueError("Animation action was not found in the imported asset: %s" % animation["action"])
        target_name = animation.get("target")
        candidates = [obj for obj in imported if obj.type == "ARMATURE"]
        if target_name:
            candidates = [obj for obj in imported if obj.name == target_name]
        target = next((obj for obj in candidates if obj.type == "ARMATURE"), None)
        if target is None:
            raise ValueError("No matching imported Armature was found for animation action: %s" % animation["action"])
        if not target.animation_data:
            target.animation_data_create()
        track = target.animation_data.nla_tracks.new()
        track.name = safe_name(animation.get("track_name"), "FORGE Action")
        strip = track.strips.new(action.name, int(animation["start_frame"]), action)
        strip.action_frame_start = float(animation.get("action_start", action.frame_range[0]))
        strip.action_frame_end = float(animation.get("action_end", action.frame_range[1]))
        strip.repeat = float(animation.get("repeat", 1.0))
        strip.scale = float(animation.get("scale", 1.0))
        strip.blend_in = float(animation.get("blend_in", 0.0))
        strip.blend_out = float(animation.get("blend_out", 0.0))
        strip.use_auto_blend = False
    return root, imported

def create_scene(job, output_dir, assets_root):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    settings = job.get("settings", {})
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = int(settings.get("width", 1920))
    scene.render.resolution_y = int(settings.get("height", 1080))
    scene.render.resolution_percentage = int(settings.get("resolution_percentage", 100))
    scene.render.fps = int(settings.get("fps", 24))
    scene.frame_start = int(settings.get("frame_start", 1))
    scene.frame_end = int(settings.get("frame_end", 120))
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = bool(settings.get("transparent", False))
    scene.render.filepath = os.path.join(output_dir, "frame_")
    scene.render.image_settings.color_mode = "RGBA" if settings.get("transparent") else "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.view_transform = "AgX"

    world = bpy.data.worlds.new("FORGE World") if not bpy.data.worlds else bpy.data.worlds[0]
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = vec(settings.get("world_color"), (0.025, 0.03, 0.05, 1))
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = float(settings.get("world_strength", 0.35))

    materials = build_materials(job, assets_root)
    for item in job.get("objects", []):
        if item["type"] == "imported_model":
            obj, imported_objects = import_model(item, assets_root)
            if item.get("material") in materials:
                for mesh_obj in imported_objects:
                    if mesh_obj.type == "MESH":
                        mesh_obj.data.materials.clear()
                        mesh_obj.data.materials.append(materials[item["material"]])
        else:
            PRIMITIVES[item["type"]]()
            obj = bpy.context.object
            obj.name = safe_name(item.get("name"), item["id"])
            obj.location = vec(item.get("location"), (0, 0, 0))
            obj.rotation_euler = tuple(math.radians(x) for x in vec(item.get("rotation"), (0, 0, 0)))
            obj.scale = vec(item.get("scale"), (1, 1, 1))
            if item.get("material") in materials:
                obj.data.materials.append(materials[item["material"]])
        animate(obj, item.get("keyframes"))

    for index, item in enumerate(job.get("lights", [])):
        data = bpy.data.lights.new(name=safe_name(item.get("name"), "FORGE Light %d" % index), type=item["type"])
        data.energy = float(item.get("energy", 1000))
        data.color = vec(item.get("color"), (1, 1, 1))
        if item.get("size") is not None and data.type == "AREA":
            data.shape = "DISK"
            data.size = float(item["size"])
        obj = bpy.data.objects.new(data.name, data)
        scene.collection.objects.link(obj)
        obj.location = vec(item.get("location"), (0, 0, 5))
        obj.rotation_euler = tuple(math.radians(x) for x in vec(item.get("rotation"), (0, 0, 0)))

    cam_spec = job.get("camera", {})
    cam_data = bpy.data.cameras.new("FORGE Camera")
    cam = bpy.data.objects.new("FORGE Camera", cam_data)
    scene.collection.objects.link(cam)
    cam.location = vec(cam_spec.get("location"), (7, -9, 6))
    cam.rotation_euler = tuple(math.radians(x) for x in vec(cam_spec.get("rotation"), (63, 0, 38)))
    cam_data.lens = float(cam_spec.get("lens", 50))
    scene.camera = cam
    animate(cam, cam_spec.get("keyframes"))

    scene.frame_set(scene.frame_start)
    os.makedirs(output_dir, exist_ok=True)
    output = os.path.abspath(os.path.join(output_dir, safe_name(job.get("title"), "forge-render") + ".mp4"))
    if settings.get("video", False):
        scene.render.image_settings.file_format = "FFMPEG"
        scene.render.ffmpeg.format = "MPEG4"
        scene.render.ffmpeg.codec = "H264"
        scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
        scene.render.filepath = output
        bpy.ops.render.render(animation=True)
        return output
    bpy.ops.render.render(write_still=True)
    return scene.render.filepath

def main():
    parser = argparse.ArgumentParser(description="Render a FORGE MOTION Blender job")
    parser.add_argument("--job", required=True, help="Path to a version-1 BLENDER_JOB.json")
    parser.add_argument("--output", default="./renders", help="Output directory")
    parser.add_argument("--assets-root", default="./assets", help="Directory containing approved model and texture assets")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    with open(args.job, "r", encoding="utf-8") as handle:
        job = json.load(handle)
    if job.get("version") != 1:
        raise SystemExit("Unsupported FORGE Blender job version; expected 1.")
    result = create_scene(job, args.output, args.assets_root)
    print(json.dumps({"ok": True, "output": result, "frame_start": bpy.context.scene.frame_start,
                      "frame_end": bpy.context.scene.frame_end, "fps": bpy.context.scene.render.fps}))

if __name__ == "__main__":
    main()
