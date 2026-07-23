from __future__ import annotations

from array import array
import hashlib
import json
import math
import shutil
import tempfile
from pathlib import Path
from typing import Callable, Iterable

import bpy
from mathutils import Vector


REPO = Path(__file__).resolve().parents[2]
OUTPUT = REPO / "assets/renders/nightmare-v2"
ENEMY_BLEND_OUTPUT = REPO / "assets/blender/nightmare-enemies-v2.blend"
MAP_BLEND_OUTPUT = REPO / "assets/blender/nightmare-map-kit-v2.blend"
OWNER = "nightmare-v2"
SCENE_NAME = "NightmareAssets_v2"
ROOT_COLLECTION_NAME = "NightmareAssets_v2_Root"
FRAME_SIZE = 256
MOBILE_FRAME_SIZE = 128
FRONT_YAW = math.atan2(-8.5, 6.5) + math.pi / 2

SOURCE_BLEND_NAMES = (
    "character-assets-v2.blend",
    "arrow-tower-v1.blend",
    "slow-tower-v1.blend",
    "tower-lineup-v1.blend",
    "enemies-voxel-v1.blend",
)

CAMERA_SPEC = {
    "location": (6.5, -8.5, 6.25),
    "target": (0.0, 0.0, 0.85),
    "ortho_scale": 4.1,
}

COLORS = {
    "shadow": (0.18, 0.08, 0.30, 1.0),
    "shadow_glow": (0.18, 0.78, 0.90, 1.0),
    "bat": (0.20, 0.10, 0.24, 1.0),
    "bone": (0.78, 0.76, 0.65, 1.0),
    "shield": (0.16, 0.14, 0.22, 1.0),
    "obsidian": (0.08, 0.07, 0.11, 1.0),
    "lava": (1.0, 0.28, 0.04, 1.0),
    "lich": (0.28, 0.08, 0.42, 1.0),
    "elite": (0.82, 0.08, 0.12, 1.0),
}

MOTION_ASSETS = (
    ("shadow-slime-bounce", 6, "shadow_slime"),
    ("vampire-bat-fly", 8, "vampire_bat"),
    ("skeleton-knight-walk", 6, "skeleton_knight"),
    ("obsidian-golem-walk", 6, "obsidian_golem"),
    ("lich-king-float", 8, "lich_king"),
)

ENEMY_DETAIL_CONTRACT = {
    "shadow-slime-bounce": {
        "minimum_parts": 18,
        "required_roles": {
            "body-shell",
            "top-plate",
            "inner-core",
            "eye",
            "mouth",
            "floating-cube",
        },
    },
    "vampire-bat-fly": {
        "minimum_parts": 32,
        "required_roles": {
            "head",
            "outer-ear",
            "inner-ear",
            "wing-frame",
            "wing-membrane",
            "eye",
            "muzzle",
            "fang",
            "claw",
        },
    },
    "skeleton-knight-walk": {
        "minimum_parts": 45,
        "required_roles": {
            "skull",
            "eye-socket",
            "tooth",
            "rib",
            "limb",
            "shield-rim",
            "shield-gem",
            "sword-blade",
            "sword-hilt",
        },
    },
    "obsidian-golem-walk": {
        "minimum_parts": 32,
        "required_roles": {
            "head-plate",
            "torso-plate",
            "shoulder-plate",
            "fist",
            "foot",
            "eye",
            "core",
            "lava-crack",
        },
    },
    "lich-king-float": {
        "minimum_parts": 50,
        "required_roles": {
            "skull",
            "eye-socket",
            "tooth",
            "crown-spire",
            "crown-gem",
            "hood",
            "pauldron",
            "robe-strip",
            "hand",
            "finger",
            "soul-flame",
        },
    },
}

VFX_ASSETS = (
    ("shield-open", 6),
    ("shield-block", 4),
    ("shield-break", 6),
    ("split-burst", 6),
    ("slow-resist", 4),
    ("lich-aura", 8),
    ("lich-phase-two", 8),
    ("elite-rune", 4),
)

THEME_PALETTES = {
    "moonlitSwamp": {
        "ground": (0.16, 0.24, 0.24, 1.0),
        "side": (0.08, 0.14, 0.15, 1.0),
        "road": (0.30, 0.36, 0.37, 1.0),
        "accent": (0.29, 0.74, 0.76, 1.0),
    },
    "rottenForest": {
        "ground": (0.18, 0.25, 0.13, 1.0),
        "side": (0.09, 0.13, 0.07, 1.0),
        "road": (0.34, 0.30, 0.20, 1.0),
        "accent": (0.48, 0.66, 0.24, 1.0),
    },
    "ashenRuins": {
        "ground": (0.28, 0.27, 0.29, 1.0),
        "side": (0.14, 0.13, 0.16, 1.0),
        "road": (0.43, 0.40, 0.42, 1.0),
        "accent": (0.60, 0.52, 0.70, 1.0),
    },
    "bloodRavine": {
        "ground": (0.28, 0.12, 0.12, 1.0),
        "side": (0.13, 0.05, 0.06, 1.0),
        "road": (0.43, 0.24, 0.21, 1.0),
        "accent": (0.86, 0.18, 0.16, 1.0),
    },
    "obsidianMine": {
        "ground": (0.12, 0.10, 0.16, 1.0),
        "side": (0.05, 0.04, 0.08, 1.0),
        "road": (0.23, 0.20, 0.28, 1.0),
        "accent": (0.88, 0.25, 0.05, 1.0),
    },
    "abyssGate": {
        "ground": (0.14, 0.08, 0.21, 1.0),
        "side": (0.06, 0.03, 0.10, 1.0),
        "road": (0.29, 0.18, 0.36, 1.0),
        "accent": (0.60, 0.20, 0.92, 1.0),
    },
}

MAP_PIECES = (
    "ground",
    "road-horizontal",
    "road-vertical",
    "road-corner-north-east",
    "road-corner-east-south",
    "road-corner-south-west",
    "road-corner-west-north",
    "boundary-stone",
    "snack-chest",
)

_ACTIVE_COLLECTION: bpy.types.Collection | None = None
_ACTIVE_ROOT: bpy.types.Object | None = None


def _tag(block: object, group: str) -> None:
    block["nightmare_owner"] = OWNER  # type: ignore[index]
    block["nightmare_group"] = group  # type: ignore[index]


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


def _owned(block: object) -> bool:
    return block.get("nightmare_owner") == OWNER  # type: ignore[attr-defined]


def _remove_owned_data() -> None:
    for scene in list(bpy.data.scenes):
        if _owned(scene):
            bpy.data.scenes.remove(scene)
    for obj in list(bpy.data.objects):
        if _owned(obj):
            bpy.data.objects.remove(obj, do_unlink=True)
    for collection in list(bpy.data.collections):
        if _owned(collection):
            bpy.data.collections.remove(collection)
    for material in list(bpy.data.materials):
        if _owned(material):
            bpy.data.materials.remove(material)
    for data_group in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.worlds,
    ):
        for datablock in list(data_group):
            if _owned(datablock):
                data_group.remove(datablock)


def _look_at(
    obj: bpy.types.Object,
    target: tuple[float, float, float],
) -> None:
    obj.rotation_euler = (
        Vector(target) - obj.location
    ).to_track_quat("-Z", "Y").to_euler()


def _set_agx(scene: bpy.types.Scene) -> None:
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except (TypeError, ValueError):
        try:
            scene.view_settings.look = "Medium High Contrast"
        except (TypeError, ValueError):
            pass


def _new_collection(
    name: str,
    parent: bpy.types.Collection,
    group: str,
) -> bpy.types.Collection:
    collection = bpy.data.collections.new(name)
    _tag(collection, group)
    parent.children.link(collection)
    return collection


def _require_scene() -> bpy.types.Scene:
    scene = bpy.data.scenes.get(SCENE_NAME)
    if scene is None or not _owned(scene):
        raise AssertionError("Call reset_nightmare_scene() first")
    return scene


def _root_collection() -> bpy.types.Collection:
    collection = bpy.data.collections.get(ROOT_COLLECTION_NAME)
    if collection is None or not _owned(collection):
        raise AssertionError("Nightmare root collection is missing")
    return collection


def _group_collection(group: str) -> bpy.types.Collection:
    expected = f"NightmareAssets_v2_{group}"
    collection = bpy.data.collections.get(expected)
    if collection is None:
        collection = _new_collection(expected, _root_collection(), group)
    elif not _owned(collection):
        raise AssertionError(f"Refusing foreign collection {expected}")
    return collection


def _assert_source_hashes(stage: str) -> None:
    scene = _require_scene()
    raw = scene.get("nightmare_source_hashes")
    if not isinstance(raw, str):
        raise AssertionError("Source hash snapshot missing")
    if json.loads(raw) != _source_hashes():
        raise AssertionError(f"Protected source blend changed during {stage}")
    print(f"NIGHTMARE_SOURCE_HASH_OK {stage}", flush=True)


def _material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    emission: float = 0.0,
    roughness: float = 0.68,
) -> bpy.types.Material:
    qualified = f"NightmareAssets_v2_Mat_{name}"
    material = bpy.data.materials.get(qualified)
    if material is None:
        material = bpy.data.materials.new(qualified)
        _tag(material, "material")
    elif not _owned(material):
        raise AssertionError(f"Refusing foreign material {qualified}")
    material.diffuse_color = color
    material.use_nodes = True
    principled = next(
        (
            node
            for node in material.node_tree.nodes
            if node.type == "BSDF_PRINCIPLED"
        ),
        None,
    )
    if principled is None:
        raise AssertionError(f"Principled shader missing for {qualified}")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    alpha = principled.inputs.get("Alpha")
    if alpha is not None:
        alpha.default_value = color[3]
    emission_color = (
        principled.inputs.get("Emission Color")
        or principled.inputs.get("Emission")
    )
    if emission_color is not None:
        emission_color.default_value = color
    emission_strength = principled.inputs.get("Emission Strength")
    if emission_strength is not None:
        emission_strength.default_value = emission
    if color[3] < 1.0:
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "DITHERED"
        elif hasattr(material, "blend_method"):
            material.blend_method = "BLEND"
    return material


