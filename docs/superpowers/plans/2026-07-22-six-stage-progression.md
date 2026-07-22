# Six-Stage Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 스테이지 1을 포함한 6개 독립 스테이지와 순차 해금·스테이지별 기록을 신규 에셋 없이 추가한다.

**Architecture:** `STAGE_CATALOG`을 맵·웨이브·난이도 배율의 단일 조회점으로 두고 `GameState.stageId`로 시뮬레이션과 렌더링을 연결한다. 기존 상태 오버레이에 작은 스테이지 선택기만 추가하고 preferences v3가 해금과 스테이지별 기록을 보존한다.

**Tech Stack:** TypeScript 5.8, HTML Canvas 2D, Vite 7, Vitest 3, CSS, GitHub Pages

## Global Constraints

- 기존 스테이지 1을 포함해 총 6개 스테이지를 제공한다.
- 모든 맵은 20×10 격자, 좌측 입구→우측 창고, 직각 단일 경로다.
- 각 스테이지는 10웨이브이며 시작 골드 320G·창고 내구도 20·빈 타워로 초기화한다.
- 신규 몬스터·타워·이미지·Blender 에셋·런타임 의존성을 추가하지 않는다.
- 기존 타워 성능, 몬스터 기본값, 점수 공식과 별 기준은 변경하지 않는다.
- Vite base `/huchu-duckbae-tower-defense/`를 유지한다.
- 사용자 요청에 따라 Playwright 및 기타 E2E는 실행하지 않는다.
- 단일 에이전트로 순차 구현한다.

---

## File Structure

- Create `src/game/map/createStageMap.ts`: 직각 웨이포인트 검증, 경로 확장, 배치 가능 칸 계산
- Create `src/game/waves/stageWaves.ts`: 스테이지 2~6 고정 웨이브와 공통 기본 스폰 간격
- Create `src/game/stages/stageCatalog.ts`: 6개 맵·웨이브·난이도 배율 카탈로그와 ID 정규화
- Modify `src/game/map/stage1.ts`: 기존 소비자를 위한 스테이지 1 맵 별칭
- Modify `src/game/simulation/*.ts`, `src/game/combat/*.ts`: `stageId` 기반 시뮬레이션과 타게팅
- Modify `src/game/render/*.ts`: 현재 스테이지 맵·경로 렌더링
- Modify `src/app/preferences.ts`: preferences v3, 순차 해금, 스테이지별 기록
- Modify `src/app/hud.ts`, `src/app/GameApp.ts`, `src/styles.css`: 최소 스테이지 선택 UI와 진행 연결
- Create `tests/game/stages.test.ts`: 카탈로그·맵·웨이브의 canonical 계약
- Modify focused tests under `tests/game/` and `tests/app/`: 시뮬레이션·렌더·저장·HUD 회귀 계약
- Modify `docs/backlog.md`: 검증이 끝난 6스테이지 항목 완료 처리

---

### Task 1: 공통 맵 팩토리와 6개 스테이지 카탈로그

**Files:**
- Create: `src/game/map/createStageMap.ts`
- Create: `src/game/waves/stageWaves.ts`
- Create: `src/game/stages/stageCatalog.ts`
- Modify: `src/game/map/stage1.ts`
- Create: `tests/game/stages.test.ts`
- Modify: `tests/game/stage1.test.ts`
- Modify: `tests/game/waves.test.ts`

**Interfaces:**
- Produces: `StageMap`, `createStageMap(waypoints)`, `StageId`, `StageDefinition`, `STAGE_IDS`, `STAGE_CATALOG`, `normalizeStageId(value)`, `getStageDefinition(value)`
- Preserves: `STAGE_1` and `STAGE_1_WAVES` references for existing consumers

- [ ] **Step 1: 카탈로그와 맵 계약 실패 테스트 작성**

`tests/game/stages.test.ts`에 다음 핵심 계약을 작성한다.

