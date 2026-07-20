# 3D Asset Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blender MCP로 후추 디펜스 2.5D 리뉴얼의 대표 맵·타워·캐릭터·적 애니메이션·투사체·폭발 시안을 만들고, 투명도·규격을 검증한 하나의 contact sheet로 사용자 승인을 받는다.

**Architecture:** 게임 코드는 건드리지 않고 저장소에 재현 가능한 Blender Python과 Node 검증 도구를 둔다. Blender 5.2 LTS의 EEVEE와 공통 직교 카메라 rig로 256px master 및 128px mobile PNG를 렌더하고, Playwright를 사용해 PNG 규격·모서리 alpha를 검사하고 contact sheet를 조립한다.

**Tech Stack:** Blender 5.2 LTS, Blender MCP `execute_blender_code`, Python `bpy`, Node.js 26, Vite/Vitest, Playwright Chromium, Git

## Global Constraints

- 이 계획은 대표 에셋 시안과 검증 도구만 만든다. `src/`, `e2e/`, 기존 런타임 에셋 manifest는 수정하지 않는다.
- 전체 방향·전체 프레임 batch와 게임 연결은 contact sheet 사용자 승인 전 시작하지 않는다.
- 모든 개별 에셋은 Blender Film Transparent를 사용하고 불투명 사각 배경을 포함하지 않는다.
- 모든 master frame은 256×256, mobile frame은 128×128이다.
- 일반 적과 모든 타워는 1타일 footprint를 사용한다. 보스 시안은 이 계획에 포함하지 않는다.
- 맵은 무늬 없는 길과 낮은 bevel·접지 그림자만 사용한다.
- 후추와 덕배 시안에는 캐릭터만 포함하며 `Aqua`, `Water`, `Fire`, `Flame`, `Orb`, `Ball` object를 포함하지 않는다.
- 공통 카메라·조명·색상 관리 설정을 모든 asset group이 공유한다.
- 외부 모델 다운로드, API 키, 신규 네트워크 의존성을 추가하지 않는다.
- Blender 작업은 CLI가 아니라 연결된 Blender MCP를 통해 실행한다.
- 저장소 로컬 Git 작성자는 `loomings <loomingsight@gmail.com>`을 유지한다.
- Canonical 설계는 `docs/superpowers/specs/2026-07-21-3d-material-retention-redesign.md`이다.

---

## File Map

### Create

- `tools/assets/redesignPreviewContract.mjs` — 21개 대표 asset과 master/mobile 출력 계약
- `tools/assets/validateRedesignPreview.mjs` — 파일 존재, PNG 크기, 모서리 alpha 검사
- `tools/assets/buildRedesignPreviewSheet.mjs` — 승인용 contact sheet 생성
- `tools/blender/redesign_preview.py` — 공통 rig, procedural map/VFX, 기존 모델 append, frame packing
- `tests/assets/redesignPreviewContract.test.ts` — 계약 키·프레임 수·출력 경로 단위 테스트
- `assets/blender/td-redesign-preview-v1.blend` — 시안 Blender 원본
- `assets/renders/redesign-preview-v1/master/**` — 256px master 출력
- `assets/renders/redesign-preview-v1/mobile/**` — 128px mobile 출력
- `assets/renders/redesign-preview-v1/redesign-preview-contact-sheet.png` — 사용자 승인용 시트
- `docs/assets/redesign-preview-v1.md` — 제작 규격·검증 결과·승인 체크리스트

### Modify

- `package.json` — `assets:preview:validate`, `assets:preview:sheet` 스크립트

### Explicitly Unchanged

- `src/**`
- `e2e/**`
- `assets/renders/enemies-v1/**`
- `assets/blender/enemies-voxel-v1.blend`

---

### Task 1: Preview Contract and Validation Harness

**Files:**
- Create: `tools/assets/redesignPreviewContract.mjs`
- Create: `tools/assets/validateRedesignPreview.mjs`
- Create: `tests/assets/redesignPreviewContract.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `PREVIEW_ROOT: string`
- Produces: `PREVIEW_ASSETS: readonly PreviewAsset[]`
- Produces: CLI `node tools/assets/validateRedesignPreview.mjs [--group <group>]`
- `PreviewAsset = { id, group, relativePath, frames, masterFrameSize, mobileFrameSize }`

- [ ] **Step 1: Write the failing contract test**

Create `tests/assets/redesignPreviewContract.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PREVIEW_ASSETS } from '../../tools/assets/redesignPreviewContract.mjs';

const expectedIds = [
  'grass',
  'road-straight-horizontal',
  'road-straight-vertical',
  'road-corner-north-east',
  'road-corner-east-south',
  'road-corner-south-west',
  'road-corner-west-north',
  'entry',
  'snack-chest',
  'tower-slow-se',
  'tower-arrow-se',
  'tower-deokbae-se',
  'tower-huchu-se',
  'orc-walk-se',
  'fairy-fly-se',
  'arrow-8dir',
  'fireball-flight',
  'waterball-flight',
  'arrow-impact',
  'fire-burst',
  'aqua-burst',
];

