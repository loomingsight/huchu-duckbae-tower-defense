from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import shutil
import sys
from pathlib import Path

import bpy
from mathutils import Vector


REPO = Path(__file__).resolve().parents[2]
EXPECTED_WORKTREE = Path("/private/tmp/huchu-defense-v2-3d-preview")
OUTPUT = REPO / "assets/renders/redesign-preview-v1"
BLEND_OUTPUT = REPO / "assets/blender/td-redesign-preview-v1.blend"
FRAME_SIZE = 256
MOBILE_SIZE = 128
OWNER = "v1"
SCENE_NAME = "TDPreview_v1"
GROUP_NAME = "TDPreview_Group_map"
RIG_COLLECTION_NAME = "TDPreview_Rig_v1"

SOURCE_BLEND_NAMES = (
    "character-assets-v2.blend",
    "arrow-tower-v1.blend",
    "slow-tower-v1.blend",
    "tower-lineup-v1.blend",
    "enemies-voxel-v1.blend",
)

COLORS = {
    "grass": (0.36, 0.62, 0.40, 1.0),
    "grass_side": (0.22, 0.42, 0.25, 1.0),
    "road": (0.78, 0.63, 0.39, 1.0),
    "road_side": (0.56, 0.41, 0.24, 1.0),
    "wood": (0.38, 0.20, 0.10, 1.0),
    "wood_light": (0.64, 0.36, 0.16, 1.0),
    "gold": (0.95, 0.66, 0.16, 1.0),
    "snack": (0.93, 0.72, 0.38, 1.0),
}

_ACTIVE_ASSET_COLLECTION: bpy.types.Collection | None = None
_STAGING_ROOT: Path | None = None
_EXPECTED_PRESERVED_GROUPS: set[str] = set()


def _tag(block: object, group: str) -> None:
    block["td_preview_owner"] = OWNER  # type: ignore[index]
    block["td_preview_group"] = group  # type: ignore[index]


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _source_hashes() -> dict[str, str]:
    return {
        name: _sha256(REPO / "assets/blender" / name)
        for name in SOURCE_BLEND_NAMES
    }