```ts
import { describe, expect, it } from 'vitest';
import { ENEMY_CATALOG } from '../../src/game/enemies/enemyCatalog';
import {
  getStageDefinition,
  normalizeStageId,
  STAGE_CATALOG,
  STAGE_IDS,
} from '../../src/game/stages/stageCatalog';

const EXPECTED = [
  { id: 1, steps: 28, buildable: 58, hp: 1, speed: 1, spawn: 1, reward: 2562 },
  { id: 2, steps: 27, buildable: 56, hp: 1.08, speed: 1, spawn: 1, reward: 2596 },
  { id: 3, steps: 26, buildable: 54, hp: 1.16, speed: 1.02, spawn: 0.98, reward: 2648 },
  { id: 4, steps: 25, buildable: 52, hp: 1.26, speed: 1.04, spawn: 0.96, reward: 2700 },
  { id: 5, steps: 23, buildable: 48, hp: 1.38, speed: 1.06, spawn: 0.94, reward: 2746 },
  { id: 6, steps: 22, buildable: 46, hp: 1.52, speed: 1.08, spawn: 0.92, reward: 2800 },
] as const;

describe('six-stage catalog', () => {
  it('defines the approved IDs, maps, multipliers, waves, and economy', () => {
    expect(STAGE_IDS).toEqual([1, 2, 3, 4, 5, 6]);
    expect(STAGE_CATALOG).toHaveLength(6);
    for (const expected of EXPECTED) {
      const stage = getStageDefinition(expected.id);
      expect(stage.map.pathCells.length - 1).toBe(expected.steps);
      expect(stage.map.buildableCells([])).toHaveLength(expected.buildable);
      expect(stage.hpMultiplier).toBe(expected.hp);
      expect(stage.speedMultiplier).toBe(expected.speed);
      expect(stage.spawnIntervalMultiplier).toBe(expected.spawn);
      expect(stage.waves).toHaveLength(10);
      const reward = stage.waves.flatMap((wave) => wave.groups)
        .reduce((sum, group) => sum + ENEMY_CATALOG[group.type].reward * group.count, 0);
      expect(reward).toBe(expected.reward);
      expect(stage.waves.slice(0, 9).flatMap((wave) => wave.groups)
        .filter((group) => group.type === 'minotaur')).toHaveLength(0);
      expect(stage.waves[9].groups.filter((group) => group.type === 'minotaur'))
        .toEqual([{ type: 'minotaur', count: 1, spawnInterval: 0 }]);
    }
  });

  it('normalizes invalid stage IDs to stage one', () => {
    for (const value of [0, 7, 1.5, Number.NaN, '2', null]) {
      expect(normalizeStageId(value)).toBe(1);
      expect(getStageDefinition(value).id).toBe(1);
    }
  });

  it('keeps every path in bounds, orthogonal, unique, and left-to-right', () => {
    for (const stage of STAGE_CATALOG) {
      const path = stage.map.pathCells;
      expect(path[0].col).toBe(0);
      expect(path.at(-1)?.col).toBe(19);
      expect(new Set(path.map(({ col, row }) => `${col}:${row}`)).size).toBe(path.length);
      expect(path.every(({ col, row }) => col >= 0 && col < 20 && row >= 0 && row < 10)).toBe(true);
      expect(path.slice(1).every((cell, index) => (
        Math.abs(cell.col - path[index].col) + Math.abs(cell.row - path[index].row) === 1
      ))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/game/stages.test.ts tests/game/stage1.test.ts tests/game/waves.test.ts`

Expected: `stageCatalog` 모듈이 없어 새 suite가 import 단계에서 실패한다.

- [ ] **Step 3: 공통 맵 팩토리 구현**

`src/game/map/createStageMap.ts`에 다음 공개 계약을 구현한다.

```ts
import { GRID_HEIGHT, GRID_WIDTH } from '../config';
import type { Cell } from '../types';

export type StageMap = Readonly<{
  width: number;
  height: number;
  pathCells: readonly Cell[];
  isPathCell(cell: Readonly<Cell>): boolean;
  isRoadAdjacentCell(cell: Readonly<Cell>): boolean;
  isBuildableCell(cell: Readonly<Cell>, occupiedCells: readonly Readonly<Cell>[]): boolean;
  buildableCells(occupiedCells: readonly Readonly<Cell>[]): Cell[];
}>;

export function createStageMap(waypoints: readonly Readonly<Cell>[]): StageMap {
  if (waypoints.length < 2) throw new Error('A stage route needs at least two waypoints');
  const pathCells: Cell[] = [];
  const pathKeys = new Set<string>();
  const append = (cell: Cell) => {
    const inBounds = Number.isInteger(cell.col) && Number.isInteger(cell.row)
      && cell.col >= 0 && cell.col < GRID_WIDTH && cell.row >= 0 && cell.row < GRID_HEIGHT;
    if (!inBounds) throw new Error('Stage waypoint is out of bounds');
    const key = `${cell.col}:${cell.row}`;
    if (pathKeys.has(key)) throw new Error('Stage route cannot revisit a cell');
    pathKeys.add(key);
    pathCells.push({ ...cell });
  };
  append({ ...waypoints[0] });
  for (let index = 1; index < waypoints.length; index += 1) {
    const previous = waypoints[index - 1];
    const next = waypoints[index];
    const horizontal = previous.row === next.row && previous.col !== next.col;
    const vertical = previous.col === next.col && previous.row !== next.row;
    if (!horizontal && !vertical) throw new Error('Stage route segments must be orthogonal');
    const colStep = Math.sign(next.col - previous.col);
    const rowStep = Math.sign(next.row - previous.row);
    for (let col = previous.col + colStep, row = previous.row + rowStep;
      col !== next.col + colStep || row !== next.row + rowStep;
      col += colStep, row += rowStep) append({ col, row });
  }
  const isPathCell = (cell: Readonly<Cell>) => pathKeys.has(`${cell.col}:${cell.row}`);
  const isRoadAdjacentCell = (cell: Readonly<Cell>) => pathCells.some((pathCell) => (
    Math.max(Math.abs(pathCell.col - cell.col), Math.abs(pathCell.row - cell.row)) === 1
  ));
  const isBuildableCell = (cell: Readonly<Cell>, occupied: readonly Readonly<Cell>[]) => (
    Number.isInteger(cell.col) && Number.isInteger(cell.row)
    && cell.col >= 0 && cell.col < GRID_WIDTH && cell.row >= 0 && cell.row < GRID_HEIGHT
    && !isPathCell(cell) && isRoadAdjacentCell(cell)
    && !occupied.some((taken) => taken.col === cell.col && taken.row === cell.row)
  );
  const buildableCells = (occupied: readonly Readonly<Cell>[]) => Array.from(
    { length: GRID_HEIGHT * GRID_WIDTH },
    (_, index) => ({ col: index % GRID_WIDTH, row: Math.floor(index / GRID_WIDTH) }),
  ).filter((cell) => isBuildableCell(cell, occupied));
  return { width: GRID_WIDTH, height: GRID_HEIGHT, pathCells, isPathCell, isRoadAdjacentCell, isBuildableCell, buildableCells };
}
```

