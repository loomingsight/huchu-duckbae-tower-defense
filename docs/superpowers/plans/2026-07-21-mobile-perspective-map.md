# Mobile Perspective Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 20×10 게임 규칙은 유지하면서 모바일 가로 화면의 맵을 좌→우 사다리꼴 원근 시점으로 바꾸고, 녹색 비길 타일·정면 캐릭터·깊이별 확대·정확한 터치 배치를 제공한다.

**Architecture:** `layout.ts`는 보드 영역과 원근 파라미터를 계산하고, 새 `projection.ts`가 월드/화면 좌표 변환의 유일한 소스가 된다. 맵·입력·엔티티·투사체는 모두 이 공통 투영을 사용하며, 시뮬레이션 좌표·경로·전투 밸런스에는 손대지 않는다.

**Tech Stack:** TypeScript 5.8, HTML Canvas 2D, Vite 7, Vitest 3, Playwright

## Global Constraints

- 실행은 사용자가 지정한 단일 에이전트 방식으로 진행하고 서브에이전트를 사용하지 않는다.
- 기존 20×10 그리드와 `{ col: 0, row: 2 }`→`{ col: 19, row: 3 }` 경로를 유지한다.
- 맵 폭은 844×390 기준 캔버스의 92%, 높이는 76%로 계산하고 전체 맵을 자르지 않는다.
- 원근 배율은 위쪽 0.75, 아래쪽 1.10이며 캐릭터 기준 배율 1.25를 한 번만 곱한다.
- 비길 타일은 `#4f8c65`/`#5d9a70`, 길은 무늬 없는 `#e4c99f`를 사용한다.
- 몬스터와 후추·덕배는 항상 카메라 정면을 보며, 화살 타워와 화살 투사체만 목표 방향을 추적한다.
- Vite base `/huchu-duckbae-tower-defense/`와 기존 게임 데이터·배치 규칙·전투 수치를 변경하지 않는다.
- 새 런타임 의존성을 추가하지 않는다.

---

## File Structure

- Create: `src/game/render/projection.ts` — 원근 투영, 역투영, 셀 다각형, 원형 가이드, 시각 배율의 단일 소스
- Create: `tests/game/projection.test.ts` — 투영 왕복, 배율, 경계, 화면 점유율 계약
- Modify: `src/game/render/layout.ts` — 92%×76% 보드와 원근 파라미터 계산
- Modify: `tests/game/layout.test.ts` — 새 레이아웃 계약 검증
- Modify: `src/app/input.ts` — 공통 역투영과 셀 다각형 검증 사용
- Modify: `tests/app/input.test.ts` — CSS 배율·사다리꼴 외부·비정상 입력 검증
- Modify: `e2e/game.spec.ts` — 런타임과 같은 순수 투영 함수로 셀 중심 클릭
- Modify: `src/game/render/drawMap.ts` — 녹색/모래색 사다리꼴 보드, 3D 측면, 원근 사거리 가이드
- Create: `tests/game/mapRendering.test.ts` — 타일 색·무늬 제거·랜드마크·가이드 렌더 계약
- Modify: `src/game/render/drawEntities.ts` — 정면 고정, 화면 Y 깊이 정렬, 접지, 깊이별 크기
- Modify: `tests/game/direction.test.ts` — 화면 벡터 기반 화살 타워 방향 계약
- Modify: `tests/game/renderTestUtils.ts` — 방향별 이미지 태그를 구분하는 테스트 에셋
- Modify: `tests/game/renderer.test.ts` — 정면 모션·접지·깊이 정렬·크기 검증
- Modify: `src/game/render/drawEffects.ts` — 투사체·폭발·HP 보조 효과에 공통 투영/배율 적용
- Modify: `docs/qa/landscape-844x390.png` — 최종 모바일 가로 기준 캡처

---

### Task 0: Preserve the Current Playable MVP Baseline

**Files:**
- Verify: all currently modified and untracked MVP files shown by `git status --short`
- Commit: current playable MVP changes only; exclude `.superpowers/`, `dist/`, and `test-results/`

**Interfaces:**
- Consumes: current branch `codex/3d-preview-assets` at design commit `24a16ce`
- Produces: a clean, tested baseline commit before the camera refactor

- [ ] **Step 1: Verify the current baseline before staging**

Run:

```bash
git status --short
npm run check
git diff --check
```

Expected: `npm run check` exits 0, `git diff --check` prints nothing, and the status contains only the previously reviewed MVP/gameplay/grounding/backlog files.

- [ ] **Step 2: Stage the exact current MVP set**

Run:

```bash
git add e2e/game.spec.ts src/app/GameApp.ts src/app/gameRuntime.ts src/app/hud.ts src/app/input.ts src/app/preferences.ts src/game/combat/updateProjectiles.ts src/game/map/stage1.ts src/game/render/assetLoader.ts src/game/render/canvasRenderer.ts src/game/render/drawEffects.ts src/game/render/drawEntities.ts src/game/render/drawMap.ts src/game/render/layout.ts src/game/render/spriteManifest.ts src/game/render/spriteSheet.ts src/game/scoring.ts src/game/simulation/createGame.ts src/game/simulation/placeTower.ts src/game/simulation/updateEnemies.ts src/game/simulation/updateGame.ts src/game/simulation/updateWaves.ts src/styles.css tests/app/hud.test.ts tests/app/input.test.ts tests/app/preferences.test.ts tests/game/assetLoader.test.ts tests/game/combat.test.ts tests/game/direction.test.ts tests/game/layout.test.ts tests/game/outcome.test.ts tests/game/placement.test.ts tests/game/renderTestUtils.ts tests/game/renderer.test.ts tests/game/scoring.test.ts docs/backlog.md
git diff --cached --check
git diff --cached --name-only
```

Expected: the cached check prints nothing; the cached list matches the command above and does not contain the design/plan docs, generated browser files, `dist`, or `test-results`.

- [ ] **Step 3: Commit the verified baseline**

```bash
git commit -m "feat: complete playable tower defense mvp"
```

Expected: one commit is created and `git status --short` is empty before Task 1.

---

### Task 1: Shared Perspective Projection and Layout

**Files:**
- Create: `src/game/render/projection.ts`
- Create: `tests/game/projection.test.ts`
- Modify: `src/game/render/layout.ts`
- Modify: `tests/game/layout.test.ts`

**Interfaces:**
- Consumes: `GRID_WIDTH`, `GRID_HEIGHT`, `CanvasLayout`, `Cell`, and `Vec2`
- Produces: `projectWorldPoint`, `projectCellPolygon`, `perspectiveScaleAt`, `visualScaleAt`, `unprojectScreenPoint`, `isScreenPointInsidePolygon`, `projectWorldRing`, `isRenderableWorldPoint`
- Produces: `CanvasLayout.projection` with `centerX`, `topY`, `baseCellWidth`, `rowStep`, `farScale`, `nearScale`

- [ ] **Step 1: Write failing projection and layout tests**

