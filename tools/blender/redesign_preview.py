from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import sys
import tempfile
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
TOWER_GROUP_NAME = "TDPreview_Group_tower"
RIG_COLLECTION_NAME = "TDPreview_Rig_v1"
MATERIAL_PREFIX = "TDPreview_map_v1__"
TOWER_MATERIAL_PREFIX = "TDPreview_tower_v1__"
TOWER_GROUND_Z = 0.20

CAMERA_SPEC = {
    "name": "TD_Preview_Camera",
    "location": (6.5, -8.5, 6.25),
    "target": (0.0, 0.0, 0.6),
    "ortho_scale": 5.6,
}
LIGHT_SPECS = {
    "TD_Key": ((4.5, -4.5, 8.0), 1050.0, 5.0),
    "TD_Fill": ((-4.5, -2.0, 5.0), 500.0, 4.0),
    "TD_Rim": ((2.0, 5.0, 7.0), 750.0, 3.0),
}

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
_EXPECTED_PRESERVED_STATE: dict[str, object] = {}
_LIFECYCLE_EVENTS: list[str] = []
_PREFLIGHT_SNAPSHOT: dict[str, object] | None = None


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


def _child_preflight() -> dict[str, object]:
    if _LIFECYCLE_EVENTS:
        raise AssertionError("Child preflight must be the first lifecycle event")
    if REPO.resolve() != EXPECTED_WORKTREE.resolve():
        raise AssertionError(f"Must run from isolated worktree, got {REPO}")
    if bpy.data.is_dirty:
        raise AssertionError(f"Refusing to preflight dirty child scene: {bpy.data.filepath}")
    initial_path = bpy.data.filepath
    if initial_path:
        active = Path(initial_path).resolve()
        protected = {
            (REPO / "assets/blender" / name).resolve()
            for name in SOURCE_BLEND_NAMES
        }
        if active in protected:
            raise AssertionError(f"Refusing protected source as child initial path: {initial_path}")
    snapshot: dict[str, object] = {
        "repo": str(REPO.resolve()),
        "initial_path": initial_path,
        "initial_dirty": bool(bpy.data.is_dirty),
        "source_hashes": _source_hashes(),
    }
    _LIFECYCLE_EVENTS.append("preflight_ok")
    print("TD_PREVIEW_PREFLIGHT_OK " + json.dumps(snapshot, sort_keys=True), flush=True)
    return snapshot


def _snapshot_source_hashes(snapshot: dict[str, object]) -> dict[str, str]:
    hashes = snapshot.get("source_hashes")
    if not isinstance(hashes, dict) or not all(
        isinstance(name, str) and isinstance(digest, str)
        for name, digest in hashes.items()
    ):
        raise AssertionError("Invalid child preflight source snapshot")
    return hashes


def _assert_preflight_snapshot(
    snapshot: dict[str, object],
    stage: str,
    *,
    require_initial_path: bool,
) -> None:
    if snapshot.get("repo") != str(REPO.resolve()):
        raise AssertionError(f"Preflight worktree changed during {stage}")
    if _source_hashes() != _snapshot_source_hashes(snapshot):
        raise AssertionError(f"Protected source blend hash changed during {stage}")
    if require_initial_path and bpy.data.filepath != snapshot.get("initial_path"):
        raise AssertionError(f"Child active path changed during {stage}")
    print(f"TD_PREVIEW_SOURCE_SNAPSHOT_OK {stage}", flush=True)


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
    qualified_name = MATERIAL_PREFIX + name
    material = bpy.data.materials.get(qualified_name)
    if material is None:
        material = bpy.data.materials.new(qualified_name)
    elif (
        material.get("td_preview_owner") != OWNER
        or material.get("td_preview_group") != "map"
    ):
        raise AssertionError(f"Refusing to reuse foreign material {qualified_name}")
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


def _rounded(values: object) -> tuple[float, ...]:
    return tuple(round(float(value), 7) for value in values)  # type: ignore[arg-type]


def _custom_properties(block: object) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in block.items():  # type: ignore[attr-defined]
        if isinstance(value, (str, int, float, bool)) or value is None:
            result[str(key)] = value
        elif hasattr(value, "__iter__"):
            result[str(key)] = tuple(value)
        else:
            result[str(key)] = repr(value)
    return dict(sorted(result.items()))


def _material_signature(material: bpy.types.Material) -> dict[str, object]:
    principled = None
    if material.use_nodes and material.node_tree is not None:
        principled = next(
            (node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"),
            None,
        )
    shader: dict[str, object] | None = None
    if principled is not None:
        shader = {
            "base_color": _rounded(principled.inputs["Base Color"].default_value),
            "roughness": round(float(principled.inputs["Roughness"].default_value), 7),
            "alpha": round(float(principled.inputs["Alpha"].default_value), 7)
            if principled.inputs.get("Alpha") is not None
            else None,
        }
    return {
        "name": material.name,
        "props": _custom_properties(material),
        "diffuse": _rounded(material.diffuse_color),
        "use_nodes": bool(material.use_nodes),
        "shader": shader,
    }


def _object_signature(obj: bpy.types.Object) -> dict[str, object]:
    data = obj.data
    data_signature: dict[str, object] | None = None
    if data is not None:
        data_signature = {
            "name": data.name,
            "type": data.__class__.__name__,
            "props": _custom_properties(data),
        }
        if obj.type == "MESH":
            data_signature.update(
                vertices=len(data.vertices),
                edges=len(data.edges),
                polygons=len(data.polygons),
            )
        elif obj.type == "CAMERA":
            data_signature.update(type=data.type, ortho_scale=round(float(data.ortho_scale), 7))
        elif obj.type == "LIGHT":
            data_signature.update(
                type=data.type,
                energy=round(float(data.energy), 7),
                shape=data.shape,
                size=round(float(data.size), 7),
            )
    return {
        "name": obj.name,
        "type": obj.type,
        "props": _custom_properties(obj),
        "collections": sorted(collection.name for collection in obj.users_collection),
        "location": _rounded(obj.location),
        "rotation": _rounded(obj.rotation_euler),
        "scale": _rounded(obj.scale),
        "hide_render": bool(obj.hide_render),
        "hide_viewport": bool(obj.hide_viewport),
        "data": data_signature,
        "materials": [
            _material_signature(slot.material) if slot.material is not None else None
            for slot in obj.material_slots
        ],
    }


def _collection_signature(collection: bpy.types.Collection) -> dict[str, object]:
    return {
        "name": collection.name,
        "props": _custom_properties(collection),
        "hide_render": bool(collection.hide_render),
        "hide_viewport": bool(collection.hide_viewport),
        "objects": {
            obj.name: _object_signature(obj)
            for obj in sorted(collection.objects, key=lambda item: item.name)
        },
        "children": {
            child.name: _collection_signature(child)
            for child in sorted(collection.children, key=lambda item: item.name)
        },
    }


def _snapshot_preserved_groups(excluded_group_name: str = GROUP_NAME) -> dict[str, object]:
    return {
        collection.name: _collection_signature(collection)
        for collection in sorted(bpy.data.collections, key=lambda item: item.name)
        if collection.name.startswith("TDPreview_Group_")
        and collection.name != excluded_group_name
    }


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


def _rig_data_name(object_name: str) -> str:
    return object_name + "_Data"


def _remove_owned_rig_objects(collection: bpy.types.Collection) -> None:
    removed_data: list[object] = []
    for obj in list(collection.objects):
        if obj.get("td_preview_owner") != OWNER:
            raise AssertionError(f"Foreign object in preview rig: {obj.name}")
        if obj.data is not None:
            removed_data.append(obj.data)
        bpy.data.objects.remove(obj, do_unlink=True)
    for data in removed_data:
        if data.users != 0 or data.get("td_preview_owner") != OWNER:  # type: ignore[attr-defined]
            continue
        if isinstance(data, bpy.types.Camera):
            bpy.data.cameras.remove(data)
        elif isinstance(data, bpy.types.Light):
            bpy.data.lights.remove(data)


def _assert_available_rig_data_name(name: str, datablocks: object) -> None:
    existing = datablocks.get(name)  # type: ignore[attr-defined]
    if existing is not None:
        raise AssertionError(f"Rig data name is occupied: {name}")


def _new_rig(scene: bpy.types.Scene, collection: bpy.types.Collection) -> None:
    camera_data_name = _rig_data_name(str(CAMERA_SPEC["name"]))
    _assert_available_rig_data_name(camera_data_name, bpy.data.cameras)
    camera_data = bpy.data.cameras.new(camera_data_name)
    _tag(camera_data, "common")
    camera = bpy.data.objects.new(str(CAMERA_SPEC["name"]), camera_data)
    _tag(camera, "common")
    collection.objects.link(camera)

    for name in LIGHT_SPECS:
        data_name = _rig_data_name(name)
        _assert_available_rig_data_name(data_name, bpy.data.lights)
        data = bpy.data.lights.new(data_name, "AREA")
        _tag(data, "common")
        light = bpy.data.objects.new(name, data)
        _tag(light, "common")
        collection.objects.link(light)
    _normalize_rig(scene, collection)


def _unlink_rig_from_other_parents(scene: bpy.types.Scene, rig: bpy.types.Collection) -> None:
    for parent in bpy.data.collections:
        if parent != scene.collection and rig.name in {child.name for child in parent.children}:
            parent.children.unlink(rig)
    for other_scene in bpy.data.scenes:
        if other_scene != scene and rig.name in {child.name for child in other_scene.collection.children}:
            other_scene.collection.children.unlink(rig)
    _link_child(scene.collection, rig)


def _normalize_rig(scene: bpy.types.Scene, rig: bpy.types.Collection) -> None:
    _tag(rig, "common")
    _unlink_rig_from_other_parents(scene, rig)
    objects = {obj.name: obj for obj in rig.objects}
    camera = objects[str(CAMERA_SPEC["name"])]
    for obj in rig.objects:
        _tag(obj, "common")
        _tag(obj.data, "common")
        expected_data_name = _rig_data_name(obj.name)
        conflict = (
            bpy.data.cameras.get(expected_data_name)
            if obj.type == "CAMERA"
            else bpy.data.lights.get(expected_data_name)
        )
        if conflict is not None and conflict is not obj.data:
            raise AssertionError(f"Rig data name is occupied: {expected_data_name}")
        obj.data.name = expected_data_name
        for linked in list(obj.users_collection):
            if linked != rig:
                linked.objects.unlink(obj)
        if rig not in obj.users_collection:
            rig.objects.link(obj)
        obj.scale = (1.0, 1.0, 1.0)
        obj.rotation_mode = "XYZ"
    camera.location = CAMERA_SPEC["location"]
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = float(CAMERA_SPEC["ortho_scale"])
    look_at(camera, CAMERA_SPEC["target"])
    scene.camera = camera
    for name, (location, energy, size) in LIGHT_SPECS.items():
        light = objects[name]
        light.location = location
        light.data.type = "AREA"
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        look_at(light, CAMERA_SPEC["target"])


def _rotation_matches(obj: bpy.types.Object, location: tuple[float, float, float]) -> bool:
    expected = (Vector(CAMERA_SPEC["target"]) - Vector(location)).to_track_quat("-Z", "Y")
    return abs(obj.rotation_euler.to_quaternion().rotation_difference(expected).angle) <= 1e-6


def _collection_tree_contains(root: bpy.types.Collection, target: bpy.types.Collection) -> bool:
    return any(
        child == target or _collection_tree_contains(child, target)
        for child in root.children
    )


def _assert_rig_exact(scene: bpy.types.Scene, rig: bpy.types.Collection) -> None:
    required = {str(CAMERA_SPEC["name"]): "CAMERA", **{name: "LIGHT" for name in LIGHT_SPECS}}
    objects = {obj.name: obj for obj in rig.objects}
    if set(objects) != set(required) or any(objects[name].type != kind for name, kind in required.items()):
        raise AssertionError("Common rig object manifest mismatch")
    if rig.get("td_preview_owner") != OWNER or rig.get("td_preview_group") != "common":
        raise AssertionError("Common rig collection ownership mismatch")
    if {parent.name for parent in bpy.data.collections if rig.name in {child.name for child in parent.children}}:
        raise AssertionError("Common rig is linked beneath a non-scene collection")
    linked_scenes = {
        candidate
        for candidate in bpy.data.scenes
        if _collection_tree_contains(candidate.collection, rig)
    }
    if linked_scenes != {scene} or rig.name not in {child.name for child in scene.collection.children}:
        raise AssertionError("Common rig scene link mismatch")
    camera = objects[str(CAMERA_SPEC["name"])]
    if scene.camera is not camera:
        raise AssertionError("Preview scene camera link mismatch")
    if set(camera.users_collection) != {rig}:
        raise AssertionError("Preview camera collection link mismatch")
    if (
        camera.get("td_preview_owner") != OWNER
        or camera.get("td_preview_group") != "common"
        or camera.data.get("td_preview_owner") != OWNER
        or camera.data.get("td_preview_group") != "common"
        or camera.data.name != _rig_data_name(camera.name)
        or camera.data.users != 1
        or camera.data.type != "ORTHO"
        or abs(camera.data.ortho_scale - float(CAMERA_SPEC["ortho_scale"])) > 1e-6
        or (camera.location - Vector(CAMERA_SPEC["location"])).length > 1e-6
        or not _rotation_matches(camera, CAMERA_SPEC["location"])
        or (camera.scale - Vector((1.0, 1.0, 1.0))).length > 1e-6
    ):
        raise AssertionError("Preview camera is not exactly normalized")
    for name, (location, energy, size) in LIGHT_SPECS.items():
        light = objects[name]
        if (
            set(light.users_collection) != {rig}
            or light.get("td_preview_owner") != OWNER
            or light.get("td_preview_group") != "common"
            or light.data.get("td_preview_owner") != OWNER
            or light.data.get("td_preview_group") != "common"
            or light.data.name != _rig_data_name(name)
            or light.data.users != 1
            or light.data.type != "AREA"
            or abs(light.data.energy - energy) > 1e-6
            or light.data.shape != "DISK"
            or abs(light.data.size - size) > 1e-6
            or (light.location - Vector(location)).length > 1e-6
            or not _rotation_matches(light, location)
            or (light.scale - Vector((1.0, 1.0, 1.0))).length > 1e-6
        ):
            raise AssertionError(f"Preview light is not exactly normalized: {name}")


def ensure_preview_rig(scene: bpy.types.Scene) -> bpy.types.Collection:
    rigs = [collection for collection in bpy.data.collections if collection.name == RIG_COLLECTION_NAME]
    if len(rigs) > 1:
        raise AssertionError("Duplicate preview rig collections")
    rig = rigs[0] if rigs else bpy.data.collections.new(RIG_COLLECTION_NAME)
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
        and all(
            obj.get("td_preview_owner") == OWNER
            and obj.get("td_preview_group") == "common"
            and obj.data is not None
            and obj.data.get("td_preview_owner") == OWNER
            and obj.data.get("td_preview_group") == "common"
            for obj in rig.objects
        )
    )
    if not valid:
        _remove_owned_rig_objects(rig)
        _new_rig(scene, rig)
    else:
        _normalize_rig(scene, rig)
    _configure_render(scene)
    _assert_rig_exact(scene, rig)
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


