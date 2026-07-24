# 타워 선택 취소 및 설치 타워 정보 조회 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 골드가 부족해도 선택 중인 타워를 취소할 수 있고, 배치 모드가 아닐 때 설치된 타워의 이름·주 능력치와 맵 사정거리를 확인할 수 있게 한다.

**Architecture:** `GameRuntime`에 배치 선택과 독립적인 `inspectedTowerId` 상태를 추가한다. HUD는 카탈로그 기반의 최소 정보 뷰를 렌더링하고, `GameApp`은 캔버스 셀에서 설치 타워를 찾아 기존 맵 선택·사정거리 렌더 입력으로 연결한다.

**Tech Stack:** TypeScript, Canvas 2D, DOM/CSS, Vitest, Vite

## Global Constraints

- 선택되지 않은 구매 불가능 타워 버튼은 계속 `disabled` 상태여야 한다.
- 현재 선택된 타워만 골드 부족 예외를 적용하며 일시정지·세로 방향 차단 규칙은 유지한다.
- 정보 패널에는 이름과 `공격력` 또는 `둔화`만 표시한다.
- 사정거리는 맵 가이드로만 표시하고 텍스트 수치로 노출하지 않는다.
- 공격 간격과 폭발 범위는 표시하지 않는다.
- 빈 타일, 그리드 바깥, 닫기 버튼, 새 게임, 결과 진입, 배치 타워 선택은 조회 상태를 해제한다.
- 닫기 버튼은 최소 `44 × 44px` 터치 영역을 보장한다.
- 전체 E2E 스위트는 실행하지 않고 단위 테스트, 타입 검사, 프로덕션 빌드와 모바일 브라우저 스모크 테스트로 검증한다.

---

### Task 1: 런타임에 설치 타워 조회 상태 추가

**Files:**
- Modify: `src/app/gameRuntime.ts`
- Modify: `tests/app/gameRuntime.test.ts`

**Interfaces:**
- Produces: `GameRuntimeSnapshot.inspectedTowerId: number | null`
- Produces: `GameRuntime.inspectTower(id: number | null): void`
- Consumes: 기존 `selectTower`, `setSelectedCell`, `startGame`, 결과 전환 흐름

- [ ] **Step 1: 조회 상태 전환과 초기화 실패 테스트 작성**

`tests/app/gameRuntime.test.ts`에 다음 테스트를 추가한다.

```ts
it('tracks one inspected tower independently and clears placement state', () => {
  const { runtime } = setupRuntime();
  runtime.startGame();
  runtime.selectTower('arrow');
  runtime.setSelectedCell({ col: 2, row: 5 });

  runtime.inspectTower(7);
  expect(runtime.getSnapshot()).toMatchObject({
    selectedTower: null,
    selectedCell: null,
    inspectedTowerId: 7,
  });

  runtime.inspectTower(9);
  expect(runtime.getSnapshot().inspectedTowerId).toBe(9);

  runtime.selectTower('slow');
  expect(runtime.getSnapshot().inspectedTowerId).toBeNull();
});

it('normalizes invalid inspection IDs and clears inspection on restart', () => {
  const { runtime } = setupRuntime();
  runtime.startGame();
  runtime.inspectTower(Number.NaN);
  expect(runtime.getSnapshot().inspectedTowerId).toBeNull();

  runtime.inspectTower(3);
  runtime.startGame();
  expect(runtime.getSnapshot().inspectedTowerId).toBeNull();
});
```

기존 `restart resets state...` 테스트의 최종 스냅샷에도
`expect(snapshot.inspectedTowerId).toBeNull()`을 추가한다.

- [ ] **Step 2: 런타임 집중 테스트가 실패하는지 확인**

Run:

```bash
npx vitest run tests/app/gameRuntime.test.ts
```

Expected: `inspectTower`와 `inspectedTowerId`가 존재하지 않아 FAIL.

- [ ] **Step 3: 최소 런타임 상태 구현**

`src/app/gameRuntime.ts`의 공개 타입에 다음 필드를 추가한다.

