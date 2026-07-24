# 나이트메어 봉인 방패 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 나이트메어 N3~N6에서 화살-only 전략은 봉인 방패를 돌파하지 못하게 하고, 슬로우 또는 덕배·후추를 포함한 혼합 전략은 2별 이상으로 클리어할 수 있게 한다.

**Architecture:** 기존 해골 기사의 `shieldHitsRemaining`과 방패 이벤트를 재사용한다. 피해 처리기는 투사체 타워 종류를 받아 화살을 차단하고, 슬로우 처리기와 고급 타워는 공용 `disruptEnemyShield` 함수로 봉인 방패를 해제한다. 기존 특성 안내 상태에는 N3 전용 안내만 추가한다.

**Tech Stack:** TypeScript 5.8, Vitest 3.2, Vite 7, HTML Canvas, GitHub Actions Pages

## Global Constraints

- 봉인 방패는 나이트메어 N3~N6의 해골 기사에게만 적용한다.
- N1·N2의 기존 3회 방어 규칙은 유지한다.
- 화살 공격은 봉인 방패를 소모하거나 피해를 주지 않는다.
- 슬로우 범위 진입 또는 덕배·후추 첫 타격은 방패만 해제한다.
- N3에서만 최초 안내를 2.5초 동안 한 번 표시한다.
- N1·N2 시작 골드는 280G, N3~N6은 360/380/480/480G다.
- 타워 수치, 적 카탈로그, 웨이브 구성, 점수 기준과 저장 스키마는 변경하지 않는다.
- 새 에셋과 오디오는 만들지 않는다.
- 전체 E2E는 실행하지 않는다.
- Vite base `/huchu-duckbae-tower-defense/`를 유지한다.

---

### Task 1: 봉인 방패 전투 계약 RED

**Files:**
- Modify: `tests/game/nightmareTraits.test.ts`
- Modify: `tests/game/nightmareBalance.test.ts`

**Interfaces:**
- Consumes: `spawnEnemy(state, type, waveIndex)`, `applyEnemyDamage(state, enemy, damage, sourceType?)`, `updateSlow(state)`
- Produces: N1·N2 기존 방패 회귀 계약, N3~N6 봉인 방패 블록·해제 계약, 화살-only 패배 계약

- [ ] **Step 1: 방패 상호작용 실패 테스트를 추가한다**

`tests/game/nightmareTraits.test.ts`에 다음 계약을 추가한다.

```ts
it('keeps the N3 counter shield locked against arrows', () => {
  const state = createGame('nightmare-3');
  spawnEnemy(state, 'skeletonKnight', 0);
  const enemy = state.enemies[0];

  for (let hit = 0; hit < 6; hit += 1) {
    applyEnemyDamage(state, enemy, 18, 'arrow');
  }

  expect(enemy.hp).toBe(enemy.maxHp);
  expect(enemy.shieldHitsRemaining).toBe(3);
  expect(state.traitEvents.filter(({ kind }) => kind === 'shield-block'))
    .toHaveLength(6);
});

it('lets slow and premium towers disrupt the N3 counter shield', () => {
  const slowed = createGame('nightmare-3');
  placeTower(slowed, 'slow', { col: 0, row: 7 });
  spawnEnemy(slowed, 'skeletonKnight', 0);
  updateSlow(slowed);
  expect(slowed.enemies[0].shieldHitsRemaining).toBe(0);

  for (const type of ['deokbae', 'huchu'] as const) {
    const state = createGame('nightmare-3');
    spawnEnemy(state, 'skeletonKnight', 0);
    const enemy = state.enemies[0];
    applyEnemyDamage(state, enemy, 72, type);
    expect(enemy.shieldHitsRemaining).toBe(0);
    expect(enemy.hp).toBe(enemy.maxHp);
    applyEnemyDamage(state, enemy, 72, type);
    expect(enemy.hp).toBe(enemy.maxHp - 72);
  }
});
```

기존 N1 테스트의 `applyEnemyDamage` 호출에는 출처를 넘기지 않아 기존
3회 방어 계약이 유지되는지 함께 확인한다.

- [ ] **Step 2: 화살-only 패배 시뮬레이션을 추가한다**

`tests/game/nightmareBalance.test.ts`에 경로 커버리지 순 화살 빌드를 만든다.

```ts
function arrowOnlyBuildOrder(
  stageKey: TestedNightmareStageKey,
): readonly Build[] {
  return rankedBuilds(stageKey, 'arrow', new Set());
}
```