DOG_VFX_WORDS = (
    "aqua",
    "water",
    "fire",
    "flame",
    "orb",
    "ball",
    "wave",
    "drop",
    "bubble",
)


def _contains_dog_vfx_token(name: str) -> bool:
    lowered = name.casefold()
    return any(word in lowered for word in DOG_VFX_WORDS)


def huchu_predicate(name: str) -> bool:
    return (name.startswith("Huchu_") or name == "Huchu_v2") and not _contains_dog_vfx_token(name)


def deokbae_predicate(name: str) -> bool:
    return (name.startswith("Deokbae_") or name == "Deokbae_v2") and not _contains_dog_vfx_token(name)


def arrow_predicate(name: str) -> bool:
    return (name.startswith("Arrow_") or name == "ArrowTower_Root") and name not in {
        "Arrow_Camera",
        "Arrow_Key",
        "Arrow_Fill",
        "Arrow_Rim",
        "Arrow_Ground",
    }


def slow_predicate(name: str) -> bool:
    return (name.startswith("Slow_") or name.startswith("SlowTower_")) and name not in {
        "Slow_Camera",
        "Slow_Key",
        "Slow_Fill",
        "Slow_Rim",
        "Slow_Ground",
    } and "aura" not in name.casefold()


TOWER_ASSETS = {
    "towers/slow-se.png": ("slow-tower-v1.blend", slow_predicate),
    "towers/arrow-se.png": ("arrow-tower-v1.blend", arrow_predicate),
    "towers/deokbae-se.png": ("character-assets-v2.blend", deokbae_predicate),
    "towers/huchu-se.png": ("character-assets-v2.blend", huchu_predicate),
}


def append_selected_objects(
    blend_path: Path,
    predicate: object,
    collection_name: str,
) -> list[bpy.types.Object]:
    if bpy.data.collections.get(collection_name) is not None:
        raise AssertionError(f"Tower asset collection already exists: {collection_name}")
    with bpy.data.libraries.load(str(blend_path), link=False) as (source, target):
        selected_names = [name for name in source.objects if predicate(name)]  # type: ignore[operator]
        target.objects = selected_names
    if not selected_names:
        raise AssertionError(f"No source objects selected from {blend_path.name}")
    collection = bpy.data.collections.new(collection_name)
    bpy.context.scene.collection.children.link(collection)
    loaded: list[bpy.types.Object] = []
    for obj in target.objects:
        if obj is not None:
            collection.objects.link(obj)
            loaded.append(obj)
    if len(loaded) != len(selected_names):
        raise AssertionError(f"Incomplete object append from {blend_path.name}")
    return loaded


def mesh_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    meshes = [obj for obj in objects if obj.type == "MESH"]
    return _world_bounds(meshes)


def _tower_asset_slug(collection: bpy.types.Collection) -> str:
    relative_path = collection.get("td_preview_asset")
    if not isinstance(relative_path, str) or relative_path not in TOWER_ASSETS:
        raise AssertionError(f"Invalid tower asset collection identity: {collection.name}")
    return Path(relative_path).stem.replace("-", "_")


def _tower_collection_for(objects: list[bpy.types.Object]) -> bpy.types.Collection:
    collections = {
        collection
        for obj in objects
        for collection in obj.users_collection
        if collection.get("td_preview_group") == "tower"
    }
    if len(collections) != 1:
        raise AssertionError("Tower objects must share exactly one owned asset collection")
    return next(iter(collections))


def fit_objects_to_tile(
    objects: list[bpy.types.Object],
    target_width: float = 2.45,
    target_height: float = 2.65,
) -> None:
    if target_width <= 0 or target_height <= 0:
        raise AssertionError("Tower fit targets must be positive")
    collection = _tower_collection_for(objects)
    minimum, maximum = mesh_bounds(objects)
    extent = maximum - minimum
    widest = max(extent.x, extent.y)
    if widest <= 0 or extent.z <= 0:
        raise AssertionError("Tower source has degenerate bounds")
    scale = min(target_width / widest, target_height / extent.z)
    slug = _tower_asset_slug(collection)
    root = bpy.data.objects.new(f"TDPreview_tower_{slug}__FitRoot", None)
    _tag(root, "tower")
    collection.objects.link(root)
    for obj in objects:
        world_transform = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_world = world_transform
    root.scale = (scale, scale, scale)
    bpy.context.view_layer.update()
    minimum, maximum = mesh_bounds(objects)
    root.location = (
        -(minimum.x + maximum.x) / 2.0,
        -(minimum.y + maximum.y) / 2.0,
        TOWER_GROUND_Z - minimum.z,
    )
    bpy.context.view_layer.update()