Create `tests/game/projection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { GRID_HEIGHT, GRID_WIDTH } from '../../src/game/config';
import { computeCanvasLayout } from '../../src/game/render/layout';
import {
  perspectiveScaleAt,
  projectCellPolygon,
  projectWorldRing,
  projectWorldPoint,
  unprojectScreenPoint,
  visualScaleAt,
} from '../../src/game/render/projection';

describe('perspective projection', () => {
  const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 2 });

  it('uses the approved far, near, and character scale values', () => {
    expect(perspectiveScaleAt(layout, 0)).toBeCloseTo(0.75);
    expect(perspectiveScaleAt(layout, GRID_HEIGHT)).toBeCloseTo(1.1);
    expect(visualScaleAt(layout, 0)).toBeCloseTo(0.9375);
    expect(visualScaleAt(layout, GRID_HEIGHT)).toBeCloseTo(1.375);
  });

  it('keeps the entrance left of the snack chest', () => {
    const entrance = projectWorldPoint(layout, { x: 0.5, y: 2.5 });
    const chest = projectWorldPoint(layout, { x: 19.5, y: 3.5 });
    expect(entrance.x).toBeLessThan(chest.x);
  });

  it('makes near cells wider than far cells', () => {
    const far = projectCellPolygon(layout, { col: 10, row: 0 });
    const near = projectCellPolygon(layout, { col: 10, row: 9 });
    expect(near[1].x - near[0].x).toBeGreaterThan(far[1].x - far[0].x);
  });

  it.each([
    { x: 0.5, y: 0.5 },
    { x: 5.25, y: 7.5 },
    { x: 12.5, y: 3.5 },
    { x: 19.5, y: 9.5 },
  ])('round-trips world point %o', (world) => {
    const screen = projectWorldPoint(layout, world);
    const restored = unprojectScreenPoint(layout, screen);
    expect(restored?.x).toBeCloseTo(world.x, 1);
    expect(restored?.y).toBeCloseTo(world.y, 1);
  });

  it('keeps every board corner inside the map bounds', () => {
    const points = [
      ...projectCellPolygon(layout, { col: 0, row: 0 }),
      ...projectCellPolygon(layout, { col: GRID_WIDTH - 1, row: 0 }),
      ...projectCellPolygon(layout, { col: 0, row: GRID_HEIGHT - 1 }),
      ...projectCellPolygon(layout, { col: GRID_WIDTH - 1, row: GRID_HEIGHT - 1 }),
    ];
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(layout.mapArea.x - 0.5);
      expect(point.x).toBeLessThanOrEqual(layout.mapArea.x + layout.mapArea.width + 0.5);
      expect(point.y).toBeGreaterThanOrEqual(layout.mapArea.y - 0.5);
      expect(point.y).toBeLessThanOrEqual(layout.mapArea.y + layout.mapArea.height + 0.5);
    }
  });

  it('rejects non-finite and outside inverse points', () => {
    expect(unprojectScreenPoint(layout, { x: Number.NaN, y: 10 })).toBeNull();
    expect(unprojectScreenPoint(layout, { x: 0, y: 0 })).toBeNull();
    expect(projectWorldRing(layout, { x: 2.5, y: 2.5 }, Number.MAX_VALUE)).toEqual([]);
  });
});
```

Replace the landscape test in `tests/game/layout.test.ts` with:

```ts
it('fits the full perspective board inside a 844 by 390 landscape viewport', () => {
  const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });

  expect(layout.showOrientationPrompt).toBe(false);
  expect(layout.gameArea).toEqual({ x: 0, y: 0, width: 844, height: 390 });
  expect(layout.mapArea.width / layout.gameArea.width).toBeCloseTo(0.92);
  expect(layout.mapArea.height / layout.gameArea.height).toBeCloseTo(0.76);
  expect(layout.projection.centerX).toBeCloseTo(422);
  expect(layout.projection.topY).toBeCloseTo(layout.mapArea.y);
  expect(layout.projection.farScale).toBe(0.75);
  expect(layout.projection.nearScale).toBe(1.1);
  expect(layout.mapArea.x).toBeGreaterThanOrEqual(layout.gameArea.x);
  expect(layout.mapArea.y).toBeGreaterThanOrEqual(layout.gameArea.y);
  expect(layout.mapArea.x + layout.mapArea.width).toBeLessThanOrEqual(844);
  expect(layout.mapArea.y + layout.mapArea.height).toBeLessThanOrEqual(390);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npm test -- tests/game/projection.test.ts tests/game/layout.test.ts
```

Expected: FAIL because `src/game/render/projection.ts` and `layout.projection` do not exist.

- [ ] **Step 3: Implement the layout contract**

Replace `src/game/render/layout.ts` with:

```ts
import { GRID_HEIGHT, GRID_WIDTH } from '../config';

const MAX_DEVICE_PIXEL_RATIO = 2;
const TILE_HEIGHT_RATIO = 0.44;
const MAP_WIDTH_RATIO = 0.92;
const MAP_HEIGHT_RATIO = 0.76;
const MAP_TOP_RATIO = 0.1;
const MAP_BOTTOM_PADDING = 6;
const FAR_SCALE = 0.75;
const NEAR_SCALE = 1.1;

export type Viewport = { width: number; height: number; dpr?: number };
export type CanvasRect = { x: number; y: number; width: number; height: number };
export type PerspectiveProjection = Readonly<{
  centerX: number;
  topY: number;
  baseCellWidth: number;
  rowStep: number;
  farScale: number;
  nearScale: number;
}>;

export type CanvasLayout = {
  viewport: Readonly<{ width: number; height: number }>;
  gameArea: Readonly<CanvasRect>;
  mapArea: Readonly<CanvasRect>;
  mapOrigin: Readonly<{ x: number; y: number }>;
  projection: PerspectiveProjection;
  tileWidth: number;
  tileHeight: number;
  cellSize: number;
  dpr: number;
  backingWidth: number;
  backingHeight: number;
  showOrientationPrompt: boolean;
};

function positiveDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function computeCanvasLayout(viewport: Viewport): CanvasLayout {
  const width = positiveDimension(viewport.width);
  const height = positiveDimension(viewport.height);
  const requestedDpr = Number.isFinite(viewport.dpr) ? viewport.dpr ?? 1 : 1;
  const dpr = Math.min(MAX_DEVICE_PIXEL_RATIO, Math.max(1, requestedDpr));
  const gameArea = { x: 0, y: 0, width, height };

  const dimensionSum = GRID_WIDTH + GRID_HEIGHT;
  const horizontalVisualUnit = Math.max(Number.EPSILON, (width - 12) * 2 / dimensionSum);
  const visualTopPadding = Math.max(8, height * MAP_TOP_RATIO);
  const visualAvailableHeight = Math.max(Number.EPSILON, height - visualTopPadding - MAP_BOTTOM_PADDING);
  const verticalVisualUnit = visualAvailableHeight * 2 / (dimensionSum * TILE_HEIGHT_RATIO);
  const tileWidth = Math.max(Number.EPSILON, Math.min(horizontalVisualUnit, verticalVisualUnit));
  const tileHeight = tileWidth * TILE_HEIGHT_RATIO;

  const mapWidth = width * MAP_WIDTH_RATIO;
  const mapHeight = height * MAP_HEIGHT_RATIO;
  const centerX = width / 2;
  const preferredTop = Math.max(8, height * MAP_TOP_RATIO);
  const topY = Math.max(0, Math.min(preferredTop, height - mapHeight));
  const baseCellWidth = mapWidth / (GRID_WIDTH * NEAR_SCALE);
  const rowStep = mapHeight / GRID_HEIGHT;
  const mapArea = {
    x: centerX - mapWidth / 2,
    y: topY,
    width: mapWidth,
    height: mapHeight,
  };

  return {
    viewport: { width, height },
    gameArea,
    mapArea,
    mapOrigin: { x: centerX, y: topY },
    projection: { centerX, topY, baseCellWidth, rowStep, farScale: FAR_SCALE, nearScale: NEAR_SCALE },
    tileWidth,
    tileHeight,
    cellSize: baseCellWidth,
    dpr,
    backingWidth: Math.max(1, Math.round(width * dpr)),
    backingHeight: Math.max(1, Math.round(height * dpr)),
    showOrientationPrompt: height > width,
  };
}

export function alignToDevicePixel(value: number, dpr: number): number {
  return Math.round(value * dpr) / dpr;
}
```