def _move_to_active(obj: bpy.types.Object) -> bpy.types.Object:
    if _ACTIVE_COLLECTION is None:
        raise AssertionError("No active asset collection")
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    _ACTIVE_COLLECTION.objects.link(obj)
    _tag(obj, _ACTIVE_COLLECTION.get("nightmare_group", "asset"))
    if obj.data is not None:
        _tag(obj.data, _ACTIVE_COLLECTION.get("nightmare_group", "asset"))
    if _ACTIVE_ROOT is not None:
        obj.parent = _ACTIVE_ROOT
    return obj


def _role(obj: bpy.types.Object, role: str) -> bpy.types.Object:
    obj["nightmare_role"] = role
    return obj


def _motion_group(obj: bpy.types.Object, group: str) -> bpy.types.Object:
    obj["nightmare_motion_group"] = group
    return obj


def _finish_detail_contract(asset_id: str) -> None:
    if _ACTIVE_COLLECTION is None:
        raise AssertionError("No active asset collection")
    contract = ENEMY_DETAIL_CONTRACT[asset_id]
    objects = [
        obj
        for obj in _ACTIVE_COLLECTION.objects
        if obj.type != "EMPTY"
    ]
    roles = sorted({
        str(obj.get("nightmare_role"))
        for obj in objects
        if isinstance(obj.get("nightmare_role"), str)
    })
    missing = sorted(contract["required_roles"] - set(roles))
    if len(objects) < contract["minimum_parts"] or missing:
        raise AssertionError(
            f"{asset_id} detail contract failed: "
            f"parts={len(objects)}, missing={missing}"
        )
    _ACTIVE_COLLECTION["nightmare_detail_version"] = 2
    _ACTIVE_COLLECTION["nightmare_detail_roles"] = json.dumps(roles)
    _ACTIVE_COLLECTION["nightmare_part_count"] = len(objects)