```ts
export type GameRuntimeSnapshot = Readonly<{
  // existing fields
  inspectedTowerId: number | null;
}>;

export type GameRuntime = Readonly<{
  // existing methods
  inspectTower(id: number | null): void;
}>;
```

내부 상태와 스냅샷을 연결한다.

```ts
let inspectedTowerId: number | null = null;

function snapshot(): GameRuntimeSnapshot {
  return {
    game,
    phase,
    speed,
    selectedTower,
    selectedCell,
    inspectedTowerId,
    portraitBlocked,
    elapsedSeconds,
  };
}
```

`startGame()`과 결과 확정에서 `inspectedTowerId = null`로 초기화한다.
`selectTower(type)`과 새 메서드는 다음 규칙을 사용한다.

```ts
selectTower(type) {
  if (selectedTower !== type) selectedCell = null;
  selectedTower = type;
  if (type !== null) inspectedTowerId = null;
  dependencies.render();
},
inspectTower(id) {
  selectedTower = null;
  selectedCell = null;
  inspectedTowerId = typeof id === 'number' && Number.isInteger(id) && id > 0
    ? id
    : null;
  dependencies.render();
},
```

- [ ] **Step 4: 런타임 집중 테스트 통과 확인**

Run:

```bash
npx vitest run tests/app/gameRuntime.test.ts
```

Expected: PASS.

- [ ] **Step 5: 런타임 상태 커밋**

```bash
git add src/app/gameRuntime.ts tests/app/gameRuntime.test.ts
git commit -m "feat: track installed tower inspection"
```

---

### Task 2: 타워 버튼 예외와 카탈로그 기반 정보 패널 구현

**Files:**
- Modify: `src/app/hud.ts`
- Modify: `src/styles.css`
- Modify: `tests/app/hud.test.ts`
- Modify: `tests/scaffold.test.ts`

**Interfaces:**
- Produces: `towerCardDisabled(input, cost, selected): boolean`
- Produces: `TowerInspectionView`
- Produces: `createTowerInspectionView(type): TowerInspectionView`
- Produces: `renderTowerInspection(elements, type): void`
- Consumes: `TOWER_CARDS`, `TOWER_CATALOG`, `TowerType`

- [ ] **Step 1: 골드 부족 취소와 정보 뷰 실패 테스트 작성**

`tests/app/hud.test.ts` import에 `createTowerInspectionView`와
`towerCardDisabled`를 추가하고 다음 테스트를 작성한다.

```ts
it('keeps only the selected unaffordable tower actionable during play', () => {
  const input = {
    gold: 0,
    phase: 'playing' as const,
    portraitBlocked: false,
  };

  expect(towerCardDisabled(input, 100, true)).toBe(false);
  expect(towerCardDisabled(input, 100, false)).toBe(true);
  expect(towerCardDisabled({ ...input, phase: 'paused' }, 100, true)).toBe(true);
  expect(towerCardDisabled({ ...input, portraitBlocked: true }, 100, true)).toBe(true);
});

it('shows only the approved primary stat for installed towers', () => {
  expect(createTowerInspectionView('slow')).toEqual({
    name: '슬로우 타워',
    statLabel: '둔화 38%',
    closeLabel: '슬로우 타워 정보 닫기',
  });
  expect(createTowerInspectionView('arrow').statLabel).toBe('공격력 18');
  expect(createTowerInspectionView('deokbae').statLabel).toBe('공격력 14');
  expect(createTowerInspectionView('huchu').statLabel).toBe('공격력 72');
});
```

`tests/scaffold.test.ts`에는 다음 구조 계약을 추가한다.

```ts
it('provides a compact accessible installed-tower panel', () => {
  const hud = readFileSync('src/app/hud.ts', 'utf8');
  const css = readFileSync('src/styles.css', 'utf8');

  expect(hud).toContain('data-tower-inspection');
  expect(hud).toContain('aria-label="설치 타워 정보"');
  expect(hud).toContain('data-tower-inspection-close');
  expect(css).toMatch(/\.tower-inspection\[hidden\]\s*\{[^}]*display: none;/s);
  expect(css).toMatch(
    /\.tower-inspection__close\s*\{[^}]*min-width: 44px;[^}]*min-height: 44px;/s,
  );
});
```