- [ ] **Step 4: 고정 웨이브와 카탈로그 구현**

`src/game/waves/stageWaves.ts`에는 설계서의 스테이지 2~6 숫자 행을 다음 helper로 변환한다. 스테이지 1은 기존 `STAGE_1_WAVES`를 그대로 사용한다.

```ts
import type { EnemyType } from '../enemies/enemyCatalog';
import type { Wave } from './stage1Waves';

const TYPES = ['slime', 'fairy', 'orc', 'golem', 'minotaur'] as const;
type WaveCounts = readonly [number, number, number, number, number];
const INTERVALS = [
  { slime: 0.70, fairy: 0.52, orc: 0.76, golem: 1.10 },
  { slime: 0.62, fairy: 0.48, orc: 0.70, golem: 1.02 },
  { slime: 0.55, fairy: 0.45, orc: 0.64, golem: 0.95 },
  { slime: 0.48, fairy: 0.42, orc: 0.57, golem: 0.88 },
  { slime: 0.42, fairy: 0.40, orc: 0.50, golem: 0.80 },
] as const;

function waves(rows: readonly WaveCounts[]): readonly Wave[] {
  return rows.map((counts, waveIndex) => ({
    groups: counts.flatMap((count, typeIndex) => {
      if (count === 0) return [];
      const type = TYPES[typeIndex] as EnemyType;
      return [{ type, count, spawnInterval: type === 'minotaur'
        ? 0
        : INTERVALS[Math.floor(waveIndex / 2)][type] }];
    }),
  }));
}

export const STAGE_2_WAVES = waves([
  [10, 0, 0, 0, 0], [8, 8, 0, 0, 0], [6, 10, 0, 0, 0], [0, 10, 4, 0, 0],
  [6, 8, 6, 0, 0], [0, 8, 8, 0, 0], [0, 6, 10, 3, 0], [0, 4, 12, 6, 0],
  [0, 2, 12, 7, 0], [0, 10, 10, 6, 1],
]);
export const STAGE_3_WAVES = waves([
  [8, 4, 0, 0, 0], [8, 0, 4, 0, 0], [8, 8, 6, 0, 0], [0, 9, 8, 0, 0],
  [0, 8, 10, 0, 0], [0, 6, 12, 0, 0], [0, 4, 10, 3, 0], [0, 2, 10, 5, 0],
  [0, 0, 8, 7, 0], [0, 8, 12, 7, 1],
]);
export const STAGE_4_WAVES = waves([
  [8, 0, 0, 0, 0], [6, 4, 0, 0, 0], [6, 7, 4, 0, 0], [0, 6, 8, 0, 0],
  [0, 4, 8, 2, 0], [0, 3, 10, 4, 0], [0, 2, 10, 6, 0], [0, 1, 10, 7, 0],
  [0, 0, 10, 7, 0], [0, 6, 12, 9, 1],
]);
export const STAGE_5_WAVES = waves([
  [12, 0, 0, 0, 0], [10, 8, 0, 0, 0], [10, 10, 4, 0, 0], [0, 10, 6, 0, 0],
  [0, 8, 8, 2, 0], [0, 6, 8, 3, 0], [0, 4, 8, 4, 0], [0, 2, 6, 6, 0],
  [0, 2, 8, 7, 0], [0, 10, 12, 8, 1],
]);
export const STAGE_6_WAVES = waves([
  [8, 4, 0, 0, 0], [8, 6, 2, 0, 0], [8, 8, 4, 0, 0], [0, 8, 8, 0, 0],
  [0, 6, 8, 2, 0], [0, 5, 8, 3, 0], [0, 4, 8, 5, 0], [0, 3, 8, 5, 0],
  [0, 2, 10, 7, 0], [0, 8, 14, 9, 1],
]);
```

`src/game/stages/stageCatalog.ts`는 승인된 6개 waypoint·이름·배율을 `createStageMap`으로 조립하고 `normalizeStageId`가 정수 1~6만 허용하게 한다. `src/game/map/stage1.ts`는 다음 호환 별칭으로 교체한다.

```ts
import { getStageDefinition } from '../stages/stageCatalog';
export const STAGE_1 = getStageDefinition(1).map;
```

- [ ] **Step 5: GREEN 확인**

Run: `npx vitest run tests/game/stages.test.ts tests/game/stage1.test.ts tests/game/waves.test.ts`

Expected: 3개 focused suite가 모두 통과하며 스테이지별 reward가 `2562/2596/2648/2700/2746/2800`이다.

- [ ] **Step 6: 커밋**

```bash
git add src/game/map/createStageMap.ts src/game/map/stage1.ts src/game/waves/stageWaves.ts src/game/stages/stageCatalog.ts tests/game/stages.test.ts tests/game/stage1.test.ts tests/game/waves.test.ts
git commit -m "feat: add six stage catalog"
```

---

### Task 2: stageId 기반 시뮬레이션·배치·전투

