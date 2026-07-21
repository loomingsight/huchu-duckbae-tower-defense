from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import math
import os
import re
import shutil
import stat
import sys
import tempfile
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


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
MOTION_GROUP_NAME = "TDPreview_Group_motion"
RIG_COLLECTION_NAME = "TDPreview_Rig_v1"
MATERIAL_PREFIX = "TDPreview_map_v1__"
TOWER_MATERIAL_PREFIX = "TDPreview_tower_v1__"
MOTION_MATERIAL_PREFIX = "TDPreview_motion_v1__"
TOWER_GROUND_Z = 0.20
MOTION_ROOT_YAW = math.radians(225.0)

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
    return name in ARROW_COMPONENT_PARENTS


def slow_predicate(name: str) -> bool:
    return name in SLOW_COMPONENT_PARENTS


SLOW_COMPONENT_PARENTS = {
    "SlowTower_Root": None,
    "SlowTower_Body": "SlowTower_Root",
    "Slow_Base_Lower": "SlowTower_Body",
    "Slow_Base_Mid": "SlowTower_Body",
    "Slow_Base_Upper": "SlowTower_Body",
    "Slow_Frame_Ring_Bottom": "SlowTower_Body",
    "Slow_Frame_Ring_Top": "SlowTower_Body",
    "Slow_Frame_Support_1": "SlowTower_Body",
    "Slow_Frame_Support_2": "SlowTower_Body",
    "Slow_Frame_Support_3": "SlowTower_Body",
    "Slow_Hourglass_Pink_Bottom": "SlowTower_Body",
    "Slow_Hourglass_Pink_Top": "SlowTower_Body",
    "Slow_Snowflake_Front_Bar_1": "SlowTower_Body",
    "Slow_Snowflake_Front_Bar_2": "SlowTower_Body",
    "Slow_Snowflake_Front_Bar_3": "SlowTower_Body",
    "Slow_Waist_Mint": "SlowTower_Body",
}

ARROW_COMPONENT_PARENTS = {
    "ArrowTower_Root": None,
    "Arrow_Base_Static": "ArrowTower_Root",
    "Arrow_Base_Mint_Rim": "Arrow_Base_Static",
    "Arrow_Base_Wood_Lower": "Arrow_Base_Static",
    "Arrow_Base_Wood_Upper": "Arrow_Base_Static",
    "Arrow_Pivot_Cap": "Arrow_Base_Static",
    "Arrow_Pivot_Collar": "Arrow_Base_Static",
    "Arrow_Pivot_Column": "Arrow_Base_Static",
    "Arrow_Turret_Yaw": "ArrowTower_Root",
    "Arrow_Bow_Band_L": "Arrow_Turret_Yaw",
    "Arrow_Bow_Band_R": "Arrow_Turret_Yaw",
    "Arrow_Bow_End_L": "Arrow_Turret_Yaw",
    "Arrow_Bow_End_R": "Arrow_Turret_Yaw",
    "Arrow_Bow_Limb": "Arrow_Turret_Yaw",
    "Arrow_Bow_String": "Arrow_Turret_Yaw",
    "Arrow_Fletching_H": "Arrow_Turret_Yaw",
    "Arrow_Fletching_V": "Arrow_Turret_Yaw",
    "Arrow_Loaded_Head": "Arrow_Turret_Yaw",
    "Arrow_Loaded_Shaft": "Arrow_Turret_Yaw",
    "Arrow_Rail": "Arrow_Turret_Yaw",
    "Arrow_Stock": "Arrow_Turret_Yaw",
    "Arrow_Turret_Collar": "Arrow_Turret_Yaw",
}

TOWER_COMPONENT_PARENTS = {
    "towers/slow-se.png": SLOW_COMPONENT_PARENTS,
    "towers/arrow-se.png": ARROW_COMPONENT_PARENTS,
}

CHARACTER_HEAD_COMPONENTS = {
    "huchu": ("Huchu_v2", "Huchu_Eye3D_L", "Huchu_Eye3D_R"),
    "deokbae": ("Deokbae_v2", "Deokbae_Eye3D_L", "Deokbae_Eye3D_R"),
}
HEAD_VERTEX_GROUP_NAME = "TDPreview_HeadMetric_v1"


TOWER_ASSETS = {
    "towers/slow-se.png": ("slow-tower-v1.blend", slow_predicate),
    "towers/arrow-se.png": ("arrow-tower-v1.blend", arrow_predicate),
    "towers/deokbae-se.png": ("character-assets-v2.blend", deokbae_predicate),
    "towers/huchu-se.png": ("character-assets-v2.blend", huchu_predicate),
}

MOTION_ASSETS = {
    "motion/orc-walk-se.png": ("orc", 6),
    "motion/fairy-fly-se.png": ("fairy", 8),
}

MOTION_REQUIRED_OBJECTS = {
    "orc": {
        "Enemy_Orc_Root": ("EMPTY", None),
        "Enemy_Orc_Body": ("EMPTY", "Enemy_Orc_Root"),
        "Enemy_Orc_VFX": ("EMPTY", "Enemy_Orc_Root"),
        "Orc_Arm_L": ("MESH", "Enemy_Orc_Body"),
        "Orc_Arm_R": ("MESH", "Enemy_Orc_Body"),
        "Orc_Fist_L": ("MESH", "Enemy_Orc_Body"),
        "Orc_Fist_R": ("MESH", "Enemy_Orc_Body"),
        "Orc_Leg_L": ("MESH", "Enemy_Orc_Body"),
        "Orc_Leg_R": ("MESH", "Enemy_Orc_Body"),
        "Orc_Foot_L": ("MESH", "Enemy_Orc_Body"),
        "Orc_Foot_R": ("MESH", "Enemy_Orc_Body"),
        "Orc_Club_End": ("MESH", "Enemy_Orc_Body"),
        "Orc_Club_Grip": ("MESH", "Enemy_Orc_Body"),
        "Orc_Club_Head": ("MESH", "Enemy_Orc_Body"),
    },
    "fairy": {
        "Enemy_Fairy_Root": ("EMPTY", None),
        "Enemy_Fairy_Body": ("EMPTY", "Enemy_Fairy_Root"),
        "Enemy_Fairy_VFX": ("EMPTY", "Enemy_Fairy_Root"),
        "Fairy_Wing_LL": ("MESH", "Enemy_Fairy_VFX"),
        "Fairy_Wing_LR": ("MESH", "Enemy_Fairy_VFX"),
        "Fairy_Wing_UL": ("MESH", "Enemy_Fairy_VFX"),
        "Fairy_Wing_UR": ("MESH", "Enemy_Fairy_VFX"),
    },
}

ORC_PIVOT_MEMBERS = {
    "shoulder_l": ("Orc_Arm_L", "Orc_Fist_L"),
    "shoulder_r": (
        "Orc_Arm_R",
        "Orc_Fist_R",
        "Orc_Club_End",
        "Orc_Club_Grip",
        "Orc_Club_Head",
    ),
    "hip_l": ("Orc_Leg_L", "Orc_Foot_L"),
    "hip_r": ("Orc_Leg_R", "Orc_Foot_R"),
}

FAIRY_WINGS = (
    "Fairy_Wing_LL",
    "Fairy_Wing_LR",
    "Fairy_Wing_UL",
    "Fairy_Wing_UR",
)


def append_selected_objects(
    blend_path: Path,
    predicate: object,
    collection_name: str,
) -> list[bpy.types.Object]:
    if bpy.data.collections.get(collection_name) is not None:
        raise AssertionError(f"Preview asset collection already exists: {collection_name}")
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
    bpy.context.view_layer.update()
    return loaded


RENDER_GEOMETRY_TYPES = {"MESH", "CURVE"}


def render_geometry_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points: list[Vector] = []
    for obj in objects:
        if obj.type not in RENDER_GEOMETRY_TYPES or obj.hide_render:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        evaluated_mesh = None
        try:
            evaluated_mesh = evaluated.to_mesh(preserve_all_data_layers=False)
            if evaluated_mesh is None or not evaluated_mesh.vertices:
                raise AssertionError(f"Empty evaluated render geometry: {obj.name}")
            object_points = [
                evaluated.matrix_world @ vertex.co
                for vertex in evaluated_mesh.vertices
            ]
            if any(not all(math.isfinite(value) for value in point) for point in object_points):
                raise AssertionError(f"Non-finite evaluated render geometry: {obj.name}")
            points.extend(object_points)
        finally:
            if evaluated_mesh is not None:
                evaluated.to_mesh_clear()
    if not points:
        raise AssertionError("No evaluated render geometry found")
    minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
    return minimum, maximum


def mesh_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    return render_geometry_bounds(objects)


def _assert_required_tower_components(
    relative_path: str,
    objects: list[bpy.types.Object],
) -> None:
    manifest = TOWER_COMPONENT_PARENTS.get(relative_path)
    if manifest is None:
        return
    by_name = {obj.name: obj for obj in objects}
    if set(by_name) != set(manifest):
        raise AssertionError(
            f"{relative_path} component manifest mismatch: "
            f"missing={sorted(set(manifest) - set(by_name))} "
            f"extra={sorted(set(by_name) - set(manifest))}"
        )
    for name, expected_parent in manifest.items():
        obj = by_name[name]
        actual_parent = obj.parent.name if obj.parent is not None else None
        if actual_parent != expected_parent:
            raise AssertionError(
                f"{relative_path} source hierarchy mismatch for {name}: "
                f"expected={expected_parent} actual={actual_parent}"
            )
        if obj.hide_render:
            raise AssertionError(f"{relative_path} required component is hidden: {name}")


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


def _owned_asset_collection_for(
    objects: list[bpy.types.Object],
    group: str,
) -> bpy.types.Collection:
    collections = {
        collection
        for obj in objects
        for collection in obj.users_collection
        if collection.get("td_preview_owner") == OWNER
        and collection.get("td_preview_group") == group
        and isinstance(collection.get("td_preview_asset"), str)
    }
    if len(collections) != 1:
        raise AssertionError(
            f"{group} objects must share exactly one owned asset collection"
        )
    return next(iter(collections))


def _owned_asset_slug(collection: bpy.types.Collection, group: str) -> str:
    relative_path = collection.get("td_preview_asset")
    assets = TOWER_ASSETS if group == "tower" else MOTION_ASSETS if group == "motion" else None
    if not isinstance(relative_path, str) or assets is None or relative_path not in assets:
        raise AssertionError(f"Invalid {group} asset collection identity: {collection.name}")
    return Path(relative_path).stem.replace("-", "_")


def _fit_objects_to_owned_collection(
    objects: list[bpy.types.Object],
    target_width: float,
    target_height: float,
    group: str,
) -> bpy.types.Object:
    if target_width <= 0 or target_height <= 0:
        raise AssertionError(f"{group} fit targets must be positive")
    collection = _owned_asset_collection_for(objects, group)
    slug = _owned_asset_slug(collection, group)
    root = bpy.data.objects.new(f"TDPreview_{group}_{slug}__FitRoot", None)
    _tag(root, group)
    collection.objects.link(root)
    object_set = set(objects)
    roots = [obj for obj in objects if obj.parent not in object_set]
    if not roots:
        raise AssertionError(f"{group} source hierarchy has no top-level root")
    parent_edges = {
        obj: obj.parent
        for obj in objects
        if obj.parent in object_set
    }
    for obj in roots:
        world_transform = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_world = world_transform
    bpy.context.view_layer.update()
    if any(obj.parent is not parent for obj, parent in parent_edges.items()):
        raise AssertionError(f"{group} fit flattened a source parent edge")
    minimum, maximum = mesh_bounds(objects)
    extent = maximum - minimum
    widest = max(extent.x, extent.y)
    if widest <= 0 or extent.z <= 0:
        raise AssertionError(f"{group} source has degenerate bounds")
    scale = min(target_width / widest, target_height / extent.z)
    root.scale = (scale, scale, scale)
    bpy.context.view_layer.update()
    minimum, maximum = mesh_bounds(objects)
    root.location = (
        -(minimum.x + maximum.x) / 2.0,
        -(minimum.y + maximum.y) / 2.0,
        TOWER_GROUND_Z - minimum.z,
    )
    bpy.context.view_layer.update()
    return root


