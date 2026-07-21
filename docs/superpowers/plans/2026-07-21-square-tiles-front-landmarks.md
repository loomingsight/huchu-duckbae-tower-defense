# Square Tiles and Front-Facing Landmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 20×10 게임 규칙을 유지하면서 모든 가로형 화면에서 타일을 1:1에 가깝게 투영하고, 시작점 구조물을 제거하며, 보물상자를 바닥판 없는 정면형 3D 에셋으로 교체한다.

**Architecture:** `layout.ts`가 가로·세로 제한에서 하나의 기준 셀 크기를 고르고 중앙 깊이 배율로 행 간격을 계산한다. 맵·입력·엔티티는 기존 `projection.ts`를 계속 공유하며, `drawMap.ts`는 시작점을 생략하고 마지막 경로 셀에 정면형 보물상자만 접지한다. 보물상자는 기존 procedural Blender 생성기를 수정하고 Blender MCP로 map 그룹을 다시 렌더링한다.

**Tech Stack:** TypeScript 5.8, HTML Canvas 2D, Vite 7, Vitest 3, Playwright, Blender 5.2/Python `bpy`, Blender MCP

## Global Constraints

- 사용자가 지정한 단일 에이전트 방식으로 실행하며 서브에이전트를 사용하지 않는다.
- 20×10 스테이지와 `{ col: 0, row: 2 }`→`{ col: 19, row: 3 }` 경로를 유지한다.
- 원근 배율은 위쪽 `0.88`, 아래쪽 `1.05`, 중앙 깊이 `0.965`를 사용한다.
- 중앙 타일 가로/세로 비율은 `1.0`, 위·아래 경계 비율은 각각 약 `0.912`, `1.088`이다.
- 보드의 최대 사용 영역은 캔버스 너비 96%, 높이 90%이며 잘림 없이 중앙 정렬한다.
- 시작점 구조물은 그리지 않고 첫 경로 셀을 단색 모래 길로만 유지한다.
- 보물상자는 Blender로 다시 생성하며 타일 베이스와 배경을 포함하지 않고 정면을 본다.
- Vite base `/huchu-duckbae-tower-defense/`와 게임 수치·웨이브·비용을 변경하지 않는다.
- 새 런타임 의존성을 추가하지 않는다.

---

## File Structure

- Modify: `src/game/render/layout.ts` — 단일 기준 셀 크기와 중앙 1:1 투영 레이아웃 계산
- Modify: `tests/game/layout.test.ts` — 실제 맵 영역과 셀 기준 크기 계약
- Modify: `tests/game/projection.test.ts` — 위·중앙·아래 타일 비율과 새 원근 배율 계약
- Modify: `src/game/render/drawMap.ts` — 시작점 제거와 보물상자 전용 접지 렌더링
- Modify: `tests/game/mapRendering.test.ts` — 시작점 미렌더링과 보물 렌더링 계약
- Modify: `tools/blender/redesign_preview.py` — 보물상자 타일 베이스 제거, 접지, 카메라 정면 회전
- Modify: `tests/assets/redesignPreviewContract.test.ts` — Blender 생성기 정적 계약
- Modify: `assets/blender/td-redesign-preview-v1.blend` — Blender MCP가 저장하는 최신 원본
- Modify: `assets/renders/redesign-preview-v1/master/map/snack-chest.png` — 256px 정면형 원본 렌더
- Modify: `assets/renders/redesign-preview-v1/mobile/map/snack-chest.png` — 128px 게임 렌더
- Modify: `docs/qa/landscape-844x390.png` — 최종 모바일 가로 QA 캡처

---

### Task 1: Square-Aware Perspective Layout

**Files:**
- Modify: `tests/game/layout.test.ts`
- Modify: `tests/game/projection.test.ts`
- Modify: `src/game/render/layout.ts`