def _tower_asset_collection_name(relative_path: str) -> str:
    return "TDPreview_tower_" + Path(relative_path).stem.replace("-", "_")


def _stable_tower_name(slug: str, original: str) -> str:
    safe_original = re.sub(r"[^A-Za-z0-9_]+", "_", original).strip("_")
    return f"TDPreview_tower_{slug}__{safe_original}"


def _tag_tower_dependencies(
    objects: list[bpy.types.Object],
    collection: bpy.types.Collection,
) -> None:
    slug = _tower_asset_slug(collection)
    original_names = {obj: obj.name for obj in objects}
    for obj, original in original_names.items():
        _tag(obj, "tower")
        obj.name = _stable_tower_name(slug, original)
    seen_data: set[object] = set()
    seen_materials: set[bpy.types.Material] = set()
    for obj in objects:
        if obj.data is not None and obj.data not in seen_data:
            seen_data.add(obj.data)
            original = obj.data.name
            _tag(obj.data, "tower")
            obj.data.name = _stable_tower_name(
                slug,
                f"data_{len(seen_data):02d}_{original}",
            )
        for slot in obj.material_slots:
            material = slot.material
            if material is None or material in seen_materials:
                continue
            seen_materials.add(material)
            original = material.name
            _tag(material, "tower")
            material.name = _stable_tower_name(
                slug,
                f"material_{len(seen_materials):02d}_{original}",
            ).replace(
                "TDPreview_tower_",
                TOWER_MATERIAL_PREFIX,
                1,
            )


def _tower_dependency_blocks(
    objects: list[bpy.types.Object],
    collections: list[bpy.types.Collection],
) -> list[object]:
    blocks: list[object] = [*objects, *collections]
    seen: set[int] = {id(block) for block in blocks}
    for obj in objects:
        for block in (obj.data, obj.animation_data.action if obj.animation_data else None):
            if block is not None and id(block) not in seen:
                seen.add(id(block))
                blocks.append(block)
        for slot in obj.material_slots:
            material = slot.material
            if material is None or id(material) in seen:
                continue
            seen.add(id(material))
            blocks.append(material)
            if material.node_tree is not None and id(material.node_tree) not in seen:
                seen.add(id(material.node_tree))
                blocks.append(material.node_tree)
                for node in material.node_tree.nodes:
                    for attribute in ("image", "node_tree"):
                        dependency = getattr(node, attribute, None)
                        if dependency is not None and id(dependency) not in seen:
                            seen.add(id(dependency))
                            blocks.append(dependency)
    return blocks


def _assert_clean_tower_dependencies(
    objects: list[bpy.types.Object],
    collections: list[bpy.types.Collection],
) -> None:
    forbidden = [
        block.name
        for block in _tower_dependency_blocks(objects, collections)
        if hasattr(block, "name") and _contains_dog_vfx_token(str(block.name))
    ]
    if forbidden:
        raise AssertionError("Forbidden dog dependency token: " + ", ".join(sorted(forbidden)))


def _assert_only_td_rig(scene: bpy.types.Scene, tower_group: bpy.types.Collection) -> None:
    rig = bpy.data.collections.get(RIG_COLLECTION_NAME)
    if rig is None:
        raise AssertionError("Tower render is missing the common TD rig")
    allowed_non_mesh = set(rig.objects)
    source_rig_names = {
        "Preview_Camera",
        "Preview_Key",
        "Preview_Fill",
        "Preview_Rim",
        "Preview_Ground",
        "Arrow_Camera",
        "Arrow_Key",
        "Arrow_Fill",
        "Arrow_Rim",
        "Arrow_Ground",
        "Slow_Camera",
        "Slow_Key",
        "Slow_Fill",
        "Slow_Rim",
        "Slow_Ground",
    }
    leaked = [obj.name for obj in tower_group.all_objects if obj.name in source_rig_names]
    if leaked:
        raise AssertionError("Source rig object leaked into tower group: " + ", ".join(leaked))
    unexpected = [
        obj.name
        for obj in scene.objects
        if obj.type in {"CAMERA", "LIGHT"} and obj not in allowed_non_mesh
    ]
    if unexpected:
        raise AssertionError("Non-TD camera/light in preview scene: " + ", ".join(unexpected))


def _assert_tower_asset_geometry(
    relative_path: str,
    collection: bpy.types.Collection,
) -> dict[str, float]:
    meshes = [obj for obj in collection.all_objects if obj.type == "MESH"]
    minimum, maximum = mesh_bounds(meshes)
    extent = maximum - minimum
    center = (minimum + maximum) / 2.0
    if max(extent.x, extent.y) > 2.45001 or extent.z > 2.65001:
        raise AssertionError(f"{relative_path} exceeds one-tile bounds: {minimum} {maximum}")
    if abs(center.x) > 1e-5 or abs(center.y) > 1e-5:
        raise AssertionError(f"{relative_path} is not centered in its tile: {center}")
    if abs(minimum.z - TOWER_GROUND_Z) > 1e-5:
        raise AssertionError(f"{relative_path} is not grounded at {TOWER_GROUND_Z}: {minimum.z}")
    return {
        "width_x": round(float(extent.x), 6),
        "width_y": round(float(extent.y), 6),
        "height": round(float(extent.z), 6),
        "ground_z": round(float(minimum.z), 6),
    }


def _character_metrics(collection: bpy.types.Collection) -> dict[str, float]:
    meshes = [obj for obj in collection.all_objects if obj.type == "MESH"]
    minimum, maximum = mesh_bounds(meshes)
    height = maximum.z - minimum.z
    head_floor = minimum.z + height * 0.58
    head_points: list[Vector] = []
    for obj in meshes:
        for vertex in obj.data.vertices:
            point = obj.matrix_world @ vertex.co
            if point.z >= head_floor:
                head_points.append(point)
    if not head_points:
        raise AssertionError(f"No head vertices found for {collection.name}")
    head_width = max(
        max(point.x for point in head_points) - min(point.x for point in head_points),
        max(point.y for point in head_points) - min(point.y for point in head_points),
    )
    return {
        "height": float(height),
        "head_width": float(head_width),
    }


def _refit_character_ratio(
    huchu: bpy.types.Collection,
    deokbae: bpy.types.Collection,
) -> dict[str, dict[str, float]]:
    huchu_metrics = _character_metrics(huchu)
    deokbae_metrics = _character_metrics(deokbae)
    ratio_scale = min(
        1.0,
        deokbae_metrics["height"] * 1.02 / huchu_metrics["height"],
        deokbae_metrics["head_width"] * 1.05 / huchu_metrics["head_width"],
    )
    if ratio_scale < 1.0:
        root = next(
            (obj for obj in huchu.objects if obj.name.endswith("__FitRoot")),
            None,
        )
        if root is None:
            raise AssertionError("Huchu fit root is missing")
        root.scale = tuple(value * ratio_scale for value in root.scale)
        bpy.context.view_layer.update()
        objects = [obj for obj in huchu.all_objects if obj.type == "MESH"]
        minimum, maximum = mesh_bounds(objects)
        root.location.x -= (minimum.x + maximum.x) / 2.0
        root.location.y -= (minimum.y + maximum.y) / 2.0
        root.location.z += TOWER_GROUND_Z - minimum.z
        bpy.context.view_layer.update()
        huchu_metrics = _character_metrics(huchu)
    if huchu_metrics["height"] > deokbae_metrics["height"] * 1.02 + 1e-6:
        raise AssertionError("Huchu height ratio exceeds Deokbae contract")
    if huchu_metrics["head_width"] > deokbae_metrics["head_width"] * 1.05 + 1e-6:
        raise AssertionError("Huchu head-width ratio exceeds Deokbae contract")
    return {
        "huchu": {key: round(value, 6) for key, value in huchu_metrics.items()},
        "deokbae": {key: round(value, 6) for key, value in deokbae_metrics.items()},
    }


def _remove_unused_owned_tower_data() -> None:
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.armatures, bpy.data.materials):
        for block in list(datablocks):
            if (
                block.get("td_preview_owner") == OWNER
                and block.get("td_preview_group") == "tower"
                and block.users == 0
            ):
                datablocks.remove(block)


def _prepare_tower_group(scene: bpy.types.Scene) -> bpy.types.Collection:
    existing = bpy.data.collections.get(TOWER_GROUP_NAME)
    if existing is not None:
        _remove_owned_collection(existing, "tower")
        _remove_unused_owned_tower_data()
    group = bpy.data.collections.new(TOWER_GROUP_NAME)
    _tag(group, "tower")
    _link_child(scene.collection, group)
    return group


def _append_tower_asset(
    group: bpy.types.Collection,
    relative_path: str,
    blend_name: str,
    predicate: object,
) -> tuple[bpy.types.Collection, list[bpy.types.Object]]:
    collection_name = _tower_asset_collection_name(relative_path)
    objects = append_selected_objects(
        REPO / "assets/blender" / blend_name,
        predicate,
        collection_name,
    )
    collection = bpy.data.collections[collection_name]
    _tag(collection, "tower")
    collection["td_preview_asset"] = relative_path
    bpy.context.scene.collection.children.unlink(collection)
    _link_child(group, collection)
    _tag_tower_dependencies(objects, collection)
    if relative_path.endswith(("huchu-se.png", "deokbae-se.png")):
        _assert_clean_tower_dependencies(objects, [collection])
    fit_objects_to_tile(objects)
    _assert_tower_asset_geometry(relative_path, collection)
    return collection, objects


def _preview_collection_tree() -> list[bpy.types.Collection]:
    collections: list[bpy.types.Collection] = []

    def visit(collection: bpy.types.Collection) -> None:
        if collection in collections:
            return
        collections.append(collection)
        for child in collection.children:
            visit(child)

    for collection in bpy.data.collections:
        if collection.name.startswith("TDPreview_Group_"):
            visit(collection)
    return collections


def _render_visible_preview_collections() -> list[str]:
    return sorted(
        collection.name
        for collection in _preview_collection_tree()
        if not collection.hide_render
    )