def fit_objects_to_tile(
    objects: list[bpy.types.Object],
    target_width: float = 2.45,
    target_height: float = 2.65,
) -> None:
    _fit_objects_to_owned_collection(
        objects,
        target_width,
        target_height,
        "tower",
    )


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
    blocks: list[object] = []
    queue: list[object] = [*objects, *collections]
    seen: set[tuple[type, int]] = set()
    local_rna_types = tuple(
        candidate
        for name in (
            "Modifier",
            "Constraint",
            "Node",
            "NodeSocket",
            "ParticleSystem",
            "NlaTrack",
            "NlaStrip",
            "FCurve",
            "Driver",
            "DriverVariable",
            "DriverTarget",
        )
        if (candidate := getattr(bpy.types, name, None)) is not None
    )

    def enqueue(value: object | None) -> None:
        if value is not None:
            queue.append(value)

    def enqueue_id_property(value: object) -> None:
        if isinstance(value, bpy.types.ID):
            enqueue(value)
        elif isinstance(value, (list, tuple)):
            for item in value:
                enqueue_id_property(item)
        else:
            keys = getattr(value, "keys", None)
            if callable(keys):
                try:
                    for identifier in keys():
                        enqueue_id_property(value[identifier])
                except (KeyError, TypeError, RuntimeError):
                    pass

    def animation_dependencies(owner: object) -> None:
        animation = getattr(owner, "animation_data", None)
        if animation is None:
            return
        enqueue(getattr(animation, "action", None))
        for track in getattr(animation, "nla_tracks", ()):
            enqueue(track)
            for strip in track.strips:
                enqueue(strip)
                enqueue(getattr(strip, "action", None))
        for fcurve in getattr(animation, "drivers", ()):
            enqueue(fcurve)
            driver = getattr(fcurve, "driver", None)
            enqueue(driver)
            if driver is not None:
                for variable in driver.variables:
                    enqueue(variable)
                    for target in variable.targets:
                        enqueue(target)
                        enqueue(getattr(target, "id", None))

    while queue:
        block = queue.pop()
        pointer = getattr(block, "as_pointer", None)
        identity = pointer() if callable(pointer) else id(block)
        key = (type(block), identity)
        if key in seen:
            continue
        seen.add(key)
        blocks.append(block)
        animation_dependencies(block)

        if isinstance(block, local_rna_types):
            for prop in block.bl_rna.properties:
                if prop.identifier in {"rna_type", "id_data"}:
                    continue
                try:
                    value = getattr(block, prop.identifier)
                except (AttributeError, ReferenceError, RuntimeError, TypeError):
                    continue
                if prop.type == "POINTER":
                    enqueue(value)
                elif prop.type == "COLLECTION":
                    for item in value:
                        enqueue(item)
            keys = getattr(block, "keys", None)
            if callable(keys):
                try:
                    identifiers = tuple(keys())
                except TypeError:
                    identifiers = ()
                for identifier in identifiers:
                    enqueue_id_property(block[identifier])

        if isinstance(block, bpy.types.Collection):
            for child in block.children:
                enqueue(child)
            for obj in block.objects:
                enqueue(obj)
        if isinstance(block, bpy.types.Object):
            enqueue(block.data)
            enqueue(block.parent)
            enqueue(block.instance_collection)
            for slot in block.material_slots:
                enqueue(slot.material)
            for modifier in block.modifiers:
                enqueue(modifier)
            for constraint in block.constraints:
                enqueue(constraint)
            for particle_system in block.particle_systems:
                enqueue(particle_system)
                enqueue(getattr(particle_system, "settings", None))
            if block.pose is not None:
                for bone in block.pose.bones:
                    for constraint in bone.constraints:
                        enqueue(constraint)
        if isinstance(block, bpy.types.Material):
            enqueue(block.node_tree)
        if isinstance(block, bpy.types.NodeTree):
            for node in block.nodes:
                enqueue(node)
                for socket in (*node.inputs, *node.outputs):
                    enqueue(socket)
                    default_value = getattr(socket, "default_value", None)
                    if isinstance(default_value, bpy.types.ID):
                        enqueue(default_value)
        if isinstance(block, bpy.types.Mesh):
            enqueue(block.shape_keys)
            for material in block.materials:
                enqueue(material)
        if isinstance(block, bpy.types.Key):
            for shape_key in block.key_blocks:
                enqueue(shape_key)
        if isinstance(block, bpy.types.ParticleSettings):
            for slot in getattr(block, "texture_slots", ()):
                enqueue(slot)
        if isinstance(block, (bpy.types.Curve, bpy.types.MetaBall)):
            for material in block.materials:
                enqueue(material)

        for attribute in (
            "image",
            "node_tree",
            "node_group",
            "object",
            "target",
            "mirror_object",
            "offset_object",
            "origin",
            "curve_object",
            "pole_target",
            "space_object",
            "camera",
            "texture",
            "material",
            "collection",
            "bevel_object",
            "taper_object",
            "instance_object",
            "instance_collection",
        ):
            try:
                dependency = getattr(block, attribute, None)
            except (AttributeError, ReferenceError):
                dependency = None
            if dependency is not block:
                enqueue(dependency)
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
    geometry = [obj for obj in collection.all_objects if obj.type in RENDER_GEOMETRY_TYPES]
    minimum, maximum = render_geometry_bounds(geometry)
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


def _tower_component(
    collection: bpy.types.Collection,
    source_name: str,
) -> bpy.types.Object:
    return _object_with_source_suffix(collection, source_name)


def _geometry_center(obj: bpy.types.Object) -> Vector:
    minimum, maximum = render_geometry_bounds([obj])
    return (minimum + maximum) / 2.0


def _camera_space_geometry_center(obj: bpy.types.Object) -> Vector:
    camera = bpy.context.scene.camera
    if camera is None:
        raise AssertionError("Preview camera is missing for screen-space geometry assertion")
    return camera.matrix_world.inverted_safe() @ _geometry_center(obj)


def _assert_tower_component_layout(
    relative_path: str,
    collection: bpy.types.Collection,
) -> None:
    if relative_path == "towers/slow-se.png":
        bottom_ring = _tower_component(collection, "Slow_Frame_Ring_Bottom")
        top_ring = _tower_component(collection, "Slow_Frame_Ring_Top")
        bottom_glass = _tower_component(collection, "Slow_Hourglass_Pink_Bottom")
        top_glass = _tower_component(collection, "Slow_Hourglass_Pink_Top")
        if _geometry_center(top_ring).z <= _geometry_center(bottom_ring).z + 0.25:
            raise AssertionError("Slow tower cage rings do not form a vertical silhouette")
        if _geometry_center(top_glass).z <= _geometry_center(bottom_glass).z + 0.15:
            raise AssertionError("Slow tower hourglass top/bottom collapsed")
        for index in range(1, 4):
            support = _tower_component(collection, f"Slow_Frame_Support_{index}")
            minimum, maximum = render_geometry_bounds([support])
            if maximum.z - minimum.z <= 0.35:
                raise AssertionError(f"Slow tower support {index} lost vertical extent")
    elif relative_path == "towers/arrow-se.png":
        string = _tower_component(collection, "Arrow_Bow_String")
        if string.type != "CURVE":
            raise AssertionError("Arrow bow string is not CURVE geometry")
        shaft = _camera_space_geometry_center(
            _tower_component(collection, "Arrow_Loaded_Shaft")
        )
        head = _camera_space_geometry_center(
            _tower_component(collection, "Arrow_Loaded_Head")
        )
        fletching = _camera_space_geometry_center(
            _tower_component(collection, "Arrow_Fletching_H")
        )
        if not (
            head.x > shaft.x > fletching.x
            and head.y < shaft.y < fletching.y
        ):
            raise AssertionError(
                "Arrow must point screen southeast with aligned "
                "head/shaft/fletching ordering"
            )


def _object_with_source_suffix(
    collection: bpy.types.Collection,
    source_name: str,
) -> bpy.types.Object:
    suffix = "__" + source_name
    matches = [obj for obj in collection.all_objects if obj.name.endswith(suffix)]
    if len(matches) != 1:
        raise AssertionError(
            f"Expected one explicit character component {source_name}, found {len(matches)}"
        )
    return matches[0]


def _explicit_head_width(
    body: bpy.types.Object,
) -> float:
    if body.type != "MESH":
        raise AssertionError("Explicit head metric requires a body mesh")
    group = body.vertex_groups.get(HEAD_VERTEX_GROUP_NAME)
    if group is None:
        raise AssertionError(f"Missing explicit head vertex group on {body.name}")
    lateral = body.matrix_world.to_3x3().col[0].normalized()
    head_points: list[Vector] = []
    for vertex in body.data.vertices:
        if any(membership.group == group.index for membership in vertex.groups):
            head_points.append(body.matrix_world @ vertex.co)
    if len(head_points) < 2:
        raise AssertionError(f"Explicit eye-anchored head geometry is empty for {body.name}")
    lateral_positions = [point.dot(lateral) for point in head_points]
    return max(lateral_positions) - min(lateral_positions)


def _ensure_character_head_vertex_group(collection: bpy.types.Collection) -> None:
    relative_path = collection.get("td_preview_asset")
    if relative_path not in {"towers/huchu-se.png", "towers/deokbae-se.png"}:
        return
    character = "huchu" if relative_path == "towers/huchu-se.png" else "deokbae"
    body_name, left_eye_name, right_eye_name = CHARACTER_HEAD_COMPONENTS[character]
    body = _object_with_source_suffix(collection, body_name)
    eyes = [
        _object_with_source_suffix(collection, left_eye_name),
        _object_with_source_suffix(collection, right_eye_name),
    ]
    if body.vertex_groups.get(HEAD_VERTEX_GROUP_NAME) is not None:
        raise AssertionError(f"Imported body already contains reserved group {HEAD_VERTEX_GROUP_NAME}")
    lateral = body.matrix_world.to_3x3().col[0].normalized()
    back = body.matrix_world.to_3x3().col[1].normalized()
    up = body.matrix_world.to_3x3().col[2].normalized()
    eye_centers = []
    for eye in eyes:
        points = [eye.matrix_world @ Vector(corner) for corner in eye.bound_box]
        minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
        maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
        eye_centers.append((minimum + maximum) / 2.0)
    eye_center = (eye_centers[0] + eye_centers[1]) / 2.0
    eye_span = abs((eye_centers[1] - eye_centers[0]).dot(lateral))
    if eye_span <= 1e-4:
        raise AssertionError("Explicit eye anchors have degenerate lateral span")
    indices = []
    for vertex in body.data.vertices:
        relative = (body.matrix_world @ vertex.co) - eye_center
        depth = relative.dot(back)
        vertical = relative.dot(up)
        if -eye_span <= depth <= 1.5 * eye_span and abs(vertical) <= 0.25 * eye_span:
            indices.append(vertex.index)
    if len(indices) < 2:
        raise AssertionError(f"Explicit head vertex group is empty for {body.name}")
    group = body.vertex_groups.new(name=HEAD_VERTEX_GROUP_NAME)
    group.add(indices, 1.0, "REPLACE")


def _character_metrics(collection: bpy.types.Collection) -> dict[str, float]:
    meshes = [obj for obj in collection.all_objects if obj.type == "MESH"]
    minimum, maximum = render_geometry_bounds(meshes)
    height = maximum.z - minimum.z
    character = "huchu" if collection.get("td_preview_asset") == "towers/huchu-se.png" else "deokbae"
    body_name, left_eye_name, right_eye_name = CHARACTER_HEAD_COMPONENTS[character]
    body = _object_with_source_suffix(collection, body_name)
    _object_with_source_suffix(collection, left_eye_name)
    _object_with_source_suffix(collection, right_eye_name)
    head_width = _explicit_head_width(body)
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
    _assert_required_tower_components(relative_path, objects)
    collection = bpy.data.collections[collection_name]
    _tag(collection, "tower")
    collection["td_preview_asset"] = relative_path
    bpy.context.scene.collection.children.unlink(collection)
    _link_child(group, collection)
    _tag_tower_dependencies(objects, collection)
    if relative_path == "towers/arrow-se.png":
        turret = _tower_component(collection, "Arrow_Turret_Yaw")
        turret.rotation_mode = "XYZ"
        turret.rotation_euler.z = -math.pi / 2.0
        bpy.context.view_layer.update()
    _ensure_character_head_vertex_group(collection)
    _assert_clean_tower_dependencies(objects, [collection])
    fit_objects_to_tile(objects)
    _assert_tower_asset_geometry(relative_path, collection)
    _assert_tower_component_layout(relative_path, collection)
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


def _motion_asset_collection_name(relative_path: str) -> str:
    return "TDPreview_motion_" + Path(relative_path).stem.replace("-", "_")


def _motion_source_name(obj: bpy.types.Object) -> str:
    source_name = obj.get("td_preview_source_name")
    return source_name if isinstance(source_name, str) else obj.name


def _motion_object(
    collection: bpy.types.Collection,
    source_name: str,
) -> bpy.types.Object:
    matches = [
        obj
        for obj in collection.objects
        if _motion_source_name(obj) == source_name
    ]
    if len(matches) != 1:
        raise AssertionError(
            f"Expected one motion object {source_name}, found {len(matches)}"
        )
    return matches[0]