**Files:**
- Modify: `src/game/simulation/createGame.ts`
- Modify: `src/game/simulation/updateWaves.ts`
- Modify: `src/game/simulation/updateEnemies.ts`
- Modify: `src/game/simulation/updateGame.ts`
- Modify: `src/game/simulation/placeTower.ts`
- Modify: `src/game/combat/targeting.ts`
- Modify: `src/game/combat/updateTowers.ts`
- Modify: `src/game/combat/updateProjectiles.ts`
- Modify: `src/game/combat/updateSlow.ts`
- Modify: `tests/game/enemies.test.ts`
- Modify: `tests/game/placement.test.ts`
- Modify: `tests/game/targeting.test.ts`
- Modify: `tests/game/outcome.test.ts`
- Modify: `tests/game/combat.test.ts`

**Interfaces:**
- Consumes: `getStageDefinition(stageId)` from Task 1
- Produces: `GameState.stageId`, `createGame(stageId?: unknown)`, `enemyPosition(enemy, stageId?)`, `selectTarget(tower, enemies, stageId?)`
- Preserves: default argument stage 1 for existing tests and callers

- [ ] **Step 1: 스테이지 배율·초기화·경로 실패 테스트 작성**

다음 계약을 focused tests에 추가한다.

```ts
it('starts every valid stage with independent resources', () => {
  for (const stageId of [1, 2, 3, 4, 5, 6] as const) {
    const game = createGame(stageId);
    expect(game).toMatchObject({ stageId, gold: 320, baseHp: 20, towers: [] });
  }
  expect(createGame(99).stageId).toBe(1);
});

it('applies stage and wave HP multipliers exactly once', () => {
  const state = createGame(6);
  spawnEnemy(state, 'minotaur', 9);
  expect(state.enemies[0].maxHp).toBeCloseTo(2160 * 1.52 * 1.72);
});

it('uses the selected stage speed and route length', () => {
  const state = createGame(6);
  spawnEnemy(state, 'slime', 0);
  updateEnemies(state, 1);
  expect(state.enemies[0].progress).toBeCloseTo(1.15 * 1.08);
  state.enemies[0].progress = getStageDefinition(6).map.pathCells.length - 1;
  updateEnemies(state, 0);
  expect(state.enemies).toHaveLength(0);
});

it('scales the stored spawn cooldown once for later stages', () => {
  const state = createGame(6);
  updateWaves(state, 0.01);
  expect(state.wave.spawnCooldown).toBeCloseTo((0.70 * 0.92) - 0.01);
});
```

`placement.test.ts`에서는 stage 2의 road cell이 거부되고 stage 2의 road-adjacent cell이 허용되는지 검증한다. `targeting.test.ts`에서는 `enemyPosition(enemy, 6)`의 route endpoint가 스테이지 6 마지막 셀 중심과 일치하는지 검증한다.

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/game/enemies.test.ts tests/game/placement.test.ts tests/game/targeting.test.ts tests/game/outcome.test.ts tests/game/combat.test.ts`

Expected: `stageId`와 스테이지 배율·경로가 구현되지 않아 새 assertions가 실패한다.

- [ ] **Step 3: GameState와 웨이브·이동 연결**

`GameState`의 첫 필드에 아래 property를 추가한다.

```ts
stageId: StageId;
```

`createGame` signature를 `export function createGame(stageId: unknown = 1): GameState`로 바꾸고 기존 return object의 `elapsedSeconds` 바로 앞에 아래 필드를 삽입한다.

```ts
stageId: normalizeStageId(stageId),
```

`updateWaves.ts`는 함수 시작에서 `const stage = getStageDefinition(state.stageId)`를 얻고 모든 `STAGE_1_WAVES` 참조를 `stage.waves`로 교체한다. 적 생성 HP와 다음 cooldown은 다음 식만 사용한다.

```ts
const scaledHp = definition.hp * stage.hpMultiplier * (1 + waveIndex * 0.08);
state.wave.spawnCooldown = group.spawnInterval * stage.spawnIntervalMultiplier;
```

`updateEnemies.ts`는 module-level `ROUTE_LENGTH`를 제거하고 다음 값을 매 update에서 조회한다.

```ts
const stage = getStageDefinition(state.stageId);
const routeLength = stage.map.pathCells.length - 1;
enemy.progress += definition.speed * stage.speedMultiplier * enemy.speedMultiplier * safeDt;
```

`updateGame.ts`도 현재 `stage.waves`로 completed-wave 및 victory를 판정한다.

- [ ] **Step 4: 배치·타게팅·전투 연결**

`placeTower.ts`는 `getStageDefinition(state.stageId).map.isBuildableCell(...)`을 사용한다. `targeting.ts`의 공개 함수는 다음 signature로 바꾸되 기본값은 1을 유지한다.

```ts
export function enemyPosition(enemy: GameEnemy, stageId: unknown = 1): Vec2 | undefined;
export function selectTarget(
  tower: GameTower,
  enemies: readonly GameEnemy[],
  stageId: unknown = 1,
): GameEnemy | undefined;
```

`updateTowers`, `updateProjectiles`, `updateSlow`의 모든 `selectTarget`·`enemyPosition` 호출은 `state.stageId`를 마지막 인자로 전달한다. 이 변경으로 스플래시 중심, 슬로우 범위, 투사체 추적도 같은 경로를 사용한다.

- [ ] **Step 5: GREEN 확인**

Run: `npx vitest run tests/game/enemies.test.ts tests/game/placement.test.ts tests/game/targeting.test.ts tests/game/outcome.test.ts tests/game/combat.test.ts tests/game/waves.test.ts`

Expected: focused simulation/combat suites가 모두 통과하고 stage 1 기존 수치도 유지된다.

- [ ] **Step 6: 커밋**

```bash
git add src/game/simulation src/game/combat tests/game/enemies.test.ts tests/game/placement.test.ts tests/game/targeting.test.ts tests/game/outcome.test.ts tests/game/combat.test.ts
git commit -m "feat: run combat on the selected stage"
```

---

### Task 3: 현재 스테이지 맵 렌더링

**Files:**
- Modify: `src/game/render/canvasRenderer.ts`
- Modify: `src/game/render/drawMap.ts`
- Modify: `src/game/render/drawEntities.ts`
- Modify: `src/game/render/drawEffects.ts`
- Modify: `src/app/GameApp.ts`
- Modify: `tests/game/renderer.test.ts`
- Modify: `tests/game/mapRendering.test.ts`

**Interfaces:**
- Consumes: `GameState.stageId` and `getStageDefinition`
- Produces: `GameSnapshot.stageId`, `drawMap(ctx, layout, assets, map, selection?)`
- Preserves: one shared projection/layout and all existing sprite assets

- [ ] **Step 1: 스테이지별 맵·엔티티 실패 테스트 작성**

모든 renderer test snapshot에 `stageId: 1` 기본값을 추가하고 다음 회귀를 작성한다.

```ts
it('draws the selected stage road and chest instead of stage one', () => {
  const { context, calls } = createRecordingContext();
  const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
  const stage = getStageDefinition(6);
  drawMap(context, layout, createTestAssets(), stage.map);
  expect(calls.filter((call) => call.method === 'fill' && call.fillStyle === '#e4c99f'))
    .toHaveLength(stage.map.pathCells.length);
});