- [ ] **Step 2: HUD 집중 테스트가 실패하는지 확인**

Run:

```bash
npx vitest run tests/app/hud.test.ts tests/scaffold.test.ts
```

Expected: 새 함수와 마크업 및 CSS가 없어 FAIL.

- [ ] **Step 3: 순수 뷰와 버튼 비활성화 규칙 구현**

`src/app/hud.ts`에 다음 함수를 추가한다.

```ts
export function towerCardDisabled(
  input: Pick<HudViewInput, 'gold' | 'phase' | 'portraitBlocked'>,
  cost: number,
  selected: boolean,
): boolean {
  const availability = towerCardAvailability(input, cost);
  const controlsDisabled = input.portraitBlocked || input.phase !== 'playing';
  return controlsDisabled || (availability.unaffordable && !selected);
}

export type TowerInspectionView = Readonly<{
  name: string;
  statLabel: string;
  closeLabel: string;
}>;

function nonNegativeWhole(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

export function createTowerInspectionView(type: TowerType): TowerInspectionView {
  const card = TOWER_CARDS.find((candidate) => candidate.type === type)!;
  const definition = TOWER_CATALOG[type];
  const statLabel = type === 'slow'
    ? `둔화 ${nonNegativeWhole((1 - (definition.multiplier ?? 1)) * 100)}%`
    : `공격력 ${nonNegativeWhole(definition.damage)}`;
  return {
    name: card.name,
    statLabel,
    closeLabel: `${card.name} 정보 닫기`,
  };
}
```

`renderHud()`의 버튼 비활성화는 다음처럼 변경한다.

```ts
button.disabled = towerCardDisabled(input, card.cost, isSelected);
```

- [ ] **Step 4: 정보 패널 DOM과 렌더 함수 구현**

`HudElements`에 `towerInspection`, `towerInspectionName`,
`towerInspectionStat`, `towerInspectionClose`를 추가한다. `createHud()`의
`.game-stage` 안에서 배치 확인 영역 다음에 아래 마크업을 추가한다.

```html
<aside class="tower-inspection" data-tower-inspection
  aria-label="설치 타워 정보" hidden>
  <span class="tower-inspection__copy">
    <strong data-tower-inspection-name>타워</strong>
    <span data-tower-inspection-stat>공격력 0</span>
  </span>
  <button class="game-control tower-inspection__close"
    data-tower-inspection-close type="button" aria-label="타워 정보 닫기">×</button>
</aside>
```

DOM 조회를 연결하고 다음 렌더 함수를 추가한다.

```ts
export function renderTowerInspection(
  elements: HudElements,
  type: TowerType | null,
): void {
  elements.towerInspection.hidden = type === null;
  if (type === null) return;
  const view = createTowerInspectionView(type);
  elements.towerInspectionName.textContent = view.name;
  elements.towerInspectionStat.textContent = view.statLabel;
  elements.towerInspectionClose.setAttribute('aria-label', view.closeLabel);
}
```

- [ ] **Step 5: 최소 점유 CSS 구현**

`src/styles.css`에 다음 규칙을 추가하고 기존 모바일 트레이 상단 규칙과 연결한다.

```css
.tower-inspection {
  position: absolute;
  z-index: 4;
  left: 50%;
  bottom: calc(max(4px, env(safe-area-inset-bottom)) + 72px);
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 10px;
  padding: 4px 5px 4px 14px;
  transform: translateX(-50%);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 18px;
  background: rgba(25, 54, 43, 0.96);
  box-shadow: var(--md-sys-elevation-2);
}

.tower-inspection[hidden] {
  display: none;
}

.tower-inspection__copy {
  display: flex;
  align-items: baseline;
  gap: 8px;
  white-space: nowrap;
}

.tower-inspection__close {
  min-width: 44px;
  min-height: 44px;
  padding: 0;
}
```

모바일 가로 미디어 쿼리에 다음을 추가한다.

```css
.game-shell--tower-tray-top .tower-inspection {
  top: calc(max(4px, env(safe-area-inset-top)) + 58px);
  bottom: auto;
}
```

- [ ] **Step 6: HUD 집중 테스트 통과 확인**