def _has_ancestor(obj: bpy.types.Object, ancestor: bpy.types.Object) -> bool:
    current = obj.parent
    while current is not None:
        if current is ancestor:
            return True
        current = current.parent
    return False


def _assert_motion_inventory(
    kind: str,
    objects: list[bpy.types.Object],
) -> dict[str, bpy.types.Object]:
    manifest = MOTION_REQUIRED_OBJECTS.get(kind)
    if manifest is None:
        raise AssertionError(f"Unknown motion inventory kind: {kind}")
    by_name = {_motion_source_name(obj): obj for obj in objects}
    missing = sorted(set(manifest) - set(by_name))
    if missing:
        raise AssertionError(f"Missing {kind} motion objects: {missing}")
    for name, (expected_type, expected_parent) in manifest.items():
        obj = by_name[name]
        if obj.type != expected_type:
            raise AssertionError(
                f"{kind} motion type mismatch for {name}: "
                f"expected={expected_type} actual={obj.type}"
            )
        actual_parent = _motion_source_name(obj.parent) if obj.parent is not None else None
        if actual_parent != expected_parent:
            raise AssertionError(
                f"{kind} source hierarchy mismatch for {name}: "
                f"expected={expected_parent} actual={actual_parent}"
            )
        if obj.hide_render:
            raise AssertionError(f"{kind} required object is hidden: {name}")
    body = by_name[f"Enemy_{kind.title()}_Body"]
    visible_body_meshes = [
        obj
        for obj in objects
        if obj.type == "MESH" and not obj.hide_render and _has_ancestor(obj, body)
    ]
    if not visible_body_meshes:
        raise AssertionError(f"{kind} body transform root has no visible mesh descendants")
    return by_name


def _stable_motion_name(slug: str, original: str) -> str:
    safe_original = re.sub(r"[^A-Za-z0-9_]+", "_", original).strip("_")
    return f"TDPreview_motion_{slug}__{safe_original}"


def _tag_motion_dependencies(
    objects: list[bpy.types.Object],
    collection: bpy.types.Collection,
) -> None:
    slug = _owned_asset_slug(collection, "motion")
    original_names = {obj: obj.name for obj in objects}
    for obj, original in original_names.items():
        obj["td_preview_source_name"] = original
        _tag(obj, "motion")
        desired = _stable_motion_name(slug, original)
        occupied = bpy.data.objects.get(desired)
        if occupied is not None and occupied is not obj:
            raise AssertionError(f"Motion object name is occupied: {desired}")
        obj.name = desired
    seen_data: set[object] = set()
    seen_materials: set[bpy.types.Material] = set()
    for obj in objects:
        if obj.data is not None and obj.data not in seen_data:
            seen_data.add(obj.data)
            original = obj.data.name
            owner = obj.data.get("td_preview_owner")
            if owner not in (None, OWNER):
                raise AssertionError(f"Foreign data on motion object: {obj.name}")
            _tag(obj.data, "motion")
            obj.data.name = _stable_motion_name(
                slug,
                f"data_{len(seen_data):02d}_{original}",
            )
        for slot in obj.material_slots:
            material = slot.material
            if material is None or material in seen_materials:
                continue
            seen_materials.add(material)
            owner = material.get("td_preview_owner")
            if owner not in (None, OWNER):
                raise AssertionError(f"Foreign material on motion object: {material.name}")
            original = material.name
            _tag(material, "motion")
            material.name = _stable_motion_name(
                slug,
                f"material_{len(seen_materials):02d}_{original}",
            ).replace("TDPreview_motion_", MOTION_MATERIAL_PREFIX, 1)


def _remove_unused_owned_motion_data() -> None:
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.armatures, bpy.data.materials):
        for block in list(datablocks):
            if (
                block.get("td_preview_owner") == OWNER
                and block.get("td_preview_group") == "motion"
                and block.users == 0
            ):
                datablocks.remove(block)


def _prepare_motion_group(scene: bpy.types.Scene) -> bpy.types.Collection:
    existing = bpy.data.collections.get(MOTION_GROUP_NAME)
    if existing is not None:
        _remove_owned_collection(existing, "motion")
        _remove_unused_owned_motion_data()
    group = bpy.data.collections.new(MOTION_GROUP_NAME)
    _tag(group, "motion")
    _link_child(scene.collection, group)
    return group


def _matrix_max_delta(left: object, right: object) -> float:
    return max(
        abs(float(left[row][column]) - float(right[row][column]))  # type: ignore[index]
        for row in range(4)
        for column in range(4)
    )


def _snapshot_motion_transforms(
    objects: object,
) -> dict[bpy.types.Object, dict[str, object]]:
    return {
        obj: {
            "parent": obj.parent,
            "parent_type": obj.parent_type,
            "parent_bone": obj.parent_bone,
            "matrix_parent_inverse": obj.matrix_parent_inverse.copy(),
            "matrix_basis": obj.matrix_basis.copy(),
            "rotation_mode": obj.rotation_mode,
            "location": obj.location.copy(),
            "rotation_euler": obj.rotation_euler.copy(),
            "rotation_quaternion": obj.rotation_quaternion.copy(),
            "rotation_axis_angle": tuple(obj.rotation_axis_angle),
            "scale": obj.scale.copy(),
        }
        for obj in objects  # type: ignore[union-attr]
    }


def _restore_motion_transforms(
    snapshot: dict[bpy.types.Object, dict[str, object]],
) -> None:
    for obj, state in snapshot.items():
        obj.parent = state["parent"]  # type: ignore[assignment]
        obj.parent_type = str(state["parent_type"])
        obj.parent_bone = str(state["parent_bone"])
    bpy.context.view_layer.update()
    for obj, state in snapshot.items():
        obj.rotation_mode = str(state["rotation_mode"])
        obj.matrix_parent_inverse = state["matrix_parent_inverse"].copy()  # type: ignore[union-attr]
        obj.matrix_basis = state["matrix_basis"].copy()  # type: ignore[union-attr]
        obj.location = state["location"]  # type: ignore[assignment]
        obj.scale = state["scale"]  # type: ignore[assignment]
        if obj.rotation_mode == "QUATERNION":
            obj.rotation_quaternion = state["rotation_quaternion"]  # type: ignore[assignment]
        elif obj.rotation_mode == "AXIS_ANGLE":
            obj.rotation_axis_angle = state["rotation_axis_angle"]  # type: ignore[assignment]
        else:
            obj.rotation_euler = state["rotation_euler"]  # type: ignore[assignment]
    bpy.context.view_layer.update()


def _reparent_preserve_world(
    obj: bpy.types.Object,
    parent: bpy.types.Object,
) -> None:
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.parent_type = "OBJECT"
    obj.parent_bone = ""
    obj.matrix_parent_inverse = parent.matrix_world.inverted_safe()
    obj.matrix_world = world
    bpy.context.view_layer.update()
    if _matrix_max_delta(obj.matrix_world, world) > 1e-6:
        raise AssertionError(f"World transform changed while parenting {obj.name}")