def _snapshot_preview_render_visibility() -> dict[str, bool]:
    return {
        collection.name: bool(collection.hide_render)
        for collection in _preview_collection_tree()
    }


def _isolate_preview_render_collection(
    active_group: bpy.types.Collection,
    current: bpy.types.Collection,
) -> list[str]:
    if not active_group.name.startswith("TDPreview_Group_"):
        raise AssertionError(f"Active preview group has invalid identity: {active_group.name}")
    if current not in active_group.children_recursive:
        raise AssertionError(f"Current asset is outside active preview group: {current.name}")
    allowed = {active_group, current, *current.children_recursive}
    for collection in _preview_collection_tree():
        collection.hide_render = collection not in allowed
    for obj in current.all_objects:
        if obj.hide_render:
            raise AssertionError(f"Current render object is hidden: {obj.name}")
    return _render_visible_preview_collections()


def _assert_current_only_render_visibility(
    active_group: bpy.types.Collection,
    current: bpy.types.Collection,
) -> list[str]:
    visible = _render_visible_preview_collections()
    expected = sorted((active_group.name, current.name, *(child.name for child in current.children_recursive)))
    if visible != expected:
        raise AssertionError(
            f"Render visibility is not current-only: expected={expected} actual={visible}"
        )
    return visible


def _restore_preview_render_visibility(snapshot: dict[str, bool]) -> None:
    for name, hide_render in snapshot.items():
        collection = bpy.data.collections.get(name)
        if collection is None:
            raise AssertionError(f"Preview collection disappeared before visibility restore: {name}")
        collection.hide_render = hide_render


def _expected_tower_visibility_audit(
    group: bpy.types.Collection,
) -> dict[str, list[str]]:
    expected: dict[str, list[str]] = {}
    for collection in group.children:
        relative_path = collection.get("td_preview_asset")
        if not isinstance(relative_path, str) or relative_path not in TOWER_ASSETS:
            raise AssertionError(f"Invalid tower audit asset identity: {collection.name}")
        expected[relative_path] = sorted(
            (group.name, collection.name, *(child.name for child in collection.children_recursive))
        )
    if set(expected) != set(TOWER_ASSETS):
        raise AssertionError("Tower visibility audit manifest is incomplete")
    return expected


def _assert_persisted_tower_visibility_audit(group: bpy.types.Collection) -> None:
    serialized = group.get("render_visibility_audit")
    if not isinstance(serialized, str):
        raise AssertionError("Tower render visibility audit was not persisted")
    try:
        actual = json.loads(serialized)
    except json.JSONDecodeError as error:
        raise AssertionError("Tower render visibility audit is invalid JSON") from error
    expected = _expected_tower_visibility_audit(group)
    if actual != expected:
        raise AssertionError(
            f"Tower render visibility audit mismatch: expected={expected} actual={actual}"
        )


def render_tower_group(scene: bpy.types.Scene) -> dict[str, object]:
    group = _prepare_tower_group(scene)
    collections: dict[str, bpy.types.Collection] = {}
    for relative_path, (blend_name, predicate) in TOWER_ASSETS.items():
        collection, _ = _append_tower_asset(group, relative_path, blend_name, predicate)
        collections[relative_path] = collection
    character_metrics = _refit_character_ratio(
        collections["towers/huchu-se.png"],
        collections["towers/deokbae-se.png"],
    )
    _assert_only_td_rig(scene, group)
    geometry: dict[str, dict[str, float]] = {}
    visibility_before = _snapshot_preview_render_visibility()
    visibility_audit: dict[str, list[str]] = {}
    try:
        for relative_path, collection in collections.items():
            geometry[relative_path] = _assert_tower_asset_geometry(relative_path, collection)
            _isolate_preview_render_collection(group, collection)
            visibility_audit[relative_path] = _assert_current_only_render_visibility(
                group,
                collection,
            )
            emit_single(relative_path)
    finally:
        _restore_preview_render_visibility(visibility_before)
    if _snapshot_preview_render_visibility() != visibility_before:
        raise AssertionError("Preview render visibility changed after tower renders")
    group["render_visibility_audit"] = json.dumps(visibility_audit, sort_keys=True)
    _assert_persisted_tower_visibility_audit(group)
    group["character_metrics"] = json.dumps(character_metrics, sort_keys=True)
    return {
        "geometry": geometry,
        "character_metrics": character_metrics,
        "render_visibility_audit": visibility_audit,
    }


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


def _expected_file_names(group: str = "map") -> set[str]:
    builders = MAP_BUILDERS if group == "map" else TOWER_ASSETS
    return {Path(relative_path).name for relative_path in builders}


def _group_directory(group: str) -> str:
    if group == "map":
        return "map"
    if group == "tower":
        return "towers"
    raise AssertionError(f"Unsupported preview group directory: {group}")


def _validate_render_tree(
    root: Path,
    group: str = "map",
) -> dict[str, dict[str, dict[str, int]]]:
    if group not in ("map", "tower"):
        raise AssertionError(f"Unsupported render tree group: {group}")
    expected = _expected_file_names(group)
    group_directory = _group_directory(group)
    result: dict[str, dict[str, dict[str, int]]] = {}
    for variant, size in (("master", FRAME_SIZE), ("mobile", MOBILE_SIZE)):
        directory = root / variant / group_directory
        actual = {path.name for path in directory.glob("*.png")}
        if actual != expected:
            raise AssertionError(f"{variant} manifest mismatch: expected={sorted(expected)} actual={sorted(actual)}")
        if len(list(directory.iterdir())) != len(expected):
            raise AssertionError(f"{variant} {group_directory} directory contains non-manifest files")
        result[variant] = {
            name: _validate_png(directory / name, size)
            for name in sorted(expected)
        }
    return result


def _assert_owned_data_integrity() -> dict[str, int]:
    counts: dict[str, int] = {}
    datablock_sets = (
        ("mesh", bpy.data.meshes, {"map", "tower"}),
        ("material", bpy.data.materials, {"map", "tower"}),
        ("curve", bpy.data.curves, {"tower"}),
        ("armature", bpy.data.armatures, {"tower"}),
        ("camera", bpy.data.cameras, {"common"}),
        ("light", bpy.data.lights, {"common"}),
    )
    seen: set[tuple[str, str]] = set()
    for kind, datablocks, expected_groups in datablock_sets:
        owned = [block for block in datablocks if block.get("td_preview_owner") == OWNER]
        counts[kind] = len(owned)
        for block in owned:
            key = (kind, block.name)
            if key in seen or re.search(r"\.\d{3}$", block.name):
                raise AssertionError(f"Duplicate owned {kind} data: {block.name}")
            seen.add(key)
            group = block.get("td_preview_group")
            if group not in expected_groups:
                raise AssertionError(f"Owned {kind} has wrong group: {block.name}")
            if block.users <= 0:
                raise AssertionError(f"Owned orphan {kind}: {block.name}")
            if kind in ("mesh", "curve", "armature"):
                users = [obj for obj in bpy.data.objects if obj.data is block]
                if len(users) != 1 or block.users != 1:
                    raise AssertionError(f"Owned {kind} must have exactly one user: {block.name}")
                if users[0].get("td_preview_owner") != OWNER or users[0].get("td_preview_group") != group:
                    raise AssertionError(f"Owned {kind} is linked to a foreign object: {block.name}")
            elif kind == "material":
                users = [
                    obj
                    for obj in bpy.data.objects
                    if any(slot.material is block for slot in obj.material_slots)
                ]
                if not users:
                    raise AssertionError(f"Owned material has no object slot user: {block.name}")
                if any(
                    obj.get("td_preview_owner") != OWNER
                    or obj.get("td_preview_group") != group
                    for obj in users
                ):
                    raise AssertionError(f"Owned material is linked to a foreign object: {block.name}")
                expected_prefix = MATERIAL_PREFIX if group == "map" else TOWER_MATERIAL_PREFIX
                if not block.name.startswith(expected_prefix):
                    raise AssertionError(f"Owned {group} material is outside its namespace: {block.name}")
            else:
                users = [obj for obj in bpy.data.objects if obj.data is block]
                if len(users) != 1 or block.users != 1:
                    raise AssertionError(f"Owned {kind} must have exactly one user: {block.name}")
                if users[0].get("td_preview_owner") != OWNER or users[0].get("td_preview_group") != "common":
                    raise AssertionError(f"Owned {kind} is linked to a foreign object: {block.name}")
    for obj in bpy.data.objects:
        if obj.get("td_preview_owner") != OWNER:
            continue
        group = obj.get("td_preview_group")
        if group not in ("map", "tower", "common"):
            raise AssertionError(f"Owned object has invalid data/group: {obj.name}")
        if obj.data is None:
            if group != "tower" or obj.type != "EMPTY":
                raise AssertionError(f"Owned object has invalid empty data: {obj.name}")
        elif obj.data.get("td_preview_owner") != OWNER or obj.data.get("td_preview_group") != group:
            raise AssertionError(f"Owned object/data ownership mismatch: {obj.name}")
        if re.search(r"\.\d{3}$", obj.name):
            raise AssertionError(f"Duplicate owned object: {obj.name}")
    return counts


