#!/usr/bin/env python3
"""FORGE MOTION declarative Blender renderer. Run with Blender's bundled Python."""
import argparse
import json
import math
import os
import sys

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

def build_materials(job):
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

def create_scene(job, output_dir):
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

    materials = build_materials(job)
    for item in job.get("objects", []):
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
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    with open(args.job, "r", encoding="utf-8") as handle:
        job = json.load(handle)
    if job.get("version") != 1:
        raise SystemExit("Unsupported FORGE Blender job version; expected 1.")
    result = create_scene(job, args.output)
    print(json.dumps({"ok": True, "output": result, "frame_start": bpy.context.scene.frame_start,
                      "frame_end": bpy.context.scene.frame_end, "fps": bpy.context.scene.render.fps}))

if __name__ == "__main__":
    main()