def _set_supported_look(scene: bpy.types.Scene) -> str:
    for candidate in ("Medium High Contrast", "AgX - Medium High Contrast", "None"):
        try:
            scene.view_settings.look = candidate
            return candidate
        except (TypeError, ValueError):
            continue
    return scene.view_settings.look


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float = 0.72,
) -> bpy.types.Material:
    material = bpy.data.materials.get(name)
    if material is None:
        material = bpy.data.materials.new(name)
    _tag(material, "map")
    material.diffuse_color = color
    material.use_nodes = True
    principled = next(
        (node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"),
        None,
    )
    if principled is None:
        raise AssertionError(f"Principled shader missing from {name}")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    alpha_input = principled.inputs.get("Alpha")
    if alpha_input is not None:
        alpha_input.default_value = color[3]
    if color[3] < 1.0:
        if hasattr(material, "surface_render_method"):
            for method in ("DITHERED", "BLENDED"):
                try:
                    material.surface_render_method = method
                    break
                except (TypeError, ValueError):
                    continue
        elif hasattr(material, "blend_method"):
            material.blend_method = "BLEND"
    return material


def _move_to_active_collection(obj: bpy.types.Object) -> None:
    if _ACTIVE_ASSET_COLLECTION is None:
        raise AssertionError("No active per-asset collection")
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    _ACTIVE_ASSET_COLLECTION.objects.link(obj)
    _tag(obj, "map")
    if obj.data is not None:
        obj.data.name = obj.name + "_Data"
        _tag(obj.data, "map")


def _asset_object_name(base_name: str) -> str:
    if _ACTIVE_ASSET_COLLECTION is None:
        raise AssertionError("No active per-asset collection")
    asset = _ACTIVE_ASSET_COLLECTION.get("td_preview_asset")
    if not isinstance(asset, str):
        raise AssertionError("Active collection has no asset identity")
    return base_name + "__" + Path(asset).stem.replace("-", "_")


def add_box(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    bevel: float = 0.08,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    if obj is None:
        raise AssertionError(f"Failed to create {name}")
    obj.name = _asset_object_name(name)
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("PreviewBevel", "BEVEL")
    modifier.width = bevel
    modifier.segments = 2
    obj.data.materials.append(material)
    _move_to_active_collection(obj)
    return obj


def _add_cylinder(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=1.0, depth=2.0, location=location)
    obj = bpy.context.object
    if obj is None:
        raise AssertionError(f"Failed to create {name}")
    obj.name = _asset_object_name(name)
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("PreviewBevel", "BEVEL")
    modifier.width = 0.045
    modifier.segments = 2
    obj.data.materials.append(material)
    _move_to_active_collection(obj)
    return obj


def look_at(obj: bpy.types.Object, target: tuple[float, float, float] = (0.0, 0.0, 0.6)) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def _link_child(parent: bpy.types.Collection, child: bpy.types.Collection) -> None:
    if child.name not in {item.name for item in parent.children}:
        parent.children.link(child)


def _remove_owned_collection(collection: bpy.types.Collection, group: str) -> None:
    for child in list(collection.children):
        _remove_owned_collection(child, group)
    for obj in list(collection.objects):
        if obj.get("td_preview_owner") != OWNER or obj.get("td_preview_group") != group:
            raise AssertionError(f"Refusing to remove foreign object {obj.name}")
        bpy.data.objects.remove(obj, do_unlink=True)
    if collection.get("td_preview_owner") != OWNER or collection.get("td_preview_group") != group:
        raise AssertionError(f"Refusing to remove foreign collection {collection.name}")
    bpy.data.collections.remove(collection)


def _remove_unused_owned_map_data() -> None:
    for datablocks in (bpy.data.meshes, bpy.data.materials):
        for block in list(datablocks):
            if (
                block.get("td_preview_owner") == OWNER
                and block.get("td_preview_group") == "map"
                and block.users == 0
            ):
                datablocks.remove(block)


def _preview_scene() -> bpy.types.Scene:
    matches = [scene for scene in bpy.data.scenes if scene.name == SCENE_NAME]
    if len(matches) > 1:
        raise AssertionError(f"Duplicate {SCENE_NAME} scenes")
    if matches:
        scene = matches[0]
    else:
        scene = bpy.data.scenes.new(SCENE_NAME)
        _tag(scene, "common")
    _tag(scene, "common")
    bpy.context.window.scene = scene
    return scene


def _configure_render(scene: bpy.types.Scene) -> None:
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.resolution_x = FRAME_SIZE
    scene.render.resolution_y = FRAME_SIZE
    scene.render.resolution_percentage = 100
    scene.render.pixel_aspect_x = 1.0
    scene.render.pixel_aspect_y = 1.0
    scene.render.image_settings.color_mode = "RGBA"
    _set_supported_look(scene)


def _new_rig(scene: bpy.types.Scene, collection: bpy.types.Collection) -> None:
    camera_data = bpy.data.cameras.new("TD_Preview_Camera")
    _tag(camera_data, "common")
    camera = bpy.data.objects.new("TD_Preview_Camera", camera_data)
    _tag(camera, "common")
    collection.objects.link(camera)
    camera.location = (6.5, -8.5, 6.25)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 5.6
    look_at(camera)
    scene.camera = camera

    for name, location, energy, size in (
        ("TD_Key", (4.5, -4.5, 8.0), 1050.0, 5.0),
        ("TD_Fill", (-4.5, -2.0, 5.0), 500.0, 4.0),
        ("TD_Rim", (2.0, 5.0, 7.0), 750.0, 3.0),
    ):
        data = bpy.data.lights.new(name, "AREA")
        _tag(data, "common")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        light = bpy.data.objects.new(name, data)
        _tag(light, "common")
        light.location = location
        look_at(light)
        collection.objects.link(light)


def ensure_preview_rig(scene: bpy.types.Scene) -> bpy.types.Collection:
    rigs = [collection for collection in bpy.data.collections if collection.name == RIG_COLLECTION_NAME]
    if len(rigs) > 1:
        raise AssertionError("Duplicate preview rig collections")
    rig = rigs[0] if rigs else bpy.data.collections.new(RIG_COLLECTION_NAME)
    _tag(rig, "common")
    _link_child(scene.collection, rig)
    objects = {obj.name: obj for obj in rig.objects}
    required = {
        "TD_Preview_Camera": "CAMERA",
        "TD_Key": "LIGHT",
        "TD_Fill": "LIGHT",
        "TD_Rim": "LIGHT",
    }
    valid = (
        len(rig.objects) == len(required)
        and all(name in objects and objects[name].type == kind for name, kind in required.items())
        and all(obj.get("td_preview_owner") == OWNER for obj in rig.objects)
    )
    if not valid:
        for obj in list(rig.objects):
            if obj.get("td_preview_owner") != OWNER:
                raise AssertionError(f"Foreign object in preview rig: {obj.name}")
            bpy.data.objects.remove(obj, do_unlink=True)
        _new_rig(scene, rig)
    else:
        scene.camera = objects["TD_Preview_Camera"]
    _configure_render(scene)
    return rig


def tile_base() -> bpy.types.Object:
    grass = make_material("M_Grass", COLORS["grass"])
    return add_box("Asset_TileBase", (0.0, 0.0, 0.0), (1.6, 1.6, 0.18), grass, 0.10)


def road_arm(axis: str, positive: bool = True) -> bpy.types.Object:
    road = make_material("M_Road", COLORS["road"])
    length = 0.82
    direction = "pos" if positive else "neg"
    if axis == "x":
        x = 0.78 if positive else -0.78
        return add_box(f"Asset_RoadArm_x_{direction}", (x, 0.0, 0.235), (length, 0.61, 0.055), road, 0.08)
    if axis == "y":
        y = 0.78 if positive else -0.78
        return add_box(f"Asset_RoadArm_y_{direction}", (0.0, y, 0.235), (0.61, length, 0.055), road, 0.08)
    raise ValueError(f"Unsupported road axis: {axis}")


def build_road(arms: tuple[tuple[str, bool], ...]) -> None:
    tile_base()
    road = make_material("M_Road", COLORS["road"])
    add_box("Asset_RoadCenter", (0.0, 0.0, 0.235), (0.61, 0.61, 0.055), road, 0.08)
    for axis, positive in arms:
        road_arm(axis, positive)


def add_bone(
    name: str,
    location: tuple[float, float, float],
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    scale: float = 0.22,
) -> None:
    snack = make_material("M_Snack", COLORS["snack"])
    bar = add_box(name + "_Bar", location, (scale * 1.4, scale * 0.36, scale * 0.30), snack, 0.08)
    bar.rotation_euler = rotation
    cos_z = math.cos(rotation[2])
    sin_z = math.sin(rotation[2])
    for side in (-1, 1):
        end_x = side * scale * 1.42
        for across in (-1, 1):
            local_y = across * scale * 0.45
            x = location[0] + end_x * cos_z - local_y * sin_z
            y = location[1] + end_x * sin_z + local_y * cos_z
            bpy.ops.mesh.primitive_uv_sphere_add(
                segments=16,
                ring_count=8,
                location=(x, y, location[2]),
                scale=(scale * 0.46, scale * 0.46, scale * 0.42),
            )
            knob = bpy.context.object
            if knob is None:
                raise AssertionError(f"Failed to create {name} knob")
            knob.name = _asset_object_name(f"{name}_Knob_{side}_{across}")
            knob.data.materials.append(snack)
            _move_to_active_collection(knob)


def build_snack_chest() -> None:
    tile_base()
    wood = make_material("M_Wood", COLORS["wood"])
    wood_light = make_material("M_WoodLight", COLORS["wood_light"])
    gold = make_material("M_Gold", COLORS["gold"], 0.35)
    snack = make_material("M_Snack", COLORS["snack"])
    add_box("Asset_ChestBase", (0.0, 0.0, 0.66), (0.92, 0.67, 0.40), wood, 0.10)
    lid = add_box("Asset_ChestLid", (0.0, 0.38, 1.16), (0.92, 0.20, 0.38), wood_light, 0.10)
    lid.rotation_euler.x = math.radians(-28)
    add_box("Asset_ChestBand", (0.0, -0.69, 0.72), (0.12, 0.04, 0.43), gold, 0.03)
    add_bone("Asset_BoneA", (-0.28, -0.28, 1.23), rotation=(0.0, 0.0, 0.35), scale=0.17)
    add_bone("Asset_BoneB", (0.28, -0.24, 1.29), rotation=(0.0, 0.0, -0.45), scale=0.15)
    biscuit = _add_cylinder("Asset_SnackBiscuit", (0.0, -0.40, 1.36), (0.20, 0.20, 0.065), snack)
    biscuit.rotation_euler.z = math.radians(22)


MAP_BUILDERS = {
    "map/grass.png": tile_base,
    "map/road-straight-horizontal.png": lambda: build_road((("x", False), ("x", True))),
    "map/road-straight-vertical.png": lambda: build_road((("y", False), ("y", True))),
    "map/road-corner-north-east.png": lambda: build_road((("y", True), ("x", True))),
    "map/road-corner-east-south.png": lambda: build_road((("x", True), ("y", False))),
    "map/road-corner-south-west.png": lambda: build_road((("y", False), ("x", False))),
    "map/road-corner-west-north.png": lambda: build_road((("x", False), ("y", True))),
    "map/entry.png": lambda: build_road((("x", False), ("x", True))),
    "map/snack-chest.png": build_snack_chest,
}


def _asset_collection_name(relative_path: str) -> str:
    return "TDPreview_map_" + Path(relative_path).stem.replace("-", "_")


def _world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points: list[Vector] = []
    for obj in objects:
        if obj.type != "MESH" or len(obj.data.vertices) == 0:
            raise AssertionError(f"Empty render object: {obj.name}")
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise AssertionError("No mesh bounds available")
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    if not all(math.isfinite(value) for value in (*minimum, *maximum)):
        raise AssertionError("Non-finite render bounds")
    return minimum, maximum


def _assert_asset_geometry(relative_path: str, collection: bpy.types.Collection) -> None:
    meshes = [obj for obj in collection.all_objects if obj.type == "MESH"]
    minimum, maximum = _world_bounds(meshes)
    tile = next((obj for obj in meshes if obj.name.startswith("Asset_TileBase")), None)
    if tile is None or any(abs(actual - expected) > 1e-5 for actual, expected in zip(tile.dimensions, (3.2, 3.2, 0.36))):
        raise AssertionError(f"{relative_path} must have a 3.2 x 3.2 x 0.36 tile")
    if minimum.x < -1.601 or maximum.x > 1.601 or minimum.y < -1.601 or maximum.y > 1.601:
        raise AssertionError(f"{relative_path} exceeds one tile footprint: {minimum} {maximum}")
    if "road" in relative_path or relative_path.endswith("entry.png"):
        road_parts = [obj for obj in meshes if obj.name.startswith("Asset_Road")]
        if not road_parts:
            raise AssertionError(f"{relative_path} is missing road geometry")
        if any(min(obj.dimensions.x, obj.dimensions.y) < 1.2199 for obj in road_parts):
            raise AssertionError(f"{relative_path} road width is not 1.22")
    if relative_path.endswith("snack-chest.png"):
        names = {obj.name for obj in meshes}
        if not any(name.startswith("Asset_Bone") for name in names):
            raise AssertionError("Snack chest is missing a bone")
        if not any(name.startswith("Asset_SnackBiscuit") for name in names):
            raise AssertionError("Snack chest is missing an identifiable snack")


def _visible_meshes(scene: bpy.types.Scene) -> list[bpy.types.Object]:
    return [obj for obj in scene.objects if obj.type == "MESH" and not obj.hide_render]


def render_still(output_path: Path) -> None:
    scene = bpy.context.scene
    meshes = _visible_meshes(scene)
    _world_bounds(meshes)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    scene.render.resolution_x = FRAME_SIZE
    scene.render.resolution_y = FRAME_SIZE
    scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)


def resize_png(source: Path, destination: Path, width: int, height: int) -> None:
    image = None
    try:
        image = bpy.data.images.load(str(source), check_existing=False)
        image.scale(width, height)
        image.filepath_raw = str(destination)
        image.file_format = "PNG"
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save()
    finally:
        if image is not None:
            bpy.data.images.remove(image)


def emit_single(relative_path: str) -> None:
    if _STAGING_ROOT is None:
        raise AssertionError("No run staging root")
    master = _STAGING_ROOT / "master" / relative_path
    mobile = _STAGING_ROOT / "mobile" / relative_path
    render_still(master)
    resize_png(master, mobile, MOBILE_SIZE, MOBILE_SIZE)


def _prepare_map_group(scene: bpy.types.Scene) -> bpy.types.Collection:
    existing = bpy.data.collections.get(GROUP_NAME)
    if existing is not None:
        _remove_owned_collection(existing, "map")
        _remove_unused_owned_map_data()
    group = bpy.data.collections.new(GROUP_NAME)
    _tag(group, "map")
    _link_child(scene.collection, group)
    return group


def render_map_group(scene: bpy.types.Scene) -> None:
    global _ACTIVE_ASSET_COLLECTION
    group = _prepare_map_group(scene)
    asset_collections: list[bpy.types.Collection] = []
    for relative_path, builder in MAP_BUILDERS.items():
        collection = bpy.data.collections.new(_asset_collection_name(relative_path))
        _tag(collection, "map")
        collection["td_preview_asset"] = relative_path
        _link_child(group, collection)
        asset_collections.append(collection)
        _ACTIVE_ASSET_COLLECTION = collection
        builder()
        if relative_path == "map/entry.png":
            gold = make_material("M_EntryGold", COLORS["gold"], 0.40)
            add_box("Asset_EntryPostL", (-0.72, 0.0, 0.72), (0.10, 0.10, 0.55), gold, 0.03)
            add_box("Asset_EntryPostR", (0.72, 0.0, 0.72), (0.10, 0.10, 0.55), gold, 0.03)
        _assert_asset_geometry(relative_path, collection)
        for candidate in asset_collections:
            candidate.hide_render = candidate is not collection
        emit_single(relative_path)
    _ACTIVE_ASSET_COLLECTION = None
    for collection in asset_collections:
        collection.hide_render = False


def _validate_png(path: Path, expected_size: int) -> dict[str, int]:
    image = None
    try:
        image = bpy.data.images.load(str(path), check_existing=False)
        if tuple(image.size) != (expected_size, expected_size):
            raise AssertionError(f"{path} has size {tuple(image.size)}")
        if image.channels != 4:
            raise AssertionError(f"{path} is not RGBA: {image.channels} channels")
        pixels = image.pixels[:]
        visible_x: list[int] = []
        visible_y: list[int] = []
        for y in range(expected_size):
            row_offset = y * expected_size * 4
            for x in range(expected_size):
                alpha = pixels[row_offset + x * 4 + 3]
                if alpha > 1e-6:
                    visible_x.append(x)
                    visible_y.append(y)
                elif x in (0, expected_size - 1) or y in (0, expected_size - 1):
                    continue
        if not visible_x:
            raise AssertionError(f"{path} has no visible pixels")
        if min(visible_x) <= 0 or max(visible_x) >= expected_size - 1 or min(visible_y) <= 0 or max(visible_y) >= expected_size - 1:
            raise AssertionError(f"{path} visible pixels touch the frame")
        for x in range(expected_size):
            if pixels[x * 4 + 3] > 1e-6 or pixels[((expected_size - 1) * expected_size + x) * 4 + 3] > 1e-6:
                raise AssertionError(f"{path} top/bottom border is not transparent")
        for y in range(expected_size):
            if pixels[(y * expected_size) * 4 + 3] > 1e-6 or pixels[(y * expected_size + expected_size - 1) * 4 + 3] > 1e-6:
                raise AssertionError(f"{path} left/right border is not transparent")
        return {
            "min_x": min(visible_x),
            "max_x": max(visible_x),
            "min_y": min(visible_y),
            "max_y": max(visible_y),
        }
    finally:
        if image is not None:
            bpy.data.images.remove(image)


def _expected_file_names() -> set[str]:
    return {Path(relative_path).name for relative_path in MAP_BUILDERS}


def _validate_render_tree(root: Path) -> dict[str, dict[str, dict[str, int]]]:
    expected = _expected_file_names()
    result: dict[str, dict[str, dict[str, int]]] = {}
    for variant, size in (("master", FRAME_SIZE), ("mobile", MOBILE_SIZE)):
        directory = root / variant / "map"
        actual = {path.name for path in directory.glob("*.png")}
        if actual != expected:
            raise AssertionError(f"{variant} manifest mismatch: expected={sorted(expected)} actual={sorted(actual)}")
        if len(list(directory.iterdir())) != len(expected):
            raise AssertionError(f"{variant} map directory contains non-manifest files")
        result[variant] = {
            name: _validate_png(directory / name, size)
            for name in sorted(expected)
        }
    return result


def _validate_candidate(candidate: Path, preserved_groups: set[str]) -> dict[str, object]:
    bpy.ops.wm.open_mainfile(filepath=str(candidate), load_ui=False)
    scenes = [scene for scene in bpy.data.scenes if scene.name == SCENE_NAME]
    if len(scenes) != 1:
        raise AssertionError(f"Expected one {SCENE_NAME}, found {len(scenes)}")
    scene = scenes[0]
    rigs = [collection for collection in bpy.data.collections if collection.name == RIG_COLLECTION_NAME]
    groups = [collection for collection in bpy.data.collections if collection.name == GROUP_NAME]
    if len(rigs) != 1 or len(groups) != 1:
        raise AssertionError(f"Rig/map persistence mismatch: rigs={len(rigs)} groups={len(groups)}")
    rig = rigs[0]
    if len(rig.objects) != 4 or sum(obj.type == "CAMERA" for obj in rig.objects) != 1:
        raise AssertionError("Common rig must contain one camera and three lights")
    camera = next(obj for obj in rig.objects if obj.type == "CAMERA")
    if camera.data.type != "ORTHO" or abs(camera.data.ortho_scale - 5.6) > 1e-6:
        raise AssertionError("Common camera must use the approved orthographic lens")
    if (camera.location - Vector((6.5, -8.5, 6.25))).length > 1e-6:
        raise AssertionError("Common camera must use the approved diagonal position")
    group = groups[0]
    asset_collections = list(group.children)
    expected_names = {_asset_collection_name(path) for path in MAP_BUILDERS}
    if len(asset_collections) != 9 or {collection.name for collection in asset_collections} != expected_names:
        raise AssertionError("Map per-asset collection persistence mismatch")
    current_preview_groups = {
        collection.name
        for collection in bpy.data.collections
        if collection.name.startswith("TDPreview_Group_") and collection.name != GROUP_NAME
    }
    if not preserved_groups.issubset(current_preview_groups):
        raise AssertionError(f"Previously completed groups were lost: {sorted(preserved_groups - current_preview_groups)}")
    owned_names: set[str] = set()
    owned_data_names: set[tuple[str, str]] = set()
    for obj in bpy.data.objects:
        if obj.get("td_preview_owner") == OWNER:
            if obj.name in owned_names or ".00" in obj.name:
                raise AssertionError(f"Duplicate owned object: {obj.name}")
            owned_names.add(obj.name)
            if obj.data is not None and obj.data.get("td_preview_owner") == OWNER:
                key = (obj.data.__class__.__name__, obj.data.name)
                if key in owned_data_names:
                    raise AssertionError(f"Duplicate owned object data: {key}")
                owned_data_names.add(key)
    for collection in asset_collections:
        relative_path = collection.get("td_preview_asset")
        if relative_path not in MAP_BUILDERS:
            raise AssertionError(f"Unknown persisted map asset: {relative_path}")
        _assert_asset_geometry(relative_path, collection)
    return {
        "scene": scene.name,
        "rig_objects": sorted(obj.name for obj in rig.objects),
        "asset_collections": sorted(collection.name for collection in asset_collections),
        "preserved_groups": sorted(preserved_groups),
        "owned_objects": len(owned_names),
        "owned_data": len(owned_data_names),
    }


def _journal_path() -> Path:
    return OUTPUT / ".map-publish-journal.json"


def _remove_tree(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)


def _restore_map_outputs(record: dict[str, object]) -> None:
    backup_root = Path(str(record["backup_root"]))
    for variant in ("master", "mobile"):
        final = OUTPUT / variant / "map"
        backup = backup_root / f"{variant}-map"
        existed = bool(record[f"{variant}_existed"])
        if backup.exists():
            _remove_tree(final)
            final.parent.mkdir(parents=True, exist_ok=True)
            os.replace(backup, final)
        elif not existed:
            _remove_tree(final)


def _recover_stale_publish() -> None:
    journal = _journal_path()
    if not journal.exists():
        return
    record = json.loads(journal.read_text(encoding="utf-8"))
    if record.get("kind") != "td-preview-map-v1":
        raise AssertionError("Refusing unknown preview publish journal")
    _restore_map_outputs(record)
    _remove_tree(Path(str(record["staging_root"])))
    _remove_tree(Path(str(record["backup_root"])))
    journal.unlink()


def _publish(staging_root: Path, candidate: Path, run_id: str) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    backup_root = OUTPUT / f".backup-map-{run_id}"
    journal = _journal_path()
    record: dict[str, object] = {
        "kind": "td-preview-map-v1",
        "run_id": run_id,
        "staging_root": str(staging_root),
        "backup_root": str(backup_root),
        "master_existed": (OUTPUT / "master/map").exists(),
        "mobile_existed": (OUTPUT / "mobile/map").exists(),
    }
    journal.write_text(json.dumps(record, sort_keys=True), encoding="utf-8")
    try:
        backup_root.mkdir(parents=True, exist_ok=False)
        for variant in ("master", "mobile"):
            final = OUTPUT / variant / "map"
            backup = backup_root / f"{variant}-map"
            if final.exists():
                os.replace(final, backup)
            final.parent.mkdir(parents=True, exist_ok=True)
            os.replace(staging_root / variant / "map", final)
        _validate_render_tree(OUTPUT)
        BLEND_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        os.replace(candidate, BLEND_OUTPUT)
    except BaseException:
        _restore_map_outputs(record)
        raise
    else:
        journal.unlink(missing_ok=True)
        _remove_tree(backup_root)
        _remove_tree(staging_root)


def render_group(group: str) -> None:
    global _STAGING_ROOT, _EXPECTED_PRESERVED_GROUPS
    if group != "map":
        raise ValueError(f"Unsupported preview group: {group}")
    if REPO.resolve() != EXPECTED_WORKTREE.resolve():
        raise AssertionError(f"Must run from isolated worktree, got {REPO}")
    if bpy.data.is_dirty:
        raise AssertionError(f"Refusing to mutate dirty child scene: {bpy.data.filepath}")
    source_hashes_before = _source_hashes()
    _recover_stale_publish()
    if BLEND_OUTPUT.exists():
        if BLEND_OUTPUT.name in SOURCE_BLEND_NAMES:
            raise AssertionError("Target blend overlaps protected source allow-list")
        bpy.ops.wm.open_mainfile(filepath=str(BLEND_OUTPUT), load_ui=False)
        if bpy.data.is_dirty:
            raise AssertionError("Target preview blend opened dirty")
    scene = _preview_scene()
    _EXPECTED_PRESERVED_GROUPS = {
        collection.name
        for collection in bpy.data.collections
        if collection.name.startswith("TDPreview_Group_") and collection.name != GROUP_NAME
    }
    ensure_preview_rig(scene)
    run_id = _RUN_ID
    staging_root = OUTPUT / f".staging-map-{run_id}"
    candidate = BLEND_OUTPUT.parent / f".{BLEND_OUTPUT.stem}.{run_id}.candidate.blend"
    if staging_root.exists() or candidate.exists():
        raise AssertionError(f"Run paths already exist for {run_id}")
    staging_root.mkdir(parents=True)
    _STAGING_ROOT = staging_root
    try:
        render_map_group(scene)
        render_validation = _validate_render_tree(staging_root)
        if _source_hashes() != source_hashes_before:
            raise AssertionError("Protected source blend hash changed during render")
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(candidate), check_existing=False)
        persistence = _validate_candidate(candidate, _EXPECTED_PRESERVED_GROUPS)
        if _source_hashes() != source_hashes_before:
            raise AssertionError("Protected source blend hash changed during candidate validation")
        _publish(staging_root, candidate, run_id)
        if _source_hashes() != source_hashes_before:
            raise AssertionError("Protected source blend hash changed during publish")
        print("TD_PREVIEW_RENDER_VALIDATION " + json.dumps(render_validation, sort_keys=True))
        print("TD_PREVIEW_PERSISTENCE " + json.dumps(persistence, sort_keys=True))
        print("TD_PREVIEW_SOURCE_HASHES " + json.dumps(source_hashes_before, sort_keys=True))
    except BaseException:
        if candidate.exists():
            candidate.unlink()
        _remove_tree(staging_root)
        raise
    finally:
        _STAGING_ROOT = None


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--group", choices=("map",), required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args(argv)
    if not args.run_id.isalnum() or not (8 <= len(args.run_id) <= 64):
        parser.error("--run-id must be 8-64 alphanumeric characters")
    return args


_RUN_ID = ""


def main(argv: list[str]) -> int:
    global _RUN_ID
    args = _parse_args(argv)
    _RUN_ID = args.run_id
    render_group(args.group)
    print(f"TD_PREVIEW_OK {_RUN_ID}")
    return 0


if __name__ == "__main__":
    separator = sys.argv.index("--") if "--" in sys.argv else 0
    raise SystemExit(main(sys.argv[separator + 1 :]))