it('positions enemies on the render snapshot stage route', () => {
  const { context, calls } = createRecordingContext();
  const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });
  const enemy = {
    id: 1, type: 'slime' as const, hp: 50.4, maxHp: 50.4, progress: 5,
    speedMultiplier: 1, rewarded: false, lastHitAtSeconds: null,
  };
  drawEntities(context, layout, snapshot({
    stageId: 6,
    enemies: [enemy],
  }), createTestAssets());
  const translated = calls.find((call) => call.method === 'translate');
  const expected = projectWorldPoint(layout, enemyPosition(enemy, 6)!);
  expect(translated?.args[0]).toBeCloseTo(expected.x);
});
```

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/game/mapRendering.test.ts tests/game/renderer.test.ts`

Expected: `drawMap`이 map 인자를 받지 않고 entity/effect 경로가 stage 1에 고정돼 실패한다.

- [ ] **Step 3: 맵과 render snapshot 연결**

`GameSnapshot`, `RenderEntitiesSnapshot`, `EffectSnapshot`에 `readonly stageId: StageId`를 추가한다. `canvasRenderer.render`는 한 번 조회한 stage map을 전달한다.

```ts
const stage = getStageDefinition(snapshot.stageId);
drawMap(context, layout, assets, stage.map, {
  buildableCells: options.placementGuideCells,
  cell: options.selectedCell,
  range: options.selectedRange,
  valid: options.selectedValid,
});
```

`drawMap`과 내부 bounds/road/chest 함수는 `StageMap`을 인자로 받아 `map.width`, `map.height`, `map.isPathCell(cell)`, `map.pathCells.at(-1)`만 사용한다. module-level `PATH_KEYS`와 `STAGE_1` import를 제거한다.

`drawEntities`와 `drawEffects`는 모든 `enemyPosition`·`selectTarget`에 `snapshot.stageId`를 전달한다.

- [ ] **Step 4: GameApp의 배치 가이드와 웨이브 수 연결**

`GameApp.render`에서 다음 local을 만들고 `STAGE_1`·`STAGE_1_WAVES` 참조를 제거한다.

```ts
const stageDefinition = getStageDefinition(snapshot.game.stageId);
const placementGuideCells = snapshot.selectedTower !== null
  && snapshot.phase === 'playing'
  && !snapshot.portraitBlocked
  ? stageDefinition.map.buildableCells(snapshot.game.towers.map((tower) => tower.cell))
  : undefined;
```

HUD의 `waveCount`에는 `stageDefinition.waves.length`를 전달한다.

- [ ] **Step 5: GREEN 확인**

Run: `npx vitest run tests/game/mapRendering.test.ts tests/game/renderer.test.ts tests/game/layout.test.ts tests/app/input.test.ts`

Expected: stage 1/6 map rendering, shared projection, placement guide tests가 모두 통과한다.

- [ ] **Step 6: 커밋**

```bash
git add src/game/render src/app/GameApp.ts tests/game/renderer.test.ts tests/game/mapRendering.test.ts
git commit -m "feat: render the active stage map"
```

---

### Task 4: preferences v3와 스테이지별 기록

**Files:**
- Modify: `src/app/preferences.ts`
- Modify: `src/app/GameApp.ts`
- Modify: `tests/app/preferences.test.ts`