def _new_motion_empty(
    collection: bpy.types.Collection,
    name: str,
    parent: bpy.types.Object,
    parent_local_location: Vector,
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    _tag(obj, "motion")
    collection.objects.link(obj)
    obj.parent = parent
    obj.parent_type = "OBJECT"
    obj.parent_bone = ""
    obj.matrix_parent_inverse = Matrix.Identity(4)
    obj.matrix_basis = Matrix.Translation(parent_local_location)
    bpy.context.view_layer.update()
    if set(obj.users_collection) != {collection}:
        raise AssertionError(f"Motion pivot escaped its asset collection: {name}")
    return obj


def _mesh_points_in_parent_space(
    obj: bpy.types.Object,
    parent: bpy.types.Object,
) -> list[Vector]:
    if obj.type != "MESH" or not obj.data.vertices:
        raise AssertionError(f"Motion attachment object is not a populated mesh: {obj.name}")
    transform = parent.matrix_world.inverted_safe() @ obj.matrix_world
    return [transform @ vertex.co for vertex in obj.data.vertices]


def _top_center_attachment(
    obj: bpy.types.Object,
    parent: bpy.types.Object,
) -> Vector:
    points = _mesh_points_in_parent_space(obj, parent)
    return Vector((
        (min(point.x for point in points) + max(point.x for point in points)) / 2.0,
        (min(point.y for point in points) + max(point.y for point in points)) / 2.0,
        max(point.z for point in points),
    ))


def _wing_inner_attachment(
    wing: bpy.types.Object,
    parent: bpy.types.Object,
    side: str,
) -> Vector:
    points = _mesh_points_in_parent_space(wing, parent)
    inner_x = max(point.x for point in points) if side == "L" else min(point.x for point in points)
    candidates = [point for point in points if abs(point.x - inner_x) <= 1e-6]
    if not candidates:
        raise AssertionError(f"No inner-edge hinge vertices for {wing.name}")
    return Vector((
        inner_x,
        sum(point.y for point in candidates) / len(candidates),
        sum(point.z for point in candidates) / len(candidates),
    ))


def _orc_pose_components(frame: int, count: int) -> tuple[float, float]:
    if count != 6 or frame not in range(count):
        raise AssertionError("Orc walk requires frames 0..5")
    phase = math.tau * frame / count
    return (
        math.radians(15.0) * math.sin(phase),
        0.06 * (1.0 - math.cos(phase)) / 2.0,
    )


def _fairy_pose_components(frame: int, count: int) -> tuple[float, float]:
    if count != 8 or frame not in range(count):
        raise AssertionError("Fairy flight requires frames 0..7")
    flap_phase = math.tau * 2.0 * frame / count
    hover_phase = math.tau * frame / count + math.pi / 8.0
    return (
        math.radians(28.0) * math.sin(flap_phase),
        0.10 * math.sin(hover_phase),
    )


def _matrix_signature(matrix: object) -> list[float]:
    return [
        round(float(matrix[row][column]), 7)  # type: ignore[index]
        for row in range(4)
        for column in range(4)
    ]


def _motion_geometry_metrics(
    relative_path: str,
    objects: list[bpy.types.Object],
) -> dict[str, float]:
    minimum, maximum = render_geometry_bounds(objects)
    extent = maximum - minimum
    if max(extent.x, extent.y) > 2.45001 or extent.z > 2.65001:
        raise AssertionError(f"{relative_path} exceeds one-tile bounds: {minimum} {maximum}")
    if abs((minimum.x + maximum.x) / 2.0) > 1e-5 or abs((minimum.y + maximum.y) / 2.0) > 1e-5:
        raise AssertionError(f"{relative_path} is not centered before posing")
    if abs(minimum.z - TOWER_GROUND_Z) > 1e-5:
        raise AssertionError(f"{relative_path} is not grounded at {TOWER_GROUND_Z}")
    return {
        "width_x": round(float(extent.x), 6),
        "width_y": round(float(extent.y), 6),
        "height": round(float(extent.z), 6),
        "ground_z": round(float(minimum.z), 6),
    }


def pack_frames(
    frame_paths: object,
    output_path: Path,
    frame_size: int,
) -> None:
    paths = [Path(path) for path in frame_paths]  # type: ignore[union-attr]
    if not paths or frame_size <= 0:
        raise AssertionError("Frame packing requires positive, nonempty inputs")
    images: list[bpy.types.Image] = []
    sheet = None
    try:
        for path in paths:
            image = bpy.data.images.load(str(path), check_existing=False)
            images.append(image)
            if tuple(image.size) != (frame_size, frame_size) or image.channels != 4:
                raise AssertionError(
                    f"Frame input is not {frame_size}x{frame_size} RGBA: {path}"
                )
        sheet_width = frame_size * len(images)
        sheet = bpy.data.images.new(
            "TDPreview_motion_FrameSheet",
            width=sheet_width,
            height=frame_size,
            alpha=True,
        )
        target = [0.0] * (sheet_width * frame_size * 4)
        for index, image in enumerate(images):
            pixels = image.pixels[:]
            for y in range(frame_size):
                source_start = y * frame_size * 4
                target_start = (y * sheet_width + index * frame_size) * 4
                target[target_start:target_start + frame_size * 4] = pixels[
                    source_start:source_start + frame_size * 4
                ]
        sheet.pixels.foreach_set(target)
        sheet.update()
        sheet.filepath_raw = str(output_path)
        sheet.file_format = "PNG"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save()
    finally:
        for image in images:
            if image.name in bpy.data.images:
                bpy.data.images.remove(image)
        if sheet is not None and sheet.name in bpy.data.images:
            bpy.data.images.remove(sheet)


def _canonical_frame_digest(
    pixels: object,
    sheet_width: int,
    frame_size: int,
    frame: int,
) -> str:
    canonical = bytearray()
    x_offset = frame * frame_size
    for y in range(frame_size):
        for x in range(frame_size):
            offset = (y * sheet_width + x_offset + x) * 4
            alpha = max(0.0, min(1.0, float(pixels[offset + 3])))  # type: ignore[index]
            for channel in range(3):
                value = max(0.0, min(1.0, float(pixels[offset + channel])))  # type: ignore[index]
                canonical.append(round(value * alpha * 255.0))
            canonical.append(round(alpha * 255.0))
    return hashlib.sha256(canonical).hexdigest()


def _validate_animation_png(
    path: Path,
    frame_size: int,
    frame_count: int,
) -> dict[str, object]:
    image = None
    try:
        image = bpy.data.images.load(str(path), check_existing=False)
        sheet_width = frame_size * frame_count
        if tuple(image.size) != (sheet_width, frame_size):
            raise AssertionError(
                f"{path} has size {tuple(image.size)}, expected {(sheet_width, frame_size)}"
            )
        if image.channels != 4:
            raise AssertionError(f"{path} is not RGBA: {image.channels} channels")
        pixels = image.pixels[:]
        frames: list[dict[str, object]] = []
        for frame in range(frame_count):
            visible_x: list[int] = []
            visible_y: list[int] = []
            x_offset = frame * frame_size
            for y in range(frame_size):
                for x in range(frame_size):
                    alpha = pixels[(y * sheet_width + x_offset + x) * 4 + 3]
                    if alpha > 1e-6:
                        visible_x.append(x)
                        visible_y.append(y)
                    if (x in (0, frame_size - 1) or y in (0, frame_size - 1)) and alpha > 1e-6:
                        raise AssertionError(f"{path} frame {frame} border is not transparent")
            if not visible_x:
                raise AssertionError(f"{path} frame {frame} has no visible pixels")
            digest = _canonical_frame_digest(
                pixels,
                sheet_width,
                frame_size,
                frame,
            )
            frames.append({
                "frame": frame,
                "digest": digest,
                "visible_pixels": len(visible_x),
                "bounds": [min(visible_x), max(visible_x), min(visible_y), max(visible_y)],
            })
        digests = [str(frame["digest"]) for frame in frames]
        if len(set(digests)) != frame_count:
            raise AssertionError(f"{path} contains duplicate motion frames: {digests}")
        return {"size": [sheet_width, frame_size], "channels": 4, "frames": frames}
    finally:
        if image is not None:
            bpy.data.images.remove(image)


def _remove_motion_frame_temp(temp: Path, frame_root: Path) -> None:
    if temp.exists():
        _remove_tree_exact(temp, temp, frame_root, "motion frame temp")
    if frame_root.exists():
        if any(frame_root.iterdir()):
            raise AssertionError(f"Motion frame root contains unexpected residue: {frame_root}")
        _assert_exact_path(frame_root, frame_root, frame_root.parent, "motion frame root")
        frame_root.rmdir()


def render_animation_sheet(
    relative_path: str,
    frame_count: int,
    pose_frame: object,
) -> dict[str, object]:
    if _STAGING_ROOT is None:
        raise AssertionError("No run staging root for motion frames")
    expected = MOTION_ASSETS.get(relative_path)
    if expected is None or expected[1] != frame_count:
        raise AssertionError(f"Unknown motion sheet contract: {relative_path}/{frame_count}")
    slug = Path(relative_path).stem
    frame_root = _STAGING_ROOT / ".frames"
    temp = frame_root / slug
    if temp.exists():
        raise AssertionError(f"Motion frame temp already exists: {temp}")
    master_frames: list[Path] = []
    mobile_frames: list[Path] = []
    try:
        (temp / "master").mkdir(parents=True, exist_ok=False)
        (temp / "mobile").mkdir(parents=True, exist_ok=False)
        for frame in range(frame_count):
            restore = pose_frame(frame, frame_count)  # type: ignore[operator]
            master_frame = temp / "master" / f"{frame:02d}.png"
            mobile_frame = temp / "mobile" / f"{frame:02d}.png"
            try:
                render_still(master_frame)
                resize_png(master_frame, mobile_frame, MOBILE_SIZE, MOBILE_SIZE)
            finally:
                if restore is not None:
                    restore()  # type: ignore[operator]
            master_frames.append(master_frame)
            mobile_frames.append(mobile_frame)
        master = _STAGING_ROOT / "master" / relative_path
        mobile = _STAGING_ROOT / "mobile" / relative_path
        pack_frames(master_frames, master, FRAME_SIZE)
        pack_frames(mobile_frames, mobile, MOBILE_SIZE)
        return {
            "master": _validate_animation_png(master, FRAME_SIZE, frame_count),
            "mobile": _validate_animation_png(mobile, MOBILE_SIZE, frame_count),
        }
    finally:
        _remove_motion_frame_temp(temp, frame_root)


def _clear_motion_asset_objects(collection: bpy.types.Collection) -> None:
    for obj in list(collection.objects):
        if obj.get("td_preview_owner") != OWNER or obj.get("td_preview_group") != "motion":
            raise AssertionError(f"Refusing to remove foreign motion object {obj.name}")
        bpy.data.objects.remove(obj, do_unlink=True)
    _remove_unused_owned_motion_data()
    if collection.objects or collection.children:
        raise AssertionError(f"Motion asset cleanup left scene objects: {collection.name}")


def _snapshot_motion_append_datablocks() -> dict[str, set[object]]:
    return {
        "objects": set(bpy.data.objects),
        "collections": set(bpy.data.collections),
        "meshes": set(bpy.data.meshes),
        "curves": set(bpy.data.curves),
        "armatures": set(bpy.data.armatures),
        "materials": set(bpy.data.materials),
    }


def _rollback_failed_motion_append(snapshot: dict[str, set[object]]) -> None:
    for obj in [block for block in bpy.data.objects if block not in snapshot["objects"]]:
        bpy.data.objects.remove(obj, do_unlink=True)
    for collection in [
        block
        for block in bpy.data.collections
        if block not in snapshot["collections"]
    ]:
        bpy.data.collections.remove(collection)
    for name, blocks in (
        ("meshes", bpy.data.meshes),
        ("curves", bpy.data.curves),
        ("armatures", bpy.data.armatures),
        ("materials", bpy.data.materials),
    ):
        for block in [item for item in blocks if item not in snapshot[name]]:
            if block.users != 0:
                raise AssertionError(
                    f"Failed motion append left used {name} datablock: {block.name}"
                )
            blocks.remove(block)
    residue = {
        name: [block.name for block in blocks if block not in snapshot[name]]
        for name, blocks in (
            ("objects", bpy.data.objects),
            ("collections", bpy.data.collections),
            ("meshes", bpy.data.meshes),
            ("curves", bpy.data.curves),
            ("armatures", bpy.data.armatures),
            ("materials", bpy.data.materials),
        )
    }
    residue = {name: names for name, names in residue.items() if names}
    if residue:
        raise AssertionError(f"Failed motion append cleanup left datablocks: {residue}")


def _append_motion_asset(
    group: bpy.types.Collection,
    relative_path: str,
    kind: str,
) -> tuple[bpy.types.Collection, list[bpy.types.Object], dict[str, bpy.types.Object]]:
    title = kind.title()
    collection_name = _motion_asset_collection_name(relative_path)
    append_snapshot = _snapshot_motion_append_datablocks()
    try:
        objects = append_selected_objects(
            REPO / "assets/blender/enemies-voxel-v1.blend",
            lambda name: name.startswith(f"Enemy_{title}_") or name.startswith(f"{title}_"),
            collection_name,
        )
        inventory = _assert_motion_inventory(kind, objects)
        collection = bpy.data.collections[collection_name]
        _tag(collection, "motion")
        collection["td_preview_asset"] = relative_path
        bpy.context.scene.collection.children.unlink(collection)
        _link_child(group, collection)
        _tag_motion_dependencies(objects, collection)
        inventory = {_motion_source_name(obj): obj for obj in objects}
        return collection, objects, inventory
    except BaseException:
        try:
            _rollback_failed_motion_append(append_snapshot)
        except BaseException as cleanup_error:
            raise AssertionError("Failed to roll back partial motion append") from cleanup_error
        raise


def _rig_orc_motion(
    collection: bpy.types.Collection,
    inventory: dict[str, bpy.types.Object],
) -> tuple[dict[str, bpy.types.Object], dict[str, list[float]]]:
    body = inventory["Enemy_Orc_Body"]
    pivots: dict[str, bpy.types.Object] = {}
    attachments: dict[str, list[float]] = {}
    for pivot_key, member_names in ORC_PIVOT_MEMBERS.items():
        attachment = _top_center_attachment(inventory[member_names[0]], body)
        attachments[pivot_key] = [round(float(value), 7) for value in attachment]
        pivot = _new_motion_empty(
            collection,
            _stable_motion_name(Path(str(collection["td_preview_asset"])).stem.replace("-", "_"), f"Pivot_{pivot_key}"),
            body,
            attachment,
        )
        pivots[pivot_key] = pivot
        for name in member_names:
            _reparent_preserve_world(inventory[name], pivot)
    for pivot_key, member_names in ORC_PIVOT_MEMBERS.items():
        if any(inventory[name].parent is not pivots[pivot_key] for name in member_names):
            raise AssertionError(f"Orc paired limb parenting failed: {pivot_key}")
    return pivots, attachments


def _rig_fairy_motion(
    collection: bpy.types.Collection,
    inventory: dict[str, bpy.types.Object],
) -> tuple[bpy.types.Object, dict[str, bpy.types.Object], dict[str, list[float]]]:
    root = inventory["Enemy_Fairy_Root"]
    body = inventory["Enemy_Fairy_Body"]
    vfx = inventory["Enemy_Fairy_VFX"]
    slug = Path(str(collection["td_preview_asset"])).stem.replace("-", "_")
    hover = _new_motion_empty(
        collection,
        _stable_motion_name(slug, "HoverRoot"),
        root,
        Vector((0.0, 0.0, 0.0)),
    )
    _reparent_preserve_world(body, hover)
    _reparent_preserve_world(vfx, hover)
    pivots: dict[str, bpy.types.Object] = {}
    attachments: dict[str, list[float]] = {}
    for name in FAIRY_WINGS:
        wing = inventory[name]
        side = name[-1]
        attachment = _wing_inner_attachment(wing, vfx, side)
        attachments[name] = [round(float(value), 7) for value in attachment]
        pivot = _new_motion_empty(
            collection,
            _stable_motion_name(slug, f"Hinge_{name}"),
            vfx,
            attachment,
        )
        pivots[name] = pivot
        _reparent_preserve_world(wing, pivot)
    if body.parent is not hover or vfx.parent is not hover:
        raise AssertionError("Fairy body and wing parent are not under one hover root")
    if any(inventory[name].parent is not pivots[name] for name in FAIRY_WINGS):
        raise AssertionError("Fairy wing hinge parenting failed")
    return hover, pivots, attachments


def _assert_motion_root_anchor(
    root: bpy.types.Object,
    expected_matrix: object,
) -> None:
    if abs(root.rotation_euler.z - MOTION_ROOT_YAW) > 1e-6:
        raise AssertionError(f"Motion root yaw changed: {root.rotation_euler.z}")
    if _matrix_max_delta(root.matrix_world, expected_matrix) > 1e-6:
        raise AssertionError(f"Motion root anchor moved: {root.name}")


def _render_orc_motion_asset(
    collection: bpy.types.Collection,
    objects: list[bpy.types.Object],
    inventory: dict[str, bpy.types.Object],
) -> dict[str, object]:
    source_snapshot = _snapshot_motion_transforms(objects)
    baseline = None
    try:
        root = inventory["Enemy_Orc_Root"]
        root.rotation_mode = "XYZ"
        root.rotation_euler.z = MOTION_ROOT_YAW
        bpy.context.view_layer.update()
        fit_root = _fit_objects_to_owned_collection(objects, 2.45, 2.65, "motion")
        root.rotation_euler.z = MOTION_ROOT_YAW
        bpy.context.view_layer.update()
        geometry = _motion_geometry_metrics("motion/orc-walk-se.png", objects)
        pivots, attachments = _rig_orc_motion(collection, inventory)
        baseline_objects = [*objects, fit_root, *pivots.values()]
        baseline = _snapshot_motion_transforms(baseline_objects)
        root_anchor = root.matrix_world.copy()
        body = inventory["Enemy_Orc_Body"]
        traces: list[dict[str, object]] = []

        def pose(frame: int, count: int) -> object:
            _restore_motion_transforms(baseline)
            swing, bob = _orc_pose_components(frame, count)
            pivots["shoulder_l"].rotation_euler.x += swing
            pivots["hip_r"].rotation_euler.x += swing
            pivots["shoulder_r"].rotation_euler.x -= swing
            pivots["hip_l"].rotation_euler.x -= swing
            body.location.z += bob
            bpy.context.view_layer.update()
            _assert_motion_root_anchor(root, root_anchor)
            traces.append({
                "frame": frame,
                "phase": round(math.tau * frame / count, 10),
                "swing_degrees": round(math.degrees(swing), 10),
                "bob": round(bob, 10),
                "root": _matrix_signature(root.matrix_world),
                "diagonal_a": round(pivots["shoulder_l"].rotation_euler.x, 10),
                "diagonal_b": round(pivots["shoulder_r"].rotation_euler.x, 10),
            })
            return lambda: _restore_motion_transforms(baseline)

        sheets = render_animation_sheet("motion/orc-walk-se.png", 6, pose)
        _restore_motion_transforms(baseline)
        _assert_motion_root_anchor(root, root_anchor)
        return {
            "geometry": geometry,
            "root_yaw_radians": round(float(root.rotation_euler.z), 9),
            "root_yaw_degrees": round(math.degrees(root.rotation_euler.z), 6),
            "root_anchor": _matrix_signature(root_anchor),
            "attachments": attachments,
            "traces": traces,
            "sheets": sheets,
        }
    finally:
        if baseline is not None:
            _restore_motion_transforms(baseline)
        _restore_motion_transforms(source_snapshot)


def _render_fairy_motion_asset(
    collection: bpy.types.Collection,
    objects: list[bpy.types.Object],
    inventory: dict[str, bpy.types.Object],
) -> dict[str, object]:
    source_snapshot = _snapshot_motion_transforms(objects)
    baseline = None
    try:
        root = inventory["Enemy_Fairy_Root"]
        root.rotation_mode = "XYZ"
        root.rotation_euler.z = MOTION_ROOT_YAW
        bpy.context.view_layer.update()
        fit_root = _fit_objects_to_owned_collection(objects, 2.45, 2.65, "motion")
        root.rotation_euler.z = MOTION_ROOT_YAW
        bpy.context.view_layer.update()
        geometry = _motion_geometry_metrics("motion/fairy-fly-se.png", objects)
        hover, pivots, attachments = _rig_fairy_motion(collection, inventory)
        baseline_objects = [*objects, fit_root, hover, *pivots.values()]
        baseline = _snapshot_motion_transforms(baseline_objects)
        root_anchor = root.matrix_world.copy()
        traces: list[dict[str, object]] = []

        def pose(frame: int, count: int) -> object:
            _restore_motion_transforms(baseline)
            flap, hover_offset = _fairy_pose_components(frame, count)
            for name, pivot in pivots.items():
                pivot.rotation_euler.y += flap if name.endswith("L") else -flap
            hover.location.z += hover_offset
            bpy.context.view_layer.update()
            _assert_motion_root_anchor(root, root_anchor)
            traces.append({
                "frame": frame,
                "phase": round(math.tau * 2.0 * frame / count, 10),
                "flap_degrees": round(math.degrees(flap), 10),
                "hover": round(hover_offset, 10),
                "root": _matrix_signature(root.matrix_world),
                "left": round(pivots["Fairy_Wing_UL"].rotation_euler.y, 10),
                "right": round(pivots["Fairy_Wing_UR"].rotation_euler.y, 10),
            })
            return lambda: _restore_motion_transforms(baseline)

        sheets = render_animation_sheet("motion/fairy-fly-se.png", 8, pose)
        _restore_motion_transforms(baseline)
        _assert_motion_root_anchor(root, root_anchor)
        return {
            "geometry": geometry,
            "root_yaw_radians": round(float(root.rotation_euler.z), 9),
            "root_yaw_degrees": round(math.degrees(root.rotation_euler.z), 6),
            "root_anchor": _matrix_signature(root_anchor),
            "attachments": attachments,
            "traces": traces,
            "sheets": sheets,
        }
    finally:
        if baseline is not None:
            _restore_motion_transforms(baseline)
        _restore_motion_transforms(source_snapshot)


def _assert_motion_group_clean(group: bpy.types.Collection) -> None:
    expected = {_motion_asset_collection_name(path) for path in MOTION_ASSETS}
    if {collection.name for collection in group.children} != expected:
        raise AssertionError("Motion group asset collection manifest mismatch")
    for collection in group.children:
        if (
            collection.get("td_preview_owner") != OWNER
            or collection.get("td_preview_group") != "motion"
            or collection.objects
            or collection.children
        ):
            raise AssertionError(f"Motion asset collection was not cleaned: {collection.name}")
    residue = [
        obj.name
        for obj in bpy.data.objects
        if obj.get("td_preview_owner") == OWNER
        and obj.get("td_preview_group") == "motion"
    ]
    if residue:
        raise AssertionError("Motion-owned temporary objects remain: " + ", ".join(residue))


def render_motion_group(scene: bpy.types.Scene) -> dict[str, object]:
    group = _prepare_motion_group(scene)
    preserved_visibility = _snapshot_preview_render_visibility()
    metrics: dict[str, object] = {}
    visibility_audit: dict[str, list[str]] = {}
    try:
        for relative_path, (kind, _) in MOTION_ASSETS.items():
            collection = None
            objects: list[bpy.types.Object] = []
            asset_visibility: dict[str, bool] | None = None
            try:
                collection, objects, inventory = _append_motion_asset(
                    group,
                    relative_path,
                    kind,
                )
                asset_visibility = _snapshot_preview_render_visibility()
                _isolate_preview_render_collection(group, collection)
                visibility_audit[relative_path] = _assert_current_only_render_visibility(
                    group,
                    collection,
                )
                if kind == "orc":
                    metrics[relative_path] = _render_orc_motion_asset(
                        collection,
                        objects,
                        inventory,
                    )
                else:
                    metrics[relative_path] = _render_fairy_motion_asset(
                        collection,
                        objects,
                        inventory,
                    )
            finally:
                if asset_visibility is not None:
                    _restore_preview_render_visibility(asset_visibility)
                if collection is not None:
                    _clear_motion_asset_objects(collection)
        _assert_motion_group_clean(group)
    finally:
        _restore_preview_render_visibility(preserved_visibility)
    final_visibility = _snapshot_preview_render_visibility()
    if any(final_visibility.get(name) != hidden for name, hidden in preserved_visibility.items()):
        raise AssertionError("Previously persisted render visibility changed after motion renders")
    if any(
        final_visibility.get(collection.name) is not False
        for collection in (group, *group.children)
    ):
        raise AssertionError("Motion collection visibility did not restore to visible")
    group["render_visibility_audit"] = json.dumps(visibility_audit, sort_keys=True)
    group["motion_metrics"] = json.dumps(metrics, sort_keys=True)
    return {
        "motion_metrics": metrics,
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
    if group == "map":
        relative_paths = MAP_BUILDERS
    elif group == "tower":
        relative_paths = TOWER_ASSETS
    elif group == "motion":
        relative_paths = MOTION_ASSETS
    else:
        raise AssertionError(f"Unsupported preview group manifest: {group}")
    return {Path(relative_path).name for relative_path in relative_paths}


def _group_directory(group: str) -> str:
    if group == "map":
        return "map"
    if group == "tower":
        return "towers"
    if group == "motion":
        return "motion"
    raise AssertionError(f"Unsupported preview group directory: {group}")


def _validate_render_tree(
    root: Path,
    group: str = "map",
) -> dict[str, dict[str, object]]:
    if group not in ("map", "tower", "motion"):
        raise AssertionError(f"Unsupported render tree group: {group}")
    expected = _expected_file_names(group)
    group_directory = _group_directory(group)
    result: dict[str, dict[str, object]] = {}
    for variant, size in (("master", FRAME_SIZE), ("mobile", MOBILE_SIZE)):
        directory = root / variant / group_directory
        actual = {path.name for path in directory.glob("*.png")}
        if actual != expected:
            raise AssertionError(f"{variant} manifest mismatch: expected={sorted(expected)} actual={sorted(actual)}")
        if len(list(directory.iterdir())) != len(expected):
            raise AssertionError(f"{variant} {group_directory} directory contains non-manifest files")
        if group == "motion":
            frame_counts = {
                Path(relative_path).name: frame_count
                for relative_path, (_, frame_count) in MOTION_ASSETS.items()
            }
            result[variant] = {
                name: _validate_animation_png(directory / name, size, frame_counts[name])
                for name in sorted(expected)
            }
        else:
            result[variant] = {
                name: _validate_png(directory / name, size)
                for name in sorted(expected)
            }
    return result


def _assert_owned_data_integrity() -> dict[str, int]:
    counts: dict[str, int] = {}
    datablock_sets = (
        ("mesh", bpy.data.meshes, {"map", "tower", "motion"}),
        ("material", bpy.data.materials, {"map", "tower", "motion"}),
        ("curve", bpy.data.curves, {"tower", "motion"}),
        ("armature", bpy.data.armatures, {"tower", "motion"}),
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
                if group == "map":
                    expected_prefix = MATERIAL_PREFIX
                elif group == "tower":
                    expected_prefix = TOWER_MATERIAL_PREFIX
                else:
                    expected_prefix = MOTION_MATERIAL_PREFIX
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
        if group not in ("map", "tower", "motion", "common"):
            raise AssertionError(f"Owned object has invalid data/group: {obj.name}")
        if obj.data is None:
            if group not in ("tower", "motion") or obj.type != "EMPTY":
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
    if group_name not in ("map", "tower", "motion"):
        raise AssertionError(f"Unsupported candidate group: {group_name}")
    bpy.ops.wm.open_mainfile(filepath=str(candidate), load_ui=False)
    scenes = [scene for scene in bpy.data.scenes if scene.name == SCENE_NAME]
    if len(scenes) != 1:
        raise AssertionError(f"Expected one {SCENE_NAME}, found {len(scenes)}")
    scene = scenes[0]
    rigs = [collection for collection in bpy.data.collections if collection.name == RIG_COLLECTION_NAME]
    if group_name == "map":
        active_group_name = GROUP_NAME
    elif group_name == "tower":
        active_group_name = TOWER_GROUP_NAME
    else:
        active_group_name = MOTION_GROUP_NAME
    groups = [collection for collection in bpy.data.collections if collection.name == active_group_name]
    if len(rigs) != 1 or len(groups) != 1:
        raise AssertionError(f"Rig/{group_name} persistence mismatch: rigs={len(rigs)} groups={len(groups)}")
    rig = rigs[0]
    _assert_rig_exact(scene, rig)
    group = groups[0]
    asset_collections = list(group.children)
    if group_name == "map":
        builders = MAP_BUILDERS
        collection_namer = _asset_collection_name
    elif group_name == "tower":
        builders = TOWER_ASSETS
        collection_namer = _tower_asset_collection_name
    else:
        builders = MOTION_ASSETS
        collection_namer = _motion_asset_collection_name
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
        elif group_name == "tower":
            _assert_tower_asset_geometry(relative_path, collection)
            _assert_tower_component_layout(relative_path, collection)
            _assert_clean_tower_dependencies(list(collection.all_objects), [collection])
        elif (
            collection.get("td_preview_owner") != OWNER
            or collection.get("td_preview_group") != "motion"
            or collection.objects
            or collection.children
        ):
            raise AssertionError(f"Persisted motion collection is not clean: {collection.name}")
    character_metrics: dict[str, dict[str, float]] | None = None
    motion_metrics: dict[str, object] | None = None
    if group_name == "tower":
        _assert_only_td_rig(scene, group)
        _assert_persisted_tower_visibility_audit(group)
        persisted_metrics = group.get("character_metrics")
        if not isinstance(persisted_metrics, str):
            raise AssertionError("Tower character metrics were not persisted")
        character_metrics = json.loads(persisted_metrics)
        huchu = character_metrics["huchu"]
        deokbae = character_metrics["deokbae"]
        collections_by_asset = {
            collection.get("td_preview_asset"): collection
            for collection in asset_collections
        }
        recomputed = {
            "huchu": _character_metrics(collections_by_asset["towers/huchu-se.png"]),
            "deokbae": _character_metrics(collections_by_asset["towers/deokbae-se.png"]),
        }
        for character, metrics in recomputed.items():
            for key, value in metrics.items():
                if abs(float(character_metrics[character][key]) - value) > 1e-5:
                    raise AssertionError(
                        f"Persisted {character} {key} does not match explicit geometry"
                    )
        if huchu["height"] > deokbae["height"] * 1.02 + 1e-6:
            raise AssertionError("Persisted Huchu height ratio exceeds contract")
        if huchu["head_width"] > deokbae["head_width"] * 1.05 + 1e-6:
            raise AssertionError("Persisted Huchu head-width ratio exceeds contract")
    elif group_name == "motion":
        _assert_motion_group_clean(group)
        persisted_metrics = group.get("motion_metrics")
        persisted_visibility = group.get("render_visibility_audit")
        if not isinstance(persisted_metrics, str) or not isinstance(persisted_visibility, str):
            raise AssertionError("Motion metrics/visibility audit were not persisted")
        motion_metrics = json.loads(persisted_metrics)
        visibility_audit = json.loads(persisted_visibility)
        if set(motion_metrics) != set(MOTION_ASSETS) or set(visibility_audit) != set(MOTION_ASSETS):
            raise AssertionError("Motion persistence audit manifest mismatch")
        for relative_path, (_, frame_count) in MOTION_ASSETS.items():
            metric = motion_metrics[relative_path]
            if (
                abs(float(metric["root_yaw_degrees"]) - 225.0) > 1e-5
                or abs(float(metric["root_yaw_radians"]) - MOTION_ROOT_YAW) > 1e-6
                or len(metric["traces"]) != frame_count
            ):
                raise AssertionError(f"Persisted motion trace contract mismatch: {relative_path}")
            anchors = {tuple(trace["root"]) for trace in metric["traces"]}
            if len(anchors) != 1:
                raise AssertionError(f"Persisted root anchor moved: {relative_path}")
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
    if motion_metrics is not None:
        result["motion_metrics"] = motion_metrics
    return result


def _journal_path(output_root: Path = OUTPUT, group: str = "map") -> Path:
    if group not in ("map", "tower", "motion"):
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
    if group not in ("map", "tower", "motion"):
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
    if record.get("group", "map") not in ("map", "tower", "motion"):
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
    backup_root = paths["backup_root"]
    if backup_root.exists():
        if not backup_root.is_dir() or backup_root.is_symlink():
            raise AssertionError("Rollback backup root is not a real directory")
        allowed_names = {
            _backup_component_path(paths, component, group).name
            for component in ("master", "mobile", "blend")
        }
        actual_names = {path.name for path in backup_root.iterdir()}
        unexpected = sorted(actual_names - allowed_names)
        if unexpected:
            raise AssertionError(f"Unexpected rollback backup entries: {unexpected}")
        for component in ("master", "mobile", "blend"):
            backup = _backup_component_path(paths, component, group)
            if not backup.exists():
                continue
            expected = previous[component]
            if expected is None or not _component_matches(backup, expected):
                raise AssertionError(f"Unsafe rollback backup for {component}")
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
    for group in ("map", "tower", "motion"):
        _recover_stale_publish_at(OUTPUT, BLEND_OUTPUT, _source_hashes, group)


def _assert_publish_inputs_clean(record: dict[str, object]) -> None:
    paths = _validate_publish_record(record, OUTPUT, BLEND_OUTPUT)
    group = str(record.get("group", "map"))
    if not paths["staging_root"].is_dir() or paths["staging_root"].is_symlink():
        raise AssertionError("Publish staging root is not a real directory")
    if not paths["candidate"].is_file() or paths["candidate"].is_symlink():
        raise AssertionError("Publish candidate is not a real file")
    if paths["backup_root"].exists():
        raise AssertionError(f"Publish backup root already exists: {paths['backup_root']}")
    journal = _journal_path(OUTPUT, group)
    if journal.exists():
        raise AssertionError(f"Publish journal already exists: {journal}")


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
    _assert_publish_inputs_clean(record)
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


def _acquire_publish_lock(
    run_id: str,
    group: str,
    output_root: Path = OUTPUT,
) -> tuple[Path, int]:
    _validate_run_id(run_id)
    if group not in ("map", "tower", "motion"):
        raise AssertionError(f"Unsupported publish lock group: {group}")
    output_root.mkdir(parents=True, exist_ok=True)
    if output_root.is_symlink() or not output_root.is_dir():
        raise AssertionError(f"Preview output root is not a real directory: {output_root}")
    flags = os.O_RDONLY
    if hasattr(os, "O_DIRECTORY"):
        flags |= os.O_DIRECTORY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(output_root, flags)
    except OSError as error:
        raise AssertionError(f"Could not open preview publish lock root: {output_root}") from error
    try:
        if not stat.S_ISDIR(os.fstat(descriptor).st_mode):
            raise AssertionError(f"Preview publish lock root is not a directory: {output_root}")
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise AssertionError(
                f"Another preview publisher owns the output lock: {output_root}"
            ) from error
    except BaseException:
        os.close(descriptor)
        raise
    return output_root, descriptor


def _release_publish_lock(
    lock: tuple[Path, int],
    output_root: Path = OUTPUT,
) -> None:
    locked_root, descriptor = lock
    error: BaseException | None = None
    try:
        if locked_root.absolute() != output_root.absolute():
            raise AssertionError(f"Unexpected preview publish lock root: {locked_root}")
        if locked_root.is_symlink() or not locked_root.is_dir():
            raise AssertionError("Preview publish lock root disappeared or changed type")
        held = os.fstat(descriptor)
        current = os.stat(locked_root, follow_symlinks=False)
        if not stat.S_ISDIR(held.st_mode) or (held.st_dev, held.st_ino) != (current.st_dev, current.st_ino):
            raise AssertionError("Preview publish lock root changed while locked")
    except BaseException as caught:
        error = caught
    finally:
        try:
            fcntl.flock(descriptor, fcntl.LOCK_UN)
        finally:
            os.close(descriptor)
    if error is not None:
        raise error


def _assert_no_publish_residue() -> None:
    residue: list[Path] = []
    for group in ("map", "tower", "motion"):
        journal = _journal_path(OUTPUT, group)
        if journal.exists():
            residue.append(journal)
    for pattern in (
        ".staging-*",
        ".backup-*",
        ".*-publish-journal.*.tmp",
    ):
        residue.extend(OUTPUT.glob(pattern))
    residue.extend(
        BLEND_OUTPUT.parent.glob(f".{BLEND_OUTPUT.stem}.*.candidate.blend")
    )
    if residue:
        raise AssertionError(
            "Refusing preview publish residue: "
            + ", ".join(str(path) for path in sorted(set(residue)))
        )


def _snapshot_preserved_output_groups(active_group: str) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    for group in ("map", "tower", "motion"):
        if group == active_group:
            continue
        directory = _group_directory(group)
        for variant in ("master", "mobile"):
            path = OUTPUT / variant / directory
            if path.exists():
                result[f"{variant}/{directory}"] = _hash_tree(path)
    return result


def _assert_preserved_output_groups(snapshot: dict[str, dict[str, str]]) -> None:
    for relative, expected in snapshot.items():
        path = OUTPUT / relative
        if not path.exists() or _hash_tree(path) != expected:
            raise AssertionError(f"Previously rendered output changed: {relative}")


def render_group(group: str) -> None:
    global _STAGING_ROOT, _EXPECTED_PRESERVED_STATE
    if group not in ("map", "tower", "motion"):
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
    run_id = _RUN_ID
    lock = _acquire_publish_lock(run_id, group)
    try:
        _recover_stale_publish()
        _assert_no_publish_residue()
        _assert_preflight_snapshot(
            _PREFLIGHT_SNAPSHOT,
            "stale_publish_recovery",
            require_initial_path=True,
        )
        preserved_output_hashes = _snapshot_preserved_output_groups(group)
        if BLEND_OUTPUT.exists():
            if BLEND_OUTPUT.name in SOURCE_BLEND_NAMES:
                raise AssertionError("Target blend overlaps protected source allow-list")
            bpy.ops.wm.open_mainfile(filepath=str(BLEND_OUTPUT), load_ui=False)
            if bpy.data.is_dirty:
                raise AssertionError("Target preview blend opened dirty")
        scene = _preview_scene()
        if group == "map":
            active_group_name = GROUP_NAME
        elif group == "tower":
            active_group_name = TOWER_GROUP_NAME
        else:
            active_group_name = MOTION_GROUP_NAME
        _EXPECTED_PRESERVED_STATE = _snapshot_preserved_groups(active_group_name)
        ensure_preview_rig(scene)
        paths = _derive_publish_paths(run_id, OUTPUT, BLEND_OUTPUT, group)
        staging_root = paths["staging_root"]
        candidate = paths["candidate"]
        if staging_root.exists() or paths["backup_root"].exists() or candidate.exists():
            raise AssertionError(f"Run paths already exist for {run_id}")
        staging_root.mkdir(parents=True)
        _STAGING_ROOT = staging_root
        try:
            if group == "map":
                build_result = render_map_group(scene)
            elif group == "tower":
                build_result = render_tower_group(scene)
            else:
                build_result = render_motion_group(scene)
            render_validation = _validate_render_tree(staging_root, group)
            if _source_hashes() != source_hashes_before:
                raise AssertionError("Protected source blend hash changed during render")
            bpy.context.preferences.filepaths.save_version = 0
            bpy.ops.wm.save_as_mainfile(filepath=str(candidate), check_existing=False)
            persistence = _validate_candidate(candidate, _EXPECTED_PRESERVED_STATE, group)
            if _source_hashes() != source_hashes_before:
                raise AssertionError("Protected source blend hash changed during candidate validation")
            _publish(staging_root, candidate, run_id, source_hashes_before, group)
            _assert_preserved_output_groups(preserved_output_hashes)
            _assert_no_publish_residue()
            _assert_preflight_snapshot(
                _PREFLIGHT_SNAPSHOT,
                "render_publish_complete",
                require_initial_path=False,
            )
            _LIFECYCLE_EVENTS.append("render_publish_ok")
            print("TD_PREVIEW_RENDER_VALIDATION " + json.dumps(render_validation, sort_keys=True))
            print("TD_PREVIEW_PERSISTENCE " + json.dumps(persistence, sort_keys=True))
            print("TD_PREVIEW_PRESERVED_OUTPUTS " + json.dumps(preserved_output_hashes, sort_keys=True))
            if build_result is not None:
                print("TD_PREVIEW_GROUP_METRICS " + json.dumps(build_result, sort_keys=True))
            print("TD_PREVIEW_SOURCE_HASHES " + json.dumps(source_hashes_before, sort_keys=True))
        except BaseException:
            if candidate.exists():
                _unlink_exact(candidate, candidate, candidate.parent, "candidate blend")
            _remove_tree_exact(
                staging_root,
                paths["staging_root"],
                OUTPUT,
                "run staging",
            )
            raise
        finally:
            _STAGING_ROOT = None
    finally:
        _release_publish_lock(lock)


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--group", choices=("map", "tower", "motion"), required=True)
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


def _test_v2_candidate_path_compatibility() -> None:
    with tempfile.TemporaryDirectory(prefix="td-preview-v2-candidate-") as temporary:
        sandbox = Path(temporary)
        output = sandbox / "assets/renders/redesign-preview-v1"
        blend = sandbox / "assets/blender/td-redesign-preview-v1.blend"
        run_id = "LegacyV2Candidate123"
        group = "tower"
        paths = _derive_publish_paths(run_id, output, blend, group)
        legacy_candidate = blend.parent / f".{blend.stem}.{run_id}.candidate.blend"
        record = {
            "run_id": run_id,
            "group": group,
            "staging_root": str(paths["staging_root"]),
            "backup_root": str(paths["backup_root"]),
            "candidate": str(legacy_candidate),
        }
        validated = _validated_record_paths(record, output, blend)
        if validated["candidate"] != legacy_candidate:
            raise AssertionError("Version 2 journal candidate path is not backward compatible")


def _test_publish_lock_crash_recovery() -> None:
    with tempfile.TemporaryDirectory(prefix="td-preview-lock-") as temporary:
        output = Path(temporary) / "assets/renders/redesign-preview-v1"
        first = _acquire_publish_lock("CrashLockFirst123", "motion", output)
        try:
            _expect_assertion(
                "concurrent preview publisher",
                lambda: _acquire_publish_lock("CrashLockOther123", "map", output),
            )
            lock_path, descriptor = first
            os.close(descriptor)
            first = None
            recovered = _acquire_publish_lock("CrashLockNext123", "tower", output)
            _release_publish_lock(recovered, output)
            if lock_path != output or not lock_path.is_dir():
                raise AssertionError("Advisory lock must use the stable output directory inode")
        finally:
            if first is not None:
                _release_publish_lock(first, output)


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


def _test_rollback_rejects_foreign_backup_before_mutation() -> None:
    with tempfile.TemporaryDirectory(prefix="td-preview-foreign-backup-") as temporary:
        sandbox = Path(temporary)
        output = sandbox / "assets/renders/redesign-preview-v1"
        blend = sandbox / "assets/blender/td-redesign-preview-v1.blend"
        run_id = "ForeignBackup123"
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
        paths["backup_root"].mkdir(parents=True, exist_ok=False)
        _write_marker_tree(paths["backup_root"] / "master-map", "foreign")
        _expect_assertion(
            "foreign rollback backup",
            lambda: _rollback_publish(record, output, blend),
        )
        for variant in ("master", "mobile"):
            _assert_marker(output / variant / "map", "old")
        if blend.read_bytes() != b"old-blend":
            raise AssertionError("Rejected rollback backup mutated the final blend")


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


def _test_required_tower_components_and_hierarchy() -> None:
    for relative_path, manifest, mutated_name in (
        ("towers/slow-se.png", SLOW_COMPONENT_PARENTS, "Slow_Frame_Support_1"),
        ("towers/arrow-se.png", ARROW_COMPONENT_PARENTS, "Arrow_Loaded_Shaft"),
    ):
        objects = [bpy.data.objects.new(name, None) for name in manifest]
        by_name = {obj.name: obj for obj in objects}
        for name, parent_name in manifest.items():
            if parent_name is not None:
                by_name[name].parent = by_name[parent_name]
        try:
            _assert_required_tower_components(relative_path, objects)
            by_name[mutated_name].parent = by_name[next(name for name, parent in manifest.items() if parent is None)]
            _expect_assertion(
                f"flattened {relative_path} source hierarchy",
                lambda: _assert_required_tower_components(relative_path, objects),
            )
        finally:
            for obj in reversed(objects):
                bpy.data.objects.remove(obj)


def _test_tail_independent_head_metric() -> None:
    mesh = bpy.data.meshes.new("ReviewCharacterBodyMesh")
    mesh.from_pydata(
        [
            (-1.0, -1.0, 1.0),
            (1.0, -1.0, 1.0),
            (-0.8, -0.6, 1.8),
            (0.8, -0.6, 1.8),
            (-8.0, 2.0, 1.7),
            (8.0, 2.0, 1.7),
            (-1.0, 0.0, 0.0),
            (1.0, 0.0, 0.0),
            (0.0, -3.5, 1.25),
        ],
        [],
        [],
    )
    body = bpy.data.objects.new("TDPreview_review__Huchu_v2", mesh)
    eye_mesh = bpy.data.meshes.new("ReviewEyeMesh")
    eye_mesh.from_pydata([(-0.05, 0.0, 0.0), (0.05, 0.0, 0.0)], [], [])
    left = bpy.data.objects.new("TDPreview_review__Huchu_Eye3D_L", eye_mesh)
    right = bpy.data.objects.new("TDPreview_review__Huchu_Eye3D_R", eye_mesh)
    left.location = (-0.25, -1.0, 1.25)
    right.location = (0.25, -1.0, 1.25)
    collection = bpy.data.collections.new("ReviewCharacterCollection")
    collection["td_preview_asset"] = "towers/huchu-se.png"
    bpy.context.scene.collection.children.link(collection)
    collection.objects.link(body)
    collection.objects.link(left)
    collection.objects.link(right)
    group = body.vertex_groups.new(name=HEAD_VERTEX_GROUP_NAME)
    group.add([0, 1, 2, 3, 8], 1.0, "REPLACE")
    bpy.context.view_layer.update()
    try:
        before = _character_metrics(collection)["head_width"]
        if abs(before - 2.0) > 1e-6:
            raise AssertionError(f"Explicit head width used non-lateral geometry: {before}")
        mesh.vertices[4].co.x = -80.0
        mesh.vertices[5].co.x = 80.0
        bpy.context.view_layer.update()
        after_tail = _character_metrics(collection)["head_width"]
        if abs(after_tail - 2.0) > 1e-6:
            raise AssertionError("Tail movement changed explicit head width")
        mesh.vertices[0].co.x = -1.25
        mesh.vertices[1].co.x = 1.25
        bpy.context.view_layer.update()
        after_head = _character_metrics(collection)["head_width"]
        if abs(after_head - 2.5) > 1e-6:
            raise AssertionError("Head movement did not change explicit head width")
    finally:
        bpy.context.scene.collection.children.unlink(collection)
        bpy.data.objects.remove(body)
        bpy.data.objects.remove(left)
        bpy.data.objects.remove(right)
        bpy.data.meshes.remove(mesh)
        bpy.data.meshes.remove(eye_mesh)
        bpy.data.collections.remove(collection)


def _test_recursive_tower_dependency_closure() -> None:
    mesh = bpy.data.meshes.new("ReviewClosureMesh")
    obj = bpy.data.objects.new("ReviewClosureObject", mesh)
    bpy.context.scene.collection.objects.link(obj)
    material = bpy.data.materials.new("ReviewClosureMaterial")
    material.use_nodes = True
    mesh.materials.append(material)
    outer = bpy.data.node_groups.new("ReviewOuterNodeGroup", "ShaderNodeTree")
    nested = bpy.data.node_groups.new("ReviewNestedNodeGroup", "ShaderNodeTree")
    image = bpy.data.images.new("ReviewBubbleNestedImage", 1, 1)
    node = material.node_tree.nodes.new("ShaderNodeGroup")
    node.node_tree = outer
    nested_node = outer.nodes.new("ShaderNodeGroup")
    nested_node.node_tree = nested
    image_node = nested.nodes.new("ShaderNodeTexImage")
    image_node.image = image
    target = bpy.data.objects.new("ReviewConstraintTarget", None)
    constraint = obj.constraints.new("COPY_LOCATION")
    constraint.target = target
    shape_key = obj.shape_key_add(name="ReviewShapeKey")
    instance_collection = bpy.data.collections.new("ReviewInstanceCollection")
    instance_child = bpy.data.objects.new("ReviewInstanceChild", None)
    instance_collection.objects.link(instance_child)
    instance = bpy.data.objects.new("ReviewInstanceObject", None)
    instance.instance_type = "COLLECTION"
    instance.instance_collection = instance_collection
    action = bpy.data.actions.new("ReviewAction")
    modifier_target_mesh = bpy.data.meshes.new("ReviewModifierTargetMesh")
    modifier_target = bpy.data.objects.new("ReviewModifierTarget", modifier_target_mesh)
    bpy.context.scene.collection.objects.link(modifier_target)
    modifier = obj.modifiers.new("ReviewShrinkwrapModifier", "SHRINKWRAP")
    modifier.target = modifier_target
    texture = bpy.data.textures.new("ReviewTexture", type="CLOUDS")
    displace = obj.modifiers.new("ReviewDisplaceModifier", "DISPLACE")
    displace.texture = texture
    geometry_tree = bpy.data.node_groups.new("ReviewGeometryTree", "GeometryNodeTree")
    nested_geometry_tree = bpy.data.node_groups.new("ReviewNestedGeometryTree", "GeometryNodeTree")
    geometry_node = geometry_tree.nodes.new("GeometryNodeGroup")
    geometry_node.node_tree = nested_geometry_tree
    geometry_modifier = obj.modifiers.new("ReviewGeometryModifier", "NODES")
    geometry_modifier.node_group = geometry_tree
    driver_target = bpy.data.objects.new("ReviewDriverTarget", None)
    bpy.context.scene.collection.objects.link(driver_target)
    driver_fcurve = obj.driver_add("location", 0)
    variable = driver_fcurve.driver.variables.new()
    variable.targets[0].id = driver_target
    unrelated_collection = bpy.data.collections.new("UnrelatedWaterCollection")
    unrelated_object = bpy.data.objects.new("UnrelatedWaterObject", None)
    unrelated_collection.objects.link(unrelated_object)
    bpy.context.scene.collection.children.link(unrelated_collection)
    try:
        _expect_assertion(
            "nested image tower dependency",
            lambda: _assert_clean_tower_dependencies([obj], []),
        )
        image.name = "ReviewNestedImage"

        shape_key.name = "ReviewWaterShapeKey"
        _expect_assertion(
            "shape-key tower dependency",
            lambda: _assert_clean_tower_dependencies([obj], []),
        )
        shape_key.name = "ReviewShapeKey"

        target.name = "ReviewFlameConstraintTarget"
        _expect_assertion(
            "constraint target tower dependency",
            lambda: _assert_clean_tower_dependencies([obj], []),
        )
        target.name = "ReviewConstraintTarget"

        modifier_target.name = "ReviewWaterModifierTarget"
        _expect_assertion(
            "modifier target tower dependency",
            lambda: _assert_clean_tower_dependencies([obj], []),
        )
        modifier_target.name = "ReviewModifierTarget"

        texture.name = "ReviewFlameTexture"
        _expect_assertion(
            "modifier texture tower dependency",
            lambda: _assert_clean_tower_dependencies([obj], []),
        )
        texture.name = "ReviewTexture"

        nested_geometry_tree.name = "ReviewBubbleGeometryTree"
        _expect_assertion(
            "geometry-node tower dependency",
            lambda: _assert_clean_tower_dependencies([obj], []),
        )
        nested_geometry_tree.name = "ReviewNestedGeometryTree"

        driver_target.name = "ReviewOrbDriverTarget"
        _expect_assertion(
            "driver target tower dependency",
            lambda: _assert_clean_tower_dependencies([obj], []),
        )
        driver_target.name = "ReviewDriverTarget"

        instance_child.name = "ReviewOrbInstanceChild"
        _expect_assertion(
            "instance collection tower dependency",
            lambda: _assert_clean_tower_dependencies([instance], []),
        )
        instance_child.name = "ReviewInstanceChild"

        animation = obj.animation_data_create()
        track = animation.nla_tracks.new()
        track.strips.new("ReviewNlaStrip", 1, action)
        action.name = "ReviewFireAction"
        _expect_assertion(
            "animation action tower dependency",
            lambda: _assert_clean_tower_dependencies([obj], []),
        )
        action.name = "ReviewAction"
        _assert_clean_tower_dependencies([obj], [])
    finally:
        obj.driver_remove("location", 0)
        bpy.data.objects.remove(obj)
        bpy.data.objects.remove(target)
        bpy.data.objects.remove(modifier_target)
        bpy.data.meshes.remove(modifier_target_mesh)
        bpy.data.objects.remove(driver_target)
        bpy.data.objects.remove(instance)
        bpy.data.objects.remove(instance_child)
        bpy.data.collections.remove(instance_collection)
        bpy.data.objects.remove(unrelated_object)
        bpy.data.collections.remove(unrelated_collection)
        bpy.data.meshes.remove(mesh)
        bpy.data.materials.remove(material)
        bpy.data.textures.remove(texture)
        bpy.data.node_groups.remove(outer)
        bpy.data.node_groups.remove(nested)
        bpy.data.node_groups.remove(geometry_tree)
        bpy.data.node_groups.remove(nested_geometry_tree)
        bpy.data.images.remove(image)
        bpy.data.actions.remove(action)


def _test_curve_render_bounds() -> None:
    mesh = bpy.data.meshes.new("ReviewBoundsMesh")
    mesh.from_pydata(
        [
            (-0.5, -0.5, 0.2),
            (0.5, -0.5, 0.2),
            (0.5, 0.5, 0.2),
            (-0.5, 0.5, 0.2),
            (-0.5, -0.5, 1.2),
            (0.5, -0.5, 1.2),
            (0.5, 0.5, 1.2),
            (-0.5, 0.5, 1.2),
        ],
        [],
        [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (4, 0, 3, 7)],
    )
    mesh_obj = bpy.data.objects.new("ReviewBoundsMeshObject", mesh)
    curve = bpy.data.curves.new("ReviewBoundsCurve", "CURVE")
    curve.dimensions = "3D"
    spline = curve.splines.new("POLY")
    spline.points.add(1)
    spline.points[0].co = (0.0, 0.0, 0.25, 1.0)
    spline.points[1].co = (0.0, 0.0, 1.0, 1.0)
    curve.bevel_depth = 0.05
    curve_obj = bpy.data.objects.new("ReviewBoundsCurveObject", curve)
    curve_obj.location.x = 4.0
    collection = bpy.data.collections.new("ReviewBoundsCollection")
    bpy.context.scene.collection.children.link(collection)
    collection.objects.link(mesh_obj)
    collection.objects.link(curve_obj)
    bpy.context.view_layer.update()
    try:
        try:
            _assert_tower_asset_geometry("towers/arrow-se.png", collection)
        except AssertionError as error:
            if "exceeds one-tile bounds" not in str(error):
                raise AssertionError(f"Curve bounds failed for the wrong reason: {error}") from error
        else:
            raise AssertionError("Curve outside tile was omitted from tower geometry assertion")
        curve_obj.location.x = 0.0
        bpy.context.view_layer.update()
        _assert_tower_asset_geometry("towers/arrow-se.png", collection)
    finally:
        bpy.context.scene.collection.children.unlink(collection)
        bpy.data.objects.remove(mesh_obj)
        bpy.data.objects.remove(curve_obj)
        bpy.data.collections.remove(collection)
        bpy.data.meshes.remove(mesh)
        bpy.data.curves.remove(curve)


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


def _test_motion_phase_contract() -> None:
    orc = [_orc_pose_components(frame, 6) for frame in range(6)]
    if len({(round(swing, 10), round(bob, 10)) for swing, bob in orc}) != 6:
        raise AssertionError("Orc motion signatures must be unique across six frames")
    for frame, (swing, bob) in enumerate(orc):
        phase = math.tau * frame / 6
        expected_swing = math.radians(15.0) * math.sin(phase)
        expected_bob = 0.06 * (1.0 - math.cos(phase)) / 2.0
        if abs(swing - expected_swing) > 1e-12 or abs(bob - expected_bob) > 1e-12:
            raise AssertionError(f"Orc frame {frame} does not use the exact phase contract")

    fairy = [_fairy_pose_components(frame, 8) for frame in range(8)]
    if len({(round(flap, 10), round(hover, 10)) for flap, hover in fairy}) != 8:
        raise AssertionError("Fairy motion signatures must be unique across eight frames")
    for frame, (flap, hover) in enumerate(fairy):
        flap_phase = math.tau * 2.0 * frame / 8
        hover_phase = math.tau * frame / 8 + math.pi / 8.0
        expected_flap = math.radians(28.0) * math.sin(flap_phase)
        expected_hover = 0.10 * math.sin(hover_phase)
        if abs(flap - expected_flap) > 1e-12 or abs(hover - expected_hover) > 1e-12:
            raise AssertionError(f"Fairy frame {frame} does not use the exact phase contract")
        paired_flap = fairy[(frame + 4) % 8][0]
        if abs(flap - paired_flap) > 1e-12:
            raise AssertionError("Fairy four-frame pairs must repeat the wing cycle")
    extrema = [math.degrees(fairy[index][0]) for index in (1, 3, 5, 7)]
    if any(abs(abs(value) - 28.0) > 1e-10 for value in extrema):
        raise AssertionError("Fairy sampled flap extrema must reach exactly 28 degrees")


def _review_motion_inventory(kind: str) -> tuple[bpy.types.Collection, list[bpy.types.Object]]:
    collection = bpy.data.collections.new(f"ReviewMotionInventory_{kind}")
    bpy.context.scene.collection.children.link(collection)
    if kind == "orc":
        empty_names = ("Enemy_Orc_Root", "Enemy_Orc_Body", "Enemy_Orc_VFX")
        mesh_names = (
            "Orc_Arm_L",
            "Orc_Arm_R",
            "Orc_Fist_L",
            "Orc_Fist_R",
            "Orc_Leg_L",
            "Orc_Leg_R",
            "Orc_Foot_L",
            "Orc_Foot_R",
            "Orc_Club_End",
            "Orc_Club_Grip",
            "Orc_Club_Head",
            "Orc_Torso",
        )
        root_name, body_name, vfx_name = empty_names
    elif kind == "fairy":
        empty_names = ("Enemy_Fairy_Root", "Enemy_Fairy_Body", "Enemy_Fairy_VFX")
        mesh_names = (
            "Fairy_Wing_LL",
            "Fairy_Wing_LR",
            "Fairy_Wing_UL",
            "Fairy_Wing_UR",
            "Fairy_Head",
        )
        root_name, body_name, vfx_name = empty_names
    else:
        raise AssertionError(kind)
    objects = [bpy.data.objects.new(name, None) for name in empty_names]
    by_name = {obj.name: obj for obj in objects}
    for name in mesh_names:
        mesh = bpy.data.meshes.new(name + "_Mesh")
        mesh.from_pydata(
            [
                (-0.1, -0.1, -0.1),
                (0.1, -0.1, -0.1),
                (0.1, 0.1, 0.1),
                (-0.1, 0.1, 0.1),
            ],
            [],
            [(0, 1, 2, 3)],
        )
        obj = bpy.data.objects.new(name, mesh)
        objects.append(obj)
        by_name[name] = obj
    for obj in objects:
        collection.objects.link(obj)
    by_name[body_name].parent = by_name[root_name]
    by_name[vfx_name].parent = by_name[root_name]
    for name in mesh_names:
        by_name[name].parent = (
            by_name[vfx_name]
            if kind == "fairy" and name.startswith("Fairy_Wing_")
            else by_name[body_name]
        )
    bpy.context.view_layer.update()
    return collection, objects


def _test_motion_required_inventory_and_hierarchy() -> None:
    for kind in ("orc", "fairy"):
        collection, objects = _review_motion_inventory(kind)
        try:
            inventory = _assert_motion_inventory(kind, objects)
            expected_body = f"Enemy_{kind.title()}_Body"
            if inventory[expected_body].type != "EMPTY":
                raise AssertionError(f"{kind} body must be an EMPTY transform root")
            required_mesh = "Orc_Arm_L" if kind == "orc" else "Fairy_Wing_LL"
            if inventory[required_mesh].type != "MESH":
                raise AssertionError(f"{required_mesh} must be render geometry")
            _expect_assertion(
                f"missing {kind} required mesh",
                lambda: _assert_motion_inventory(
                    kind,
                    [obj for obj in objects if obj.name != required_mesh],
                ),
            )
            original_parent = inventory[required_mesh].parent
            inventory[required_mesh].parent = inventory[f"Enemy_{kind.title()}_Root"]
            _expect_assertion(
                f"invalid {kind} source hierarchy",
                lambda: _assert_motion_inventory(kind, objects),
            )
            inventory[required_mesh].parent = original_parent
        finally:
            bpy.context.scene.collection.children.unlink(collection)
            for obj in reversed(objects):
                data = obj.data
                bpy.data.objects.remove(obj)
                if isinstance(data, bpy.types.Mesh) and data.users == 0:
                    bpy.data.meshes.remove(data)
        bpy.data.collections.remove(collection)


def _test_motion_append_failure_cleanup() -> None:
    group = bpy.data.collections.new("ReviewMotionAppendFailureGroup")
    bpy.context.scene.collection.children.link(group)
    tracked = {
        "objects": bpy.data.objects,
        "collections": bpy.data.collections,
        "meshes": bpy.data.meshes,
        "curves": bpy.data.curves,
        "armatures": bpy.data.armatures,
        "materials": bpy.data.materials,
    }
    before = {name: set(blocks) for name, blocks in tracked.items()}
    original_inventory_assertion = globals()["_assert_motion_inventory"]
    leaked: dict[str, list[str]] = {}

    def fail_inventory(kind: str, objects: list[bpy.types.Object]) -> object:
        raise AssertionError(f"Injected {kind} inventory failure after {len(objects)} objects")

    globals()["_assert_motion_inventory"] = fail_inventory
    try:
        _expect_assertion(
            "injected motion inventory failure",
            lambda: _append_motion_asset(
                group,
                "motion/orc-walk-se.png",
                "orc",
            ),
        )
        leaked = {
            name: [block.name for block in blocks if block not in before[name]]
            for name, blocks in tracked.items()
        }
    finally:
        globals()["_assert_motion_inventory"] = original_inventory_assertion
        for obj in [block for block in bpy.data.objects if block not in before["objects"]]:
            bpy.data.objects.remove(obj, do_unlink=True)
        for collection in [
            block
            for block in bpy.data.collections
            if block not in before["collections"] and block is not group
        ]:
            bpy.data.collections.remove(collection)
        for name in ("meshes", "curves", "armatures", "materials"):
            blocks = tracked[name]
            for block in [item for item in blocks if item not in before[name]]:
                if block.users == 0:
                    blocks.remove(block)
        if group.name in bpy.data.collections:
            bpy.data.collections.remove(group)
    residue = {name: names for name, names in leaked.items() if names}
    if residue:
        raise AssertionError(f"Failed motion append leaked datablocks: {residue}")


def _test_motion_transform_restore() -> None:
    collection = bpy.data.collections.new("ReviewMotionTransform")
    bpy.context.scene.collection.children.link(collection)
    original_parent = bpy.data.objects.new("ReviewMotionOriginalParent", None)
    temporary_parent = bpy.data.objects.new("ReviewMotionTemporaryParent", None)
    child = bpy.data.objects.new("ReviewMotionChild", None)
    for obj in (original_parent, temporary_parent, child):
        collection.objects.link(obj)
    original_parent.location = (0.3, -0.4, 0.8)
    original_parent.rotation_euler.z = 0.2
    temporary_parent.location = (-0.6, 0.2, 1.1)
    temporary_parent.rotation_euler.x = -0.3
    child.parent = original_parent
    child.location = (0.2, 0.5, -0.1)
    child.rotation_euler = (0.1, -0.2, 0.3)
    child.scale = (0.9, 1.1, 1.2)
    bpy.context.view_layer.update()
    original_world = child.matrix_world.copy()
    snapshot = _snapshot_motion_transforms((original_parent, temporary_parent, child))
    try:
        _reparent_preserve_world(child, temporary_parent)
        if _matrix_max_delta(child.matrix_world, original_world) > 1e-6:
            raise AssertionError("Motion reparent changed the child world matrix")
        original_parent.location.x += 2.0
        temporary_parent.rotation_euler.y += 0.7
        child.location.z += 3.0
        _restore_motion_transforms(snapshot)
        if child.parent is not original_parent:
            raise AssertionError("Motion restore did not restore parentage")
        if _matrix_max_delta(child.matrix_world, original_world) > 1e-6:
            raise AssertionError("Motion restore did not restore the world matrix")
    finally:
        bpy.context.scene.collection.children.unlink(collection)
        for obj in (child, temporary_parent, original_parent):
            bpy.data.objects.remove(obj)
        bpy.data.collections.remove(collection)


def _write_review_motion_frame(path: Path, size: int, color: tuple[float, float, float, float]) -> None:
    image = bpy.data.images.new("ReviewMotionFrame", width=size, height=size, alpha=True)
    try:
        pixels = [0.0] * (size * size * 4)
        for y in range(2, size - 2):
            for x in range(2, size - 2):
                offset = (y * size + x) * 4
                pixels[offset:offset + 4] = color
        image.pixels.foreach_set(pixels)
        image.update()
        image.filepath_raw = str(path)
        image.file_format = "PNG"
        image.save()
    finally:
        bpy.data.images.remove(image)


def _test_motion_sheet_packing_and_validation() -> None:
    with tempfile.TemporaryDirectory(prefix="td-preview-motion-sheet-") as temporary:
        root = Path(temporary)
        frame_paths = [root / f"frame-{index}.png" for index in range(3)]
        for index, path in enumerate(frame_paths):
            _write_review_motion_frame(
                path,
                8,
                (0.2 + index * 0.2, 0.4, 0.7 - index * 0.1, 1.0),
            )
        sheet = root / "sheet.png"
        pack_frames(frame_paths, sheet, 8)
        validation = _validate_animation_png(sheet, 8, 3)
        if validation["size"] != [24, 8] or len(validation["frames"]) != 3:
            raise AssertionError("Motion sheet packing order/dimensions are invalid")
        duplicate_sheet = root / "duplicate-sheet.png"
        pack_frames((frame_paths[0], frame_paths[0], frame_paths[1]), duplicate_sheet, 8)
        _expect_assertion(
            "duplicate motion sheet cells",
            lambda: _validate_animation_png(duplicate_sheet, 8, 3),
        )


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
        ("v2_candidate_path_compatibility", _test_v2_candidate_path_compatibility),
        ("publish_lock_crash_recovery", _test_publish_lock_crash_recovery),
        ("publish_phase_recovery", _test_publish_recovery_phases),
        ("source_hash_failure_rollback", _test_source_hash_failure_rolls_back_everything),
        ("foreign_backup_preflight", _test_rollback_rejects_foreign_backup_before_mutation),
        ("foreign_material_group_invariants", _test_foreign_material_and_group_invariants),
        ("rig_normalization_owned_orphans", _test_rig_normalization_and_owned_orphans),
        ("tower_predicates_purity", _test_tower_predicates_and_purity),
        ("required_tower_components_hierarchy", _test_required_tower_components_and_hierarchy),
        ("tail_independent_head_metric", _test_tail_independent_head_metric),
        ("recursive_tower_dependency_closure", _test_recursive_tower_dependency_closure),
        ("curve_render_bounds", _test_curve_render_bounds),
        ("tower_dependency_cleanup_order", _test_tower_dependency_cleanup_order),
        ("current_only_render_visibility", _test_current_only_render_visibility),
        ("motion_phase_contract", _test_motion_phase_contract),
        ("motion_required_inventory_hierarchy", _test_motion_required_inventory_and_hierarchy),
        ("motion_append_failure_cleanup", _test_motion_append_failure_cleanup),
        ("motion_transform_restore", _test_motion_transform_restore),
        ("motion_sheet_packing_validation", _test_motion_sheet_packing_and_validation),
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