def _validate_candidate(
    candidate: Path,
    preserved_state: dict[str, object],
    group_name: str = "map",
) -> dict[str, object]:
    if group_name not in ("map", "tower"):
        raise AssertionError(f"Unsupported candidate group: {group_name}")
    bpy.ops.wm.open_mainfile(filepath=str(candidate), load_ui=False)
    scenes = [scene for scene in bpy.data.scenes if scene.name == SCENE_NAME]
    if len(scenes) != 1:
        raise AssertionError(f"Expected one {SCENE_NAME}, found {len(scenes)}")
    scene = scenes[0]
    rigs = [collection for collection in bpy.data.collections if collection.name == RIG_COLLECTION_NAME]
    active_group_name = GROUP_NAME if group_name == "map" else TOWER_GROUP_NAME
    groups = [collection for collection in bpy.data.collections if collection.name == active_group_name]
    if len(rigs) != 1 or len(groups) != 1:
        raise AssertionError(f"Rig/{group_name} persistence mismatch: rigs={len(rigs)} groups={len(groups)}")
    rig = rigs[0]
    _assert_rig_exact(scene, rig)
    group = groups[0]
    asset_collections = list(group.children)
    builders = MAP_BUILDERS if group_name == "map" else TOWER_ASSETS
    collection_namer = _asset_collection_name if group_name == "map" else _tower_asset_collection_name
    expected_names = {collection_namer(path) for path in builders}
    if len(asset_collections) != len(builders) or {collection.name for collection in asset_collections} != expected_names:
        raise AssertionError(f"{group_name} per-asset collection persistence mismatch")
    current_preserved_state = _snapshot_preserved_groups(active_group_name)
    if current_preserved_state != preserved_state:
        raise AssertionError("Previously completed preview group state changed")
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
        if relative_path not in builders:
            raise AssertionError(f"Unknown persisted {group_name} asset: {relative_path}")
        if group_name == "map":
            _assert_asset_geometry(relative_path, collection)
        else:
            _assert_tower_asset_geometry(relative_path, collection)
            if relative_path.endswith(("huchu-se.png", "deokbae-se.png")):
                _assert_clean_tower_dependencies(list(collection.all_objects), [collection])
    character_metrics: dict[str, dict[str, float]] | None = None
    if group_name == "tower":
        _assert_only_td_rig(scene, group)
        _assert_persisted_tower_visibility_audit(group)
        persisted_metrics = group.get("character_metrics")
        if not isinstance(persisted_metrics, str):
            raise AssertionError("Tower character metrics were not persisted")
        character_metrics = json.loads(persisted_metrics)
        huchu = character_metrics["huchu"]
        deokbae = character_metrics["deokbae"]
        if huchu["height"] > deokbae["height"] * 1.02 + 1e-6:
            raise AssertionError("Persisted Huchu height ratio exceeds contract")
        if huchu["head_width"] > deokbae["head_width"] * 1.05 + 1e-6:
            raise AssertionError("Persisted Huchu head-width ratio exceeds contract")
    data_counts = _assert_owned_data_integrity()
    result: dict[str, object] = {
        "scene": scene.name,
        "rig_objects": sorted(obj.name for obj in rig.objects),
        "asset_collections": sorted(collection.name for collection in asset_collections),
        "preserved_groups": sorted(preserved_state),
        "owned_objects": len(owned_names),
        "owned_data": len(owned_data_names),
        "owned_datablocks": data_counts,
    }
    if character_metrics is not None:
        result["character_metrics"] = character_metrics
    return result


def _journal_path(output_root: Path = OUTPUT, group: str = "map") -> Path:
    if group not in ("map", "tower"):
        raise AssertionError(f"Unsupported publish group: {group}")
    return output_root / f".{group}-publish-journal.json"


def _validate_run_id(run_id: object) -> str:
    if not isinstance(run_id, str) or not run_id.isalnum() or not (8 <= len(run_id) <= 64):
        raise AssertionError("Publish journal run_id must be 8-64 alphanumeric characters")
    return run_id


def _derive_publish_paths(
    run_id: object,
    output_root: Path = OUTPUT,
    blend_output: Path = BLEND_OUTPUT,
    group: str = "map",
) -> dict[str, Path]:
    validated = _validate_run_id(run_id)
    if group not in ("map", "tower"):
        raise AssertionError(f"Unsupported publish group: {group}")
    return {
        "staging_root": output_root / f".staging-{group}-{validated}",
        "backup_root": output_root / f".backup-{group}-{validated}",
        "candidate": blend_output.parent / f".{blend_output.stem}.{validated}.candidate.blend",
    }


def _same_exact_path(actual: Path, expected: Path) -> bool:
    return (
        actual.is_absolute()
        and actual.absolute() == expected.absolute()
        and actual.resolve(strict=False) == expected.resolve(strict=False)
    )


def _validated_record_paths(
    record: dict[str, object],
    output_root: Path = OUTPUT,
    blend_output: Path = BLEND_OUTPUT,
) -> dict[str, Path]:
    try:
        group = record.get("group", "map")
        if not isinstance(group, str):
            raise AssertionError("Preview journal group must be a string")
        paths = _derive_publish_paths(record["run_id"], output_root, blend_output, group)
        recorded = {
            key: Path(record[key])
            for key in ("staging_root", "backup_root", "candidate")
            if isinstance(record[key], str)
        }
    except (KeyError, TypeError, ValueError) as error:
        raise AssertionError("Incomplete or invalid preview publish journal paths") from error
    if set(recorded) != {"staging_root", "backup_root", "candidate"}:
        raise AssertionError("Incomplete or invalid preview publish journal paths")
    for key, expected in paths.items():
        actual = recorded[key]
        if not _same_exact_path(actual, expected):
            raise AssertionError(f"Refusing journal {key} outside its derived run path")
        if actual.exists() and actual.is_symlink():
            raise AssertionError(f"Refusing symlink journal {key}: {actual}")
    return paths


def _assert_exact_path(path: Path, expected: Path, parent: Path, label: str) -> None:
    if not _same_exact_path(path, expected) or path.parent.absolute() != parent.absolute():
        raise AssertionError(f"Refusing {label} outside exact preview path: {path}")
    if path.exists() and path.is_symlink():
        raise AssertionError(f"Refusing symlink {label}: {path}")


def _remove_tree_exact(path: Path, expected: Path, parent: Path, label: str) -> None:
    _assert_exact_path(path, expected, parent, label)
    if not path.exists():
        return
    _assert_exact_path(path, expected, parent, label)
    shutil.rmtree(path)


def _unlink_exact(path: Path, expected: Path, parent: Path, label: str) -> None:
    _assert_exact_path(path, expected, parent, label)
    if path.exists():
        _assert_exact_path(path, expected, parent, label)
        path.unlink()


def _hash_tree(path: Path) -> dict[str, str]:
    if not path.is_dir() or path.is_symlink():
        raise AssertionError(f"Expected a real directory to hash: {path}")
    return {
        item.relative_to(path).as_posix(): _sha256(item)
        for item in sorted(path.rglob("*"))
        if item.is_file() and not item.is_symlink()
    }


def _current_component_hash(path: Path) -> dict[str, str] | str | None:
    if not path.exists():
        return None
    return _hash_tree(path) if path.is_dir() else _sha256(path)


def _create_publish_record(
    staging_root: Path,
    candidate: Path,
    run_id: str,
    output_root: Path,
    blend_output: Path,
    source_hashes: dict[str, str],
    group: str = "map",
) -> dict[str, object]:
    paths = _derive_publish_paths(run_id, output_root, blend_output, group)
    if not _same_exact_path(staging_root, paths["staging_root"]):
        raise AssertionError("Staging root is not derived from run_id")
    if not _same_exact_path(candidate, paths["candidate"]):
        raise AssertionError("Candidate blend is not derived from run_id")
    group_directory = _group_directory(group)
    record: dict[str, object] = {
        "kind": "td-preview-map-v1",
        "version": 2,
        "group": group,
        "run_id": run_id,
        "phase": "prepared",
        "staging_root": str(paths["staging_root"]),
        "backup_root": str(paths["backup_root"]),
        "candidate": str(paths["candidate"]),
        "previous": {
            variant: _current_component_hash(output_root / variant / group_directory)
            for variant in ("master", "mobile")
        },
        "target": {
            variant: _hash_tree(staging_root / variant / group_directory)
            for variant in ("master", "mobile")
        },
        "source_hashes": dict(sorted(source_hashes.items())),
    }
    record["previous"]["blend"] = _current_component_hash(blend_output)  # type: ignore[index]
    record["target"]["blend"] = _sha256(candidate)  # type: ignore[index]
    _validate_publish_record(record, output_root, blend_output)
    return record


def _validate_hash_set(value: object, label: str) -> None:
    if value is None:
        return
    if isinstance(value, str):
        if len(value) != 64 or any(character not in "0123456789abcdef" for character in value):
            raise AssertionError(f"Invalid {label} file hash")
        return
    if not isinstance(value, dict) or not all(
        isinstance(key, str)
        and isinstance(digest, str)
        and len(digest) == 64
        and all(character in "0123456789abcdef" for character in digest)
        for key, digest in value.items()
    ):
        raise AssertionError(f"Invalid {label} tree hashes")


def _validate_publish_record(
    record: dict[str, object],
    output_root: Path = OUTPUT,
    blend_output: Path = BLEND_OUTPUT,
) -> dict[str, Path]:
    if record.get("kind") != "td-preview-map-v1" or record.get("version") != 2:
        raise AssertionError("Refusing unknown preview publish journal")
    if record.get("group", "map") not in ("map", "tower"):
        raise AssertionError("Refusing invalid preview publish group")
    if record.get("phase") not in ("prepared", "maps_promoted", "blend_promoted"):
        raise AssertionError("Refusing invalid preview publish phase")
    paths = _validated_record_paths(record, output_root, blend_output)
    previous = record.get("previous")
    target = record.get("target")
    if not isinstance(previous, dict) or not isinstance(target, dict):
        raise AssertionError("Preview journal is missing component hashes")
    if set(previous) != {"master", "mobile", "blend"} or set(target) != {"master", "mobile", "blend"}:
        raise AssertionError("Preview journal component manifest mismatch")
    for component in ("master", "mobile", "blend"):
        _validate_hash_set(previous[component], f"previous {component}")
        _validate_hash_set(target[component], f"target {component}")
    if target["master"] is None or target["mobile"] is None or target["blend"] is None:
        raise AssertionError("Preview journal target hashes may not be empty")
    source_hashes = record.get("source_hashes")
    if not isinstance(source_hashes, dict) or not all(
        isinstance(key, str) and isinstance(value, str)
        for key, value in source_hashes.items()
    ):
        raise AssertionError("Preview journal source hashes are invalid")
    return paths