N3~N6에 대해 같은 60fps 시뮬레이션을 실행하고 패배를 고정한다.

```ts
it.each([
  'nightmare-3',
  'nightmare-4',
  'nightmare-5',
  'nightmare-6',
] satisfies readonly TestedNightmareStageKey[])(
  'defeats an arrow-only build on %s',
  (stageKey) => {
    const { state } = simulateBuildOrder(stageKey, arrowOnlyBuildOrder(stageKey));
    expect(state.towers.every(({ type }) => type === 'arrow')).toBe(true);
    expect(state.outcome).toBe('defeat');
  },
);
```

- [ ] **Step 3: 집중 테스트로 RED를 확인한다**

Run:

```bash
npx vitest run tests/game/nightmareTraits.test.ts tests/game/nightmareBalance.test.ts
```

Expected: `applyEnemyDamage`의 네 번째 인자 타입 오류 또는 N3 화살 타격이
기존 방패 횟수를 소모해 실패한다. N4·N6의 화살-only 기존 통과 결과도
새 패배 계약과 충돌한다.

---

### Task 2: 봉인 방패 전투 구현 GREEN

**Files:**
- Modify: `src/game/enemies/enemyTraits.ts`
- Modify: `src/game/combat/updateProjectiles.ts`
- Modify: `src/game/combat/updateSlow.ts`
- Test: `tests/game/nightmareTraits.test.ts`
- Test: `tests/game/combat.test.ts`

**Interfaces:**
- Produces: `disruptEnemyShield(state: GameState, enemy: GameEnemy): boolean`
- Changes: `applyEnemyDamage(state: GameState, enemy: GameEnemy, damage: number, sourceType?: TowerType): void`

- [ ] **Step 1: 봉인 방패 판정과 공용 해제 함수를 구현한다**

`src/game/enemies/enemyTraits.ts`에 타입 전용 import와 판정을 추가한다.

```ts
import { stageRef } from '../stages/stageIdentity';
import type { TowerType } from '../towers/towerCatalog';

function hasCounterShield(
  state: Readonly<GameState>,
  enemy: Readonly<GameEnemy>,
): boolean {
  const stage = stageRef(state.stageKey);
  return stage.mode === 'nightmare'
    && stage.number >= 3
    && enemy.type === 'skeletonKnight'
    && enemy.shieldHitsRemaining > 0;
}

export function disruptEnemyShield(
  state: GameState,
  enemy: GameEnemy,
): boolean {
  if (!hasCounterShield(state, enemy)) return false;
  enemy.shieldHitsRemaining = 0;
  emitEnemyTraitEvent(state, enemy, 'shield-break');
  return true;
}
```

`applyEnemyDamage`는 봉인 방패에서 화살과 출처 없는 피해를 차단하고,
덕배·후추는 방패만 해제한 뒤 반환한다.

```ts
export function applyEnemyDamage(
  state: GameState,
  enemy: GameEnemy,
  damage: number,
  sourceType?: TowerType,
): void {
  if (enemy.hp <= 0 || !Number.isFinite(damage) || damage <= 0) return;
  if (hasCounterShield(state, enemy)) {
    if (sourceType === 'deokbae' || sourceType === 'huchu') {
      disruptEnemyShield(state, enemy);
    } else {
      emitEnemyTraitEvent(state, enemy, 'shield-block');
    }
    return;
  }
  if (enemy.shieldHitsRemaining > 0) {
    enemy.shieldHitsRemaining -= 1;
    emitEnemyTraitEvent(
      state,
      enemy,
      enemy.shieldHitsRemaining === 0 ? 'shield-break' : 'shield-block',
    );
    return;
  }

  const previousHp = enemy.hp;
  enemy.hp = Math.max(0, enemy.hp - damage);
  if (enemy.hp < previousHp) {
    enemy.lastHitAtSeconds = state.elapsedSeconds;
    emitEnemyTraitEvent(state, enemy, 'damage');
  }
}
```

- [ ] **Step 2: 실제 투사체와 슬로우 경로를 연결한다**

`src/game/combat/updateProjectiles.ts`의 직접·스플래시 피해 호출에
`projectile.towerType`을 전달한다.

```ts
applyEnemyDamage(state, enemy, projectile.damage, projectile.towerType);
applyEnemyDamage(state, target, projectile.damage, projectile.towerType);
```

`src/game/combat/updateSlow.ts`는 사정거리 안의 적에게 기존 둔화를 적용하기
전에 방패 해제를 요청한다.