Run:

```bash
npx vitest run tests/app/hud.test.ts tests/scaffold.test.ts
```

Expected: PASS.

- [ ] **Step 7: HUD 변경 커밋**

```bash
git add src/app/hud.ts src/styles.css tests/app/hud.test.ts tests/scaffold.test.ts
git commit -m "feat: add installed tower info panel"
```

---

### Task 3: 캔버스 탭과 맵 사정거리 연결

**Files:**
- Create: `src/app/towerInspection.ts`
- Create: `tests/app/towerInspection.test.ts`
- Modify: `src/app/GameApp.ts`
- Modify: `tests/scaffold.test.ts`

**Interfaces:**
- Produces: `towerAtCell(towers, cell): Readonly<GameTower> | null`
- Produces: `towerById(towers, id): Readonly<GameTower> | null`
- Consumes: `GameRuntime.inspectTower`, `renderTowerInspection`, 기존 `pointerToCell`

- [ ] **Step 1: 타워 조회 실패 테스트 작성**

`tests/app/towerInspection.test.ts`를 생성한다.

```ts
import { describe, expect, it } from 'vitest';
import { towerAtCell, towerById } from '../../src/app/towerInspection';
import { createGame } from '../../src/game/simulation/createGame';
import { placeTower } from '../../src/game/simulation/placeTower';

describe('installed tower lookup', () => {
  it('finds towers by exact cell or stable ID', () => {
    const state = createGame();
    placeTower(state, 'arrow', { col: 4, row: 1 });
    const tower = state.towers[0];

    expect(towerAtCell(state.towers, { col: 4, row: 1 })).toBe(tower);
    expect(towerAtCell(state.towers, { col: 5, row: 1 })).toBeNull();
    expect(towerById(state.towers, tower.id)).toBe(tower);
    expect(towerById(state.towers, 999)).toBeNull();
  });
});
```

- [ ] **Step 2: 조회 테스트가 실패하는지 확인**

Run:

```bash
npx vitest run tests/app/towerInspection.test.ts
```

Expected: `src/app/towerInspection.ts`가 없어 FAIL.

- [ ] **Step 3: 최소 조회 도우미 구현**

`src/app/towerInspection.ts`를 생성한다.

```ts
import type { GameTower } from '../game/simulation/createGame';
import type { Cell } from '../game/types';

export function towerAtCell(
  towers: readonly Readonly<GameTower>[],
  cell: Readonly<Cell>,
): Readonly<GameTower> | null {
  return towers.find((tower) => (
    tower.cell.col === cell.col && tower.cell.row === cell.row
  )) ?? null;
}

export function towerById(
  towers: readonly Readonly<GameTower>[],
  id: number,
): Readonly<GameTower> | null {
  return towers.find((tower) => tower.id === id) ?? null;
}
```

- [ ] **Step 4: `GameApp` 렌더 상태 연결**

`src/app/GameApp.ts`에서 새 HUD 함수와 조회 도우미를 import한다. `render()` 시작부에서
조회 대상을 계산한다.

```ts
const inspectedTower = snapshot.inspectedTowerId === null
  ? null
  : towerById(snapshot.game.towers, snapshot.inspectedTowerId);
const placingTower = snapshot.selectedTower !== null && snapshot.selectedCell !== null;
const mapSelectedCell = placingTower ? snapshot.selectedCell : inspectedTower?.cell ?? null;
const mapSelectedRange = placingTower
  ? TOWER_CATALOG[snapshot.selectedTower!].range
  : inspectedTower === null
    ? undefined
    : TOWER_CATALOG[inspectedTower.type].range;
```

`renderer.render()`에는 `mapSelectedCell`과 `mapSelectedRange`를 전달한다. 배치
유효성 및 미리보기는 기존 배치 상태에서만 전달한다. `hudKey`에
`snapshot.inspectedTowerId`를 추가하고 HUD 갱신 블록에서 다음을 호출한다.

```ts
renderTowerInspection(hud, inspectedTower?.type ?? null);
```

- [ ] **Step 5: 캔버스 탭과 닫기 동작 연결**

다음 함수를 `GameApp` 내부에 추가한다.