def _fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _write_journal_atomic(record: dict[str, object], output_root: Path = OUTPUT) -> None:
    blend_output = BLEND_OUTPUT if output_root == OUTPUT else output_root.parents[1] / "blender/td-redesign-preview-v1.blend"
    _validate_publish_record(record, output_root, blend_output)
    output_root.mkdir(parents=True, exist_ok=True)
    run_id = _validate_run_id(record["run_id"])
    group = str(record.get("group", "map"))
    journal = _journal_path(output_root, group)
    temporary = output_root / f".{group}-publish-journal.{run_id}.tmp"
    _assert_exact_path(temporary, output_root / temporary.name, output_root, "journal temp")
    try:
        with temporary.open("x", encoding="utf-8") as handle:
            json.dump(record, handle, sort_keys=True, separators=(",", ":"))
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, journal)
        _fsync_directory(output_root)
    finally:
        if temporary.exists():
            _unlink_exact(temporary, output_root / temporary.name, output_root, "journal temp")


def _backup_component_path(
    paths: dict[str, Path],
    component: str,
    group: str = "map",
) -> Path:
    name = "preview.blend" if component == "blend" else f"{component}-{group}"
    return paths["backup_root"] / name


def _final_component_path(
    output_root: Path,
    blend_output: Path,
    component: str,
    group: str = "map",
) -> Path:
    return blend_output if component == "blend" else output_root / component / _group_directory(group)


def _remove_final_group(output_root: Path, variant: str, group: str = "map") -> None:
    group_directory = _group_directory(group)
    expected = output_root / variant / group_directory
    _remove_tree_exact(expected, expected, output_root / variant, f"final {variant} {group_directory}")


def _promote_maps(
    record: dict[str, object],
    output_root: Path = OUTPUT,
    blend_output: Path = BLEND_OUTPUT,
) -> None:
    paths = _validate_publish_record(record, output_root, blend_output)
    group = str(record.get("group", "map"))
    group_directory = _group_directory(group)
    for variant in ("master", "mobile"):
        final = output_root / variant / group_directory
        staged = paths["staging_root"] / variant / group_directory
        backup = _backup_component_path(paths, variant, group)
        if not staged.is_dir() or staged.is_symlink() or backup.exists():
            raise AssertionError(f"Invalid {variant} publish paths")
        if final.exists():
            _assert_exact_path(final, output_root / variant / group_directory, output_root / variant, f"final {variant} {group_directory}")
            os.replace(final, backup)
        final.parent.mkdir(parents=True, exist_ok=True)
        os.replace(staged, final)


def _promote_blend(
    record: dict[str, object],
    output_root: Path = OUTPUT,
    blend_output: Path = BLEND_OUTPUT,
) -> None:
    paths = _validate_publish_record(record, output_root, blend_output)
    group = str(record.get("group", "map"))
    candidate = paths["candidate"]
    backup = _backup_component_path(paths, "blend", group)
    if not candidate.is_file() or candidate.is_symlink() or backup.exists():
        raise AssertionError("Invalid blend publish paths")
    blend_output.parent.mkdir(parents=True, exist_ok=True)
    if blend_output.exists():
        _assert_exact_path(blend_output, blend_output, blend_output.parent, "final preview blend")
        os.replace(blend_output, backup)
    os.replace(candidate, blend_output)


def _component_matches(path: Path, expected: object) -> bool:
    return _current_component_hash(path) == expected


def _published_outputs_match(
    record: dict[str, object],
    output_root: Path,
    blend_output: Path,
    current_source_hashes: object,
) -> bool:
    target = record["target"]
    group = str(record.get("group", "map"))
    return (
        all(
            _component_matches(_final_component_path(output_root, blend_output, component, group), target[component])
            for component in ("master", "mobile", "blend")
        )
        and current_source_hashes() == record["source_hashes"]  # type: ignore[operator]
    )


def _rollback_publish(
    record: dict[str, object],
    output_root: Path,
    blend_output: Path,
) -> None:
    paths = _validate_publish_record(record, output_root, blend_output)
    previous = record["previous"]
    group = str(record.get("group", "map"))
    for component in ("master", "mobile", "blend"):
        final = _final_component_path(output_root, blend_output, component, group)
        backup = _backup_component_path(paths, component, group)
        expected = previous[component]
        if expected is not None and not backup.exists() and not _component_matches(final, expected):
            raise AssertionError(f"Cannot safely restore previous {component} output")
    for component in ("master", "mobile", "blend"):
        final = _final_component_path(output_root, blend_output, component, group)
        backup = _backup_component_path(paths, component, group)
        expected = previous[component]
        if backup.exists():
            if component == "blend":
                _unlink_exact(final, blend_output, blend_output.parent, "final preview blend")
            else:
                _remove_final_group(output_root, component, group)
                final.parent.mkdir(parents=True, exist_ok=True)
            os.replace(backup, final)
        elif expected is None:
            if component == "blend":
                _unlink_exact(final, blend_output, blend_output.parent, "final preview blend")
            else:
                _remove_final_group(output_root, component, group)
        if not _component_matches(final, expected):
            raise AssertionError(f"Previous {component} output was not restored")


def _cleanup_publish(
    record: dict[str, object],
    output_root: Path,
    blend_output: Path,
) -> None:
    paths = _validate_publish_record(record, output_root, blend_output)
    group = str(record.get("group", "map"))
    _remove_tree_exact(
        paths["staging_root"],
        output_root / f".staging-{group}-{record['run_id']}",
        output_root,
        "run staging",
    )
    _remove_tree_exact(
        paths["backup_root"],
        output_root / f".backup-{group}-{record['run_id']}",
        output_root,
        "run backup",
    )
    _unlink_exact(paths["candidate"], paths["candidate"], blend_output.parent, "candidate blend")
    journal = _journal_path(output_root, group)
    _unlink_exact(journal, output_root / f".{group}-publish-journal.json", output_root, "publish journal")


def _recover_stale_publish_at(
    output_root: Path,
    blend_output: Path,
    current_source_hashes: object,
    group: str = "map",
) -> None:
    journal = _journal_path(output_root, group)
    if not journal.exists():
        return
    try:
        parsed = json.loads(journal.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise AssertionError("Refusing malformed preview publish journal") from error
    if not isinstance(parsed, dict):
        raise AssertionError("Refusing non-object preview publish journal")
    record: dict[str, object] = parsed
    if record.get("group", "map") != group:
        raise AssertionError("Preview publish journal group/path mismatch")
    _validate_publish_record(record, output_root, blend_output)
    if record["phase"] == "blend_promoted" and _published_outputs_match(
        record,
        output_root,
        blend_output,
        current_source_hashes,
    ):
        _cleanup_publish(record, output_root, blend_output)
        return
    _rollback_publish(record, output_root, blend_output)
    _cleanup_publish(record, output_root, blend_output)


def _recover_stale_publish() -> None:
    for group in ("map", "tower"):
        _recover_stale_publish_at(OUTPUT, BLEND_OUTPUT, _source_hashes, group)


def _publish(
    staging_root: Path,
    candidate: Path,
    run_id: str,
    source_hashes_before: dict[str, str],
    group: str = "map",
) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    record = _create_publish_record(
        staging_root,
        candidate,
        run_id,
        OUTPUT,
        BLEND_OUTPUT,
        source_hashes_before,
        group,
    )
    _write_journal_atomic(record, OUTPUT)
    paths = _validated_record_paths(record, OUTPUT, BLEND_OUTPUT)
    try:
        paths["backup_root"].mkdir(parents=True, exist_ok=False)
        _promote_maps(record, OUTPUT, BLEND_OUTPUT)
        _validate_render_tree(OUTPUT, group)
        record["phase"] = "maps_promoted"
        _write_journal_atomic(record, OUTPUT)
        _promote_blend(record, OUTPUT, BLEND_OUTPUT)
        record["phase"] = "blend_promoted"
        _write_journal_atomic(record, OUTPUT)
        if not _published_outputs_match(record, OUTPUT, BLEND_OUTPUT, _source_hashes):
            raise AssertionError("Published outputs or protected source hashes changed")
    except BaseException:
        _rollback_publish(record, OUTPUT, BLEND_OUTPUT)
        _cleanup_publish(record, OUTPUT, BLEND_OUTPUT)
        raise
    _cleanup_publish(record, OUTPUT, BLEND_OUTPUT)


def render_group(group: str) -> None:
    global _STAGING_ROOT, _EXPECTED_PRESERVED_STATE
    if group not in ("map", "tower"):
        raise ValueError(f"Unsupported preview group: {group}")
    if _PREFLIGHT_SNAPSHOT is None:
        raise AssertionError("render_group requires the main child preflight snapshot")
    if _LIFECYCLE_EVENTS != [
        "preflight_ok",
        "self_tests_start",
        "self_tests_ok",
        "post_self_test_ok",
    ]:
        raise AssertionError("render_group lifecycle order is invalid")
    _assert_preflight_snapshot(
        _PREFLIGHT_SNAPSHOT,
        "render_start",
        require_initial_path=True,
    )
    if bpy.data.is_dirty:
        raise AssertionError(f"Refusing to mutate dirty child scene: {bpy.data.filepath}")
    source_hashes_before = _snapshot_source_hashes(_PREFLIGHT_SNAPSHOT)
    _recover_stale_publish()
    _assert_preflight_snapshot(
        _PREFLIGHT_SNAPSHOT,
        "stale_publish_recovery",
        require_initial_path=True,
    )
    if BLEND_OUTPUT.exists():
        if BLEND_OUTPUT.name in SOURCE_BLEND_NAMES:
            raise AssertionError("Target blend overlaps protected source allow-list")
        bpy.ops.wm.open_mainfile(filepath=str(BLEND_OUTPUT), load_ui=False)
        if bpy.data.is_dirty:
            raise AssertionError("Target preview blend opened dirty")
    scene = _preview_scene()
    active_group_name = GROUP_NAME if group == "map" else TOWER_GROUP_NAME
    _EXPECTED_PRESERVED_STATE = _snapshot_preserved_groups(active_group_name)
    ensure_preview_rig(scene)
    run_id = _RUN_ID
    staging_root = OUTPUT / f".staging-{group}-{run_id}"
    candidate = BLEND_OUTPUT.parent / f".{BLEND_OUTPUT.stem}.{run_id}.candidate.blend"
    if staging_root.exists() or candidate.exists():
        raise AssertionError(f"Run paths already exist for {run_id}")
    staging_root.mkdir(parents=True)
    _STAGING_ROOT = staging_root
    try:
        build_result = render_map_group(scene) if group == "map" else render_tower_group(scene)
        render_validation = _validate_render_tree(staging_root, group)
        if _source_hashes() != source_hashes_before:
            raise AssertionError("Protected source blend hash changed during render")
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(candidate), check_existing=False)
        persistence = _validate_candidate(candidate, _EXPECTED_PRESERVED_STATE, group)
        if _source_hashes() != source_hashes_before:
            raise AssertionError("Protected source blend hash changed during candidate validation")
        _publish(staging_root, candidate, run_id, source_hashes_before, group)
        _assert_preflight_snapshot(
            _PREFLIGHT_SNAPSHOT,
            "render_publish_complete",
            require_initial_path=False,
        )
        _LIFECYCLE_EVENTS.append("render_publish_ok")
        print("TD_PREVIEW_RENDER_VALIDATION " + json.dumps(render_validation, sort_keys=True))
        print("TD_PREVIEW_PERSISTENCE " + json.dumps(persistence, sort_keys=True))
        if build_result is not None:
            print("TD_PREVIEW_GROUP_METRICS " + json.dumps(build_result, sort_keys=True))
        print("TD_PREVIEW_SOURCE_HASHES " + json.dumps(source_hashes_before, sort_keys=True))
    except BaseException:
        if candidate.exists():
            _unlink_exact(candidate, candidate, candidate.parent, "candidate blend")
        _remove_tree_exact(
            staging_root,
            OUTPUT / f".staging-{group}-{run_id}",
            OUTPUT,
            "run staging",
        )
        raise
    finally:
        _STAGING_ROOT = None


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--group", choices=("map", "tower"), required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args(argv)
    try:
        _validate_run_id(args.run_id)
    except AssertionError:
        parser.error("--run-id must be 8-64 alphanumeric characters")
    return args