**Interfaces:**
- Consumes: `GRID_WIDTH`, `GRID_HEIGHT`, `computeCanvasLayout()`, `projectWorldPoint()`
- Produces: `CanvasLayout.projection` with `farScale=0.88`, `nearScale=1.05`, `rowStep=baseCellWidth*0.965`
- Produces: `mapArea` containing the near edge envelope of the full projected board

- [ ] **Step 1: Write failing aspect-ratio and layout tests**

Update `tests/game/projection.test.ts` to assert the approved scale values and add:

```ts
function aspectAtRow(layout: ReturnType<typeof computeCanvasLayout>, row: number): number {
  const left = projectWorldPoint(layout, { x: 10, y: row });
  const right = projectWorldPoint(layout, { x: 11, y: row });
  return (right.x - left.x) / layout.projection.rowStep;
}

it.each([
  { viewport: { width: 844, height: 390, dpr: 1 } },
  { viewport: { width: 1280, height: 720, dpr: 1 } },
])('keeps projected tiles visually square in $viewport', ({ viewport }) => {
  const candidate = computeCanvasLayout(viewport);
  expect(aspectAtRow(candidate, 0)).toBeCloseTo(0.88 / 0.965, 2);
  expect(aspectAtRow(candidate, GRID_HEIGHT / 2)).toBeCloseTo(1, 2);
  expect(aspectAtRow(candidate, GRID_HEIGHT)).toBeCloseTo(1.05 / 0.965, 2);
});
```

Update `tests/game/layout.test.ts` so the landscape case asserts:

```ts
expect(layout.mapArea.width).toBeLessThanOrEqual(844 * 0.96);
expect(layout.mapArea.height).toBeLessThanOrEqual(390 * 0.90);
expect(layout.projection.farScale).toBe(0.88);
expect(layout.projection.nearScale).toBe(1.05);
expect(layout.projection.rowStep)
  .toBeCloseTo(layout.projection.baseCellWidth * 0.965);
expect(layout.tileWidth).toBeCloseTo(layout.projection.baseCellWidth);
expect(layout.tileHeight).toBeCloseTo(layout.projection.rowStep);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npx vitest run tests/game/layout.test.ts tests/game/projection.test.ts
```

Expected: FAIL because the current constants are `0.75`/`1.10`, the map dimensions are independently fixed, and `rowStep` is not derived from the middle scale.

- [ ] **Step 3: Implement the minimal shared-size layout**

In `src/game/render/layout.ts`, replace the old independent width/height calculations with:

```ts
const MAP_WIDTH_RATIO = 0.96;
const MAP_HEIGHT_RATIO = 0.90;
const FAR_SCALE = 0.88;
const NEAR_SCALE = 1.05;
const MID_SCALE = (FAR_SCALE + NEAR_SCALE) / 2;

const maxMapWidth = width * MAP_WIDTH_RATIO;
const maxMapHeight = height * MAP_HEIGHT_RATIO;
const widthLimitedCell = maxMapWidth / (GRID_WIDTH * NEAR_SCALE);
const heightLimitedCell = maxMapHeight / (GRID_HEIGHT * MID_SCALE);
const baseCellWidth = Math.max(
  Number.EPSILON,
  Math.min(widthLimitedCell, heightLimitedCell),
);
const rowStep = baseCellWidth * MID_SCALE;
const mapWidth = baseCellWidth * GRID_WIDTH * NEAR_SCALE;
const mapHeight = rowStep * GRID_HEIGHT;
const centerX = width / 2;
const topY = Math.max(0, (height - mapHeight) / 2);
const mapArea = {
  x: centerX - mapWidth / 2,
  y: topY,
  width: mapWidth,
  height: mapHeight,
};
```

Return `tileWidth: baseCellWidth`, `tileHeight: rowStep`, and keep `cellSize: baseCellWidth`. Remove unused isometric constants and calculations.

- [ ] **Step 4: Run focused and input tests and verify GREEN**

Run:

```bash
npx vitest run tests/game/layout.test.ts tests/game/projection.test.ts tests/app/input.test.ts
```