**Interfaces:**
- Produces: `StageRecord`, `GamePreferences` v3, `stageRecordFor(preferences, stageId)`
- Changes: `recordOutcome` result includes `stageId`; mutation helpers accept current in-memory preferences as an optional final argument
- Preserves: muted, totalAttempts, totalVictories and best-effort localStorage behavior

- [ ] **Step 1: v2 이전·해금·기록 실패 테스트 작성**

다음 key-aware fake storage와 기본 preference helper를 test file 상단에 둔다.

```ts
function storageWith(initial: Readonly<Record<string, string>>): PreferencesStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

function throwingStorage(): PreferencesStorage {
  return {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
  };
}

function defaultPreferences(): GamePreferences {
  return {
    muted: false,
    totalAttempts: 0,
    totalVictories: 0,
    highestUnlockedStage: 1,
    stageRecords: {},
  };
}
```

그 다음 아래 계약을 작성한다.

```ts
it('migrates v2 records to stage one and unlocks stage two after a prior victory', () => {
  const storage = storageWith({
    'huchu-defense.preferences.v2': JSON.stringify({
      muted: true, bestScore: 8200, bestClearSeconds: 95,
      totalAttempts: 3, totalVictories: 1,
    }),
  });
  expect(loadPreferences(storage)).toEqual({
    muted: true,
    totalAttempts: 3,
    totalVictories: 1,
    highestUnlockedStage: 2,
    stageRecords: { 1: { bestScore: 8200, bestClearSeconds: 95 } },
  });
});

it('unlocks only the next stage on victory and keeps defeat locked', () => {
  const storage = storageWith({});
  const initial = loadPreferences(storage);
  const defeat = recordOutcome(storage, {
    stageId: 1, score: 4000, victory: false, elapsedSeconds: 90,
  }, initial);
  expect(defeat.preferences.highestUnlockedStage).toBe(1);
  expect(stageRecordFor(defeat.preferences, 1)).toEqual({ bestScore: 4000, bestClearSeconds: null });
  const victory = recordOutcome(storage, {
    stageId: 1, score: 8000, victory: true, elapsedSeconds: 85,
  }, defeat.preferences);
  expect(victory.preferences.highestUnlockedStage).toBe(2);
  expect(stageRecordFor(victory.preferences, 1)).toEqual({ bestScore: 8000, bestClearSeconds: 85 });
});

it('caps unlocks at six and advances in memory when storage throws', () => {
  const unavailable = throwingStorage();
  const current = { ...defaultPreferences(), highestUnlockedStage: 6 };
  const result = recordOutcome(unavailable, {
    stageId: 6, score: 11000, victory: true, elapsedSeconds: 120,
  }, current);
  expect(result.preferences.highestUnlockedStage).toBe(6);
  expect(stageRecordFor(result.preferences, 6).bestScore).toBe(11000);
});
```

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/app/preferences.test.ts`

Expected: v3 fields와 `stageRecordFor`가 없어 실패한다.

- [ ] **Step 3: preferences v3 구현**

저장 키를 `huchu-defense.preferences.v3`로 변경하고 v2 key를 migration source로 유지한다. 기본값은 다음과 같다.

```ts
const DEFAULT_PREFERENCES: GamePreferences = {
  muted: false,
  totalAttempts: 0,
  totalVictories: 0,
  highestUnlockedStage: 1,
  stageRecords: {},
};

export function stageRecordFor(
  preferences: GamePreferences,
  stageId: unknown,
): StageRecord {
  const id = normalizeStageId(stageId);
  return preferences.stageRecords[id] ?? { bestScore: 0, bestClearSeconds: null };
}
```

`loadPreferences`는 v3가 없을 때 v2를 읽고 stage 1 record로 이전한다. `recordAttempt`, `saveMutedPreference`, `recordOutcome`은 마지막 optional `current = loadPreferences(storage)` 인자를 사용해 localStorage 실패 시에도 전달된 메모리 상태를 잃지 않는다. `recordOutcome`은 현재 stage record만 갱신하고 승리일 때 `highestUnlockedStage`를 `Math.min(6, Math.max(current, stageId + 1))`로 올린다.

- [ ] **Step 4: GameApp 결과 기록을 현재 스테이지에 연결**

`GameApp`의 mute·attempt·outcome 호출에 현재 `preferences`를 전달한다. 결과 패널은 `stageRecordFor(preferences, snapshot.game.stageId)`의 `bestScore`와 `bestClearSeconds`를 표시한다. `recordOutcome` 입력에는 `stageId: game.stageId`를 추가한다.

- [ ] **Step 5: GREEN 확인**

Run: `npx vitest run tests/app/preferences.test.ts tests/game/scoring.test.ts tests/app/lifecycle.test.ts`

Expected: v2 migration, corrupt storage fallback, stage record, 기존 score suite가 모두 통과한다.

- [ ] **Step 6: 커밋**

```bash
git add src/app/preferences.ts src/app/GameApp.ts tests/app/preferences.test.ts
git commit -m "feat: persist stage progression records"
```

---

### Task 5: 최소 스테이지 선택·순차 진행 UI

**Files:**
- Modify: `src/app/hud.ts`
- Modify: `src/app/GameApp.ts`
- Modify: `src/styles.css`
- Modify: `tests/app/hud.test.ts`
- Modify: `tests/scaffold.test.ts`

**Interfaces:**
- Consumes: `STAGE_IDS`, `getStageDefinition`, `preferences.highestUnlockedStage`
- Produces: `createStagePickerView(selectedStageId, highestUnlockedStage)`, `stageActionLabel(phase, currentStageId, selectedStageId)`, `HudElements.stageButtons`
- Preserves: one overlay, 44px minimum touch target, mobile landscape map area

- [ ] **Step 1: HUD 순수 계약 실패 테스트 작성**

`tests/app/hud.test.ts`에 다음 assertions를 추가한다.

```ts
it('formats the selected stage into the compact wave status', () => {
  const view = createHudView({
    stageId: 4, gold: 320, baseHp: 20, waveIndex: 2, waveCount: 10,
    phase: 'playing', speed: 1, muted: false, portraitBlocked: false,
  });
  expect(view.waveText).toBe('S4 · 3/10');
  expect(view.waveLabel).toBe('스테이지 4, 현재 웨이브 3/10');
});