```ts
import {
  disruptEnemyShield,
  emitEnemyTraitEvent,
} from '../enemies/enemyTraits';

if (isWithinRadius(tower.position, position, definition.range)) {
  disruptEnemyShield(state, enemy);
  // 기존 둔화 계산 유지
}
```

- [ ] **Step 3: 집중 테스트로 GREEN을 확인한다**

Run:

```bash
npx vitest run tests/game/nightmareTraits.test.ts tests/game/combat.test.ts tests/game/nightmareBalance.test.ts
```

Expected: N1·N2 기존 방패, N3 봉인 방패, 슬로우·고급 타워 해제와 N3~N6
전략 시뮬레이션이 모두 통과한다.

- [ ] **Step 4: 전투 구현을 커밋한다**

```bash
git add src/game/enemies/enemyTraits.ts src/game/combat/updateProjectiles.ts \
  src/game/combat/updateSlow.ts tests/game/nightmareTraits.test.ts \
  tests/game/combat.test.ts tests/game/nightmareBalance.test.ts
git diff --cached --check
git commit -m "feat: require mixed towers for sealed shields"
```

---

### Task 3: N3 최초 안내

**Files:**
- Modify: `src/app/traitNotice.ts`
- Modify: `tests/app/traitNotice.test.ts`
- Test: `tests/app/hud.test.ts`

**Interfaces:**
- Consumes: 기존 `shield-open` 이벤트
- Produces: N3 전용 `shield-counter` 안내 상태와 고정 문구

- [ ] **Step 1: N3 안내 RED 테스트를 추가한다**

```ts
const shieldOpenEvent = {
  kind: 'shield-open' as const,
  enemyId: 7,
  position: { x: 4.5, y: 3.5 },
};

it('shows the sealed-shield explanation only on nightmare three', () => {
  const n3 = updateTraitNoticeState(
    createTraitNoticeState('nightmare-3'),
    [shieldOpenEvent],
    8,
  );
  expect(traitNoticeView(n3, 8)).toEqual({
    title: '해골 기사 · 봉인 방패',
    body: '슬로우·덕배·후추로 방패를 해제하세요',
  });
  expect(traitNoticeView(n3, 10.5)).toBeNull();

  for (const key of ['nightmare-2', 'nightmare-4', 'normal-3']) {
    expect(traitNoticeView(
      updateTraitNoticeState(createTraitNoticeState(key), [shieldOpenEvent], 8),
      8,
    )).toBeNull();
  }
});
```

- [ ] **Step 2: 안내 상태와 뷰를 최소 확장한다**

`TraitNoticeState`에 `baseNoticesEnabled`, `shieldCounterEnabled`,
`shieldCounterShown`을 추가하고 `ActiveTraitNotice`에
`'shield-counter'`를 추가한다. N1은 기존 두 안내만, N3은
`shield-open` 안내만 처리한다.

```ts
type ActiveTraitNotice = 'slow-resistance' | 'split' | 'shield-counter';

export type TraitNoticeState = Readonly<{
  enabled: boolean;
  baseNoticesEnabled: boolean;
  shieldCounterEnabled: boolean;
  slowResistanceShown: boolean;
  splitShown: boolean;
  shieldCounterShown: boolean;
  activeNotice: ActiveTraitNotice | null;
  noticeEndsAt: number | null;
}>;

const SHIELD_COUNTER_VIEW: TraitNoticeView = {
  title: '해골 기사 · 봉인 방패',
  body: '슬로우·덕배·후추로 방패를 해제하세요',
};

export function createTraitNoticeState(stageKey: unknown): TraitNoticeState {
  const key = normalizeStageKey(stageKey);
  const baseNoticesEnabled = key === 'nightmare-1';
  const shieldCounterEnabled = key === 'nightmare-3';
  return {
    enabled: baseNoticesEnabled || shieldCounterEnabled,
    baseNoticesEnabled,
    shieldCounterEnabled,
    slowResistanceShown: false,
    splitShown: false,
    shieldCounterShown: false,
    activeNotice: null,
    noticeEndsAt: null,
  };
}
```

`traitNoticeView`는 `activeNotice` 종류별 고정 뷰를 반환한다. 기존
2.5초 상수와 HUD 마크업·CSS는 재사용한다.

- [ ] **Step 3: 안내 집중 테스트를 실행한다**

Run:

```bash
npx vitest run tests/app/traitNotice.test.ts tests/app/hud.test.ts
```