- [ ] **Step 4: Implement the shared projection module**

Create `src/game/render/projection.ts`:

```ts
import { GRID_HEIGHT, GRID_WIDTH } from '../config';
import type { Cell, Vec2 } from '../types';
import type { CanvasLayout } from './layout';
import { alignToDevicePixel } from './layout';

export type ScreenPoint = Readonly<{ x: number; y: number }>;
export type CellPolygon = readonly [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];

const CHARACTER_BASE_SCALE = 1.25;

function finitePoint(point: Readonly<Vec2>): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function perspectiveScaleAt(layout: CanvasLayout, row: number): number {
  if (!Number.isFinite(row)) return Number.NaN;
  const depth = Math.max(0, Math.min(1, row / GRID_HEIGHT));
  return layout.projection.farScale
    + (layout.projection.nearScale - layout.projection.farScale) * depth;
}

export function visualScaleAt(layout: CanvasLayout, row: number): number {
  return CHARACTER_BASE_SCALE * perspectiveScaleAt(layout, row);
}

export function projectWorldPoint(layout: CanvasLayout, point: Readonly<Vec2>): ScreenPoint {
  if (!finitePoint(point)) return { x: Number.NaN, y: Number.NaN };
  const scale = perspectiveScaleAt(layout, point.y);
  const x = layout.projection.centerX
    + (point.x - GRID_WIDTH / 2) * layout.projection.baseCellWidth * scale;
  const y = layout.projection.topY + point.y * layout.projection.rowStep;
  return {
    x: alignToDevicePixel(x, layout.dpr),
    y: alignToDevicePixel(y, layout.dpr),
  };
}

export function projectCellPolygon(layout: CanvasLayout, cell: Readonly<Cell>): CellPolygon {
  return [
    projectWorldPoint(layout, { x: cell.col, y: cell.row }),
    projectWorldPoint(layout, { x: cell.col + 1, y: cell.row }),
    projectWorldPoint(layout, { x: cell.col + 1, y: cell.row + 1 }),
    projectWorldPoint(layout, { x: cell.col, y: cell.row + 1 }),
  ];
}

export function unprojectScreenPoint(layout: CanvasLayout, point: ScreenPoint): Vec2 | null {
  if (!finitePoint(point)) return null;
  const row = (point.y - layout.projection.topY) / layout.projection.rowStep;
  const scale = perspectiveScaleAt(layout, row);
  const col = GRID_WIDTH / 2
    + (point.x - layout.projection.centerX) / (layout.projection.baseCellWidth * scale);
  if (
    !Number.isFinite(col)
    || !Number.isFinite(row)
    || col < 0
    || col >= GRID_WIDTH
    || row < 0
    || row >= GRID_HEIGHT
  ) return null;
  return { x: col, y: row };
}

export function isScreenPointInsidePolygon(
  point: ScreenPoint,
  polygon: readonly ScreenPoint[],
): boolean {
  if (!finitePoint(point) || polygon.length < 3 || polygon.some((vertex) => !finitePoint(vertex))) {
    return false;
  }
  let sign = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const cross = (next.x - current.x) * (point.y - current.y)
      - (next.y - current.y) * (point.x - current.x);
    if (Math.abs(cross) <= 1e-7) continue;
    const currentSign = Math.sign(cross);
    if (sign !== 0 && currentSign !== sign) return false;
    sign = currentSign;
  }
  return true;
}

export function projectWorldRing(
  layout: CanvasLayout,
  center: Readonly<Vec2>,
  radius: number,
  segments = 48,
): readonly ScreenPoint[] {
  if (!finitePoint(center) || !Number.isFinite(radius) || radius <= 0) return [];
  const requestedSegments = Number.isFinite(segments) ? segments : 48;
  const count = Math.max(8, Math.min(128, Math.floor(requestedSegments)));
  const points = Array.from({ length: count }, (_, index) => {
    const angle = index / count * Math.PI * 2;
    return projectWorldPoint(layout, {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  });
  return points.every(finitePoint) ? points : [];
}

export function isRenderableWorldPoint(layout: CanvasLayout, point: Readonly<Vec2>): boolean {
  if (!finitePoint(point)) return false;
  const screen = projectWorldPoint(layout, point);
  if (!finitePoint(screen)) return false;
  const margin = layout.tileWidth * 4;
  return screen.x >= layout.gameArea.x - margin
    && screen.x <= layout.gameArea.x + layout.gameArea.width + margin
    && screen.y >= layout.gameArea.y - margin
    && screen.y <= layout.gameArea.y + layout.gameArea.height + margin;
}
```

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
npm test -- tests/game/projection.test.ts tests/game/layout.test.ts
git add src/game/render/projection.ts src/game/render/layout.ts tests/game/projection.test.ts tests/game/layout.test.ts
git diff --cached --check
git commit -m "feat: add shared perspective projection"
```

Expected: both test files pass and the commit contains exactly four files.

---

### Task 2: Perspective-Safe Mobile Input and E2E Cell Targeting

**Files:**
- Modify: `src/app/input.ts`
- Modify: `tests/app/input.test.ts`
- Modify: `e2e/game.spec.ts`

**Interfaces:**
- Consumes: `unprojectScreenPoint`, `projectCellPolygon`, `isScreenPointInsidePolygon`, `projectWorldPoint`
- Produces: unchanged `pointerToWorld(...) -> Vec2 | null` and `pointerToCell(...) -> Cell | null`

- [ ] **Step 1: Replace input tests with perspective cases**

Use this body for the first two tests in `tests/app/input.test.ts`:

```ts
it('converts scaled client coordinates through the shared inverse projection', () => {
  const layout = computeCanvasLayout({ width: 400, height: 300, dpr: 2 });
  const canvasRect = { left: 50, top: 20, width: 800, height: 600 };
  const world = { x: 2.5, y: 4.5 };
  const screen = projectWorldPoint(layout, world);
  const point = {
    x: canvasRect.left + screen.x * 2,
    y: canvasRect.top + screen.y * 2,
  };

  const converted = pointerToWorld(point, layout, canvasRect);
  expect(converted?.x).toBeCloseTo(world.x, 1);
  expect(converted?.y).toBeCloseTo(world.y, 1);
  expect(pointerToCell(point, layout, canvasRect)).toEqual({ col: 2, row: 4 });
});