it('marks only unlocked stage buttons as selectable', () => {
  expect(createStagePickerView(2, 3)).toEqual([
    { id: 1, selected: false, locked: false },
    { id: 2, selected: true, locked: false },
    { id: 3, selected: false, locked: false },
    { id: 4, selected: false, locked: true },
    { id: 5, selected: false, locked: true },
    { id: 6, selected: false, locked: true },
  ]);
});

it('uses the approved progression action labels', () => {
  expect(stageActionLabel('ready', 1, 1)).toBe('게임 시작');
  expect(stageActionLabel('defeat', 3, 3)).toBe('다시 도전');
  expect(stageActionLabel('victory', 3, 4)).toBe('다음 스테이지');
  expect(stageActionLabel('victory', 6, 6)).toBe('다시 하기');
  expect(stageActionLabel('victory', 3, 2)).toBe('스테이지 2 시작');
});
```

`tests/scaffold.test.ts`에서는 `.stage-picker`가 6열 grid이고 `.stage-picker__button`이 44×44 최소 크기인지 CSS source contract로 검증한다.

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/app/hud.test.ts tests/scaffold.test.ts`

Expected: picker helpers와 CSS가 없어 새 tests가 실패한다.

- [ ] **Step 3: HUD 마크업과 스타일 구현**

`HudViewInput`에 `stageId: StageId`를 추가하고 wave text를 `S${stageId} · ${wave}/${waveCount}`로 만든다. 오버레이 본문과 결과 패널 사이에 다음 picker를 추가한다.

```ts
<div class="stage-picker" data-stage-picker aria-label="스테이지 선택">
  ${STAGE_IDS.map((id) => `
    <button class="game-control stage-picker__button" data-stage-id="${id}"
      type="button" aria-label="스테이지 ${id}" aria-pressed="false">${id}</button>
  `).join('')}
</div>
```

`renderStagePicker`는 locked 버튼을 disabled 처리하고 `스테이지 N 잠김` label을 사용한다.

```css
.stage-picker {
  display: grid;
  grid-template-columns: repeat(6, 44px);
  justify-content: center;
  gap: 6px;
  margin-top: 10px;
}

.stage-picker__button {
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  background: var(--md-sys-color-surface-container-high);
  font-weight: 900;
}

.stage-picker__button[aria-pressed="true"] {
  border-color: var(--md-sys-color-primary);
  background: #245f5c;
  box-shadow: inset 0 0 0 2px rgba(109, 229, 220, 0.34);
}
```

locked 버튼은 기존 `.game-control:disabled` opacity를 재사용한다.

- [ ] **Step 4: GameApp 선택과 다음 스테이지 흐름 구현**

preferences 로드 직후 `let selectedStageId = preferences.highestUnlockedStage`를 둔다. runtime dependency는 reference 대신 closure를 사용한다.

```ts
createGame: () => createGame(selectedStageId),
```

render 시 picker view를 현재 preferences와 selected ID로 갱신하고 overlay key에 current stage, selected stage, highest unlock을 포함한다. 승리 outcome에서는 record 결과를 저장한 뒤 현재 stage가 6 미만이면 `selectedStageId = currentStage + 1`로 둔다. 패배에서는 현재 stage를 유지한다.

각 stage button listener는 `ready|victory|defeat` 상태와 `id <= highestUnlockedStage`를 모두 확인한 뒤 selected ID를 바꾸고 `runtime.renderNow()`를 호출한다. state action은 기존 `startNewGame()`을 재사용해 선택된 stage의 완전히 새 상태를 시작한다.

- [ ] **Step 5: GREEN 및 app 회귀 확인**

Run: `npx vitest run tests/app/hud.test.ts tests/scaffold.test.ts tests/app/preferences.test.ts tests/app/gameRuntime.test.ts tests/app/lifecycle.test.ts`

Expected: stage picker, HUD, persistence, runtime lifecycle suites가 모두 통과한다.

- [ ] **Step 6: 커밋**

```bash
git add src/app/hud.ts src/app/GameApp.ts src/styles.css tests/app/hud.test.ts tests/scaffold.test.ts
git commit -m "feat: add stage selection and unlocking"
```

---

### Task 6: 백로그 완료와 E2E 제외 전체 검증

**Files:**
- Modify: `docs/backlog.md`
- Verify: `dist/index.html`