Expected: N1 기존 안내, N3 봉인 방패 안내, N2·N4+ 비노출 계약이 통과한다.

- [ ] **Step 4: 안내 구현을 커밋한다**

```bash
git add src/app/traitNotice.ts tests/app/traitNotice.test.ts tests/app/hud.test.ts
git diff --cached --check
git commit -m "feat: explain sealed shields on N3"
```

---

### Task 4: 난도 데이터와 문서 정합성

**Files:**
- Modify: `src/game/stages/stageCatalog.ts`
- Modify: `tests/game/stages.test.ts`
- Modify: `docs/backlog.md`
- Modify: `docs/superpowers/plans/2026-07-24-nightmare-n3-n6-rebalance.md`

**Interfaces:**
- Produces: N1~N6 시작 골드 `280/280/360/380/480/480`

- [ ] **Step 1: 카탈로그 계약과 구현을 일치시킨다**

`NIGHTMARE_DIFFICULTY`에 스테이지별 `startingGold`를 선언하고 나이트메어
스테이지 생성부가 `difficulty.startingGold`를 사용하게 한다. 기존 승인
난도 배율과 점수 기준은 설계 표를 그대로 사용한다.

```ts
const expectedEconomy = [
  ['nightmare-1', 1.00, 1.00, 1.00, 1.00, 280],
  ['nightmare-2', 1.04, 1.00, 1.00, 1.00, 280],
  ['nightmare-3', 1.07, 1.01, 1.00, 1.00, 360],
  ['nightmare-4', 1.13, 1.02, 0.98, 1.02, 380],
  ['nightmare-5', 1.21, 1.03, 0.96, 1.05, 480],
  ['nightmare-6', 1.30, 1.05, 0.94, 1.08, 480],
] as const;
```

- [ ] **Step 2: 기존 계획과 백로그를 최종 결정으로 갱신한다**

- 기존 계획의 시작 골드를 `360/380/480/480G`로 맞춘다.
- 화살-only 1별 후속 검증을 화살-only 차단 실제 플레이 검증으로 바꾼다.
- N3~N6 재조정과 봉인 방패 구현 항목을 완료 처리한다.
- 배포 후 실제 플레이 항목은 배포·공개 확인 전까지 미완료로 둔다.

- [ ] **Step 3: 데이터 집중 테스트를 실행한다**

Run:

```bash
npx vitest run tests/game/stages.test.ts tests/game/nightmareBalance.test.ts
```

Expected: 카탈로그 표와 혼합·화살-only 전략 계약이 모두 통과한다.

- [ ] **Step 4: 난도 데이터와 문서를 커밋한다**

```bash
git add src/game/stages/stageCatalog.ts tests/game/stages.test.ts \
  docs/backlog.md docs/superpowers/plans/2026-07-24-nightmare-n3-n6-rebalance.md \
  docs/superpowers/plans/2026-07-24-nightmare-counter-shield.md
git diff --cached --check
git commit -m "balance: tune N3-N6 mixed-tower economy"
```

---

### Task 5: 전체 검증과 GitHub Pages 배포

**Files:**
- Verify: `dist/index.html`
- Verify: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: Tasks 1~4의 구현 커밋
- Produces: `main` 배포와 공개 HTTP 200 증거

- [ ] **Step 1: 전체 비-E2E 검증을 실행한다**

Run:

```bash
npm run check
git diff --check
```

Expected: 전체 Vitest, 타입 검사와 Vite 프로덕션 빌드가 통과한다.

- [ ] **Step 2: Pages base 경로를 확인한다**

Run:

```bash
rg -o '/huchu-duckbae-tower-defense/[^\" ]+\\.(js|css)' dist/index.html
```

Expected: JS·CSS 경로가 모두 `/huchu-duckbae-tower-defense/`로 시작한다.

- [ ] **Step 3: 기능 브랜치를 main에 반영하고 푸시한다**

기능 브랜치의 모든 커밋을 로컬 `main`에 fast-forward로 반영한 뒤
`origin/main`에 푸시한다. GitHub 인증은 키체인 또는 프로세스 범위의
`GH_TOKEN="$LOOMINGSIGHT_GITHUB_TOKEN"`만 사용한다.

- [ ] **Step 4: Actions와 공개 리소스를 확인한다**

Pages 워크플로가 `success`가 될 때까지 확인한 뒤 공개 게임 URL과 빌드된
주요 JS·CSS URL이 HTTP 200인지 확인한다. 완료 전에는 배포 성공으로
보고하지 않는다.