def _box(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    bevel: float = 0.06,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    if obj is None:
        raise AssertionError(f"Failed to create {name}")
    obj.name = f"Nightmare_{name}"
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new("NightmareBevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    obj.data.materials.append(material)
    return _move_to_active(obj)


def _sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=2,
        radius=1.0,
        location=location,
    )
    obj = bpy.context.object
    if obj is None:
        raise AssertionError(f"Failed to create {name}")
    obj.name = f"Nightmare_{name}"
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    return _move_to_active(obj)


def _cylinder(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    vertices: int = 16,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=1.0,
        depth=2.0,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    if obj is None:
        raise AssertionError(f"Failed to create {name}")
    obj.name = f"Nightmare_{name}"
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("NightmareBevel", "BEVEL")
    modifier.width = 0.035
    modifier.segments = 2
    obj.data.materials.append(material)
    return _move_to_active(obj)


def _cone(
    name: str,
    location: tuple[float, float, float],
    radius1: float,
    radius2: float,
    depth: float,
    material: bpy.types.Material,
    *,
    vertices: int = 4,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    if obj is None:
        raise AssertionError(f"Failed to create {name}")
    obj.name = f"Nightmare_{name}"
    obj.data.materials.append(material)
    return _move_to_active(obj)


def _triangle_prism(
    name: str,
    points: tuple[
        tuple[float, float],
        tuple[float, float],
        tuple[float, float],
    ],
    y: float,
    thickness: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    front_y = y - thickness / 2
    back_y = y + thickness / 2
    vertices = [
        (x, front_y, z) for x, z in points
    ] + [
        (x, back_y, z) for x, z in points
    ]
    faces = [
        (0, 1, 2),
        (5, 4, 3),
        (0, 3, 4, 1),
        (1, 4, 5, 2),
        (2, 5, 3, 0),
    ]
    mesh = bpy.data.meshes.new(f"Nightmare_{name}_Mesh")
    _tag(mesh, "mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(f"Nightmare_{name}", mesh)
    obj.data.materials.append(material)
    if _ACTIVE_COLLECTION is None:
        raise AssertionError("No active asset collection")
    _ACTIVE_COLLECTION.objects.link(obj)
    _tag(obj, _ACTIVE_COLLECTION.get("nightmare_group", "asset"))
    if _ACTIVE_ROOT is not None:
        obj.parent = _ACTIVE_ROOT
    return obj


def _polygon_prism(
    name: str,
    points: tuple[tuple[float, float], ...],
    y: float,
    thickness: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    if len(points) < 3:
        raise AssertionError(f"{name} requires at least three points")
    front_y = y - thickness / 2
    back_y = y + thickness / 2
    count = len(points)
    vertices = [
        (x, front_y, z) for x, z in points
    ] + [
        (x, back_y, z) for x, z in points
    ]
    faces: list[tuple[int, ...]] = [
        tuple(range(count)),
        tuple(range(count * 2 - 1, count - 1, -1)),
    ]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((
            index,
            next_index,
            count + next_index,
            count + index,
        ))
    mesh = bpy.data.meshes.new(f"Nightmare_{name}_Mesh")
    _tag(mesh, "mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(f"Nightmare_{name}", mesh)
    obj.data.materials.append(material)
    if _ACTIVE_COLLECTION is None:
        raise AssertionError("No active asset collection")
    _ACTIVE_COLLECTION.objects.link(obj)
    _tag(obj, _ACTIVE_COLLECTION.get("nightmare_group", "asset"))
    if _ACTIVE_ROOT is not None:
        obj.parent = _ACTIVE_ROOT
    return obj


def _arc(
    name: str,
    center: tuple[float, float, float],
    radius: float,
    start: float,
    end: float,
    material: bpy.types.Material,
    *,
    thickness: float = 0.035,
    points: int = 18,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(f"Nightmare_{name}_Curve", "CURVE")
    _tag(curve, "curve")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = thickness
    curve.bevel_resolution = 2
    spline = curve.splines.new("POLY")
    spline.points.add(points - 1)
    for index, point in enumerate(spline.points):
        angle = start + (end - start) * index / max(1, points - 1)
        point.co = (
            center[0] + math.cos(angle) * radius,
            center[1],
            center[2] + math.sin(angle) * radius,
            1.0,
        )
    obj = bpy.data.objects.new(f"Nightmare_{name}", curve)
    curve.materials.append(material)
    if _ACTIVE_COLLECTION is None:
        raise AssertionError("No active asset collection")
    _ACTIVE_COLLECTION.objects.link(obj)
    _tag(obj, _ACTIVE_COLLECTION.get("nightmare_group", "asset"))
    if _ACTIVE_ROOT is not None:
        obj.parent = _ACTIVE_ROOT
    return obj


def _remove_group_assets(group: str) -> None:
    group_collection = _group_collection(group)
    for child in list(group_collection.children):
        if not _owned(child):
            raise AssertionError(f"Refusing foreign child collection {child.name}")
        for obj in list(child.all_objects):
            if _owned(obj):
                bpy.data.objects.remove(obj, do_unlink=True)
        group_collection.children.unlink(child)
        bpy.data.collections.remove(child)


def _begin_asset(
    asset_id: str,
    group: str,
    frames: int,
    *,
    ortho_scale: float,
    target_z: float,
) -> bpy.types.Object:
    global _ACTIVE_COLLECTION, _ACTIVE_ROOT
    parent = _group_collection(group)
    collection = _new_collection(
        f"NightmareAsset_{group}_{asset_id}",
        parent,
        group,
    )
    collection["nightmare_asset_id"] = asset_id
    collection["nightmare_frames"] = frames
    collection["nightmare_relative_path"] = f"{group}/{asset_id}.png"
    collection["nightmare_ortho_scale"] = ortho_scale
    collection["nightmare_target_z"] = target_z
    collection.hide_render = True
    _ACTIVE_COLLECTION = collection
    root = bpy.data.objects.new(f"NightmareRoot_{asset_id}", None)
    collection.objects.link(root)
    _tag(root, group)
    root["nightmare_role"] = "root"
    root.rotation_euler.z = FRONT_YAW if group != "map" else 0.0
    _ACTIVE_ROOT = root
    return root


def _end_asset() -> None:
    global _ACTIVE_COLLECTION, _ACTIVE_ROOT
    _ACTIVE_COLLECTION = None
    _ACTIVE_ROOT = None


def _keyframe(
    obj: bpy.types.Object,
    frame: int,
    *,
    location: bool = False,
    rotation: bool = False,
    scale: bool = False,
) -> None:
    if location:
        obj.keyframe_insert(data_path="location", frame=frame)
    if rotation:
        obj.keyframe_insert(data_path="rotation_euler", frame=frame)
    if scale:
        obj.keyframe_insert(data_path="scale", frame=frame)


def _owned_asset_collections() -> list[bpy.types.Collection]:
    return sorted(
        [
            collection
            for collection in bpy.data.collections
            if _owned(collection)
            and isinstance(collection.get("nightmare_asset_id"), str)
        ],
        key=lambda collection: (
            str(collection.get("nightmare_group")),
            str(collection.get("nightmare_asset_id")),
        ),
    )


def reset_nightmare_scene() -> None:
    _remove_owned_data()
    scene = bpy.data.scenes.new(SCENE_NAME)
    _tag(scene, "scene")
    scene["nightmare_source_hashes"] = json.dumps(
        _source_hashes(),
        sort_keys=True,
    )
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = FRAME_SIZE
    scene.render.resolution_y = FRAME_SIZE
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 35
    _set_agx(scene)
    world = bpy.data.worlds.new("NightmareAssets_v2_World")
    _tag(world, "world")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background is not None:
        background.inputs["Color"].default_value = (0.025, 0.018, 0.04, 1.0)
        background.inputs["Strength"].default_value = 0.18
    scene.world = world

    camera_data = bpy.data.cameras.new("NightmareAssets_v2_CameraData")
    _tag(camera_data, "camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = float(CAMERA_SPEC["ortho_scale"])
    camera = bpy.data.objects.new("NightmareAssets_v2_Camera", camera_data)
    _tag(camera, "camera")
    scene.collection.objects.link(camera)
    camera.location = CAMERA_SPEC["location"]
    _look_at(camera, CAMERA_SPEC["target"])
    scene.camera = camera

    for name, location, energy, size in (
        ("Key", (4.0, -4.5, 7.0), 850.0, 4.5),
        ("Fill", (-4.0, -2.0, 5.0), 420.0, 3.5),
        ("Rim", (1.5, 4.5, 6.5), 650.0, 3.0),
    ):
        light_data = bpy.data.lights.new(
            f"NightmareAssets_v2_{name}Data",
            "AREA",
        )
        _tag(light_data, "light")
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.new(
            f"NightmareAssets_v2_{name}",
            light_data,
        )
        _tag(light, "light")
        scene.collection.objects.link(light)
        light.location = location
        _look_at(light, (0.0, 0.0, 0.8))

    root = bpy.data.collections.new(ROOT_COLLECTION_NAME)
    _tag(root, "root")
    scene.collection.children.link(root)
    for group in ("motion", "vfx", "map"):
        _new_collection(f"NightmareAssets_v2_{group}", root, group)
    if bpy.context.window is not None:
        bpy.context.window.scene = scene
    OUTPUT.mkdir(parents=True, exist_ok=True)
    _assert_source_hashes("reset")
    print("NIGHTMARE_SCENE_READY", flush=True)


def _build_shadow_slime(frames: int) -> None:
    asset_id = "shadow-slime-bounce"
    root = _begin_asset(
        asset_id,
        "motion",
        frames,
        ortho_scale=3.25,
        target_z=0.68,
    )
    shell = _material(
        "ShadowShell",
        (0.09, 0.018, 0.20, 0.94),
        roughness=0.48,
    )
    shell_light = _material(
        "ShadowShellLight",
        (0.22, 0.045, 0.46, 0.88),
        roughness=0.42,
    )
    shell_dark = _material(
        "ShadowShellDark",
        (0.035, 0.008, 0.085, 0.96),
        roughness=0.62,
    )
    glow = _material(
        "ShadowGlow",
        (0.025, 0.66, 0.88, 1.0),
        emission=2.2,
        roughness=0.26,
    )
    core = _role(
        _box(
            "ShadowSlimeCore",
            (0.0, 0.04, 0.63),
            (0.48, 0.32, 0.35),
            shell_light,
            bevel=0.12,
        ),
        "inner-core",
    )
    body = _role(
        _box(
            "ShadowSlimeBodyShell",
            (0.0, 0.0, 0.58),
            (0.73, 0.48, 0.46),
            shell,
            bevel=0.13,
        ),
        "body-shell",
    )
    top_parts = []
    for index, (x, y, z, sx, sy, sz) in enumerate((
        (-0.42, 0.02, 1.02, 0.24, 0.32, 0.12),
        (0.00, 0.03, 1.09, 0.26, 0.31, 0.16),
        (0.40, 0.02, 1.00, 0.22, 0.31, 0.11),
        (-0.14, -0.03, 1.16, 0.17, 0.20, 0.09),
        (0.22, -0.02, 1.19, 0.14, 0.18, 0.08),
    )):
        top_parts.append(_motion_group(_role(
            _box(
                f"ShadowSlimeTopPlate{index}",
                (x, y, z),
                (sx, sy, sz),
                shell_light if index in {1, 3} else shell,
                bevel=0.055,
            ),
            "top-plate",
        ), "wobble"))
    for direction in (-1, 1):
        _role(_box(
            f"ShadowSlimeBaseFoot{direction}",
            (direction * 0.50, -0.02, 0.16),
            (0.25, 0.34, 0.12),
            shell_dark,
            bevel=0.06,
        ), "body-shell")
    for direction in (-1, 1):
        _role(_box(
            f"ShadowSlimeEye{direction}",
            (direction * 0.25, -0.49, 0.71),
            (0.105, 0.035, 0.155),
            glow,
            bevel=0.025,
        ), "eye")
        _role(_box(
            f"ShadowSlimeCheek{direction}",
            (direction * 0.41, -0.486, 0.51),
            (0.10, 0.028, 0.045),
            shell_light,
            bevel=0.02,
        ), "face-highlight")
        _role(_box(
            f"ShadowSlimeFaceGlint{direction}",
            (direction * 0.22, -0.528, 0.77),
            (0.032, 0.015, 0.055),
            _material(
                "ShadowEyeGlint",
                (0.82, 1.0, 1.0, 1.0),
                emission=1.4,
            ),
            bevel=0.01,
        ), "eye")
    _role(_box(
        "ShadowSlimeMouth",
        (0.0, -0.50, 0.47),
        (0.075, 0.03, 0.035),
        shell_dark,
        bevel=0.018,
    ), "mouth")
    floating = []
    for index, (x, y, z, size) in enumerate((
        (-0.88, 0.02, 0.82, 0.10),
        (-0.76, 0.00, 0.40, 0.075),
        (-0.66, 0.03, 1.18, 0.065),
        (0.87, 0.02, 0.78, 0.105),
        (0.72, 0.01, 0.32, 0.070),
        (0.68, 0.03, 1.20, 0.060),
    )):
        floating.append(_role(_box(
            f"ShadowSlimeFloatingCube{index}",
            (x, y, z),
            (size, size * 0.82, size),
            shell_light,
            bevel=0.025,
            rotation=(0.0, index * 0.31, index * 0.17),
        ), "floating-cube"))
    _finish_detail_contract(asset_id)
    for frame in range(1, frames + 1):
        phase = (frame - 1) / frames * math.tau
        jump = max(0.0, math.sin(phase))
        root.location.z = 0.04 + 0.13 * jump
        body.scale = (
            1.0 + 0.055 * math.sin(phase),
            1.0 + 0.035 * math.sin(phase),
            1.0 - 0.10 * math.sin(phase),
        )
        core.scale = (0.98, 0.98, 0.96 + 0.08 * jump)
        _keyframe(root, frame, location=True)
        _keyframe(body, frame, scale=True)
        _keyframe(core, frame, scale=True)
        for index, part in enumerate(top_parts):
            part.location.z += 0.018 * math.sin(phase + index * 0.45)
            part.rotation_euler.y = 0.08 * math.sin(phase + index * 0.55)
            _keyframe(part, frame, location=True, rotation=True)
        for index, cube in enumerate(floating):
            cube.location.z += 0.025 * math.sin(phase + index * 0.73)
            cube.rotation_euler.y += 0.11
            _keyframe(cube, frame, location=True, rotation=True)
    _end_asset()


def _build_vampire_bat(frames: int) -> None:
    asset_id = "vampire-bat-fly"
    root = _begin_asset(
        asset_id,
        "motion",
        frames,
        ortho_scale=3.65,
        target_z=1.02,
    )
    bat = _material("BatFur", (0.15, 0.045, 0.18, 1.0), roughness=0.78)
    bat_light = _material(
        "BatFurLight",
        (0.29, 0.09, 0.30, 1.0),
        roughness=0.72,
    )
    wing = _material("BatWingFrame", (0.11, 0.025, 0.15, 1.0))
    inner = _material(
        "BatWingMembrane",
        (0.43, 0.13, 0.32, 0.96),
        roughness=0.62,
    )
    inner_light = _material(
        "BatWingMembraneLight",
        (0.63, 0.22, 0.39, 0.92),
        roughness=0.54,
    )
    glow = _material("BatGlow", (0.96, 0.35, 1.0, 1.0), emission=3.0)
    fang = _material("BatFang", (0.94, 0.91, 0.81, 1.0))
    mouth = _material("BatMouth", (0.19, 0.02, 0.08, 1.0))
    _role(_box(
        "BatHead",
        (0.0, 0.0, 1.09),
        (0.43, 0.33, 0.38),
        bat,
        bevel=0.10,
    ), "head")
    for direction in (-1, 1):
        _role(_box(
            f"BatCheek{direction}",
            (direction * 0.28, -0.12, 0.99),
            (0.19, 0.25, 0.23),
            bat_light,
            bevel=0.075,
        ), "head")
    _role(_box(
        "BatBody",
        (0.0, 0.08, 0.56),
        (0.24, 0.23, 0.35),
        bat,
        bevel=0.08,
    ), "body")
    _role(_triangle_prism(
        "BatChestTuft",
        ((-0.22, 0.70), (0.22, 0.70), (0.0, 0.40)),
        -0.18,
        0.10,
        bat_light,
    ), "body")
    for direction in (-1, 1):
        _role(_triangle_prism(
            f"BatEar{direction}",
            (
                (direction * 0.11, 1.35),
                (direction * 0.34, 1.83),
                (direction * 0.45, 1.27),
            ),
            -0.06,
            0.16,
            bat,
        ), "outer-ear")
        _role(_triangle_prism(
            f"BatInnerEar{direction}",
            (
                (direction * 0.18, 1.39),
                (direction * 0.33, 1.68),
                (direction * 0.38, 1.35),
            ),
            -0.155,
            0.055,
            inner_light,
        ), "inner-ear")
        wing_group = "wing-left" if direction < 0 else "wing-right"
        membranes = (
            (
                (direction * 0.25, 1.12),
                (direction * 0.82, 1.47),
                (direction * 0.73, 0.94),
                (direction * 0.43, 0.73),
            ),
            (
                (direction * 0.43, 0.98),
                (direction * 1.32, 1.25),
                (direction * 1.12, 0.69),
                (direction * 0.67, 0.49),
            ),
            (
                (direction * 0.67, 0.77),
                (direction * 1.58, 0.74),
                (direction * 1.03, 0.29),
                (direction * 0.85, 0.42),
            ),
        )
        for index, points in enumerate(membranes):
            _motion_group(_role(_polygon_prism(
                f"BatWingMembrane{direction}_{index}",
                points,
                0.02,
                0.10,
                inner_light if index == 0 else inner,
            ), "wing-membrane"), wing_group)
        frame_segments = (
            ((direction * 0.23, 1.14), (direction * 0.86, 1.46)),
            ((direction * 0.25, 1.10), (direction * 1.34, 1.23)),
            ((direction * 0.30, 1.02), (direction * 1.58, 0.74)),
            ((direction * 0.28, 0.96), (direction * 1.03, 0.29)),
        )
        for index, (start, end) in enumerate(frame_segments):
            x = (start[0] + end[0]) / 2
            z = (start[1] + end[1]) / 2
            length = math.dist(start, end)
            angle = math.atan2(end[0] - start[0], end[1] - start[1])
            _motion_group(_role(_box(
                f"BatWingFrame{direction}_{index}",
                (x, -0.045, z),
                (0.045, 0.07, length / 2),
                wing,
                bevel=0.018,
                rotation=(0.0, angle, 0.0),
            ), "wing-frame"), wing_group)
        _role(_box(
            f"BatEye{direction}",
            (direction * 0.17, -0.34, 1.17),
            (0.10, 0.035, 0.115),
            glow,
            bevel=0.025,
        ), "eye")
        _role(_box(
            f"BatMuzzle{direction}",
            (direction * 0.09, -0.365, 0.95),
            (0.12, 0.055, 0.095),
            bat_light,
            bevel=0.045,
        ), "muzzle")
        _role(_cone(
            f"BatFang{direction}",
            (direction * 0.095, -0.42, 0.84),
            0.050,
            0.0,
            0.17,
            fang,
            vertices=8,
            rotation=(math.pi, 0.0, 0.0),
        ), "fang")
        for claw_index, x_offset in enumerate((0.17, 0.26, 0.35)):
            _role(_cone(
                f"BatClaw{direction}_{claw_index}",
                (direction * x_offset, -0.05, 0.22),
                0.035,
                0.0,
                0.11,
                fang,
                vertices=6,
                rotation=(math.pi, 0.0, 0.0),
            ), "claw")
    _role(_box(
        "BatNose",
        (0.0, -0.405, 1.00),
        (0.07, 0.038, 0.055),
        mouth,
        bevel=0.025,
        rotation=(0.0, math.pi / 4, 0.0),
    ), "muzzle")
    _role(_box(
        "BatSmile",
        (0.0, -0.402, 0.87),
        (0.10, 0.025, 0.025),
        mouth,
        bevel=0.012,
    ), "muzzle")
    wing_parts = [
        obj
        for obj in _ACTIVE_COLLECTION.objects
        if str(obj.get("nightmare_motion_group", "")).startswith("wing-")
    ]
    _finish_detail_contract(asset_id)
    for frame in range(1, frames + 1):
        phase = (frame - 1) / frames * math.tau
        root.location.z = 0.16 + 0.08 * math.sin(phase)
        _keyframe(root, frame, location=True)
        for obj in wing_parts:
            direction = -1 if obj.get("nightmare_motion_group") == "wing-left" else 1
            flap = 0.74 + 0.26 * (0.5 + 0.5 * math.cos(phase))
            obj.scale.z = flap
            obj.scale.x = 0.90 + 0.10 * flap
            obj.rotation_euler.y += direction * 0.06 * math.sin(phase)
            _keyframe(obj, frame, rotation=True, scale=True)
    _end_asset()


def _build_skeleton_knight(frames: int) -> None:
    asset_id = "skeleton-knight-walk"
    root = _begin_asset(
        asset_id,
        "motion",
        frames,
        ortho_scale=3.85,
        target_z=1.00,
    )
    bone = _material("Bone", (0.80, 0.76, 0.64, 1.0), roughness=0.82)
    bone_light = _material(
        "BoneLight",
        (0.94, 0.89, 0.75, 1.0),
        roughness=0.76,
    )
    socket = _material("Socket", (0.055, 0.035, 0.075, 1.0))
    dark = _material("Shield", (0.10, 0.08, 0.14, 1.0), roughness=0.56)
    rim = _material("ShieldRimMetal", (0.29, 0.29, 0.33, 1.0), roughness=0.38)
    glow = _material("SkeletonGlow", (0.73, 0.23, 1.0, 1.0), emission=2.8)
    metal = _material("Metal", (0.46, 0.48, 0.55, 1.0), roughness=0.34)
    metal_light = _material(
        "MetalEdge",
        (0.76, 0.77, 0.80, 1.0),
        roughness=0.28,
    )
    scarf = _material("SkeletonScarf", (0.24, 0.08, 0.31, 1.0))
    _role(_box(
        "SkeletonCranium",
        (0.0, 0.02, 1.59),
        (0.42, 0.32, 0.35),
        bone,
        bevel=0.085,
    ), "skull")
    for direction in (-1, 1):
        _role(_box(
            f"SkeletonTemple{direction}",
            (direction * 0.31, -0.01, 1.50),
            (0.14, 0.28, 0.23),
            bone,
            bevel=0.055,
        ), "skull")
        _role(_box(
            f"SkeletonBrow{direction}",
            (direction * 0.16, -0.325, 1.73),
            (0.17, 0.045, 0.065),
            bone_light,
            bevel=0.025,
            rotation=(0.0, direction * -0.12, 0.0),
        ), "skull")
        _role(_box(
            f"SkeletonCheek{direction}",
            (direction * 0.25, -0.31, 1.42),
            (0.11, 0.05, 0.13),
            bone_light,
            bevel=0.03,
            rotation=(0.0, direction * 0.20, 0.0),
        ), "skull")
        _role(_box(
            f"SkeletonSocket{direction}",
            (direction * 0.16, -0.34, 1.62),
            (0.12, 0.035, 0.11),
            socket,
            bevel=0.035,
        ), "eye-socket")
        _role(_box(
            f"SkeletonEye{direction}",
            (direction * 0.16, -0.378, 1.62),
            (0.052, 0.018, 0.055),
            glow,
            bevel=0.014,
        ), "eye")
    _role(_box(
        "SkeletonNose",
        (0.0, -0.36, 1.49),
        (0.055, 0.03, 0.075),
        socket,
        bevel=0.018,
        rotation=(0.0, math.pi / 4, 0.0),
    ), "skull")
    _role(_box(
        "SkeletonJaw",
        (0.0, 0.00, 1.30),
        (0.28, 0.25, 0.14),
        bone,
        bevel=0.04,
    ), "skull")
    for index in range(6):
        _role(_box(
            f"SkeletonTooth{index}",
            ((index - 2.5) * 0.075, -0.275, 1.31),
            (0.030, 0.022, 0.065),
            bone_light,
            bevel=0.008,
        ), "tooth")
    _role(_box(
        "SkeletonHelmetRidge",
        (0.0, 0.01, 1.96),
        (0.10, 0.20, 0.20),
        metal,
        bevel=0.035,
    ), "skull")
    for direction in (-1, 1):
        _role(_box(
            f"SkeletonHelmetSide{direction}",
            (direction * 0.30, 0.04, 1.80),
            (0.10, 0.23, 0.13),
            metal,
            bevel=0.035,
        ), "skull")
    _role(_box(
        "SkeletonScarf",
        (0.0, 0.00, 1.16),
        (0.37, 0.24, 0.09),
        scarf,
        bevel=0.04,
    ), "rib")
    for index in range(6):
        z = 1.04 - index * 0.105
        width = 0.31 - index * 0.022
        _role(_box(
            f"SkeletonRib{index}",
            (0.0, 0.0, z),
            (width, 0.10, 0.030),
            bone,
            bevel=0.012,
        ), "rib")
    _role(_box(
        "SkeletonSpine",
        (0.0, 0.05, 0.89),
        (0.05, 0.08, 0.38),
        bone,
        bevel=0.015,
    ), "rib")
    _role(_box(
        "SkeletonPelvis",
        (0.0, 0.04, 0.55),
        (0.28, 0.15, 0.10),
        bone,
        bevel=0.03,
    ), "rib")
    limbs = []
    for direction in (-1, 1):
        group = "limb-left" if direction < 0 else "limb-right"
        for index, (x, z, length, angle) in enumerate((
            (0.41, 0.99, 0.23, -0.10),
            (0.47, 0.68, 0.20, 0.14),
            (0.16, 0.40, 0.20, -0.04),
            (0.17, 0.16, 0.18, 0.07),
        )):
            part = _motion_group(_role(_box(
                f"SkeletonLimb{direction}_{index}",
                (direction * x, 0.04, z),
                (0.060 if index < 2 else 0.075, 0.075, length),
                bone,
                bevel=0.022,
                rotation=(0.0, direction * angle, 0.0),
            ), "limb"), group)
            limbs.append(part)
        for index, (x, z) in enumerate(((0.43, 0.83), (0.17, 0.29))):
            _motion_group(_role(_sphere(
                f"SkeletonJoint{direction}_{index}",
                (direction * x, 0.02, z),
                (0.09, 0.08, 0.09),
                bone_light,
            ), "limb"), group)
        _motion_group(_role(_box(
            f"SkeletonFoot{direction}",
            (direction * 0.18, -0.05, 0.055),
            (0.13, 0.19, 0.065),
            bone,
            bevel=0.025,
        ), "limb"), group)
    _role(_cylinder(
        "SkeletonShieldRim",
        (-0.59, -0.34, 0.91),
        (0.47, 0.47, 0.075),
        rim,
        rotation=(math.pi / 2, 0.0, 0.0),
        vertices=24,
    ), "shield-rim")
    _role(_cylinder(
        "SkeletonShieldPlate",
        (-0.59, -0.385, 0.91),
        (0.39, 0.39, 0.060),
        dark,
        rotation=(math.pi / 2, 0.0, 0.0),
        vertices=24,
    ), "shield-rim")
    for index in range(8):
        angle = index / 8 * math.tau
        _role(_sphere(
            f"SkeletonShieldBolt{index}",
            (
                -0.59 + math.cos(angle) * 0.38,
                -0.455,
                0.91 + math.sin(angle) * 0.38,
            ),
            (0.035, 0.025, 0.035),
            metal_light,
        ), "shield-rim")
    _role(_box(
        "SkeletonShieldGem",
        (-0.59, -0.47, 0.91),
        (0.115, 0.030, 0.115),
        glow,
        bevel=0.025,
        rotation=(0.0, math.pi / 4, 0.0),
    ), "shield-gem")
    _role(_box(
        "SkeletonSwordBlade",
        (0.63, -0.02, 1.00),
        (0.075, 0.060, 0.46),
        metal,
        bevel=0.025,
        rotation=(0.0, -0.24, 0.0),
    ), "sword-blade")
    _role(_box(
        "SkeletonSwordEdge",
        (0.69, -0.085, 1.02),
        (0.020, 0.018, 0.43),
        metal_light,
        bevel=0.006,
        rotation=(0.0, -0.24, 0.0),
    ), "sword-blade")
    for direction in (-1, 1):
        _role(_box(
            f"SkeletonSwordGuard{direction}",
            (0.48 + direction * 0.15, -0.02, 0.57),
            (0.15, 0.07, 0.045),
            rim,
            bevel=0.018,
            rotation=(0.0, -0.24, direction * 0.08),
        ), "sword-hilt")
    _role(_box(
        "SkeletonSwordGrip",
        (0.43, -0.02, 0.43),
        (0.055, 0.060, 0.16),
        scarf,
        bevel=0.018,
        rotation=(0.0, -0.24, 0.0),
    ), "sword-hilt")
    _role(_sphere(
        "SkeletonSwordPommel",
        (0.39, -0.02, 0.26),
        (0.085, 0.075, 0.085),
        glow,
    ), "sword-hilt")
    _finish_detail_contract(asset_id)
    for frame in range(1, frames + 1):
        phase = (frame - 1) / frames * math.tau
        root.location.z = 0.035 + 0.045 * abs(math.sin(phase))
        _keyframe(root, frame, location=True)
        for obj in limbs:
            direction = -1 if obj.get("nightmare_motion_group") == "limb-left" else 1
            obj.rotation_euler.y += direction * 0.14 * math.sin(phase)
            _keyframe(obj, frame, rotation=True)
    _end_asset()


def _build_obsidian_golem(frames: int) -> None:
    asset_id = "obsidian-golem-walk"
    root = _begin_asset(
        asset_id,
        "motion",
        frames,
        ortho_scale=4.45,
        target_z=1.08,
    )
    obsidian = _material("Obsidian", (0.022, 0.016, 0.036, 1.0), roughness=0.44)
    obsidian_mid = _material(
        "ObsidianMid",
        (0.055, 0.038, 0.073, 1.0),
        roughness=0.40,
    )
    obsidian_light = _material(
        "ObsidianLight",
        (0.095, 0.064, 0.12, 1.0),
        roughness=0.37,
    )
    lava = _material(
        "Lava",
        (0.88, 0.10, 0.008, 1.0),
        emission=2.2,
        roughness=0.34,
    )
    lava_hot = _material(
        "LavaHot",
        (1.0, 0.30, 0.015, 1.0),
        emission=2.7,
        roughness=0.26,
    )
    _role(_box(
        "GolemTorsoCore",
        (0.0, 0.08, 1.06),
        (0.60, 0.40, 0.64),
        obsidian,
        bevel=0.09,
    ), "torso-plate")
    for index, (x, z, sx, sz, rot) in enumerate((
        (-0.33, 1.38, 0.31, 0.32, -0.10),
        (0.30, 1.38, 0.29, 0.32, 0.12),
        (-0.31, 0.96, 0.30, 0.27, 0.08),
        (0.29, 0.94, 0.28, 0.27, -0.08),
        (0.00, 0.62, 0.34, 0.20, 0.00),
    )):
        _role(_box(
            f"GolemTorsoPlate{index}",
            (x, -0.33, z),
            (sx, 0.16, sz),
            obsidian_mid if index % 2 == 0 else obsidian_light,
            bevel=0.065,
            rotation=(0.0, rot, 0.0),
        ), "torso-plate")
    _role(_box(
        "GolemHeadCore",
        (0.0, -0.01, 1.92),
        (0.43, 0.36, 0.35),
        obsidian,
        bevel=0.08,
    ), "head-plate")
    for index, (x, z, sx, sz, rot) in enumerate((
        (-0.25, 2.13, 0.23, 0.13, -0.10),
        (0.23, 2.13, 0.22, 0.13, 0.12),
        (-0.28, 1.88, 0.20, 0.20, 0.08),
        (0.27, 1.87, 0.19, 0.19, -0.08),
        (0.00, 1.70, 0.26, 0.10, 0.00),
    )):
        _role(_box(
            f"GolemHeadPlate{index}",
            (x, -0.32, z),
            (sx, 0.13, sz),
            obsidian_mid if index < 2 else obsidian_light,
            bevel=0.045,
            rotation=(0.0, rot, 0.0),
        ), "head-plate")
    for direction in (-1, 1):
        _role(_box(
            f"GolemBrow{direction}",
            (direction * 0.17, -0.405, 2.04),
            (0.17, 0.045, 0.065),
            obsidian_light,
            bevel=0.022,
            rotation=(0.0, direction * -0.14, 0.0),
        ), "head-plate")
        _role(_box(
            f"GolemEye{direction}",
            (direction * 0.16, -0.445, 1.96),
            (0.085, 0.025, 0.070),
            lava_hot,
            bevel=0.02,
        ), "eye")
    _role(_box(
        "GolemJaw",
        (0.0, -0.40, 1.70),
        (0.25, 0.055, 0.08),
        obsidian_light,
        bevel=0.025,
    ), "head-plate")
    limbs = []
    for direction in (-1, 1):
        group = "golem-left" if direction < 0 else "golem-right"
        shoulder = _motion_group(_role(_box(
            f"GolemShoulder{direction}",
            (direction * 0.78, 0.05, 1.43),
            (0.32, 0.34, 0.34),
            obsidian_light,
            bevel=0.075,
        ), "shoulder-plate"), group)
        upper = _motion_group(_role(_box(
            f"GolemUpperArm{direction}",
            (direction * 0.88, 0.04, 1.03),
            (0.25, 0.29, 0.33),
            obsidian_mid,
            bevel=0.065,
        ), "shoulder-plate"), group)
        forearm = _motion_group(_role(_box(
            f"GolemForearm{direction}",
            (direction * 0.98, -0.02, 0.65),
            (0.29, 0.31, 0.31),
            obsidian,
            bevel=0.075,
        ), "fist"), group)
        fist = _motion_group(_role(_box(
            f"GolemFist{direction}",
            (direction * 1.01, -0.10, 0.35),
            (0.34, 0.34, 0.26),
            obsidian_light,
            bevel=0.085,
        ), "fist"), group)
        leg = _motion_group(_role(_box(
            f"GolemLeg{direction}",
            (direction * 0.31, 0.05, 0.36),
            (0.27, 0.32, 0.31),
            obsidian_mid,
            bevel=0.065,
        ), "foot"), group)
        foot = _motion_group(_role(_box(
            f"GolemFoot{direction}",
            (direction * 0.34, -0.08, 0.09),
            (0.34, 0.41, 0.12),
            obsidian_light,
            bevel=0.055,
        ), "foot"), group)
        limbs.extend((shoulder, upper, forearm, fist, leg, foot))
    _role(_box(
        "GolemCoreFrame",
        (0.0, -0.50, 1.02),
        (0.20, 0.038, 0.20),
        obsidian_light,
        bevel=0.035,
        rotation=(0.0, math.pi / 4, 0.0),
    ), "core")
    _role(_box(
        "GolemCore",
        (0.0, -0.545, 1.02),
        (0.115, 0.022, 0.115),
        lava_hot,
        bevel=0.025,
        rotation=(0.0, math.pi / 4, 0.0),
    ), "core")
    for index, (x, z, rotation, length) in enumerate((
        (-0.27, 1.49, -0.42, 0.20),
        (-0.15, 1.26, 0.32, 0.15),
        (0.25, 1.40, 0.40, 0.17),
        (0.18, 1.18, -0.30, 0.14),
        (-0.35, 0.92, 0.24, 0.17),
        (0.31, 0.78, -0.36, 0.16),
        (-0.83, 1.47, -0.18, 0.14),
        (-0.91, 1.21, 0.28, 0.15),
        (0.82, 1.45, 0.24, 0.14),
        (0.93, 0.83, -0.30, 0.15),
        (-0.96, 0.55, 0.32, 0.13),
        (0.97, 0.45, -0.20, 0.12),
    )):
        _role(_box(
            f"GolemCrack{index}",
            (x, -0.455, z),
            (0.030, 0.020, length),
            lava_hot if index < 6 else lava,
            bevel=0.012,
            rotation=(0.0, rotation, 0.0),
        ), "lava-crack")
    _finish_detail_contract(asset_id)
    for frame in range(1, frames + 1):
        phase = (frame - 1) / frames * math.tau
        root.location.z = 0.025 + 0.025 * abs(math.sin(phase))
        _keyframe(root, frame, location=True)
        for obj in limbs:
            direction = -1 if obj.get("nightmare_motion_group") == "golem-left" else 1
            obj.rotation_euler.y += direction * 0.075 * math.sin(phase)
            _keyframe(obj, frame, rotation=True)
    _end_asset()


def _build_lich_king(frames: int) -> None:
    asset_id = "lich-king-float"
    root = _begin_asset(
        asset_id,
        "motion",
        frames,
        ortho_scale=4.05,
        target_z=1.20,
    )
    bone = _material("LichBone", (0.78, 0.73, 0.62, 1.0), roughness=0.82)
    bone_light = _material(
        "LichBoneLight",
        (0.93, 0.88, 0.73, 1.0),
        roughness=0.74,
    )
    socket = _material("LichSocket", (0.045, 0.02, 0.065, 1.0))
    lich = _material("LichRobe", (0.20, 0.045, 0.31, 1.0), roughness=0.66)
    lich_light = _material(
        "LichRobeLight",
        (0.39, 0.10, 0.55, 1.0),
        roughness=0.58,
    )
    crown = _material(
        "LichCrownMetal",
        (0.12, 0.045, 0.18, 1.0),
        roughness=0.34,
    )
    gold = _material("LichTrim", (0.48, 0.31, 0.12, 1.0), roughness=0.38)
    glow = _material(
        "LichGlow",
        (0.46, 0.035, 0.84, 1.0),
        emission=2.1,
    )
    glow_light = _material(
        "LichGlowLight",
        (0.70, 0.15, 1.0, 0.88),
        emission=2.4,
    )
    _role(_box(
        "LichCranium",
        (0.0, 0.0, 1.67),
        (0.47, 0.36, 0.39),
        bone,
        bevel=0.085,
    ), "skull")
    for direction in (-1, 1):
        _role(_box(
            f"LichTemple{direction}",
            (direction * 0.33, 0.0, 1.59),
            (0.14, 0.29, 0.24),
            bone,
            bevel=0.055,
        ), "skull")
        _role(_box(
            f"LichBrow{direction}",
            (direction * 0.17, -0.36, 1.81),
            (0.18, 0.04, 0.07),
            bone_light,
            bevel=0.025,
            rotation=(0.0, direction * -0.14, 0.0),
        ), "skull")
        _role(_box(
            f"LichCheek{direction}",
            (direction * 0.27, -0.34, 1.50),
            (0.11, 0.045, 0.13),
            bone_light,
            bevel=0.03,
            rotation=(0.0, direction * 0.22, 0.0),
        ), "skull")
        _role(_box(
            f"LichSocket{direction}",
            (direction * 0.17, -0.38, 1.69),
            (0.13, 0.032, 0.12),
            socket,
            bevel=0.035,
        ), "eye-socket")
        _role(_box(
            f"LichEye{direction}",
            (direction * 0.17, -0.416, 1.69),
            (0.060, 0.015, 0.062),
            glow,
            bevel=0.015,
            rotation=(0.0, direction * -0.12, 0.0),
        ), "eye")
    _role(_box(
        "LichNose",
        (0.0, -0.395, 1.56),
        (0.055, 0.025, 0.075),
        socket,
        bevel=0.018,
        rotation=(0.0, math.pi / 4, 0.0),
    ), "skull")
    _role(_box(
        "LichJaw",
        (0.0, 0.0, 1.37),
        (0.29, 0.27, 0.14),
        bone,
        bevel=0.04,
    ), "skull")
    for index in range(6):
        _role(_box(
            f"LichTooth{index}",
            ((index - 2.5) * 0.078, -0.30, 1.37),
            (0.032, 0.020, 0.070),
            bone_light,
            bevel=0.008,
        ), "tooth")
    _role(_box(
        "LichHoodBack",
        (0.0, 0.16, 1.60),
        (0.60, 0.31, 0.54),
        lich,
        bevel=0.10,
    ), "hood")
    _role(_box(
        "LichHighCollar",
        (0.0, -0.01, 1.25),
        (0.62, 0.28, 0.12),
        lich_light,
        bevel=0.045,
    ), "hood")
    for direction in (-1, 1):
        _role(_box(
            f"LichPauldron{direction}",
            (direction * 0.58, 0.02, 1.18),
            (0.29, 0.30, 0.17),
            crown,
            bevel=0.065,
            rotation=(0.0, direction * 0.16, 0.0),
        ), "pauldron")
        _role(_box(
            f"LichPauldronGem{direction}",
            (direction * 0.59, -0.30, 1.20),
            (0.07, 0.025, 0.07),
            glow,
            bevel=0.018,
            rotation=(0.0, math.pi / 4, 0.0),
        ), "pauldron")
    _role(_box(
        "LichCrownBase",
        (0.0, 0.02, 2.03),
        (0.49, 0.31, 0.12),
        crown,
        bevel=0.045,
    ), "crown-spire")
    crown_spires = []
    for index, (x, height, size) in enumerate((
        (-0.43, 0.40, 0.11),
        (-0.29, 0.53, 0.12),
        (-0.15, 0.45, 0.11),
        (0.00, 0.70, 0.15),
        (0.15, 0.45, 0.11),
        (0.29, 0.53, 0.12),
        (0.43, 0.40, 0.11),
    )):
        crown_spires.append(_motion_group(_role(_cone(
            f"LichCrownSpire{index}",
            (x, 0.02, 2.17 + height / 2),
            size,
            0.0,
            height,
            crown,
            vertices=4,
        ), "crown-spire"), "crown"))
    for index, x in enumerate((-0.28, 0.0, 0.28)):
        _role(_box(
            f"LichCrownGem{index}",
            (x, -0.31, 2.13 + (0.15 if index == 1 else 0.02)),
            (0.095 if index == 1 else 0.060, 0.025, 0.14 if index == 1 else 0.080),
            glow,
            bevel=0.018,
            rotation=(0.0, math.pi / 4, 0.0),
        ), "crown-gem")
    _role(_cone(
        "LichRobeCore",
        (0.0, 0.08, 0.78),
        0.57,
        0.34,
        0.90,
        lich,
        vertices=8,
    ), "robe-strip")
    _role(_box(
        "LichBelt",
        (0.0, -0.31, 0.91),
        (0.46, 0.06, 0.08),
        gold,
        bevel=0.025,
    ), "robe-strip")
    robe_strips = []
    for index, (x, z, length) in enumerate((
        (-0.42, 0.45, 0.40),
        (-0.22, 0.36, 0.49),
        (0.00, 0.31, 0.55),
        (0.22, 0.36, 0.49),
        (0.42, 0.45, 0.40),
    )):
        robe_strips.append(_motion_group(_role(_triangle_prism(
            f"LichRobeStrip{index}",
            (
                (x - 0.12, 0.78),
                (x + 0.12, 0.78),
                (x + (0.04 if x < 0 else -0.04), z - length),
            ),
            -0.22,
            0.11,
            lich_light if index % 2 == 0 else lich,
        ), "robe-strip"), "robe"))
    _role(_box(
        "LichChestGemFrame",
        (0.0, -0.35, 1.07),
        (0.17, 0.030, 0.17),
        gold,
        bevel=0.025,
        rotation=(0.0, math.pi / 4, 0.0),
    ), "crown-gem")
    _role(_box(
        "LichChestGem",
        (0.0, -0.39, 1.07),
        (0.105, 0.018, 0.105),
        glow,
        bevel=0.018,
        rotation=(0.0, math.pi / 4, 0.0),
    ), "crown-gem")
    hands = []
    for direction in (-1, 1):
        group = "hand-left" if direction < 0 else "hand-right"
        hand = _motion_group(_role(_box(
            f"LichPalm{direction}",
            (direction * 0.74, -0.03, 1.04),
            (0.14, 0.13, 0.15),
            bone,
            bevel=0.055,
        ), "hand"), group)
        hands.append(hand)
        for finger_index, (x_offset, z_offset, angle) in enumerate((
            (0.00, 0.18, -0.12),
            (0.10, 0.12, -0.28),
            (0.14, 0.00, -0.44),
            (0.10, -0.11, -0.58),
        )):
            finger = _motion_group(_role(_box(
                f"LichFinger{direction}_{finger_index}",
                (
                    direction * (0.75 + x_offset),
                    -0.03,
                    1.04 + z_offset,
                ),
                (0.040, 0.045, 0.12),
                bone_light,
                bevel=0.016,
                rotation=(0.0, direction * angle, 0.0),
            ), "finger"), group)
            hands.append(finger)
    soul_flames = []
    for direction in (-1, 1):
        group = "soul-left" if direction < 0 else "soul-right"
        for index, (z, size) in enumerate(((1.17, 0.14), (1.39, 0.11), (1.56, 0.075))):
            soul_flames.append(_motion_group(_role(_box(
                f"LichSoulFlame{direction}_{index}",
                (direction * 0.98, 0.04, z),
                (size, size * 0.70, size),
                glow_light if index == 0 else glow,
                bevel=0.035,
                rotation=(0.0, math.pi / 4, index * 0.20),
            ), "soul-flame"), group))
    _finish_detail_contract(asset_id)
    for frame in range(1, frames + 1):
        phase = (frame - 1) / frames * math.tau
        root.location.z = 0.20 + 0.09 * math.sin(phase)
        _keyframe(root, frame, location=True, rotation=True)
        for hand in hands:
            direction = -1 if hand.get("nightmare_motion_group") == "hand-left" else 1
            hand.location.z += 0.025 * math.sin(phase + direction * 0.8)
            _keyframe(hand, frame, location=True)
        for index, strip in enumerate(robe_strips):
            strip.rotation_euler.y = 0.04 * math.sin(phase + index * 0.45)
            _keyframe(strip, frame, rotation=True)
        for index, flame in enumerate(soul_flames):
            flame.location.z += 0.035 * math.sin(phase + index * 0.65)
            flame.scale = (1.0, 1.0, 0.88 + 0.18 * (0.5 + 0.5 * math.sin(phase + index)))
            _keyframe(flame, frame, location=True, scale=True)
        for index, spire in enumerate(crown_spires):
            spire.location.z += 0.010 * math.sin(phase + index * 0.40)
            _keyframe(spire, frame, location=True)
    _end_asset()


def build_enemy_models() -> None:
    _assert_source_hashes("enemy-build-start")
    _remove_group_assets("motion")
    for asset_id, frames, model_key in MOTION_ASSETS:
        builders: dict[str, Callable[[int], None]] = {
            "shadow_slime": _build_shadow_slime,
            "vampire_bat": _build_vampire_bat,
            "skeleton_knight": _build_skeleton_knight,
            "obsidian_golem": _build_obsidian_golem,
            "lich_king": _build_lich_king,
        }
        builders[model_key](frames)
        print(f"NIGHTMARE_ENEMY_BUILT {asset_id}", flush=True)
    _require_scene().frame_set(1)
    _assert_source_hashes("enemy-build-end")
    print("NIGHTMARE_ENEMIES_BUILT", flush=True)


def _animate_root_pulse(
    root: bpy.types.Object,
    frames: int,
    *,
    minimum: float,
    maximum: float,
    rotate: float = 0.0,
) -> None:
    for frame in range(1, frames + 1):
        phase = (frame - 1) / max(1, frames - 1)
        pulse = math.sin(phase * math.pi)
        scale = minimum + (maximum - minimum) * pulse
        root.scale = (scale, scale, scale)
        root.rotation_euler.z = FRONT_YAW + rotate * phase
        _keyframe(root, frame, rotation=True, scale=True)


def _build_shield_vfx(asset_id: str, frames: int) -> None:
    root = _begin_asset(
        asset_id,
        "vfx",
        frames,
        ortho_scale=3.3,
        target_z=0.88,
    )
    shield = _material(
        "SpectralShield",
        (0.30, 0.46, 0.98, 0.46),
        emission=1.4,
        roughness=0.30,
    )
    rim = _material(
        "SpectralShieldRim",
        (0.70, 0.82, 1.0, 0.88),
        emission=2.2,
        roughness=0.28,
    )
    points = (
        (-0.48, 1.35),
        (0.0, 1.58),
        (0.48, 1.35),
    )
    _triangle_prism("ShieldUpper", points, -0.02, 0.10, shield)
    _triangle_prism(
        "ShieldLower",
        ((-0.48, 1.35), (0.48, 1.35), (0.0, 0.38)),
        -0.02,
        0.10,
        shield,
    )
    for index, (a, b) in enumerate((
        ((-0.48, 1.35), (0.0, 1.58)),
        ((0.0, 1.58), (0.48, 1.35)),
        ((0.48, 1.35), (0.0, 0.38)),
        ((0.0, 0.38), (-0.48, 1.35)),
    )):
        midpoint = ((a[0] + b[0]) / 2, -0.09, (a[1] + b[1]) / 2)
        length = math.dist(a, b)
        angle = math.atan2(b[0] - a[0], b[1] - a[1])
        _box(
            f"ShieldRim{index}",
            midpoint,
            (0.035, 0.03, length / 2),
            rim,
            bevel=0.015,
            rotation=(0.0, angle, 0.0),
        )
    if asset_id == "shield-block":
        for direction in (-1, 1):
            _box(
                f"ShieldBlockFlash{direction}",
                (direction * 0.66, -0.04, 0.97),
                (0.05, 0.04, 0.30),
                rim,
                bevel=0.02,
                rotation=(0.0, direction * 0.52, 0.0),
            )
    _animate_root_pulse(
        root,
        frames,
        minimum=0.28 if asset_id == "shield-open" else 0.88,
        maximum=1.08,
    )
    _end_asset()


def _build_shield_break(frames: int) -> None:
    _begin_asset(
        "shield-break",
        "vfx",
        frames,
        ortho_scale=3.5,
        target_z=0.92,
    )
    material = _material(
        "ShieldShard",
        (0.56, 0.68, 1.0, 0.82),
        emission=2.0,
    )
    shards = []
    for index in range(6):
        angle = index / 6 * math.tau
        shard = _triangle_prism(
            f"ShieldShard{index}",
            ((-0.09, 0.08), (0.09, 0.08), (0.0, 0.38)),
            -0.04,
            0.09,
            material,
        )
        shard.location = (0.0, 0.0, 0.85)
        shard.rotation_euler.y = angle
        shards.append((shard, angle))
    for frame in range(1, frames + 1):
        progress = (frame - 1) / max(1, frames - 1)
        for shard, angle in shards:
            shard.location = (
                math.cos(angle) * 0.85 * progress,
                0.0,
                0.85 + math.sin(angle) * 0.70 * progress,
            )
            shard.rotation_euler.y = angle + progress * 0.8
            _keyframe(shard, frame, location=True, rotation=True)
    _end_asset()


def _build_split_burst(frames: int) -> None:
    root = _begin_asset(
        "split-burst",
        "vfx",
        frames,
        ortho_scale=3.4,
        target_z=0.72,
    )
    purple = _material(
        "SplitPurple",
        (0.38, 0.11, 0.65, 0.88),
        emission=1.8,
    )
    blobs = []
    for direction in (-1, 1):
        blob = _box(
            f"SplitBlob{direction}",
            (0.0, 0.0, 0.66),
            (0.26, 0.20, 0.23),
            purple,
            bevel=0.09,
        )
        blobs.append((blob, direction))
    for index in range(5):
        angle = index / 5 * math.tau
        _box(
            f"SplitSpark{index}",
            (math.cos(angle) * 0.34, 0.0, 0.70 + math.sin(angle) * 0.34),
            (0.05, 0.04, 0.12),
            purple,
            bevel=0.025,
            rotation=(0.0, angle, 0.0),
        )
    for frame in range(1, frames + 1):
        progress = (frame - 1) / max(1, frames - 1)
        root.scale = (0.75 + progress * 0.35,) * 3
        _keyframe(root, frame, scale=True)
        for blob, direction in blobs:
            blob.location.x = direction * (0.12 + 0.62 * progress)
            blob.location.z = 0.66 + 0.12 * math.sin(progress * math.pi)
            _keyframe(blob, frame, location=True)
    _end_asset()


def _build_slow_resist(frames: int) -> None:
    root = _begin_asset(
        "slow-resist",
        "vfx",
        frames,
        ortho_scale=3.8,
        target_z=0.92,
    )
    purple = _material(
        "SlowResistWing",
        (0.52, 0.20, 0.82, 0.82),
        emission=2.1,
    )
    frost = _material(
        "SlowResistFrost",
        (0.28, 0.78, 1.0, 0.88),
        emission=2.4,
    )
    for direction in (-1, 1):
        _triangle_prism(
            f"SlowResistWing{direction}",
            (
                (direction * 0.10, 0.95),
                (direction * 0.82, 1.35),
                (direction * 0.50, 0.46),
            ),
            0.02,
            0.11,
            purple,
        )
    _arc(
        "SlowResistArcA",
        (0.0, -0.06, 0.90),
        0.72,
        math.radians(12),
        math.radians(144),
        frost,
        thickness=0.045,
    )
    _arc(
        "SlowResistArcB",
        (0.0, -0.06, 0.90),
        0.72,
        math.radians(192),
        math.radians(324),
        frost,
        thickness=0.045,
    )
    _animate_root_pulse(root, frames, minimum=0.82, maximum=1.12)
    _end_asset()


def _build_lich_aura(asset_id: str, frames: int) -> None:
    root = _begin_asset(
        asset_id,
        "vfx",
        frames,
        ortho_scale=3.8,
        target_z=0.92,
    )
    glow = _material(
        f"{asset_id}Glow",
        (0.55, 0.13, 0.92, 0.76),
        emission=2.7,
    )
    _arc(
        f"{asset_id}RingA",
        (0.0, 0.0, 0.88),
        0.72,
        0.0,
        math.pi * 0.82,
        glow,
        thickness=0.045,
    )
    _arc(
        f"{asset_id}RingB",
        (0.0, 0.0, 0.88),
        0.72,
        math.pi,
        math.pi * 1.82,
        glow,
        thickness=0.045,
    )
    for index in range(8):
        angle = index / 8 * math.tau
        if asset_id == "lich-phase-two":
            _triangle_prism(
                f"LichPhaseSpike{index}",
                (
                    (-0.07, 0.00),
                    (0.07, 0.00),
                    (0.0, 0.36),
                ),
                -0.02,
                0.08,
                glow,
            ).rotation_euler.y = angle
        else:
            _box(
                f"LichAuraCube{index}",
                (
                    math.cos(angle) * 0.67,
                    0.0,
                    0.88 + math.sin(angle) * 0.67,
                ),
                (0.08, 0.06, 0.08),
                glow,
                bevel=0.025,
                rotation=(0.0, angle, 0.0),
            )
    for frame in range(1, frames + 1):
        progress = (frame - 1) / frames
        root.rotation_euler.z = FRONT_YAW + progress * math.tau
        scale = 0.86 + 0.16 * math.sin(progress * math.pi)
        root.scale = (scale, scale, scale)
        _keyframe(root, frame, rotation=True, scale=True)
    _end_asset()


def _build_elite_rune(frames: int) -> None:
    root = _begin_asset(
        "elite-rune",
        "vfx",
        frames,
        ortho_scale=3.3,
        target_z=0.85,
    )
    elite = _material("EliteRune", COLORS["elite"], emission=2.8)
    for index in range(4):
        angle = index / 4 * math.tau
        _box(
            f"EliteRuneDiamond{index}",
            (
                math.cos(angle) * 0.56,
                0.0,
                0.84 + math.sin(angle) * 0.56,
            ),
            (0.09, 0.05, 0.16),
            elite,
            bevel=0.025,
            rotation=(0.0, math.pi / 4 + angle, 0.0),
        )
    _animate_root_pulse(
        root,
        frames,
        minimum=0.88,
        maximum=1.10,
        rotate=math.pi / 2,
    )
    _end_asset()


def build_trait_vfx() -> None:
    _assert_source_hashes("vfx-build-start")
    _remove_group_assets("vfx")
    for asset_id, frames in VFX_ASSETS:
        if asset_id in {"shield-open", "shield-block"}:
            _build_shield_vfx(asset_id, frames)
        elif asset_id == "shield-break":
            _build_shield_break(frames)
        elif asset_id == "split-burst":
            _build_split_burst(frames)
        elif asset_id == "slow-resist":
            _build_slow_resist(frames)
        elif asset_id in {"lich-aura", "lich-phase-two"}:
            _build_lich_aura(asset_id, frames)
        elif asset_id == "elite-rune":
            _build_elite_rune(frames)
        else:
            raise AssertionError(f"Unknown VFX {asset_id}")
        print(f"NIGHTMARE_VFX_BUILT {asset_id}", flush=True)
    _require_scene().frame_set(1)
    _assert_source_hashes("vfx-build-end")


def _theme_materials(theme: str) -> dict[str, bpy.types.Material]:
    palette = THEME_PALETTES[theme]
    return {
        key: _material(
            f"{theme}_{key}",
            color,
            emission=1.2 if key == "accent" else 0.0,
            roughness=0.76 if key != "accent" else 0.44,
        )
        for key, color in palette.items()
    }


def _tile_base(materials: dict[str, bpy.types.Material]) -> None:
    tile = _box(
        "MapTile",
        (0.0, 0.0, 0.0),
        (0.96, 0.96, 0.12),
        materials["side"],
        bevel=0.08,
    )
    tile.data.materials.append(materials["ground"])
    top = _box(
        "MapTileTop",
        (0.0, 0.0, 0.13),
        (0.91, 0.91, 0.035),
        materials["ground"],
        bevel=0.035,
    )
    top["nightmare_plain_surface"] = True


def _road_arm(
    direction: str,
    materials: dict[str, bpy.types.Material],
) -> None:
    if direction == "west":
        location, scale = (-0.47, 0.0, 0.20), (0.47, 0.31, 0.045)
    elif direction == "east":
        location, scale = (0.47, 0.0, 0.20), (0.47, 0.31, 0.045)
    elif direction == "north":
        location, scale = (0.0, 0.47, 0.20), (0.31, 0.47, 0.045)
    elif direction == "south":
        location, scale = (0.0, -0.47, 0.20), (0.31, 0.47, 0.045)
    else:
        raise AssertionError(direction)
    road = _box(
        f"Road{direction}",
        location,
        scale,
        materials["road"],
        bevel=0.025,
    )
    road["nightmare_plain_surface"] = True


def _build_map_piece(
    theme: str,
    piece: str,
    materials: dict[str, bpy.types.Material],
) -> None:
    asset_id = f"{theme}-{piece}"
    target_z = 0.45 if piece == "snack-chest" else 0.05
    ortho = 3.5 if piece in {"boundary-stone", "snack-chest"} else 3.1
    _begin_asset(
        asset_id,
        "map",
        1,
        ortho_scale=ortho,
        target_z=target_z,
    )
    if _ACTIVE_COLLECTION is None:
        raise AssertionError("Missing map collection")
    _ACTIVE_COLLECTION["nightmare_relative_path"] = f"map/{theme}/{piece}.png"
    if piece == "ground":
        _tile_base(materials)
    elif piece.startswith("road-"):
        _tile_base(materials)
        directions = {
            "road-horizontal": ("west", "east"),
            "road-vertical": ("north", "south"),
            "road-corner-north-east": ("north", "east"),
            "road-corner-east-south": ("east", "south"),
            "road-corner-south-west": ("south", "west"),
            "road-corner-west-north": ("west", "north"),
        }[piece]
        for direction in directions:
            _road_arm(direction, materials)
        _box(
            "RoadCenter",
            (0.0, 0.0, 0.20),
            (0.33, 0.33, 0.045),
            materials["road"],
            bevel=0.03,
        )["nightmare_plain_surface"] = True
    elif piece == "boundary-stone":
        for index, (x, y, z, scale) in enumerate((
            (-0.36, 0.02, 0.24, (0.30, 0.26, 0.24)),
            (0.10, 0.04, 0.34, (0.36, 0.30, 0.34)),
            (0.43, 0.02, 0.19, (0.23, 0.22, 0.19)),
        )):
            _box(
                f"BoundaryStone{index}",
                (x, y, z),
                scale,
                materials["side"],
                bevel=0.10,
                rotation=(0.0, 0.12 * (index - 1), 0.16 * index),
            )
        _box(
            "BoundaryAccent",
            (0.10, -0.28, 0.36),
            (0.055, 0.025, 0.20),
            materials["accent"],
            bevel=0.015,
            rotation=(0.0, -0.34, 0.0),
        )
    elif piece == "snack-chest":
        wood = _material(
            f"{theme}_chest_wood",
            (0.31, 0.14, 0.07, 1.0),
            roughness=0.76,
        )
        gold = _material(
            f"{theme}_chest_gold",
            (0.92, 0.56, 0.08, 1.0),
            emission=0.35,
            roughness=0.43,
        )
        snack = _material(
            f"{theme}_snack",
            (0.93, 0.70, 0.30, 1.0),
            emission=0.20,
        )
        _box(
            "ChestBody",
            (0.0, 0.0, 0.40),
            (0.60, 0.42, 0.35),
            wood,
            bevel=0.07,
        )
        _box(
            "ChestLid",
            (0.0, 0.01, 0.82),
            (0.64, 0.44, 0.14),
            wood,
            bevel=0.08,
        )
        for x in (-0.42, 0.0, 0.42):
            _box(
                f"ChestBand{x}",
                (x, -0.42, 0.53),
                (0.055, 0.035, 0.48),
                gold,
                bevel=0.015,
            )
        _box(
            "ChestLock",
            (0.0, -0.47, 0.53),
            (0.14, 0.04, 0.16),
            gold,
            bevel=0.025,
        )
        for index, x in enumerate((-0.24, 0.0, 0.24)):
            _sphere(
                f"ChestSnack{index}",
                (x, -0.05, 1.05 + 0.06 * (index % 2)),
                (0.12, 0.10, 0.12),
                snack,
            )
    else:
        raise AssertionError(f"Unknown map piece {piece}")
    _end_asset()


def build_map_kit() -> None:
    _assert_source_hashes("map-build-start")
    _remove_group_assets("map")
    for theme in THEME_PALETTES:
        materials = _theme_materials(theme)
        for piece in MAP_PIECES:
            _build_map_piece(theme, piece, materials)
        print(f"NIGHTMARE_MAP_THEME_BUILT {theme}", flush=True)
    _assert_source_hashes("map-build-end")


def _show_only_asset(collection: bpy.types.Collection) -> None:
    for candidate in _owned_asset_collections():
        candidate.hide_render = candidate != collection


def _stitch_frames(
    frame_paths: list[Path],
    output_path: Path,
) -> None:
    if len(frame_paths) == 1:
        shutil.copy2(frame_paths[0], output_path)
        return
    images = [
        bpy.data.images.load(str(frame_path), check_existing=False)
        for frame_path in frame_paths
    ]
    try:
        width = FRAME_SIZE * len(images)
        height = FRAME_SIZE
        pixel_count = width * height * 4
        sheet_pixels = array("f", [0.0]) * pixel_count
        row_size = FRAME_SIZE * 4
        for image_index, image in enumerate(images):
            source = array("f", [0.0]) * (FRAME_SIZE * FRAME_SIZE * 4)
            image.pixels.foreach_get(source)
            for row in range(FRAME_SIZE):
                source_start = row * row_size
                target_start = (row * width + image_index * FRAME_SIZE) * 4
                sheet_pixels[target_start:target_start + row_size] = (
                    source[source_start:source_start + row_size]
                )
        sheet = bpy.data.images.new(
            f"NightmareSheet_{output_path.stem}",
            width=width,
            height=height,
            alpha=True,
        )
        _tag(sheet, "render")
        try:
            sheet.pixels.foreach_set(sheet_pixels)
            sheet.filepath_raw = str(output_path)
            sheet.file_format = "PNG"
            sheet.save()
        finally:
            bpy.data.images.remove(sheet)
    finally:
        for image in images:
            bpy.data.images.remove(image)


def _create_mobile(master_path: Path, mobile_path: Path, frames: int) -> None:
    master = bpy.data.images.load(str(master_path), check_existing=False)
    try:
        mobile = master.copy()
        _tag(mobile, "render")
        try:
            mobile.scale(MOBILE_FRAME_SIZE * frames, MOBILE_FRAME_SIZE)
            mobile.filepath_raw = str(mobile_path)
            mobile.file_format = "PNG"
            mobile.save()
        finally:
            bpy.data.images.remove(mobile)
    finally:
        bpy.data.images.remove(master)


def _render_asset(
    scene: bpy.types.Scene,
    collection: bpy.types.Collection,
) -> None:
    asset_id = str(collection["nightmare_asset_id"])
    frames = int(collection["nightmare_frames"])
    relative_path = Path(str(collection["nightmare_relative_path"]))
    ortho_scale = float(collection["nightmare_ortho_scale"])
    target_z = float(collection["nightmare_target_z"])
    master_path = OUTPUT / "master" / relative_path
    mobile_path = OUTPUT / "mobile" / relative_path
    master_path.parent.mkdir(parents=True, exist_ok=True)
    mobile_path.parent.mkdir(parents=True, exist_ok=True)
    _show_only_asset(collection)
    scene.camera.data.ortho_scale = ortho_scale
    _look_at(scene.camera, (0.0, 0.0, target_z))
    with tempfile.TemporaryDirectory(prefix=f"nightmare-{asset_id}-") as temp:
        frame_paths = []
        for index in range(frames):
            scene.frame_set(index + 1)
            frame_path = Path(temp) / f"frame-{index:02d}.png"
            scene.render.filepath = str(frame_path)
            bpy.ops.render.render(write_still=True, scene=scene.name)
            frame_paths.append(frame_path)
        _stitch_frames(frame_paths, master_path)
    _create_mobile(master_path, mobile_path, frames)
    print(
        f"NIGHTMARE_RENDERED {asset_id} {frames}f "
        f"{master_path.relative_to(REPO)}",
        flush=True,
    )


def render_master_and_mobile() -> None:
    _assert_source_hashes("render-start")
    scene = _require_scene()
    assets = _owned_asset_collections()
    if len(assets) not in {5, 13, 54, 59, 62, 67}:
        raise AssertionError(
            "Expected a supported asset batch of 5, 13, 54, 59, 62, "
            f"or 67 collections, found {len(assets)}"
        )
    for collection in assets:
        _render_asset(scene, collection)
    scene.frame_set(1)
    _assert_source_hashes("render-end")
    print(f"NIGHTMARE_RENDER_COMPLETE {len(assets)}", flush=True)


def _write_collection_blend(
    output_path: Path,
    collections: Iterable[bpy.types.Collection],
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()
    datablocks = set(collections)
    bpy.data.libraries.write(str(output_path), datablocks, fake_user=True)


def save_blend_files() -> None:
    _assert_source_hashes("save-start")
    motion = _group_collection("motion")
    vfx = _group_collection("vfx")
    maps = _group_collection("map")
    if motion.children or vfx.children:
        _write_collection_blend(ENEMY_BLEND_OUTPUT, (motion, vfx))
        print(f"NIGHTMARE_BLEND_SAVED {ENEMY_BLEND_OUTPUT}", flush=True)
    if maps.children:
        _write_collection_blend(MAP_BLEND_OUTPUT, (maps,))
        print(f"NIGHTMARE_BLEND_SAVED {MAP_BLEND_OUTPUT}", flush=True)
    _assert_source_hashes("save-end")


def build_all() -> None:
    reset_nightmare_scene()
    build_enemy_models()
    build_trait_vfx()
    build_map_kit()
    render_master_and_mobile()
    save_blend_files()