**Interfaces:**
- Consumes: Tasks 1~5의 검증된 결과
- Produces: 완료된 6스테이지 backlog와 배포 가능한 production build

- [ ] **Step 1: 백로그 8개 항목 완료 처리**

`docs/backlog.md`의 `6스테이지 확장` 아래 8개 checkbox를 모두 `[x]`로 변경한다. E2E 제외 정책과 설계서 링크는 유지한다.

- [ ] **Step 2: 전체 검증 실행**

Run: `npm run check`

Expected: 모든 Vitest file과 test가 통과하고 `tsc -b && vite build`가 exit 0이다.

- [ ] **Step 3: base·스코프·작업 트리 검증**

```bash
rg -o '/huchu-duckbae-tower-defense/[^" ]+' dist/index.html
git diff --check
git status --short
git diff --stat origin/main..HEAD
```

Expected: manifest/icon/JS/CSS 경로가 canonical base로 시작하고 whitespace error가 없으며 변경은 설계·계획·6스테이지 구현·백로그에 한정된다. `npm run test:e2e`는 실행하지 않는다.

- [ ] **Step 4: 백로그 커밋**

```bash
git add docs/backlog.md
git commit -m "docs: complete six stage backlog"
```

---

### Task 7: main 배포와 공개 리소스 검증

**Files:**
- Verify: `.github/workflows/deploy-pages.yml`
- Verify: GitHub Pages production output

**Interfaces:**
- Consumes: clean main branch and successful `npm run check`
- Produces: deployed GitHub Pages build for the pushed HEAD

- [ ] **Step 1: 배포 직전 HEAD 재검증**

Run: `npm run check && git status --porcelain && git rev-parse HEAD`

Expected: test/build가 통과하고 status output이 비어 있으며 배포 SHA가 출력된다.

- [ ] **Step 2: main 푸시**

Run: `env -u GITHUB_TOKEN git push origin main`

Expected: local `main`이 `origin/main`으로 fast-forward push된다.

- [ ] **Step 3: 푸시 SHA의 Pages workflow 확인**

```bash
DEPLOY_SHA=$(git rev-parse HEAD)
RUN_ID=$(env -u GITHUB_TOKEN gh run list --workflow deploy-pages.yml --branch main --limit 5 \
  --json databaseId,headSha --jq '.[] | select(.headSha == "'"$DEPLOY_SHA"'") | .databaseId' \
  | head -n 1)
test -n "$RUN_ID"
env -u GITHUB_TOKEN gh run watch "$RUN_ID" --exit-status --interval 5
```

Expected: `headSha`가 `DEPLOY_SHA`와 같은 run이 존재하고 build와 deploy가 모두 success로 종료한다.

- [ ] **Step 4: 공개 파일 HTTP 200과 hash 검증**

공개 index를 cache bypass query로 내려받고 그 HTML에 적힌 hashed JS/CSS와 대표 minotaur asset을 요청한다.

```bash
VERIFY_DIR=$(mktemp -d)
PUBLIC_BASE='https://loomingsight.github.io/huchu-duckbae-tower-defense'
curl -sS -L -H 'Cache-Control: no-cache' -o "$VERIFY_DIR/index.html" -w 'index %{http_code}\n' \
  "$PUBLIC_BASE/?deploy=$(git rev-parse HEAD)"
JS_PATH=$(rg -o '/huchu-duckbae-tower-defense/assets/[^" ]+\.js' dist/index.html)
CSS_PATH=$(rg -o '/huchu-duckbae-tower-defense/assets/[^" ]+\.css' dist/index.html)
MINOTAUR_FILE=$(rg --files dist/assets | rg '/minotaur-[^/]+\.png$' | head -n 1)
curl -sS -L -o "$VERIFY_DIR/app.js" -w 'javascript %{http_code}\n' "$PUBLIC_BASE/assets/${JS_PATH##*/}"
curl -sS -L -o "$VERIFY_DIR/app.css" -w 'css %{http_code}\n' "$PUBLIC_BASE/assets/${CSS_PATH##*/}"
curl -sS -L -o "$VERIFY_DIR/manifest.webmanifest" -w 'manifest %{http_code}\n' \
  "$PUBLIC_BASE/manifest.webmanifest?deploy=$(git rev-parse HEAD)"
curl -sS -L -o "$VERIFY_DIR/minotaur.png" -w 'asset %{http_code}\n' \
  "$PUBLIC_BASE/assets/${MINOTAUR_FILE##*/}"
cmp -s dist/index.html "$VERIFY_DIR/index.html"
cmp -s "dist/assets/${JS_PATH##*/}" "$VERIFY_DIR/app.js"
cmp -s "dist/assets/${CSS_PATH##*/}" "$VERIFY_DIR/app.css"
cmp -s "$MINOTAUR_FILE" "$VERIFY_DIR/minotaur.png"
```

Expected: index, manifest, hashed JS, hashed CSS, 대표 minotaur PNG가 모두 HTTP 200이며 index/JS/CSS/asset이 local `dist`와 byte-for-byte 일치한다.

- [ ] **Step 5: 최종 보고**

다음을 사용자에게 보고한다.

- 총 6개 스테이지와 순차 해금·스테이지별 기록 구현
- 실제 `npm run check` test file/test count와 build 성공
- E2E 미실행
- 배포 commit SHA와 GitHub Actions URL
- 공개 게임 URL과 public hash 일치 결과