it('rejects the wide map bounds outside the narrow top trapezoid and invalid inputs', () => {
  const layout = computeCanvasLayout({ width: 400, height: 300, dpr: 1 });
  const topOutside = {
    x: layout.mapArea.x + 1,
    y: layout.projection.topY + 1,
  };

  expect(pointerToCell(topOutside, layout)).toBeNull();
  expect(pointerToCell({ x: 10, y: 10 }, layout)).toBeNull();
  expect(pointerToCell({ x: Number.NaN, y: 100 }, layout)).toBeNull();
  expect(pointerToCell({ x: 100, y: Number.POSITIVE_INFINITY }, layout)).toBeNull();
});
```

Add this import:

```ts
import { projectWorldPoint } from '../../src/game/render/projection';
```

- [ ] **Step 2: Run input tests and verify RED**

Run:

```bash
npm test -- tests/app/input.test.ts
```

Expected: FAIL because `pointerToWorld` still uses the removed isometric fields.

- [ ] **Step 3: Route input through the shared inverse**

Replace the projection logic in `src/app/input.ts` with these imports and functions:

```ts
import type { CanvasLayout } from '../game/render/layout';
import {
  isScreenPointInsidePolygon,
  projectCellPolygon,
  unprojectScreenPoint,
} from '../game/render/projection';
import type { Cell, Vec2 } from '../game/types';

export function pointerToWorld(
  point: ClientPoint,
  layout: CanvasLayout,
  clientRect: ClientRect = defaultClientRect(layout),
): Vec2 | null {
  if (
    !Number.isFinite(point.x)
    || !Number.isFinite(point.y)
    || !Number.isFinite(clientRect.left)
    || !Number.isFinite(clientRect.top)
    || !Number.isFinite(clientRect.width)
    || !Number.isFinite(clientRect.height)
    || clientRect.width <= 0
    || clientRect.height <= 0
  ) return null;

  const screen = {
    x: (point.x - clientRect.left) * (layout.viewport.width / clientRect.width),
    y: (point.y - clientRect.top) * (layout.viewport.height / clientRect.height),
  };
  return unprojectScreenPoint(layout, screen);
}

export function pointerToCell(
  point: ClientPoint,
  layout: CanvasLayout,
  clientRect: ClientRect = defaultClientRect(layout),
): Cell | null {
  const world = pointerToWorld(point, layout, clientRect);
  if (world === null) return null;
  const cell = { col: Math.floor(world.x), row: Math.floor(world.y) };
  const screen = {
    x: (point.x - clientRect.left) * (layout.viewport.width / clientRect.width),
    y: (point.y - clientRect.top) * (layout.viewport.height / clientRect.height),
  };
  return isScreenPointInsidePolygon(screen, projectCellPolygon(layout, cell)) ? cell : null;
}
```

Remove the unused `GRID_WIDTH` and `GRID_HEIGHT` import.

- [ ] **Step 4: Make E2E clicks consume the same pure projection**

Add to `e2e/game.spec.ts`:

```ts
import { computeCanvasLayout } from '../src/game/render/layout';
import { projectWorldPoint } from '../src/game/render/projection';
```

Replace `canvasPositionForCell` with:

```ts
async function canvasPositionForCell(
  page: Page,
  col: number,
  row: number,
): Promise<{ x: number; y: number }> {
  const box = await page.locator('canvas').boundingBox();
  if (box === null) throw new Error('Canvas has no layout box');
  const layout = computeCanvasLayout({ width: box.width, height: box.height, dpr: 1 });
  return projectWorldPoint(layout, { x: col + 0.5, y: row + 0.5 });
}
```

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
npm test -- tests/app/input.test.ts tests/game/projection.test.ts
git add src/app/input.ts tests/app/input.test.ts e2e/game.spec.ts
git diff --cached --check
git commit -m "feat: align mobile input with perspective map"
```

Expected: focused tests pass and only the three input/E2E files are committed.

---

### Task 3: Green Trapezoid Board and Plain Road Rendering

**Files:**
- Modify: `src/game/render/drawMap.ts`
- Modify: `src/game/render/layout.ts`
- Create: `tests/game/mapRendering.test.ts`

**Interfaces:**
- Consumes: `projectCellPolygon`, `projectWorldPoint`, `projectWorldRing`, `visualScaleAt`
- Produces: unchanged `drawMap(ctx, layout, assets, selection)`

- [ ] **Step 1: Write failing map rendering tests**

Create `tests/game/mapRendering.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { drawMap } from '../../src/game/render/drawMap';
import { computeCanvasLayout } from '../../src/game/render/layout';
import { createRecordingContext, createTestAssets, imageTag } from './renderTestUtils';

describe('perspective map rendering', () => {
  it('draws green build tiles, plain sand roads, a board side, and only landmark sprites', () => {
    const { context, calls } = createRecordingContext();
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    drawMap(context, layout, createTestAssets());

    expect(calls.some((call) => call.method === 'fill' && call.fillStyle === '#4f8c65')).toBe(true);
    expect(calls.some((call) => call.method === 'fill' && call.fillStyle === '#5d9a70')).toBe(true);
    expect(calls.some((call) => call.method === 'fill' && call.fillStyle === '#e4c99f')).toBe(true);
    expect(calls.some((call) => call.method === 'fill' && call.fillStyle === '#2f6247')).toBe(true);
    const tags = calls.filter((call) => call.method === 'drawImage').map(imageTag);
    expect(tags).toContain('map-entry');
    expect(tags).toContain('map-snack-chest');
    expect(tags).not.toContain('map-grass');
    expect(tags.some((tag) => tag?.startsWith('map-road-') === true)).toBe(false);
  });

  it('renders selection and range as projected polygons instead of an isometric ellipse', () => {
    const { context, calls } = createRecordingContext();
    const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
    drawMap(context, layout, createTestAssets(), {
      cell: { col: 2, row: 1 },
      range: 3.2,
      valid: true,
    });

    expect(calls.some((call) => call.method === 'fill' && call.fillStyle === 'rgba(76, 214, 222, 0.13)')).toBe(true);
    expect(calls.some((call) => call.method === 'stroke' && call.strokeStyle === 'rgba(94, 228, 232, 0.62)')).toBe(true);
    expect(calls.some((call) => call.method === 'ellipse')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused map test and verify RED**

Run:

```bash
npm test -- tests/game/mapRendering.test.ts
```

Expected: FAIL because the current renderer draws grass/road sprites and diamonds.

- [ ] **Step 3: Replace diamond tiles with projected polygons**

In `src/game/render/drawMap.ts`, use these imports and drawing helpers:

```ts
import { cellCenter } from '../core/geometry';
import { STAGE_1 } from '../map/stage1';
import type { Cell } from '../types';
import type { GameAssets, LoadedSprite } from './assetLoader';
import type { CanvasLayout } from './layout';
import {
  projectCellPolygon,
  projectWorldPoint,
  projectWorldRing,
  visualScaleAt,
  type ScreenPoint,
} from './projection';
import { drawSpriteFrame } from './spriteSheet';