```ts
function inspectTowerAt(point: ClientPoint): void {
  const snapshot = runtime.getSnapshot();
  if (
    (snapshot.phase !== 'playing' && snapshot.phase !== 'paused')
    || snapshot.portraitBlocked
    || snapshot.selectedTower !== null
  ) return;
  const cell = pointerToCell(point, renderer.getLayout(), hud.canvas.getBoundingClientRect());
  const tower = cell === null ? null : towerAtCell(snapshot.game.towers, cell);
  runtime.inspectTower(tower?.id ?? null);
}
```

`pointerdown`은 다음 두 경우만 포인터를 추적한다.

```ts
const canPlace = snapshot.phase === 'playing' && snapshot.selectedTower !== null;
const canInspect = (
  (snapshot.phase === 'playing' || snapshot.phase === 'paused')
  && snapshot.selectedTower === null
);
if (snapshot.portraitBlocked || (!canPlace && !canInspect)) return;
```

`pointerup` 탭 처리에서 현재 스냅샷에 따라 분기한다.

```ts
if (!isTapGesture(active.start, end)) return;
if (runtime.getSnapshot().selectedTower !== null) previewSelectedTower(end);
else inspectTowerAt(end);
```

닫기 버튼을 연결한다.

```ts
scope.listen(hud.towerInspectionClose, 'click', () => runtime.inspectTower(null));
```

- [ ] **Step 6: 구조 계약과 집중 테스트 통과 확인**

`tests/scaffold.test.ts`의 정보 패널 테스트에 다음 기대를 추가한다.

```ts
expect(app).toContain('towerAtCell(');
expect(app).toContain('towerById(');
expect(app).toContain('renderTowerInspection(');
expect(app).toContain('runtime.inspectTower(');
```

Run:

```bash
npx vitest run tests/app/towerInspection.test.ts tests/app/gameRuntime.test.ts tests/app/hud.test.ts tests/scaffold.test.ts
```

Expected: PASS.

- [ ] **Step 7: 캔버스 조회 통합 커밋**

```bash
git add src/app/towerInspection.ts src/app/GameApp.ts tests/app/towerInspection.test.ts tests/scaffold.test.ts
git commit -m "feat: inspect placed towers on the board"
```

---

### Task 4: 타워 조회 기능 전체 검증

**Files:**
- Verify: `src/app/GameApp.ts`
- Verify: `src/app/gameRuntime.ts`
- Verify: `src/app/hud.ts`
- Verify: `src/styles.css`
- Verify: `tests/app/*.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3의 런타임, HUD, 캔버스 조회 계약
- Produces: 배포 가능한 검증 결과

- [ ] **Step 1: 전체 단위 테스트와 프로덕션 빌드**

Run:

```bash
npm run check
```

Expected: 모든 Vitest 파일 PASS, `tsc -b` PASS, Vite production build PASS.

- [ ] **Step 2: 배포 base 경로 확인**

Run:

```bash
rg -o '/huchu-duckbae-tower-defense/[^" ]+\.(js|css)' dist/index.html
```

Expected: JS와 CSS 경로가 모두 `/huchu-duckbae-tower-defense/`로 시작한다.

- [ ] **Step 3: 모바일 브라우저 스모크 테스트**

`844 × 390` 가로 viewport에서 다음을 확인한다.

1. 화살 타워 선택 후 골드를 비용 아래로 만든 상태에서도 선택 버튼을 눌러 취소된다.
2. 배치 모드가 아닐 때 설치된 타워를 누르면 이름과 공격력 또는 둔화만 표시된다.
3. 사정거리 숫자는 패널에 없고 맵 범위 가이드만 표시된다.
4. 빈 타일과 닫기 버튼이 패널과 범위 가이드를 닫는다.
5. 타워 트레이 위·아래 위치 모두에서 패널이 중앙 전투 경로를 가리지 않는다.
6. 브라우저 콘솔 오류가 없다.

- [ ] **Step 4: 변경 상태 검사**

Run:

```bash
git diff --check
git status --short
```

Expected: 공백 오류 없음. 의도한 파일만 변경됐거나 커밋돼 있다.