describe('3D redesign preview contract', () => {
  it('defines the exact approval-set assets once', () => {
    expect(PREVIEW_ASSETS.map((asset) => asset.id)).toEqual(expectedIds);
    expect(new Set(PREVIEW_ASSETS.map((asset) => asset.relativePath)).size).toBe(21);
  });

  it('uses fixed master/mobile frame sizes and approved frame counts', () => {
    for (const asset of PREVIEW_ASSETS) {
      expect(asset.masterFrameSize).toBe(256);
      expect(asset.mobileFrameSize).toBe(128);
      expect(asset.relativePath.endsWith('.png')).toBe(true);
    }
    expect(PREVIEW_ASSETS.find((asset) => asset.id === 'orc-walk-se')?.frames).toBe(6);
    expect(PREVIEW_ASSETS.find((asset) => asset.id === 'fairy-fly-se')?.frames).toBe(8);
    expect(PREVIEW_ASSETS.find((asset) => asset.id === 'arrow-8dir')?.frames).toBe(8);
    expect(PREVIEW_ASSETS.find((asset) => asset.id === 'fire-burst')?.frames).toBe(8);
    expect(PREVIEW_ASSETS.find((asset) => asset.id === 'aqua-burst')?.frames).toBe(8);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run tests/assets/redesignPreviewContract.test.ts
```

Expected: FAIL with `Cannot find module '../../tools/assets/redesignPreviewContract.mjs'`.

- [ ] **Step 3: Create the exact asset contract**

Create `tools/assets/redesignPreviewContract.mjs`:

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const PREVIEW_ROOT = path.join(
  repositoryRoot,
  'assets/renders/redesign-preview-v1',
);

const asset = (id, group, relativePath, frames = 1) => Object.freeze({
  id,
  group,
  relativePath,
  frames,
  masterFrameSize: 256,
  mobileFrameSize: 128,
});

export const PREVIEW_ASSETS = Object.freeze([
  asset('grass', 'map', 'map/grass.png'),
  asset('road-straight-horizontal', 'map', 'map/road-straight-horizontal.png'),
  asset('road-straight-vertical', 'map', 'map/road-straight-vertical.png'),
  asset('road-corner-north-east', 'map', 'map/road-corner-north-east.png'),
  asset('road-corner-east-south', 'map', 'map/road-corner-east-south.png'),
  asset('road-corner-south-west', 'map', 'map/road-corner-south-west.png'),
  asset('road-corner-west-north', 'map', 'map/road-corner-west-north.png'),
  asset('entry', 'map', 'map/entry.png'),
  asset('snack-chest', 'map', 'map/snack-chest.png'),
  asset('tower-slow-se', 'tower', 'towers/slow-se.png'),
  asset('tower-arrow-se', 'tower', 'towers/arrow-se.png'),
  asset('tower-deokbae-se', 'tower', 'towers/deokbae-se.png'),
  asset('tower-huchu-se', 'tower', 'towers/huchu-se.png'),
  asset('orc-walk-se', 'motion', 'motion/orc-walk-se.png', 6),
  asset('fairy-fly-se', 'motion', 'motion/fairy-fly-se.png', 8),
  asset('arrow-8dir', 'vfx', 'vfx/arrow-8dir.png', 8),
  asset('fireball-flight', 'vfx', 'vfx/fireball-flight.png', 4),
  asset('waterball-flight', 'vfx', 'vfx/waterball-flight.png', 4),
  asset('arrow-impact', 'vfx', 'vfx/arrow-impact.png', 4),
  asset('fire-burst', 'vfx', 'vfx/fire-burst.png', 8),
  asset('aqua-burst', 'vfx', 'vfx/aqua-burst.png', 8),
]);
```

- [ ] **Step 4: Create the PNG contract validator**

Create `tools/assets/validateRedesignPreview.mjs`:

```js
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { PREVIEW_ASSETS, PREVIEW_ROOT } from './redesignPreviewContract.mjs';

const groupFlag = process.argv.indexOf('--group');
const requestedGroup = groupFlag === -1 ? null : process.argv[groupFlag + 1];
const assets = PREVIEW_ASSETS.filter(
  (asset) => requestedGroup === null || asset.group === requestedGroup,
);

if (assets.length === 0) {
  throw new Error(`Unknown or empty preview group: ${requestedGroup}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  let files = 0;
  for (const asset of assets) {
    for (const variant of ['master', 'mobile']) {
      const frameSize = variant === 'master'
        ? asset.masterFrameSize
        : asset.mobileFrameSize;
      const filePath = path.join(PREVIEW_ROOT, variant, asset.relativePath);
      await access(filePath);
      const bytes = await readFile(filePath);
      const result = await page.evaluate(async ({ dataUrl, expectedWidth, expectedHeight }) => {
        const image = new Image();
        image.src = dataUrl;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (context === null) throw new Error('2D canvas unavailable');
        context.drawImage(image, 0, 0);
        const corners = [
          [0, 0],
          [canvas.width - 1, 0],
          [0, canvas.height - 1],
          [canvas.width - 1, canvas.height - 1],
        ].map(([x, y]) => context.getImageData(x, y, 1, 1).data[3]);
        return {
          width: image.naturalWidth,
          height: image.naturalHeight,
          corners,
          dimensionsOk: image.naturalWidth === expectedWidth
            && image.naturalHeight === expectedHeight,
        };
      }, {
        dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
        expectedWidth: frameSize * asset.frames,
        expectedHeight: frameSize,
      });

      if (!result.dimensionsOk) {
        throw new Error(`${asset.id}/${variant} has ${result.width}x${result.height}`);
      }
      if (result.corners.some((alpha) => alpha !== 0)) {
        throw new Error(`${asset.id}/${variant} has opaque corner alpha ${result.corners}`);
      }
      files += 1;
    }
  }
  console.log(`VALIDATED ${assets.length} assets / ${files} PNG files`);
} finally {
  await page.close();
  await browser.close();
}
```

- [ ] **Step 5: Add npm scripts**

Add to `package.json` scripts:

```json
"assets:preview:validate": "node tools/assets/validateRedesignPreview.mjs",
"assets:preview:sheet": "node tools/assets/buildRedesignPreviewSheet.mjs"
```

- [ ] **Step 6: Run the contract test and verify GREEN**

Run:

```bash
npx vitest run tests/assets/redesignPreviewContract.test.ts
```

Expected: `2 passed`.

- [ ] **Step 7: Prove the validator fails for missing renders**

Run:

```bash
npm run assets:preview:validate -- --group map
```

Expected: non-zero exit with `ENOENT` for `master/map/grass.png`.

- [ ] **Step 8: Commit the harness**

```bash
git add package.json tools/assets/redesignPreviewContract.mjs tools/assets/validateRedesignPreview.mjs tests/assets/redesignPreviewContract.test.ts
git commit -m "test: define 3d preview asset contract"
```

---

### Task 2: Shared Blender Rig, Map Tiles, and Snack Chest

**Files:**
- Create: `tools/blender/redesign_preview.py`
- Create: `assets/blender/td-redesign-preview-v1.blend`
- Create: `assets/renders/redesign-preview-v1/{master,mobile}/map/*.png`

**Interfaces:**
- Produces: `render_group(group: str) -> None`
- Produces: `make_material(name: str, color: tuple[float, float, float, float], roughness: float) -> bpy.types.Material`
- Consumes: output paths and frame counts defined by `tools/assets/redesignPreviewContract.mjs`

- [ ] **Step 1: Verify the map group is RED**

Run:

```bash
npm run assets:preview:validate -- --group map
```

Expected: FAIL at `master/map/grass.png`.

- [ ] **Step 2: Create the shared Blender scene and render helpers**

Create `tools/blender/redesign_preview.py` with these exact public constants and helpers:

```python
import math
import os
from pathlib import Path

import bpy
from mathutils import Vector

REPO = Path('/Users/jadon/Documents/huchu-defense-v2')
OUTPUT = REPO / 'assets/renders/redesign-preview-v1'
BLEND_OUTPUT = REPO / 'assets/blender/td-redesign-preview-v1.blend'
FRAME_SIZE = 256
MOBILE_SIZE = 128

COLORS = {
    'grass': (0.36, 0.62, 0.40, 1.0),
    'grass_side': (0.22, 0.42, 0.25, 1.0),
    'road': (0.78, 0.63, 0.39, 1.0),
    'road_side': (0.56, 0.41, 0.24, 1.0),
    'wood': (0.38, 0.20, 0.10, 1.0),
    'wood_light': (0.64, 0.36, 0.16, 1.0),
    'gold': (0.95, 0.66, 0.16, 1.0),
    'snack': (0.93, 0.72, 0.38, 1.0),
}

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            datablocks.remove(block)

def make_material(name, color, roughness=0.72):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    principled = material.node_tree.nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = color
    principled.inputs['Roughness'].default_value = roughness
    return material

def add_box(name, location, scale, material, bevel=0.08):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new('PreviewBevel', 'BEVEL')
    modifier.width = bevel
    modifier.segments = 2
    obj.data.materials.append(material)
    return obj

def look_at(obj, target=(0.0, 0.0, 0.6)):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

def configure_scene():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.resolution_x = FRAME_SIZE
    scene.render.resolution_y = FRAME_SIZE
    scene.render.resolution_percentage = 100
    scene.render.image_settings.color_depth = '8'
    scene.view_settings.look = 'AgX - Medium High Contrast'

    camera_data = bpy.data.cameras.new('TD_Preview_Camera')
    camera = bpy.data.objects.new('TD_Preview_Camera', camera_data)
    scene.collection.objects.link(camera)
    camera.location = (6.5, -8.5, 6.25)
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 5.6
    look_at(camera)
    scene.camera = camera

    for name, location, energy, size in (
        ('TD_Key', (4.5, -4.5, 8.0), 1050.0, 5.0),
        ('TD_Fill', (-4.5, -2.0, 5.0), 500.0, 4.0),
        ('TD_Rim', (2.0, 5.0, 7.0), 750.0, 3.0),
    ):
        data = bpy.data.lights.new(name, 'AREA')
        data.energy = energy
        data.shape = 'DISK'
        data.size = size
        light = bpy.data.objects.new(name, data)
        light.location = location
        look_at(light)
        scene.collection.objects.link(light)

def visible_meshes():
    return [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and not obj.hide_render]

def render_still(output_path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.resolution_x = FRAME_SIZE
    scene.render.resolution_y = FRAME_SIZE
    scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)

def resize_png(source, destination, width, height):
    image = bpy.data.images.load(str(source), check_existing=False)
    image.scale(width, height)
    image.filepath_raw = str(destination)
    image.file_format = 'PNG'
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save()
    bpy.data.images.remove(image)

def emit_single(relative_path):
    master = OUTPUT / 'master' / relative_path
    mobile = OUTPUT / 'mobile' / relative_path
    render_still(master)
    resize_png(master, mobile, MOBILE_SIZE, MOBILE_SIZE)

def hide_generated(prefix='Asset_'):
    for obj in bpy.context.scene.objects:
        if obj.name.startswith(prefix):
            bpy.data.objects.remove(obj, do_unlink=True)
```

- [ ] **Step 3: Add deterministic map builders**

Append exact builders with a 3.2×3.2 tile, 0.36 base height, 1.22 road width, and no road decoration:

```python
def tile_base():
    grass = make_material('M_Grass', COLORS['grass'])
    return add_box('Asset_TileBase', (0, 0, 0), (1.6, 1.6, 0.18), grass, 0.10)

def road_arm(axis, positive=True):
    road = make_material('M_Road', COLORS['road'])
    length = 0.82
    if axis == 'x':
        x = 0.78 if positive else -0.78
        return add_box('Asset_RoadArm', (x, 0, 0.235), (length, 0.61, 0.055), road, 0.08)
    y = 0.78 if positive else -0.78
    return add_box('Asset_RoadArm', (0, y, 0.235), (0.61, length, 0.055), road, 0.08)

def build_road(arms):
    tile_base()
    road = make_material('M_Road', COLORS['road'])
    add_box('Asset_RoadCenter', (0, 0, 0.235), (0.61, 0.61, 0.055), road, 0.08)
    for axis, positive in arms:
        road_arm(axis, positive)

def add_bone(name, location, rotation=(0, 0, 0), scale=0.22):
    snack = make_material('M_Snack', COLORS['snack'])
    bar = add_box(name + '_Bar', location, (scale * 1.4, scale * 0.36, scale * 0.30), snack, 0.08)
    bar.rotation_euler = rotation
    for side in (-1, 1):
        for y in (-0.16, 0.16):
            bpy.ops.mesh.primitive_uv_sphere_add(
                segments=16,
                ring_count=8,
                location=(location[0] + side * scale * 1.45, location[1] + y * scale, location[2]),
                scale=(scale * 0.46, scale * 0.46, scale * 0.42),
            )
            bpy.context.object.name = name + '_Knob'
            bpy.context.object.data.materials.append(snack)

def build_snack_chest():
    tile_base()
    wood = make_material('M_Wood', COLORS['wood'])
    wood_light = make_material('M_WoodLight', COLORS['wood_light'])
    gold = make_material('M_Gold', COLORS['gold'], 0.35)
    add_box('Asset_ChestBase', (0, 0, 0.66), (0.92, 0.67, 0.40), wood, 0.10)
    lid = add_box('Asset_ChestLid', (0, 0.36, 1.18), (0.92, 0.20, 0.38), wood_light, 0.10)
    lid.rotation_euler.x = math.radians(-28)
    add_box('Asset_ChestBand', (0, -0.69, 0.72), (0.12, 0.04, 0.43), gold, 0.03)
    add_bone('Asset_BoneA', (-0.25, 0.0, 1.22), rotation=(0, 0, 0.35), scale=0.17)
    add_bone('Asset_BoneB', (0.28, 0.02, 1.28), rotation=(0, 0, -0.45), scale=0.15)

MAP_BUILDERS = {
    'map/grass.png': tile_base,
    'map/road-straight-horizontal.png': lambda: build_road((('x', False), ('x', True))),
    'map/road-straight-vertical.png': lambda: build_road((('y', False), ('y', True))),
    'map/road-corner-north-east.png': lambda: build_road((('y', True), ('x', True))),
    'map/road-corner-east-south.png': lambda: build_road((('x', True), ('y', False))),
    'map/road-corner-south-west.png': lambda: build_road((('y', False), ('x', False))),
    'map/road-corner-west-north.png': lambda: build_road((('x', False), ('y', True))),
    'map/entry.png': lambda: build_road((('x', False), ('x', True))),
    'map/snack-chest.png': build_snack_chest,
}

def render_map_group():
    for relative_path, builder in MAP_BUILDERS.items():
        hide_generated()
        builder()
        if relative_path == 'map/entry.png':
            gold = make_material('M_EntryGold', COLORS['gold'], 0.40)
            add_box('Asset_EntryPostL', (-0.72, 0, 0.72), (0.10, 0.10, 0.55), gold, 0.03)
            add_box('Asset_EntryPostR', (0.72, 0, 0.72), (0.10, 0.10, 0.55), gold, 0.03)
        emit_single(relative_path)
```

- [ ] **Step 4: Add the MCP entry point and save behavior**

Append:

```python
def render_group(group):
    clear_scene()
    configure_scene()
    if group == 'map':
        render_map_group()
    else:
        raise ValueError(f'Unsupported preview group: {group}')
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_OUTPUT))
    print(f'RENDERED GROUP {group}')
```

- [ ] **Step 5: Render through Blender MCP**

Call `mcp__blender__execute_blender_code` with:

```python
namespace = {}
script = '/Users/jadon/Documents/huchu-defense-v2/tools/blender/redesign_preview.py'
exec(compile(open(script, encoding='utf-8').read(), script, 'exec'), namespace)
namespace['render_group']('map')
```

Expected Blender output: `RENDERED GROUP map` and saved `assets/blender/td-redesign-preview-v1.blend`.

- [ ] **Step 6: Validate the map outputs**

Run:

```bash
npm run assets:preview:validate -- --group map
```

Expected: `VALIDATED 9 assets / 18 PNG files`.

- [ ] **Step 7: Inspect the Blender viewport**

Call `mcp__blender__get_viewport_screenshot` with `max_size: 900`.

Expected: current scene uses the shared diagonal camera, no opaque world background, and the snack chest contains visible snacks without exceeding one tile base.

- [ ] **Step 8: Commit the map preview**

```bash
git add tools/blender/redesign_preview.py assets/blender/td-redesign-preview-v1.blend assets/renders/redesign-preview-v1/master/map assets/renders/redesign-preview-v1/mobile/map
git commit -m "feat: render 3d map preview kit"
```

---

### Task 3: One-Tile Tower and Character Preview

**Files:**
- Modify: `tools/blender/redesign_preview.py`
- Modify: `assets/blender/td-redesign-preview-v1.blend`
- Create: `assets/renders/redesign-preview-v1/{master,mobile}/towers/*.png`

**Interfaces:**
- Consumes: `render_still`, `resize_png`, common camera and lights from Task 2
- Produces: `append_selected_objects(blend_path, predicate, collection_name) -> list[bpy.types.Object]`
- Produces: `fit_objects_to_tile(objects, target_width: float, target_height: float) -> None`
- Extends: `render_group('tower')`

- [ ] **Step 1: Verify the tower group is RED**

Run:

```bash
npm run assets:preview:validate -- --group tower
```

Expected: FAIL at `master/towers/slow-se.png`.

- [ ] **Step 2: Add exact append and fitting helpers**

Append to `tools/blender/redesign_preview.py`:

```python
def append_selected_objects(blend_path, predicate, collection_name):
    with bpy.data.libraries.load(str(blend_path), link=False) as (source, target):
        target.objects = [name for name in source.objects if predicate(name)]
    collection = bpy.data.collections.new(collection_name)
    bpy.context.scene.collection.children.link(collection)
    loaded = []
    for obj in target.objects:
        if obj is not None:
            collection.objects.link(obj)
            loaded.append(obj)
    return loaded

def mesh_bounds(objects):
    points = []
    for obj in objects:
        if obj.type == 'MESH':
            points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return minimum, maximum

def fit_objects_to_tile(objects, target_width=2.45, target_height=2.65):
    minimum, maximum = mesh_bounds(objects)
    extent = maximum - minimum
    scale = min(target_width / max(extent.x, extent.y), target_height / extent.z)
    root = bpy.data.objects.new('Asset_FitRoot', None)
    bpy.context.scene.collection.objects.link(root)
    for obj in objects:
        if obj.parent is None:
            obj.parent = root
    root.scale = (scale, scale, scale)
    bpy.context.view_layer.update()
    minimum, maximum = mesh_bounds(objects)
    root.location = (-(minimum.x + maximum.x) / 2, -(minimum.y + maximum.y) / 2, -minimum.z + 0.20)
    return root

def render_appended(relative_path, blend_name, predicate):
    hide_generated()
    source = REPO / 'assets/blender' / blend_name
    objects = append_selected_objects(source, predicate, 'Asset_Imported')
    fit_objects_to_tile(objects)
    emit_single(relative_path)
    for obj in list(objects):
        bpy.data.objects.remove(obj, do_unlink=True)
```

- [ ] **Step 3: Add tower filters that exclude embedded VFX and backgrounds**

Append:

```python
DOG_VFX_WORDS = ('Aqua', 'Water', 'Fire', 'Flame', 'Orb', 'Ball', 'Wave', 'Drop', 'Bubble')

def huchu_predicate(name):
    return (name.startswith('Huchu_') or name == 'Huchu_v2') \
        and not any(word in name for word in DOG_VFX_WORDS)

def deokbae_predicate(name):
    return (name.startswith('Deokbae_') or name == 'Deokbae_v2') \
        and not any(word in name for word in DOG_VFX_WORDS)

def arrow_predicate(name):
    return (name.startswith('Arrow_') or name == 'ArrowTower_Root') \
        and name not in {'Arrow_Camera', 'Arrow_Key', 'Arrow_Fill', 'Arrow_Ground'}

def slow_predicate(name):
    return (name.startswith('Slow_') or name.startswith('SlowTower_')) \
        and name not in {'Slow_Camera', 'Slow_Key', 'Slow_Fill', 'Slow_Rim', 'Slow_Ground'} \
        and 'Aura' not in name

def render_tower_group():
    render_appended('towers/slow-se.png', 'slow-tower-v1.blend', slow_predicate)
    render_appended('towers/arrow-se.png', 'arrow-tower-v1.blend', arrow_predicate)
    render_appended('towers/deokbae-se.png', 'character-assets-v2.blend', deokbae_predicate)
    render_appended('towers/huchu-se.png', 'character-assets-v2.blend', huchu_predicate)
```

Update `render_group`:

```python
if group == 'map':
    render_map_group()
elif group == 'tower':
    render_tower_group()
else:
    raise ValueError(f'Unsupported preview group: {group}')
```

- [ ] **Step 4: Add Blender-side character purity assertions**

Before each dog render, assert:

```python
for obj in objects:
    assert not any(word in obj.name for word in DOG_VFX_WORDS), obj.name
```

Expected: no assertion and no aqua/fire projectile objects in either dog collection.

- [ ] **Step 5: Render the tower group through Blender MCP**

Use the Task 2 MCP loader code and call:

```python
namespace['render_group']('tower')
```

Expected: `RENDERED GROUP tower`.

- [ ] **Step 6: Validate and visually inspect the tower outputs**

Run:

```bash
npm run assets:preview:validate -- --group tower
```

Expected: `VALIDATED 4 assets / 8 PNG files`.

Open all four master PNGs with the local image viewer. Confirm each character/base fits the same one-tile width, the corners are transparent, and 후추·덕배 contain no orb or colored square background.

- [ ] **Step 7: Commit the tower preview**

```bash
git add tools/blender/redesign_preview.py assets/blender/td-redesign-preview-v1.blend assets/renders/redesign-preview-v1/master/towers assets/renders/redesign-preview-v1/mobile/towers
git commit -m "feat: render clean one-tile tower previews"
```

---

### Task 4: Enemy Walk and Fairy Wing Preview

**Files:**
- Modify: `tools/blender/redesign_preview.py`
- Modify: `assets/blender/td-redesign-preview-v1.blend`
- Create: `assets/renders/redesign-preview-v1/{master,mobile}/motion/*.png`

**Interfaces:**
- Consumes: enemy objects from `assets/blender/enemies-voxel-v1.blend`
- Produces: `render_animation_sheet(relative_path, frame_count, pose_frame) -> None`
- Produces: 6-frame `orc-walk-se` and 8-frame `fairy-fly-se`
- Extends: `render_group('motion')`

- [ ] **Step 1: Verify the motion group is RED**

Run:

```bash
npm run assets:preview:validate -- --group motion
```

Expected: FAIL at `master/motion/orc-walk-se.png`.

- [ ] **Step 2: Add horizontal frame packing**

Append:

```python
def pack_frames(frame_paths, output_path, frame_size):
    images = [bpy.data.images.load(str(path), check_existing=False) for path in frame_paths]
    sheet_width = frame_size * len(images)
    sheet = bpy.data.images.new('Asset_FrameSheet', width=sheet_width, height=frame_size, alpha=True)
    target = [0.0] * (sheet_width * frame_size * 4)
    for index, image in enumerate(images):
        pixels = list(image.pixels)
        for y in range(frame_size):
            source_start = y * frame_size * 4
            target_start = (y * sheet_width + index * frame_size) * 4
            target[target_start:target_start + frame_size * 4] = pixels[source_start:source_start + frame_size * 4]
    sheet.pixels.foreach_set(target)
    sheet.update()
    sheet.filepath_raw = str(output_path)
    sheet.file_format = 'PNG'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save()
    for image in images:
        bpy.data.images.remove(image)
    bpy.data.images.remove(sheet)

def render_animation_sheet(relative_path, frame_count, pose_frame):
    temp = OUTPUT / '_frames'
    temp.mkdir(parents=True, exist_ok=True)
    frame_paths = []
    for frame in range(frame_count):
        pose_frame(frame, frame_count)
        frame_path = temp / f'{Path(relative_path).stem}-{frame:02d}.png'
        render_still(frame_path)
        frame_paths.append(frame_path)
    master = OUTPUT / 'master' / relative_path
    mobile = OUTPUT / 'mobile' / relative_path
    pack_frames(frame_paths, master, FRAME_SIZE)
    resize_png(master, mobile, MOBILE_SIZE * frame_count, MOBILE_SIZE)
    for frame_path in frame_paths:
        frame_path.unlink(missing_ok=True)
```

- [ ] **Step 3: Add deterministic orc and fairy poses**

Append:

```python
def append_enemy(prefix):
    source = REPO / 'assets/blender/enemies-voxel-v1.blend'
    return append_selected_objects(
        source,
        lambda name: name.startswith(f'Enemy_{prefix}_') or name.startswith(f'{prefix}_'),
        f'Asset_{prefix}',
    )

def remove_objects(objects):
    for obj in list(objects):
        if obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj, do_unlink=True)

def render_orc_walk():
    objects = append_enemy('Orc')
    by_name = {obj.name: obj for obj in objects}
    base = {name: obj.rotation_euler.copy() for name, obj in by_name.items()}
    body_z = by_name['Enemy_Orc_Body'].location.z
    def pose(frame, count):
        phase = frame / count * math.tau
        swing = math.radians(15) * math.sin(phase)
        for name, sign in (('Orc_Arm_L', 1), ('Orc_Arm_R', -1), ('Orc_Leg_L', -1), ('Orc_Leg_R', 1)):
            by_name[name].rotation_euler = base[name].copy()
            by_name[name].rotation_euler.x += swing * sign
        by_name['Enemy_Orc_Body'].location.z = body_z + 0.06 * abs(math.sin(phase))
    render_animation_sheet('motion/orc-walk-se.png', 6, pose)
    remove_objects(objects)

def render_fairy_flight():
    objects = append_enemy('Fairy')
    by_name = {obj.name: obj for obj in objects}
    base = {name: obj.rotation_euler.copy() for name, obj in by_name.items()}
    body_z = by_name['Enemy_Fairy_Body'].location.z
    wings = ('Fairy_Wing_LL', 'Fairy_Wing_LR', 'Fairy_Wing_UL', 'Fairy_Wing_UR')
    def pose(frame, count):
        phase = frame / count * math.tau
        flap = math.radians(28) * math.sin(phase)
        for name in wings:
            by_name[name].rotation_euler = base[name].copy()
            by_name[name].rotation_euler.y += flap * (-1 if name.endswith('R') else 1)
        by_name['Enemy_Fairy_Body'].location.z = body_z + 0.10 * math.sin(phase)
    render_animation_sheet('motion/fairy-fly-se.png', 8, pose)
    remove_objects(objects)

def render_motion_group():
    render_orc_walk()
    render_fairy_flight()
```

Add `elif group == 'motion': render_motion_group()` to `render_group`.

- [ ] **Step 4: Render through Blender MCP**

Execute the script and call:

```python
namespace['render_group']('motion')
```

Expected: `RENDERED GROUP motion`.

- [ ] **Step 5: Validate motion sheets**

Run:

```bash
npm run assets:preview:validate -- --group motion
```

Expected: `VALIDATED 2 assets / 4 PNG files`.

Visually confirm the six orc frames alternate opposing limbs and the eight fairy frames show two full wing cycles without changing the foot/hover anchor.

- [ ] **Step 6: Commit motion previews**

```bash
git add tools/blender/redesign_preview.py assets/blender/td-redesign-preview-v1.blend assets/renders/redesign-preview-v1/master/motion assets/renders/redesign-preview-v1/mobile/motion
git commit -m "feat: render enemy motion previews"
```

---

### Task 5: Projectile and Impact Preview

**Files:**
- Modify: `tools/blender/redesign_preview.py`
- Modify: `assets/blender/td-redesign-preview-v1.blend`
- Create: `assets/renders/redesign-preview-v1/{master,mobile}/vfx/*.png`

**Interfaces:**
- Produces: `build_arrow(yaw_radians)`, `build_fireball(progress)`, `build_waterball(progress)`
- Produces: `build_impact(kind, progress)`
- Extends: `render_group('vfx')`

- [ ] **Step 1: Verify the VFX group is RED**

Run:

```bash
npm run assets:preview:validate -- --group vfx
```

Expected: FAIL at `master/vfx/arrow-8dir.png`.

- [ ] **Step 2: Add procedural projectile builders**

Append these concrete primitives:

```python
def add_uv_sphere(name, location, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    return obj

def build_arrow(yaw):
    wood = make_material('M_ArrowWood', (0.42, 0.20, 0.07, 1.0))
    metal = make_material('M_ArrowMetal', (0.68, 0.74, 0.78, 1.0), 0.24)
    feather = make_material('M_ArrowFeather', (0.92, 0.28, 0.18, 1.0))
    root = bpy.data.objects.new('Asset_ArrowRoot', None)
    bpy.context.scene.collection.objects.link(root)
    shaft = add_box('Asset_ArrowShaft', (0, 0, 0.65), (0.80, 0.045, 0.045), wood, 0.02)
    head = add_box('Asset_ArrowHead', (0.91, 0, 0.65), (0.18, 0.12, 0.08), metal, 0.02)
    feather_a = add_box('Asset_ArrowFeatherA', (-0.72, 0, 0.71), (0.18, 0.10, 0.025), feather, 0.02)
    feather_b = add_box('Asset_ArrowFeatherB', (-0.72, 0, 0.59), (0.18, 0.025, 0.10), feather, 0.02)
    for obj in (shaft, head, feather_a, feather_b):
        obj.parent = root
    root.rotation_euler.z = yaw

def build_fireball(progress):
    core = make_material('M_FireCore', (1.0, 0.36, 0.04, 1.0), 0.22)
    glow = make_material('M_FireGlow', (1.0, 0.76, 0.12, 1.0), 0.18)
    add_uv_sphere('Asset_FireCore', (0, 0, 0.75), (0.46, 0.46, 0.46), core)
    for index in range(3):
        angle = progress * math.tau + index * math.tau / 3
        add_uv_sphere(
            f'Asset_FireTrail{index}',
            (-0.45 - index * 0.22, math.sin(angle) * 0.16, 0.75 + math.cos(angle) * 0.12),
            (0.23 - index * 0.04,) * 3,
            glow,
        )

def build_waterball(progress):
    water = make_material('M_WaterCore', (0.05, 0.56, 0.82, 0.94), 0.16)
    highlight = make_material('M_WaterHighlight', (0.62, 0.94, 1.0, 0.96), 0.12)
    add_uv_sphere('Asset_WaterCore', (0, 0, 0.75), (0.52, 0.52, 0.52), water)
    angle = progress * math.tau
    add_uv_sphere('Asset_WaterHighlight', (-0.16, -0.18, 0.92), (0.17, 0.10, 0.10), highlight)
    for index in range(2):
        a = angle + index * math.pi
        add_uv_sphere(
            f'Asset_WaterDrop{index}',
            (math.cos(a) * 0.62, math.sin(a) * 0.38, 0.75 + math.sin(a) * 0.18),
            (0.10, 0.10, 0.14),
            highlight,
        )
```

- [ ] **Step 3: Add impact frame builders**

Append:

```python
def build_impact(kind, progress):
    if kind == 'arrow':
        material = make_material('M_ArrowImpact', (0.96, 0.78, 0.30, 1.0), 0.34)
        count, radius = 5, 0.18 + progress * 0.76
    elif kind == 'fire':
        material = make_material('M_FireImpact', (1.0, 0.24 + progress * 0.32, 0.02, 1.0), 0.20)
        count, radius = 9, 0.22 + progress * 1.10
    elif kind == 'aqua':
        material = make_material('M_AquaImpact', (0.05, 0.66, 0.90, 1.0), 0.16)
        count, radius = 8, 0.24 + progress * 1.22
    else:
        raise ValueError(kind)
    for index in range(count):
        angle = index * math.tau / count
        distance = radius * (0.42 + progress * 0.58)
        add_uv_sphere(
            f'Asset_{kind}_Particle{index}',
            (math.cos(angle) * distance, math.sin(angle) * distance, 0.28 + abs(math.sin(angle)) * radius * 0.38),
            (max(0.05, 0.20 * (1.0 - progress * 0.55)),) * 3,
            material,
        )
```

- [ ] **Step 4: Add VFX sheet rendering**

Append:

```python
def render_procedural_sheet(relative_path, frame_count, builder):
    def pose(frame, count):
        hide_generated()
        builder(frame / count)
    render_animation_sheet(relative_path, frame_count, pose)

def render_vfx_group():
    render_procedural_sheet(
        'vfx/arrow-8dir.png',
        8,
        lambda progress: build_arrow(round(progress * 8) * math.tau / 8),
    )
    render_procedural_sheet('vfx/fireball-flight.png', 4, build_fireball)
    render_procedural_sheet('vfx/waterball-flight.png', 4, build_waterball)
    render_procedural_sheet('vfx/arrow-impact.png', 4, lambda p: build_impact('arrow', p))
    render_procedural_sheet('vfx/fire-burst.png', 8, lambda p: build_impact('fire', p))
    render_procedural_sheet('vfx/aqua-burst.png', 8, lambda p: build_impact('aqua', p))
```

Add `elif group == 'vfx': render_vfx_group()` to `render_group`.

- [ ] **Step 5: Render through Blender MCP**

Execute the script and call:

```python
namespace['render_group']('vfx')
```

Expected: `RENDERED GROUP vfx`.

- [ ] **Step 6: Validate VFX sheets**

Run:

```bash
npm run assets:preview:validate -- --group vfx
```

Expected: `VALIDATED 6 assets / 12 PNG files`.

Visually confirm the arrow changes through eight headings, fire/water flight frames contain only the projectile, and impact sheets expand without an opaque square background.

- [ ] **Step 7: Commit VFX previews**

```bash
git add tools/blender/redesign_preview.py assets/blender/td-redesign-preview-v1.blend assets/renders/redesign-preview-v1/master/vfx assets/renders/redesign-preview-v1/mobile/vfx
git commit -m "feat: render 3d projectile and impact previews"
```

---

### Task 6: Contact Sheet, Full Validation, and Approval Handoff

**Files:**
- Create: `tools/assets/buildRedesignPreviewSheet.mjs`
- Create: `assets/renders/redesign-preview-v1/redesign-preview-contact-sheet.png`
- Create: `docs/assets/redesign-preview-v1.md`

**Interfaces:**
- Consumes: all 21 master images from `PREVIEW_ASSETS`
- Produces: `redesign-preview-contact-sheet.png`
- Produces: an asset approval document with exact pass/fail checks

- [ ] **Step 1: Run full validation before the contact sheet**

Run:

```bash
npm run assets:preview:validate
```

Expected: `VALIDATED 21 assets / 42 PNG files`.

- [ ] **Step 2: Create the contact sheet builder**

Create `tools/assets/buildRedesignPreviewSheet.mjs`:

```js
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { PREVIEW_ASSETS, PREVIEW_ROOT } from './redesignPreviewContract.mjs';

const cards = await Promise.all(PREVIEW_ASSETS.map(async (asset) => {
  const filePath = path.join(PREVIEW_ROOT, 'master', asset.relativePath);
  const bytes = await readFile(filePath);
  return {
    ...asset,
    dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
  };
}));

const grouped = Object.groupBy(cards, (asset) => asset.group);
const sections = Object.entries(grouped).map(([group, assets]) => `
  <section>
    <h2>${group.toUpperCase()}</h2>
    <div class="grid">
      ${assets.map((asset) => `
        <article class="card card--${asset.frames > 1 ? 'wide' : 'single'}">
          <div class="checker"><img src="${asset.dataUrl}" alt="${asset.id}"></div>
          <strong>${asset.id}</strong>
          <small>${asset.frames} frame${asset.frames === 1 ? '' : 's'} · 256px master / 128px mobile</small>
        </article>
      `).join('')}
    </div>
  </section>
`).join('');

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 40px; width: 1500px; color: #26332d; background: #eef4ef; font-family: system-ui, sans-serif; }
  header { margin-bottom: 28px; }
  h1 { margin: 0; font-size: 42px; }
  header p, h2, strong, small { margin: 0; }
  section { margin-top: 28px; }
  h2 { margin-bottom: 12px; color: #466253; font-size: 22px; letter-spacing: .12em; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .card { display: grid; gap: 7px; padding: 14px; border-radius: 20px; background: white; box-shadow: 0 5px 16px #193d2b1f; }
  .card--wide { grid-column: span 2; }
  .checker { display: grid; min-height: 220px; place-items: center; overflow: hidden; border-radius: 14px; background-color: #d9e2dc; background-image: linear-gradient(45deg,#c4d0c8 25%,transparent 25%),linear-gradient(-45deg,#c4d0c8 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#c4d0c8 75%),linear-gradient(-45deg,transparent 75%,#c4d0c8 75%); background-size: 24px 24px; background-position: 0 0,0 12px,12px -12px,-12px 0; }
  img { display: block; width: 100%; max-height: 260px; object-fit: contain; image-rendering: auto; }
  strong { font-size: 17px; }
  small { color: #68756d; }
</style></head><body>
  <header><h1>후추 디펜스 3D 리뉴얼 시안</h1><p>공통 Blender 카메라 · 투명 배경 · 1타일 footprint</p></header>
  ${sections}
</body></html>`;

await mkdir(PREVIEW_ROOT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
try {
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({
    path: path.join(PREVIEW_ROOT, 'redesign-preview-contact-sheet.png'),
    fullPage: true,
  });
} finally {
  await page.close();
  await browser.close();
}
console.log('WROTE redesign-preview-contact-sheet.png');
```

- [ ] **Step 3: Generate the contact sheet**

Run:

```bash
npm run assets:preview:sheet
```

Expected: `WROTE redesign-preview-contact-sheet.png`.

- [ ] **Step 4: Visually inspect the contact sheet**

Open:

```text
/Users/jadon/Documents/huchu-defense-v2/assets/renders/redesign-preview-v1/redesign-preview-contact-sheet.png
```

Reject the sheet and return to the owning task if any of these are visible:

- opaque square background around an asset
- map camera or light mismatch between cards
- road pattern or texture markings
- tower wider than the grass tile footprint
- embedded fire/water orb on 덕배 or 후추
- orc frames without alternating movement
- fairy frames without visible wing position change
- arrow frames that do not cover eight headings
- fire and aqua bursts that read as flat Canvas circles

- [ ] **Step 5: Write the approval handoff document**

Create `docs/assets/redesign-preview-v1.md` with:

```markdown
# 후추 디펜스 3D 리뉴얼 대표 시안 v1

## 출력

- Blender 원본: `assets/blender/td-redesign-preview-v1.blend`
- Contact sheet: `assets/renders/redesign-preview-v1/redesign-preview-contact-sheet.png`
- Master: `assets/renders/redesign-preview-v1/master/`
- Mobile: `assets/renders/redesign-preview-v1/mobile/`

## 자동 검증

- 21개 asset / master·mobile 42개 PNG 존재
- master frame 256×256
- mobile frame 128×128
- 모든 PNG 네 모서리 alpha 0
- contract unit test 통과

## 사용자 확인 항목

- 맵과 캐릭터의 카메라·조명 통일
- 무늬 없는 길과 명확한 직선·코너
- 한 타일 타워 크기
- 후추·덕배 캐릭터에 투사체가 포함되지 않음
- 보행·날개짓이 읽히는 프레임 변화
- 방향성 화살과 입체적인 불·물 효과

승인 전에는 전체 방향·전체 애니메이션 batch와 게임 코드 연결을 시작하지 않는다.
```

- [ ] **Step 6: Run focused and repository validation**

Run:

```bash
npx vitest run tests/assets/redesignPreviewContract.test.ts
npm run assets:preview:validate
npm run check
git diff --check
```

Expected:

- contract: `2 passed`
- assets: `VALIDATED 21 assets / 42 PNG files`
- repository: all unit tests PASS and Vite production build succeeds
- diff check: no output

- [ ] **Step 7: Commit the approval package**

```bash
git add tools/assets/buildRedesignPreviewSheet.mjs assets/renders/redesign-preview-v1/redesign-preview-contact-sheet.png docs/assets/redesign-preview-v1.md
git commit -m "docs: add 3d redesign preview approval board"
```

- [ ] **Step 8: Stop at the user approval gate**

Show the contact sheet inline and ask the user to approve or name the cards that need revision. Do not execute full asset batch rendering, projection changes, gameplay changes, Material 3 UI, or scoring work in this task.

---

## Post-Approval Boundary

After the user approves `redesign-preview-contact-sheet.png`, write two new implementation plans against the approved output contract:

1. full 2.5D asset batch, projection, animated renderer, HP, projectile, and boss presentation
2. adjacent pending placement, Material 3 HUD, scoring, persistence, outcome UI, and end-to-end verification

Those plans must name the final approved asset version and must not overwrite `redesign-preview-v1` evidence.