export {
  isRenderableWorldPoint as isRenderablePoint,
  projectWorldPoint as worldToScreen,
} from './projection';

const COLORS = {
  ground: '#17382f',
  grass: '#4f8c65',
  grassAlternate: '#5d9a70',
  road: '#e4c99f',
  boardSide: '#2f6247',
  grid: 'rgba(36, 74, 61, 0.3)',
  selected: 'rgba(50, 218, 220, 0.38)',
  selectedEdge: '#5ce1e6',
  invalid: 'rgba(255, 92, 92, 0.42)',
  invalidEdge: '#ff8b82',
  range: 'rgba(76, 214, 222, 0.13)',
  rangeEdge: 'rgba(94, 228, 232, 0.62)',
} as const;

function tracePoints(ctx: CanvasRenderingContext2D, points: readonly ScreenPoint[]): boolean {
  if (
    points.length === 0
    || points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))
  ) return false;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  return true;
}

function traceCell(ctx: CanvasRenderingContext2D, layout: CanvasLayout, cell: Readonly<Cell>): void {
  tracePoints(ctx, projectCellPolygon(layout, cell));
}

const PATH_KEYS = new Set(STAGE_1.pathCells.map((cell) => `${cell.col}:${cell.row}`));

function drawBoardThickness(ctx: CanvasRenderingContext2D, layout: CanvasLayout): void {
  const left = projectWorldPoint(layout, { x: 0, y: STAGE_1.height });
  const right = projectWorldPoint(layout, { x: STAGE_1.width, y: STAGE_1.height });
  const thickness = Math.max(5, layout.projection.rowStep * 0.22);
  tracePoints(ctx, [left, right, { x: right.x, y: right.y + thickness }, { x: left.x, y: left.y + thickness }]);
  ctx.fillStyle = COLORS.boardSide;
  ctx.fill();
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  cell: Readonly<Cell>,
  isRoad: boolean,
): void {
  traceCell(ctx, layout, cell);
  ctx.fillStyle = isRoad ? COLORS.road : cell.row % 2 === 0 ? COLORS.grass : COLORS.grassAlternate;
  ctx.fill();
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = Math.max(0.5, 1 / layout.dpr);
  ctx.stroke();
}

function drawLandmark(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  image: LoadedSprite,
  cell: Readonly<Cell>,
  sizeFactor: number,
  groundAnchor: number,
): void {
  const ground = projectWorldPoint(layout, { x: cell.col + 0.5, y: cell.row + 1 });
  const size = layout.tileWidth * sizeFactor * visualScaleAt(layout, cell.row + 0.5);
  drawSpriteFrame(ctx, image, 0, 128, {
    x: ground.x - size / 2,
    y: ground.y - size * groundAnchor,
    width: size,
    height: size,
  });
}

```

Replace `drawSelection` and `drawMap` with:

```ts
function drawSelection(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  selection: MapSelection,
): void {
  if (selection.cell == null) return;
  const { cell } = selection;
  if (
    !Number.isInteger(cell.col)
    || !Number.isInteger(cell.row)
    || cell.col < 0
    || cell.col >= STAGE_1.width
    || cell.row < 0
    || cell.row >= STAGE_1.height
  ) return;

  if (selection.range !== undefined && Number.isFinite(selection.range) && selection.range > 0) {
    const center = cellCenter(cell);
    for (let row = 0; row < STAGE_1.height; row += 1) {
      for (let col = 0; col < STAGE_1.width; col += 1) {
        if (Math.hypot(col - cell.col, row - cell.row) > selection.range) continue;
        traceCell(ctx, layout, { col, row });
        ctx.fillStyle = COLORS.range;
        ctx.fill();
      }
    }
    const ring = projectWorldRing(layout, center, selection.range);
    if (tracePoints(ctx, ring)) {
      ctx.strokeStyle = COLORS.rangeEdge;
      ctx.lineWidth = Math.max(1, 1 / layout.dpr);
      ctx.stroke();
    }
  }

  traceCell(ctx, layout, cell);
  ctx.fillStyle = selection.valid === false ? COLORS.invalid : COLORS.selected;
  ctx.fill();
  ctx.strokeStyle = selection.valid === false ? COLORS.invalidEdge : COLORS.selectedEdge;
  ctx.lineWidth = Math.max(2, 2 / layout.dpr);
  ctx.stroke();
}

export function drawMap(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  assets: GameAssets,
  selection: MapSelection = {},
): void {
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(layout.gameArea.x, layout.gameArea.y, layout.gameArea.width, layout.gameArea.height);
  drawBoardThickness(ctx, layout);

  for (let row = 0; row < STAGE_1.height; row += 1) {
    for (let col = 0; col < STAGE_1.width; col += 1) {
      drawCell(ctx, layout, { col, row }, PATH_KEYS.has(`${col}:${row}`));
    }
  }

  const entrance = STAGE_1.pathCells[0];
  const chest = STAGE_1.pathCells[STAGE_1.pathCells.length - 1];
  drawLandmark(ctx, layout, assets.map.entry, entrance, 2.15, 0.8);
  drawLandmark(ctx, layout, assets.map.snackChest, chest, 2.35, 0.81);
  drawSelection(ctx, layout, selection);
}
```

Delete the old cardinal road sprite selection, diamond projection, and per-tile sprite drawing functions.
Now that input and the renderer compatibility exports no longer read it, remove `mapOrigin` from `CanvasLayout` and the returned layout object in `src/game/render/layout.ts`.

- [ ] **Step 4: Run map/projection tests and commit**

Run:

```bash
npm test -- tests/game/mapRendering.test.ts tests/game/projection.test.ts tests/game/layout.test.ts
git add src/game/render/drawMap.ts src/game/render/layout.ts tests/game/mapRendering.test.ts
git diff --cached --check
git commit -m "feat: render green perspective game board"
```

Expected: three focused test files pass and the commit contains the map renderer, layout compatibility cleanup, and the new map test.

---

### Task 4: Front-Facing Characters, Grounding, and Depth Sorting

**Files:**
- Modify: `src/game/render/drawEntities.ts`
- Modify: `tests/game/direction.test.ts`
- Modify: `tests/game/renderTestUtils.ts`
- Modify: `tests/game/renderer.test.ts`

**Interfaces:**
- Consumes: `projectWorldPoint`, `visualScaleAt`, `isRenderableWorldPoint`
- Produces: `screenDiagonalDirection(screenVector) -> SpriteDirection` for arrow tower aim only
- Preserves: orc six-frame walk sheet, fairy eight-frame wing sheet, slime bounce, boss HP behavior

- [ ] **Step 1: Make test assets direction-observable and write RED tests**

Change the `directions` helper in `tests/game/renderTestUtils.ts` to:

```ts
const directions = (tag: string) => ({
  ne: taggedImage(`${tag}-ne`),
  se: taggedImage(`${tag}-se`),
  sw: taggedImage(`${tag}-sw`),
  nw: taggedImage(`${tag}-nw`),
});
```

In `tests/game/direction.test.ts`, rename the import and first describe block to `screenDiagonalDirection`, retaining these exact expectations:

```ts
import { screenDiagonalDirection } from '../../src/game/render/drawEntities';