_RUN_ID = ""


def _expect_assertion(label: str, action: object) -> None:
    try:
        action()  # type: ignore[operator]
    except AssertionError:
        return
    raise AssertionError(f"Self-test did not reject {label}")


def _test_publish_path_security() -> None:
    run_id = "ReviewPath123"
    paths = _derive_publish_paths(run_id, OUTPUT, BLEND_OUTPUT)
    record = {
        "run_id": run_id,
        "staging_root": str(paths["staging_root"]),
        "backup_root": str(paths["backup_root"]),
        "candidate": str(paths["candidate"]),
    }
    _validated_record_paths(record, OUTPUT, BLEND_OUTPUT)
    tampered = dict(record, staging_root="/private/tmp/not-the-preview-staging")
    _expect_assertion(
        "tampered journal staging path",
        lambda: _validated_record_paths(tampered, OUTPUT, BLEND_OUTPUT),
    )
    _expect_assertion(
        "partial journal",
        lambda: _validated_record_paths({"run_id": run_id}, OUTPUT, BLEND_OUTPUT),
    )
    with tempfile.TemporaryDirectory(prefix="td-preview-security-") as temporary:
        sandbox = Path(temporary)
        output = sandbox / "assets/renders/redesign-preview-v1"
        blend = sandbox / "assets/blender/td-redesign-preview-v1.blend"
        paths = _derive_publish_paths(run_id, output, blend)
        for variant in ("master", "mobile"):
            _write_marker_tree(paths["staging_root"] / variant / "map", "new")
        blend.parent.mkdir(parents=True, exist_ok=True)
        paths["candidate"].write_bytes(b"new-blend")
        safe_record = _create_publish_record(
            paths["staging_root"],
            paths["candidate"],
            run_id,
            output,
            blend,
            {"source": "stable"},
        )
        outside = sandbox / "must-survive"
        _write_marker_tree(outside, "protected")
        unsafe_record = dict(safe_record, staging_root=str(outside))
        output.mkdir(parents=True, exist_ok=True)
        _journal_path(output).write_text(json.dumps(unsafe_record), encoding="utf-8")
        _expect_assertion(
            "tampered recovery journal",
            lambda: _recover_stale_publish_at(
                output,
                blend,
                current_source_hashes=lambda: {"source": "stable"},
            ),
        )
        _assert_marker(outside, "protected")
        if not _journal_path(output).exists():
            raise AssertionError("Rejected journal was unexpectedly removed")
        _journal_path(output).write_text('{"run_id":', encoding="utf-8")
        _expect_assertion(
            "malformed recovery journal",
            lambda: _recover_stale_publish_at(
                output,
                blend,
                current_source_hashes=lambda: {"source": "stable"},
            ),
        )
        _assert_marker(outside, "protected")


def _write_marker_tree(path: Path, marker: str) -> None:
    path.mkdir(parents=True, exist_ok=False)
    (path / "marker.txt").write_text(marker, encoding="utf-8")


def _assert_marker(path: Path, marker: str) -> None:
    actual = (path / "marker.txt").read_text(encoding="utf-8")
    if actual != marker:
        raise AssertionError(f"Expected marker {marker!r}, got {actual!r} at {path}")


def _test_publish_recovery_phases() -> None:
    phases = ("prepared", "maps_promoted", "blend_promoted")
    for phase in phases:
        with tempfile.TemporaryDirectory(prefix="td-preview-review-") as temporary:
            sandbox = Path(temporary)
            output = sandbox / "assets/renders/redesign-preview-v1"
            blend = sandbox / "assets/blender/td-redesign-preview-v1.blend"
            run_id = "Recovery123"
            paths = _derive_publish_paths(run_id, output, blend)
            for variant in ("master", "mobile"):
                _write_marker_tree(output / variant / "map", "old")
                _write_marker_tree(paths["staging_root"] / variant / "map", "new")
            blend.parent.mkdir(parents=True, exist_ok=True)
            blend.write_bytes(b"old-blend")
            paths["candidate"].write_bytes(b"new-blend")
            record = _create_publish_record(
                paths["staging_root"],
                paths["candidate"],
                run_id,
                output,
                blend,
                {"source": "stable"},
            )
            _write_journal_atomic(record, output)
            paths["backup_root"].mkdir(parents=True, exist_ok=False)
            if phase in ("maps_promoted", "blend_promoted"):
                _promote_maps(record, output, blend)
                record["phase"] = "maps_promoted"
                _write_journal_atomic(record, output)
            else:
                old_master = output / "master/map"
                os.replace(old_master, paths["backup_root"] / "master-map")
                os.replace(paths["staging_root"] / "master/map", old_master)
            if phase == "blend_promoted":
                _promote_blend(record, output, blend)
                record["phase"] = "blend_promoted"
                _write_journal_atomic(record, output)
            _recover_stale_publish_at(
                output,
                blend,
                current_source_hashes=lambda: {"source": "stable"},
            )
            expected = "new" if phase == "blend_promoted" else "old"
            expected_blend = b"new-blend" if phase == "blend_promoted" else b"old-blend"
            for variant in ("master", "mobile"):
                _assert_marker(output / variant / "map", expected)
            if blend.read_bytes() != expected_blend:
                raise AssertionError(f"{phase} recovery produced a mixed blend")
    with tempfile.TemporaryDirectory(prefix="td-preview-fresh-") as temporary:
        sandbox = Path(temporary)
        output = sandbox / "assets/renders/redesign-preview-v1"
        blend = sandbox / "assets/blender/td-redesign-preview-v1.blend"
        run_id = "FreshPath123"
        paths = _derive_publish_paths(run_id, output, blend)
        for variant in ("master", "mobile"):
            _write_marker_tree(paths["staging_root"] / variant / "map", "new")
        blend.parent.mkdir(parents=True, exist_ok=True)
        paths["candidate"].write_bytes(b"new-blend")
        record = _create_publish_record(
            paths["staging_root"],
            paths["candidate"],
            run_id,
            output,
            blend,
            {"source": "stable"},
        )
        _write_journal_atomic(record, output)
        paths["backup_root"].mkdir(parents=True, exist_ok=False)
        _promote_maps(record, output, blend)
        record["phase"] = "maps_promoted"
        _write_journal_atomic(record, output)
        _promote_blend(record, output, blend)
        record["phase"] = "blend_promoted"
        _write_journal_atomic(record, output)
        _recover_stale_publish_at(
            output,
            blend,
            current_source_hashes=lambda: {"source": "stable"},
        )
        for variant in ("master", "mobile"):
            _assert_marker(output / variant / "map", "new")
        if blend.read_bytes() != b"new-blend":
            raise AssertionError("Fresh publish recovery did not roll forward")


def _test_source_hash_failure_rolls_back_everything() -> None:
    with tempfile.TemporaryDirectory(prefix="td-preview-review-") as temporary:
        sandbox = Path(temporary)
        output = sandbox / "assets/renders/redesign-preview-v1"
        blend = sandbox / "assets/blender/td-redesign-preview-v1.blend"
        run_id = "SourceFail123"
        paths = _derive_publish_paths(run_id, output, blend)
        for variant in ("master", "mobile"):
            _write_marker_tree(output / variant / "map", "old")
            _write_marker_tree(paths["staging_root"] / variant / "map", "new")
        blend.parent.mkdir(parents=True, exist_ok=True)
        blend.write_bytes(b"old-blend")
        paths["candidate"].write_bytes(b"new-blend")
        record = _create_publish_record(
            paths["staging_root"],
            paths["candidate"],
            run_id,
            output,
            blend,
            {"source": "before"},
        )
        _write_journal_atomic(record, output)
        paths["backup_root"].mkdir(parents=True, exist_ok=False)
        _promote_maps(record, output, blend)
        record["phase"] = "maps_promoted"
        _write_journal_atomic(record, output)
        _promote_blend(record, output, blend)
        record["phase"] = "blend_promoted"
        _write_journal_atomic(record, output)
        _recover_stale_publish_at(
            output,
            blend,
            current_source_hashes=lambda: {"source": "changed"},
        )
        for variant in ("master", "mobile"):
            _assert_marker(output / variant / "map", "old")
        if blend.read_bytes() != b"old-blend":
            raise AssertionError("Source hash failure did not roll back the blend")