Expected: all focused tests PASS and inverse projection/touch tests remain green.

- [ ] **Step 5: Commit the layout slice**

```bash
git add src/game/render/layout.ts tests/game/layout.test.ts tests/game/projection.test.ts
git commit -m "feat: keep perspective tiles visually square"
```

---

### Task 2: Remove the Entry Structure from Rendering

**Files:**
- Modify: `tests/game/mapRendering.test.ts`
- Modify: `src/game/render/drawMap.ts`

**Interfaces:**
- Consumes: `STAGE_1.pathCells`, `assets.map.snackChest`, shared projection
- Produces: map draw calls containing `map-snack-chest` but never `map-entry`

- [ ] **Step 1: Change the map rendering contract first**

In `tests/game/mapRendering.test.ts`, change the landmark assertions to:

```ts
const tags = calls.filter((call) => call.method === 'drawImage').map(imageTag);
expect(tags).not.toContain('map-entry');
expect(tags).toContain('map-snack-chest');
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run tests/game/mapRendering.test.ts
```

Expected: FAIL because `drawMap()` still draws `assets.map.entry`.

- [ ] **Step 3: Remove only the entry draw call**

In `src/game/render/drawMap.ts`, remove the `entrance` variable and `drawLandmark(...assets.map.entry...)` call. Keep the chest anchored to the final path cell:

```ts
const chest = STAGE_1.pathCells[STAGE_1.pathCells.length - 1];
drawLandmark(ctx, layout, assets.map.snackChest, chest, 2.05, 0.86);
```