describe('screenDiagonalDirection', () => {
  it.each([
    [{ x: 1, y: -1 }, 'ne'],
    [{ x: 1, y: 1 }, 'se'],
    [{ x: -1, y: 1 }, 'sw'],
    [{ x: -1, y: -1 }, 'nw'],
  ] as const)('maps screen vector %o to %s', (vector, expected) => {
    expect(screenDiagonalDirection(vector)).toBe(expected);
  });

  it('uses deterministic diagonals for axis-aligned and zero vectors', () => {
    expect(screenDiagonalDirection({ x: 1, y: 0 })).toBe('se');
    expect(screenDiagonalDirection({ x: 0, y: 1 })).toBe('sw');
    expect(screenDiagonalDirection({ x: -1, y: 0 })).toBe('nw');
    expect(screenDiagonalDirection({ x: 0, y: -1 })).toBe('ne');
    expect(screenDiagonalDirection({ x: 0, y: 0 })).toBe('se');
  });
});
```

Update the existing arrow grounding table entry to `['arrow', 'tower-arrow-se', 82 / 128]`, and change the depth test body filter to:

```ts
['tower-slow', 'tower-huchu', 'enemy-slime-se', 'motion-orc'].includes(imageTag(call) ?? '')
```

Add these tests to `tests/game/renderer.test.ts`:

Replace its projection import with:

```ts
import { projectWorldPoint, visualScaleAt } from '../../src/game/render/projection';
```

```ts
it('keeps static enemies front-facing and always uses front motion sheets', () => {
  const { context, calls } = createRecordingContext();
  const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
  const state = snapshot({
    enemies: [
      { id: 1, type: 'slime', hp: 42, maxHp: 42, progress: 0, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: null },
      { id: 2, type: 'golem', hp: 560, maxHp: 560, progress: 6, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: null },
      { id: 3, type: 'orc', hp: 110, maxHp: 110, progress: 11, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: null },
      { id: 4, type: 'fairy', hp: 58, maxHp: 58, progress: 16, speedMultiplier: 1, rewarded: false, lastHitAtSeconds: null },
    ],
  });

  drawEntities(context, layout, state, createTestAssets(), { timeSeconds: 0.5 });
  const tags = calls.filter((call) => call.method === 'drawImage').map(imageTag);
  expect(tags).toContain('enemy-slime-se');
  expect(tags).toContain('enemy-golem-se');
  expect(tags).toContain('motion-orc');
  expect(tags).toContain('motion-fairy');
  expect(tags.some((tag) => tag === 'enemy-slime-ne' || tag === 'enemy-slime-sw' || tag === 'enemy-slime-nw')).toBe(false);
});

it('renders a near tower larger than the same tower on a far row', () => {
  const { context, calls } = createRecordingContext();
  const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
  drawEntities(context, layout, snapshot({
    towers: [
      { id: 1, type: 'slow', cell: { col: 1, row: 0 }, position: { x: 1.5, y: 0.5 }, cooldownRemaining: 0 },
      { id: 2, type: 'slow', cell: { col: 1, row: 8 }, position: { x: 1.5, y: 8.5 }, cooldownRemaining: 0 },
    ],
  }), createTestAssets());
  const widths = calls
    .filter((call) => imageTag(call) === 'tower-slow')
    .map((call) => Number(call.args[7]));
  expect(widths).toHaveLength(2);
  expect(widths[1]).toBeGreaterThan(widths[0]);
});
```

- [ ] **Step 2: Run direction/renderer tests and verify RED**

Run:

```bash
npm test -- tests/game/direction.test.ts tests/game/renderer.test.ts
```

Expected: FAIL because the renamed direction function and front/depth behavior are not implemented.

- [ ] **Step 3: Use projected screen vectors only for arrow tower aim**

In `src/game/render/drawEntities.ts`, replace `movementDirection` and `towerSprite` with:

```ts
export function screenDiagonalDirection(vector: Readonly<Vec2>): SpriteDirection {
  const x = Number.isFinite(vector.x) ? vector.x : 0;
  const y = Number.isFinite(vector.y) ? vector.y : 0;
  if (x === 0 && y === 0) return 'se';
  if (x === 0) return y < 0 ? 'ne' : 'sw';
  if (y === 0) return x < 0 ? 'nw' : 'se';
  if (x > 0) return y < 0 ? 'ne' : 'se';
  return y < 0 ? 'nw' : 'sw';
}

function towerSprite(
  tower: Readonly<GameTower>,
  snapshot: RenderEntitiesSnapshot,
  assets: GameAssets,
  layout: CanvasLayout,
): LoadedSprite {
  if (tower.type !== 'arrow') return assets.towers[tower.type];
  const target = selectTarget(tower, snapshot.enemies);
  const targetPosition = target === undefined ? undefined : enemyPosition(target);
  if (targetPosition === undefined) return assets.towers.arrow.se;
  const towerScreen = projectWorldPoint(layout, tower.position);
  const targetScreen = projectWorldPoint(layout, targetPosition);
  return assets.towers.arrow[screenDiagonalDirection({
    x: targetScreen.x - towerScreen.x,
    y: targetScreen.y - towerScreen.y,
  })];
}
```

Delete `enemyMovement`; it is no longer used for character direction.

- [ ] **Step 4: Apply front assets, visual scaling, grounding, and projected depth**

Import the projection functions:

```ts
import {
  isRenderableWorldPoint,
  projectWorldPoint,
  visualScaleAt,
} from './projection';
```

Use this enemy body selection and scale inside `drawEnemyBody`:

```ts
const motion = enemy.type === 'orc'
  ? MOTION_SPRITES.orc
  : enemy.type === 'fairy' ? MOTION_SPRITES.fairy : null;