def _test_foreign_material_and_group_invariants() -> None:
    scene = _preview_scene()
    foreign_group = bpy.data.collections.new("TDPreview_Group_review_foreign")
    scene.collection.children.link(foreign_group)
    mesh = bpy.data.meshes.new("ReviewForeignMesh")
    obj = bpy.data.objects.new("ReviewForeignObject", mesh)
    foreign_group.objects.link(obj)
    foreign = bpy.data.materials.new("M_Grass")
    foreign.diffuse_color = (0.91, 0.12, 0.23, 1.0)
    mesh.materials.append(foreign)
    before = _snapshot_preserved_groups()
    created = make_material("M_Grass", COLORS["grass"])
    after = _snapshot_preserved_groups()
    if created is foreign:
        raise AssertionError("Foreign material was reused or mutated")
    if before != after:
        raise AssertionError("Foreign preview group changed while creating map material")
    bpy.data.collections.remove(foreign_group)
    bpy.data.objects.remove(obj)
    bpy.data.meshes.remove(mesh)
    bpy.data.materials.remove(foreign)
    if created.users == 0:
        bpy.data.materials.remove(created)


def _test_rig_normalization_and_owned_orphans() -> None:
    scene = _preview_scene()
    rig = ensure_preview_rig(scene)
    camera = rig.objects["TD_Preview_Camera"]
    camera.location = (1.0, 2.0, 3.0)
    camera.rotation_euler = (0.1, 0.2, 0.3)
    camera.data.type = "PERSP"
    for obj in rig.objects:
        if obj.type == "LIGHT":
            obj.location = (9.0, 9.0, 9.0)
            obj.data.energy = 1.0
            obj.data.shape = "SQUARE"
            obj.data.size = 0.5
    ensure_preview_rig(scene)
    _assert_rig_exact(scene, rig)
    for collection_name, factory in (
        ("meshes", lambda: bpy.data.meshes.new("ReviewOwnedOrphan")),
        ("materials", lambda: bpy.data.materials.new("ReviewOwnedOrphan")),
        ("cameras", lambda: bpy.data.cameras.new("ReviewOwnedOrphan")),
        ("lights", lambda: bpy.data.lights.new("ReviewOwnedOrphan", "AREA")),
    ):
        block = factory()
        _tag(block, "map" if collection_name in ("meshes", "materials") else "common")
        _expect_assertion(
            f"owned orphan {collection_name}",
            _assert_owned_data_integrity,
        )
        getattr(bpy.data, collection_name).remove(block)
    _assert_owned_data_integrity()


def _test_tower_predicates_and_purity() -> None:
    if not huchu_predicate("Huchu_Eye3D_L") or huchu_predicate("Huchu_AquaBall"):
        raise AssertionError("Huchu predicate does not isolate the character")
    if not deokbae_predicate("Deokbae_Eye3D_R") or deokbae_predicate("Deokbae_FireBall_1"):
        raise AssertionError("Deokbae predicate does not isolate the character")
    if not arrow_predicate("Arrow_Bow_Limb") or arrow_predicate("Arrow_Rim"):
        raise AssertionError("Arrow predicate does not exclude source rig objects")
    if not slow_predicate("SlowTower_Body") or slow_predicate("SlowTower_Aura"):
        raise AssertionError("Slow predicate does not exclude embedded aura VFX")

    mesh = bpy.data.meshes.new("ReviewTowerMesh")
    obj = bpy.data.objects.new("ReviewTowerObject", mesh)
    material = bpy.data.materials.new("ReviewWaterMaterial")
    mesh.materials.append(material)
    _expect_assertion(
        "forbidden tower dependency token",
        lambda: _assert_clean_tower_dependencies([obj], []),
    )
    bpy.data.objects.remove(obj)
    bpy.data.meshes.remove(mesh)
    bpy.data.materials.remove(material)


def _test_tower_dependency_cleanup_order() -> None:
    curve = bpy.data.curves.new("ReviewTowerCleanupCurve", "CURVE")
    material = bpy.data.materials.new("ReviewTowerCleanupMaterial")
    curve_name = curve.name
    material_name = material.name
    _tag(curve, "tower")
    _tag(material, "tower")
    curve.materials.append(material)
    try:
        _remove_unused_owned_tower_data()
        if bpy.data.curves.get(curve_name) is not None:
            raise AssertionError("Unused owned tower curve was not removed")
        if bpy.data.materials.get(material_name) is not None:
            raise AssertionError("Material orphaned by tower curve cleanup was not removed")
    finally:
        remaining_curve = bpy.data.curves.get(curve_name)
        if remaining_curve is not None:
            bpy.data.curves.remove(remaining_curve)
        remaining_material = bpy.data.materials.get(material_name)
        if remaining_material is not None:
            bpy.data.materials.remove(remaining_material)


def _test_current_only_render_visibility() -> None:
    scene = bpy.context.scene
    map_group = bpy.data.collections.new("TDPreview_Group_review_map_visibility")
    map_asset = bpy.data.collections.new("ReviewMapAssetVisibility")
    tower_group = bpy.data.collections.new("TDPreview_Group_review_tower_visibility")
    current = bpy.data.collections.new("ReviewCurrentTowerVisibility")
    current_child = bpy.data.collections.new("ReviewCurrentTowerChildVisibility")
    other = bpy.data.collections.new("ReviewOtherTowerVisibility")
    scene.collection.children.link(map_group)
    map_group.children.link(map_asset)
    scene.collection.children.link(tower_group)
    tower_group.children.link(current)
    current.children.link(current_child)
    tower_group.children.link(other)
    collections = (map_group, map_asset, tower_group, current, current_child, other)
    initial = {collection.name: bool(collection.hide_render) for collection in collections}
    try:
        visible = _isolate_preview_render_collection(tower_group, current)
        expected = sorted((tower_group.name, current.name, current_child.name))
        if visible != expected:
            raise AssertionError(f"Unexpected current-only render collections: {visible}")
        _assert_current_only_render_visibility(tower_group, current)
        map_group.hide_render = False
        _expect_assertion(
            "render-visible non-current preview group",
            lambda: _assert_current_only_render_visibility(tower_group, current),
        )
    finally:
        _restore_preview_render_visibility(initial)
        restored = {collection.name: bool(collection.hide_render) for collection in collections}
        if restored != initial:
            raise AssertionError("Preview collection visibility was not restored")
        bpy.data.collections.remove(tower_group)
        bpy.data.collections.remove(current)
        bpy.data.collections.remove(current_child)
        bpy.data.collections.remove(other)
        bpy.data.collections.remove(map_group)
        bpy.data.collections.remove(map_asset)


def _run_review_self_tests() -> None:
    print("TD_PREVIEW_SELF_TEST_START", flush=True)
    if _LIFECYCLE_EVENTS != ["preflight_ok"]:
        raise AssertionError(
            "TD_PREVIEW_SELF_TEST_BEFORE_PREFLIGHT "
            + json.dumps(_LIFECYCLE_EVENTS)
        )
    _LIFECYCLE_EVENTS.append("self_tests_start")
    tests = (
        ("publish_path_security", _test_publish_path_security),
        ("publish_phase_recovery", _test_publish_recovery_phases),
        ("source_hash_failure_rollback", _test_source_hash_failure_rolls_back_everything),
        ("foreign_material_group_invariants", _test_foreign_material_and_group_invariants),
        ("rig_normalization_owned_orphans", _test_rig_normalization_and_owned_orphans),
        ("tower_predicates_purity", _test_tower_predicates_and_purity),
        ("tower_dependency_cleanup_order", _test_tower_dependency_cleanup_order),
        ("current_only_render_visibility", _test_current_only_render_visibility),
    )
    failures: list[str] = []
    for name, test in tests:
        try:
            test()
        except BaseException as error:
            failures.append(f"{name}: {type(error).__name__}: {error}")
    if failures:
        raise AssertionError("TD_PREVIEW_SELF_TEST_FAIL " + " | ".join(failures))
    _LIFECYCLE_EVENTS.append("self_tests_ok")
    print("TD_PREVIEW_SELF_TEST_OK " + ",".join(name for name, _ in tests), flush=True)


def main(argv: list[str]) -> int:
    global _PREFLIGHT_SNAPSHOT, _RUN_ID
    args = _parse_args(argv)
    _RUN_ID = args.run_id
    _PREFLIGHT_SNAPSHOT = _child_preflight()
    _run_review_self_tests()
    _assert_preflight_snapshot(
        _PREFLIGHT_SNAPSHOT,
        "after_self_tests",
        require_initial_path=True,
    )
    _LIFECYCLE_EVENTS.append("post_self_test_ok")
    print("TD_PREVIEW_POST_SELF_TEST_OK", flush=True)
    render_group(args.group)
    expected_events = [
        "preflight_ok",
        "self_tests_start",
        "self_tests_ok",
        "post_self_test_ok",
        "render_publish_ok",
    ]
    if _LIFECYCLE_EVENTS != expected_events:
        raise AssertionError("Child lifecycle order changed before completion")
    print("TD_PREVIEW_LIFECYCLE_OK " + ",".join(_LIFECYCLE_EVENTS), flush=True)
    print(f"TD_PREVIEW_OK {_RUN_ID}", flush=True)
    return 0


if __name__ == "__main__":
    separator = sys.argv.index("--") if "--" in sys.argv else 0
    raise SystemExit(main(sys.argv[separator + 1 :]))