Do not remove `entry.png` from the manifest or asset loader; it remains a retained source artifact and is simply unused at runtime.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npx vitest run tests/game/mapRendering.test.ts tests/game/renderer.test.ts
```

Expected: both test files PASS.

- [ ] **Step 5: Commit the renderer slice**

```bash
git add src/game/render/drawMap.ts tests/game/mapRendering.test.ts
git commit -m "feat: remove the map entry structure"
```

---

### Task 3: Rebuild the Snack Chest as a Front-Facing 3D Asset

**Files:**
- Modify: `tests/assets/redesignPreviewContract.test.ts`
- Modify: `tools/blender/redesign_preview.py`
- Modify: `assets/blender/td-redesign-preview-v1.blend`
- Modify: `assets/renders/redesign-preview-v1/master/map/snack-chest.png`
- Modify: `assets/renders/redesign-preview-v1/mobile/map/snack-chest.png`

**Interfaces:**
- Consumes: `CAMERA_SPEC`, `_ACTIVE_ASSET_COLLECTION`, `Matrix`, `render_group('map')`
- Produces: `CHEST_FRONT_YAW`, `_transform_active_asset()`, a grounded transparent chest facing the common preview camera

- [ ] **Step 1: Write the failing Blender source contract**

Add `readFileSync` from `node:fs` and this test to `tests/assets/redesignPreviewContract.test.ts`:

```ts
it('builds the snack chest without a tile base and faces it toward the camera', () => {
  const source = readFileSync('tools/blender/redesign_preview.py', 'utf8');
  const match = source.match(
    /def build_snack_chest\(\) -> None:\n([\s\S]*?)\n\nMAP_BUILDERS =/,
  );
  expect(match).not.toBeNull();
  const body = match?.[1] ?? '';
  expect(body).not.toContain('tile_base()');
  expect(body).toContain('_transform_active_asset(CHEST_FRONT_YAW, CHEST_GROUND_OFFSET)');
  expect(source).toContain('CHEST_FRONT_YAW = math.atan2(');
  expect(source).toContain('CHEST_GROUND_OFFSET = -0.26');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run tests/assets/redesignPreviewContract.test.ts
```

Expected: FAIL because the current chest calls `tile_base()` and defines no front-facing transform.

- [ ] **Step 3: Implement the procedural chest transform**

After `CAMERA_SPEC` in `tools/blender/redesign_preview.py`, define:

```py
CHEST_FRONT_YAW = math.atan2(
    float(CAMERA_SPEC["location"][1]),
    float(CAMERA_SPEC["location"][0]),
) + math.pi / 2
CHEST_GROUND_OFFSET = -0.26
```

Before `build_snack_chest()`, add:

```py
def _transform_active_asset(yaw: float, z_offset: float) -> None:
    if _ACTIVE_ASSET_COLLECTION is None:
        raise AssertionError("No active asset collection for transform")
    transform = Matrix.Translation((0.0, 0.0, z_offset)) @ Matrix.Rotation(yaw, 4, "Z")
    for obj in _ACTIVE_ASSET_COLLECTION.objects:
        if obj.type == "MESH":
            obj.matrix_world = transform @ obj.matrix_world
```

Remove `tile_base()` from `build_snack_chest()` and call `_transform_active_asset(CHEST_FRONT_YAW, CHEST_GROUND_OFFSET)` after the biscuit is created.

- [ ] **Step 4: Run the focused source contract and verify GREEN**

Run:

```bash
npx vitest run tests/assets/redesignPreviewContract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Render the map group through Blender MCP**

Call `mcp__blender__execute_blender_code` with:

```py
script = "/private/tmp/huchu-defense-v2-3d-preview/tools/blender/redesign_preview.py"
namespace = {"__file__": script, "__name__": "td_redesign_preview"}
with open(script, "r", encoding="utf-8") as handle:
    exec(compile(handle.read(), script, "exec"), namespace)
namespace["render_group"]("map")
```

Expected Blender result: `RENDERED GROUP map`; the blend file and map renders are saved inside the isolated worktree.

- [ ] **Step 6: Validate and inspect the generated asset**

Run:

```bash
npm run assets:preview:validate -- --group map
git status --short
```

Expected: validator exits 0; inspect `assets/renders/redesign-preview-v1/mobile/map/snack-chest.png` and confirm transparent background, no platform, visible front latch/snacks, and ground contact.

- [ ] **Step 7: Commit the Blender asset slice**

```bash
git add tests/assets/redesignPreviewContract.test.ts tools/blender/redesign_preview.py assets/blender/td-redesign-preview-v1.blend assets/renders/redesign-preview-v1/master/map assets/renders/redesign-preview-v1/mobile/map
git commit -m "feat: face the snack chest toward the player"
```

---

### Task 4: Mobile Play Verification and QA Capture

**Files:**
- Modify: `docs/qa/landscape-844x390.png`
- Verify: `e2e/game.spec.ts`

**Interfaces:**
- Consumes: shared projection used by `canvasPositionForCell()`
- Produces: fresh automated evidence and a user-reviewable 844×390 screenshot

- [ ] **Step 1: Run all unit tests and production build**

Run `npm run check`.

Expected: all Vitest files PASS and the Vite production build exits 0.

- [ ] **Step 2: Run the complete browser suite**

Run `npm run test:e2e`.

Expected: 4/4 Playwright tests PASS, including placement through the new shared projection.

- [ ] **Step 3: Regenerate the landscape QA screenshot**

Run:

```bash
UPDATE_QA_SCREENSHOTS=1 npx playwright test e2e/game.spec.ts --grep "844x390 touch flow"
```

Expected: the focused test PASS and `docs/qa/landscape-844x390.png` is updated.

- [ ] **Step 4: Perform visual and repository checks**

Inspect the screenshot and verify no starting structure, a front-facing platform-free chest, square center tiles, grounded tower, and a fully visible board.

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only the intentional QA screenshot remains uncommitted.

- [ ] **Step 5: Commit the final QA evidence**

```bash
git add docs/qa/landscape-844x390.png
git commit -m "test: capture square-tile mobile gameplay"
```

- [ ] **Step 6: Verify the final branch state**

Run:

```bash
npm run check
npm run test:e2e
git status --short
```

Expected: all unit tests, build, and 4 E2E tests PASS; `git status --short` prints nothing.