const phase = timeSeconds * (motion?.fps ?? 7) + enemy.id * 0.37;
const frame = motion === null ? 0 : Math.floor(phase) % motion.frames;
const sprite = motion === null
  ? assets.enemies[enemy.type].se
  : assets.motion[enemy.type as 'orc' | 'fairy'];
const depthScale = visualScaleAt(layout, position.y);
const bounce = Math.sin(phase * Math.PI * 2)
  * layout.tileHeight
  * depthScale
  * (enemy.type === 'fairy' ? 0.22 : 0.09);
const squash = enemy.type === 'slime' ? 1 + Math.sin(phase * Math.PI * 2) * 0.08 : 1;
const center = projectWorldPoint(layout, position);

ctx.save();
ctx.translate(center.x, center.y - bounce);
ctx.scale(1 / squash, squash);
drawAnchoredSprite(
  ctx,
  sprite,
  frame,
  motion === null ? 96 : 128,
  layout.tileWidth * ENEMY_SIZES[enemy.type] * depthScale,
  ENEMY_COLORS[enemy.type],
  enemy.type.slice(0, 1).toUpperCase(),
);
ctx.restore();
```

Change `drawTowerBody` to accept a `cell` and anchor to its projected front edge:

```ts
function drawTowerBody(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  type: TowerType,
  sprite: LoadedSprite,
  cell: Readonly<Cell>,
  alpha: number,
): void {
  const ground = projectWorldPoint(layout, { x: cell.col + 0.5, y: cell.row + 1 });
  const size = layout.tileWidth * 2.6 * visualScaleAt(layout, cell.row + 0.5);
  ctx.save();
  ctx.translate(ground.x, ground.y);
  ctx.globalAlpha = alpha;
  drawAnchoredSprite(ctx, sprite, 0, 128, size, TOWER_COLORS[type], TOWER_LABELS[type], TOWER_GROUND_ANCHOR_Y[type]);
  ctx.restore();
}
```

Sort bodies with the projected Y coordinate:

```ts
function compareBodies(layout: CanvasLayout, left: EntityBody, right: EntityBody): number {
  const leftY = projectWorldPoint(layout, left.position).y;
  const rightY = projectWorldPoint(layout, right.position).y;
  return leftY - rightY
    || (left.kind === right.kind ? 0 : left.kind === 'enemy' ? 1 : -1)
    || left.id - right.id;
}
```

Replace the `drawEntities` body with the exact projected collection, sort, and draw flow:

```ts
export function drawEntities(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  snapshot: RenderEntitiesSnapshot,
  assets: GameAssets,
  options: DrawEntitiesOptions = {},
): void {
  const bodies: EntityBody[] = [];
  for (const tower of snapshot.towers) {
    if (isRenderableWorldPoint(layout, tower.position)) {
      bodies.push({ kind: 'tower', id: tower.id, position: tower.position, tower });
    }
  }
  for (const enemy of snapshot.enemies) {
    const position = enemyPosition(enemy);
    if (position !== undefined && isRenderableWorldPoint(layout, position)) {
      bodies.push({ kind: 'enemy', id: enemy.id, position, enemy });
    }
  }
  const preview = options.previewTower;
  if (preview !== null && preview !== undefined) {
    const position = cellCenter(preview.cell);
    if (isRenderableWorldPoint(layout, position)) {
      bodies.push({ kind: 'preview', id: Number.MAX_SAFE_INTEGER, position, preview });
    }
  }
  bodies.sort((left, right) => compareBodies(layout, left, right));

  const timeSeconds = Number.isFinite(options.timeSeconds) ? options.timeSeconds ?? 0 : 0;
  for (const body of bodies) {
    if (body.kind === 'enemy' && body.enemy !== undefined) {
      drawEnemyBody(ctx, layout, body.enemy, body.position, assets, timeSeconds);
    } else if (body.kind === 'tower' && body.tower !== undefined) {
      drawTowerBody(
        ctx,
        layout,
        body.tower.type,
        towerSprite(body.tower, snapshot, assets, layout),
        body.tower.cell,
        1,
      );
    } else if (body.preview !== undefined) {
      const sprite = body.preview.type === 'arrow'
        ? assets.towers.arrow.se
        : assets.towers[body.preview.type];
      drawTowerBody(
        ctx,
        layout,
        body.preview.type,
        sprite,
        body.preview.cell,
        body.preview.valid ? 0.68 : 0.38,
      );
    }
  }

  for (const body of bodies) {
    if (body.kind === 'enemy' && body.enemy !== undefined) {
      drawEnemyHp(ctx, layout, body.enemy, body.position, timeSeconds);
    }
  }
}
```

Replace `drawEnemyHp` with a world-position input so its scale is type-safe and follows the unit depth:

```ts
function drawEnemyHp(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  enemy: Readonly<GameEnemy>,
  position: Readonly<Vec2>,
  timeSeconds: number,
): void {
  const isBoss = enemy.type === 'minotaur';
  const recentlyHit = enemy.lastHitAtSeconds !== null
    && timeSeconds - enemy.lastHitAtSeconds <= 2.5;
  if (!isBoss && !recentlyHit) return;

  const center = projectWorldPoint(layout, position);
  const scale = visualScaleAt(layout, position.y);
  const width = layout.tileWidth * scale * (isBoss ? 1.35 : 0.9);
  const height = Math.max(4, layout.tileWidth * scale * 0.09);
  const x = center.x - width / 2;
  const y = center.y - layout.tileWidth * scale * (isBoss ? 1.24 : 1.02);
  const hpRatio = Number.isFinite(enemy.hp)
    && Number.isFinite(enemy.maxHp)
    && enemy.maxHp > 0
    ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp))
    : 0;

  if (isBoss) {
    ctx.fillStyle = '#f0d7ff';
    ctx.font = `900 ${Math.max(8, layout.tileWidth * scale * 0.2)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('BOSS', center.x, y - 2);
  }
  ctx.fillStyle = isBoss ? 'rgba(38, 19, 53, 0.9)' : 'rgba(44, 38, 32, 0.78)';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = isBoss
    ? '#b96cff'
    : hpRatio > 0.45 ? '#7bd45d' : hpRatio > 0.2 ? '#f1c453' : '#ef665d';
  ctx.fillRect(x, y, width * hpRatio, height);
}
```

In the HP pass, call `drawEnemyHp(ctx, layout, body.enemy, body.position, timeSeconds)`; do not pass a pre-projected screen point.

- [ ] **Step 5: Update grounding/depth expectations and commit**

In the tower grounding test, compute:

```ts
const scale = visualScaleAt(layout, 1.5);
const spriteSize = layout.tileWidth * 2.6 * scale;
const tileFront = projectWorldPoint(layout, { x: 1.5, y: 2 });
expect(visibleBaseY).toBeCloseTo(tileFront.y);
```

Update the body order expectation to:

```ts
expect(bodyCalls.map(imageTag)).toEqual([
  'tower-slow',
  'enemy-slime-se',
  'tower-huchu',
  'motion-orc',
]);
```

Run:

```bash
npm test -- tests/game/direction.test.ts tests/game/renderer.test.ts
git add src/game/render/drawEntities.ts tests/game/direction.test.ts tests/game/renderTestUtils.ts tests/game/renderer.test.ts
git diff --cached --check
git commit -m "feat: scale and front-face perspective units"
```

Expected: both focused suites pass; dogs remain their single front assets, all monsters use `se`/front motion, and arrow direction tests still pass.

---

### Task 5: Perspective Projectiles and Combat Effects

**Files:**
- Modify: `src/game/render/drawEffects.ts`
- Modify: `src/game/render/drawMap.ts`
- Modify: `tests/game/renderer.test.ts`

**Interfaces:**
- Consumes: `projectWorldPoint`, `projectWorldRing`, `visualScaleAt`, `isRenderableWorldPoint`
- Preserves: `arrowFrameForScreenVector`, fire/water animation frame counts, boss presentation, hit timing

- [ ] **Step 1: Write a failing depth-scale test for projectiles**

Add to `tests/game/renderer.test.ts`:

```ts
it('renders near projectiles larger than far projectiles', () => {
  const { context, calls } = createRecordingContext();
  const renderer = createCanvasRenderer(createTestCanvas(context), createTestAssets());
  renderer.render(snapshot({
    projectiles: [
      { id: 1, towerType: 'huchu', position: { x: 2.5, y: 0.5 }, targetId: 1, damage: 72, speed: 5, splash: 1.25 },
      { id: 2, towerType: 'huchu', position: { x: 2.5, y: 8.5 }, targetId: 1, damage: 72, speed: 5, splash: 1.25 },
    ],
  }), { timeSeconds: 0.25 });
  const widths = calls
    .filter((call) => imageTag(call) === 'vfx-waterball')
    .map((call) => Number(call.args[7]));
  expect(widths).toHaveLength(2);
  expect(widths[1]).toBeGreaterThan(widths[0]);
});
```

- [ ] **Step 2: Run the renderer test and verify RED**

Run:

```bash
npm test -- tests/game/renderer.test.ts
```

Expected: FAIL because both waterballs currently use the same `layout.tileWidth * 1.7` size.

- [ ] **Step 3: Apply the common projection and depth visual unit**

In `src/game/render/drawEffects.ts`, replace imports from `drawMap` with:

```ts
import {
  isRenderableWorldPoint,
  projectWorldPoint,
  projectWorldRing,
  visualScaleAt,
  type ScreenPoint,
} from './projection';
```

Add:

```ts
function visualUnitAt(layout: CanvasLayout, position: Readonly<Vec2>): number {
  return layout.tileWidth * visualScaleAt(layout, position.y);
}

function tracePoints(ctx: CanvasRenderingContext2D, points: readonly ScreenPoint[]): void {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
}
```

Replace every `worldToScreen` with `projectWorldPoint` and every `isRenderablePoint` with `isRenderableWorldPoint`. In `drawProjectiles`, calculate `const visualUnit = visualUnitAt(layout, projectile.position)` and use:

```ts
const arrowSize = visualUnit * 1.55;
const fireballSize = visualUnit * 1.55;
const waterballSize = visualUnit * 1.7;
```

Use `visualUnit * 0.12` and `visualUnit * 0.14` for fallback fire/water radii. In `drawRuntimeEffect`, calculate `const visualUnit = visualUnitAt(layout, effect.position)` and replace all effect size/font/rise uses of `layout.tileWidth` with `visualUnit`.

Replace the slow pulse ellipse with:

```ts
const progress = effectProgress(effect);
tracePoints(
  ctx,
  projectWorldRing(layout, effect.position, 0.35 + progress * 0.8),
);
ctx.strokeStyle = `rgba(170, 132, 255, ${1 - progress})`;
ctx.lineWidth = Math.max(1.5, 2 / layout.dpr);
ctx.stroke();
```

In floating gold, use `visualUnitAt(layout, pop.position)` for font size and rise distance. Keep boss/pause overlay sizes tied to viewport/`layout.tileWidth`; those are screen UI, not world effects.

After `drawEffects.ts` is the final consumer moved to `projection.ts`, remove the temporary `isRenderablePoint`/`worldToScreen` re-export block from `drawMap.ts`.

- [ ] **Step 4: Run renderer/effects tests and commit**

Run:

```bash
npm test -- tests/game/renderer.test.ts tests/game/effects.test.ts tests/game/direction.test.ts
git add src/game/render/drawEffects.ts src/game/render/drawMap.ts tests/game/renderer.test.ts
git diff --cached --check
git commit -m "feat: scale combat effects by map depth"
```

Expected: all three focused suites pass; arrow frames still follow projected target direction and near VFX are larger.

---

### Task 6: Full Regression, Mobile Screenshot, and Acceptance

**Files:**
- Modify: `docs/qa/landscape-844x390.png`
- Verify: `dist/index.html`

**Interfaces:**
- Consumes: all prior task commits
- Produces: fully tested production build and reviewed 844×390 screenshot

- [ ] **Step 1: Run all unit tests and production build**

Run:

```bash
npm run check
rg -n '/huchu-duckbae-tower-defense/assets/' dist/index.html
```

Expected: all Vitest files pass, TypeScript/Vite build exits 0, and the built JS/CSS asset paths begin with `/huchu-duckbae-tower-defense/`.

- [ ] **Step 2: Run the mobile browser flow and refresh the QA screenshot**

After stopping the session's manually started Vite process on port 4173, run the complete browser regression first and then refresh the focused screenshot:

```bash
npm run test:e2e
UPDATE_QA_SCREENSHOTS=1 npm run test:e2e -- --grep "844x390 touch flow"
```

Expected: the first command reports 4 passed; the second reports 1 passed, places/cancels/confirms the tower on the requested cell, advances simulation, records zero console/page errors, and writes `docs/qa/landscape-844x390.png`.

- [ ] **Step 3: Visually inspect the generated screenshot**

Open `/private/tmp/huchu-defense-v2-3d-preview/docs/qa/landscape-844x390.png` with the image viewer and verify all eight conditions:

1. entrance is on the left and snack chest on the right;
2. the entire 20×10 board is visible;
3. the top edge is narrower than the bottom edge;
4. non-road cells are green and roads are plain sand;
5. the tower base touches its projected tile front edge;
6. characters are materially larger without covering the HUD;
7. monsters and dogs face the camera;
8. selection and range align with the clicked tile.

Expected: all eight conditions are visibly satisfied.

- [ ] **Step 4: Commit the verified QA capture**

```bash
git add docs/qa/landscape-844x390.png
git diff --cached --check
git commit -m "test: capture mobile perspective gameplay"
```

Expected: the commit contains only the refreshed landscape screenshot.

- [ ] **Step 5: Final clean verification**

Run:

```bash
git status --short
npm run check
```

Expected: working tree is clean and the full check exits 0.
