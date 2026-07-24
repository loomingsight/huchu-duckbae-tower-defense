# Nightmare Early-Wave Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 나이트메어 스테이지의 첫 세 웨이브에서 그림자 슬라임 수와 분열체 체력을 낮추되 초반 골드와 전투 점수는 현재 수준으로 보전한다.

**Architecture:** 웨이브 데이터의 선택적 `killValueMultiplier`가 부모 적의 골드와 전투 점수를 함께 조정하게 하고, 나이트메어 첫 세 그림자 슬라임 그룹에만 2배를 선언한다. 그림자 슬라임 분열 로직은 자식 수와 특성은 유지하면서 HP 비율만 17%로 낮춘다.

**Tech Stack:** TypeScript, Vitest, Vite, GitHub Actions, GitHub Pages

## Global Constraints

- N1~N6의 1~3웨이브에만 그림자 슬라임 수량 완화를 적용한다.
- 공통 베이스 그림자 슬라임 수량은 `10/8/6`에서 `6/5/4`로 변경한다.
- 그림자 슬라임은 본체 1마리에서 자식 2마리로 한 번만 분열한다.
- 자식 HP는 부모 최대 HP의 17%다.
- 본체 HP·속도·누수 피해와 자식 수·속도·보상·점수·누수 피해는 변경하지 않는다.
- 초반 부모의 골드와 전투 점수에만 `killValueMultiplier: 2`를 적용한다.
- 4~10웨이브의 수량·보상·점수·스폰 간격은 변경하지 않는다.
- 다른 적, 시작 골드, 타워 가격, 별점 기준과 스테이지 난도 배율은 변경하지 않는다.
- Vite base `/huchu-duckbae-tower-defense/`를 유지한다.
- 전체 E2E와 시각 에셋 변경은 제외한다.
- 단일 에이전트로 실행한다.

---

## File Structure

- `src/game/waves/stage1Waves.ts`
  - 모든 웨이브가 공유하는 `WaveGroup.killValueMultiplier` 계약과 유효성 검사를 소유한다.
- `src/game/waves/nightmareWaves.ts`
  - 나이트메어 웨이브 수량과 초반 그림자 슬라임의 kill value 배율을 선언한다.
- `src/game/simulation/updateWaves.ts`
  - 웨이브 그룹 배율을 생성되는 부모 적의 골드와 전투 점수에 한 번 적용한다.
- `src/game/simulation/updateEnemies.ts`
  - 그림자 슬라임 자식 두 마리의 HP 비율과 재분열 방지를 담당한다.
- `tests/game/waves.test.ts`
  - 그룹 유효성, N1~N6 수량, 초반 배율, 후반 불변과 총 골드·점수 계약을 검증한다.
- `tests/game/nightmareTraits.test.ts`
  - 실제 생성 값, 분열 횟수, 자식 HP, 화살 타격 수와 가족 보상·점수를 검증한다.
- `docs/backlog.md`
  - 이번 후속 밸런스 조정을 완료 항목으로 기록한다.

---

### Task 1: 초반 웨이브 수량과 kill value 보전

**Files:**
- Modify: `src/game/waves/stage1Waves.ts:7-34`
- Modify: `src/game/waves/nightmareWaves.ts:12-69`
- Modify: `src/game/simulation/updateWaves.ts:14-42,124-127`
- Test: `tests/game/waves.test.ts:41-86`
- Test: `tests/game/nightmareTraits.test.ts:16-23`

**Interfaces:**
- Produces: `WaveGroup.killValueMultiplier?: number`
- Produces: `spawnEnemy(state, type, waveIndex, variant?, killValueMultiplier?): void`
- Consumes: `createNightmareWaves(stageNumber, countMultiplier)`와 기존 `GameEnemy.reward`, `GameEnemy.combatScore`

- [ ] **Step 1: 웨이브 수량·배율·유효성·런타임 실패 테스트 작성**

`tests/game/waves.test.ts`의 malformed group 테스트에 다음 검증을 추가한다.

```ts
    expect(isValidWaveGroup({
      type: 'shadowSlime',
      count: 1,
      spawnInterval: 0.6,
      killValueMultiplier: 2,
    })).toBe(true);
    for (const killValueMultiplier of [
      0,
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(isValidWaveGroup({
        type: 'shadowSlime',
        count: 1,
        spawnInterval: 0.6,
        killValueMultiplier,
      })).toBe(false);
    }
```

같은 파일의 나이트메어 테스트 아래에 N1~N6 전체 수량과 kill value 계약을
추가한다.

```ts
  it('eases only the first three shadow slime groups and preserves their kill value', () => {
    const expectedCounts = [
      [6, 5, 4, 8, 0, 6, 10, 6, 8, 6],
      [5, 5, 4, 7, 0, 5, 9, 5, 7, 5],
      [5, 4, 3, 7, 0, 5, 9, 5, 7, 5],
      [8, 7, 5, 11, 1, 8, 14, 8, 11, 8],
      [5, 4, 3, 7, 0, 5, 9, 5, 7, 5],
      [7, 6, 5, 9, 0, 7, 12, 7, 9, 7],
    ] as const;
    const previousGold = [168, 147, 147, 231, 147, 196] as const;
    const expectedGold = [165, 154, 132, 220, 132, 198] as const;
    const previousCombatScore = [600, 525, 525, 825, 525, 700] as const;
    const expectedCombatScore = [600, 560, 480, 800, 480, 720] as const;

    for (const [index, stageNumber] of ([1, 2, 3, 4, 5, 6] as const).entries()) {
      const stage = getStageDefinition(`nightmare-${stageNumber}`);
      const waves = createNightmareWaves(stageNumber, stage.countMultiplier);
      const shadowGroups = waves.map(({ groups }) => (
        groups.find(({ type }) => type === 'shadowSlime')
      ));

      expect(shadowGroups.map((group) => group?.count ?? 0))
        .toEqual(expectedCounts[index]);
      expect(shadowGroups.slice(0, 3).map((group) => group?.killValueMultiplier))
        .toEqual([2, 2, 2]);
      expect(shadowGroups.slice(3).every(
        (group) => group?.killValueMultiplier === undefined,
      )).toBe(true);

      const earlyParentCount = shadowGroups.slice(0, 3)
        .reduce((sum, group) => sum + (group?.count ?? 0), 0);
      expect(earlyParentCount * 11).toBe(expectedGold[index]);
      expect(earlyParentCount * 40).toBe(expectedCombatScore[index]);
      expect(Math.round(
        ((expectedGold[index] / previousGold[index]) - 1) * 100,
      )).toBeGreaterThanOrEqual(-10);
      expect(Math.round(
        ((expectedGold[index] / previousGold[index]) - 1) * 100,
      )).toBeLessThanOrEqual(5);
      expect(Math.abs(Math.round(
        ((expectedCombatScore[index] / previousCombatScore[index]) - 1) * 100,
      ))).toBeLessThanOrEqual(10);
    }
  });
```

기존 catalog count 테스트의 기대값을 새 N2 일반 적 합계로 바꾼다.

```ts
    expect(ordinaryCount).toBe(208);
```

`tests/game/nightmareTraits.test.ts`의 첫 안내 테스트 다음에 런타임 전달 테스트를
추가한다.

```ts
  it('applies the early wave kill value multiplier to the parent once', () => {
    const state = createGame('nightmare-1');

    updateWaves(state, 0.01);

    expect(state.enemies[0]).toMatchObject({
      type: 'shadowSlime',
      reward: 7,
      combatScore: 30,
    });

    const direct = createGame('nightmare-1');
    spawnEnemy(direct, 'shadowSlime', 0, 'standard', Number.NaN);
    expect(direct.enemies[0]).toMatchObject({
      reward: 3,
      combatScore: 15,
    });
  });
```

파일 상단 import를 다음처럼 바꾼다.

```ts
import { spawnEnemy, updateWaves } from '../../src/game/simulation/updateWaves';
```

- [ ] **Step 2: 웨이브 집중 테스트가 RED인지 확인**

Run:

```bash
npx vitest run tests/game/waves.test.ts tests/game/nightmareTraits.test.ts
```

Expected: 첫 세 그림자 슬라임 수량이 기존 값이고
`killValueMultiplier`와 다섯 번째 `spawnEnemy` 인자가 없으므로 새 계약 테스트가
FAIL.

- [ ] **Step 3: WaveGroup 배율 계약과 유효성 구현**

`src/game/waves/stage1Waves.ts`의 `WaveGroup`과 검사기를 다음처럼 확장한다.

```ts
export type WaveGroup = {
  type: EnemyType;
  count: number;
  spawnInterval: number;
  variant?: EnemyVariant;
  killValueMultiplier?: number;
};

export function isValidWaveGroup(group: unknown): group is WaveGroup {
  if (typeof group !== 'object' || group === null) return false;
  const candidate = group as Partial<WaveGroup>;
  const {
    type,
    count,
    spawnInterval,
    variant,
    killValueMultiplier,
  } = candidate;
  return typeof type === 'string'
    && (ENEMY_TYPES as readonly string[]).includes(type)
    && typeof count === 'number'
    && Number.isInteger(count)
    && count > 0
    && typeof spawnInterval === 'number'
    && Number.isFinite(spawnInterval)
    && spawnInterval >= 0
    && (variant === undefined
      || variant === 'standard'
      || variant === 'elite'
      || variant === 'split-child')
    && (killValueMultiplier === undefined
      || (
        typeof killValueMultiplier === 'number'
        && Number.isFinite(killValueMultiplier)
        && killValueMultiplier > 0
      ));
}
```

- [ ] **Step 4: 나이트메어 초반 수량과 그룹 배율 구현**

`src/game/waves/nightmareWaves.ts`의 첫 세 베이스 수량을 바꾼다.

```ts
const BASE_COUNTS = [
  [6, 0, 0, 0],
  [5, 6, 0, 0],
  [4, 8, 3, 0],
  [8, 4, 6, 0],
  [0, 8, 6, 0],
  [6, 6, 8, 2],
  [10, 8, 6, 3],
  [6, 8, 9, 4],
  [8, 6, 10, 5],
  [6, 8, 10, 5],
] as const;
```

각 그룹 생성 반환값에는 초반 그림자 슬라임에만 배율을 추가한다.

```ts
      return [{
        type: TYPES[typeIndex],
        count: Math.round(
          baseCount * safeCountMultiplier * TYPE_WEIGHTS[stageIndex][typeIndex],
        ),
        spawnInterval: INTERVALS[Math.floor(waveIndex / 2)][typeIndex],
        ...(waveIndex < 3 && typeIndex === 0
          ? { killValueMultiplier: 2 }
          : {}),
      }];
```

- [ ] **Step 5: 부모 적 생성 시 kill value를 한 번 적용**

`src/game/simulation/updateWaves.ts`의 `spawnEnemy` 인자와 계산을 다음처럼
바꾼다.

```ts
export function spawnEnemy(
  state: GameState,
  type: EnemyType,
  waveIndex: number,
  variant: EnemyVariant = 'standard',
  killValueMultiplier = 1,
): void {
  const definition = ENEMY_CATALOG[type];
  const stage = getStageDefinition(state.stageKey);
  const elite = variant === 'elite';
  const safeKillValueMultiplier = Number.isFinite(killValueMultiplier)
    && killValueMultiplier > 0
    ? killValueMultiplier
    : 1;
```

enemy 객체의 `reward`와 `combatScore`는 다음 식을 사용한다.

```ts
    reward: Math.round(
      definition.reward
      * stage.rewardMultiplier
      * (elite ? 1.5 : 1)
      * safeKillValueMultiplier,
    ),
    combatScore:
      definition.combatScore * safeKillValueMultiplier
      + (elite ? 100 : 0),
```

`updateWaves`의 생성 호출은 그룹 배율을 전달한다.

```ts
    spawnEnemy(
      state,
      group.type,
      state.wave.index,
      group.variant,
      group.killValueMultiplier,
    );
```

- [ ] **Step 6: Task 1 집중 테스트가 GREEN인지 확인**

Run:

```bash
npx vitest run tests/game/waves.test.ts tests/game/nightmareTraits.test.ts
```

Expected: 두 테스트 파일의 모든 테스트 PASS.

- [ ] **Step 7: Task 1 커밋**

```bash
git add src/game/waves/stage1Waves.ts \
  src/game/waves/nightmareWaves.ts \
  src/game/simulation/updateWaves.ts \
  tests/game/waves.test.ts \
  tests/game/nightmareTraits.test.ts
git commit -m "balance: reduce early shadow slime waves"
```

---

### Task 2: 분열체 HP와 초반 가족 가치 계약

**Files:**
- Modify: `src/game/simulation/updateEnemies.ts:5`
- Modify: `tests/game/nightmareTraits.test.ts:45-86`
- Modify: `docs/backlog.md:50-58`

**Interfaces:**
- Consumes: Task 1의 `spawnEnemy(..., killValueMultiplier?)`
- Produces: `SHADOW_SLIME_CHILD_HP_RATIO = 0.17`
- Preserves: 자식 `reward: 2`, `combatScore: 5`, `splitGeneration: 1`

- [ ] **Step 1: 자식 HP와 단계별 화살 타격 수 실패 테스트 작성**

기존 가족 분열 테스트의 자식 HP 기대값을 다음으로 바꾼다.

```ts
    expect(state.enemies.every(({ maxHp }) => maxHp === 72 * 0.17)).toBe(true);
```

기존 N1 여섯 발 테스트의 자식 HP 검증은 한 발 이하로 바꾼다.

```ts
    expect(state.enemies.every(({ maxHp }) => maxHp <= arrowDamage)).toBe(true);
```

그 테스트 다음에 N1~N6 초반 화살 타격 수 곡선을 추가한다.

```ts
  it('keeps the approved early child arrow-hit curve across nightmare stages', () => {
    const arrowDamage = TOWER_CATALOG.arrow.damage ?? 0;
    const expectedHits = [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 2],
      [1, 2, 2],
    ] as const;

    for (const [stageIndex, stageNumber] of (
      [1, 2, 3, 4, 5, 6] as const
    ).entries()) {
      for (const waveIndex of [0, 1, 2] as const) {
        const state = createGame(`nightmare-${stageNumber}`);
        spawnEnemy(state, 'shadowSlime', waveIndex);
        state.enemies[0].hp = 0;

        updateEnemies(state, 0);

        expect(state.enemies).toHaveLength(2);
        expect(Math.ceil(state.enemies[0].maxHp / arrowDamage))
          .toBe(expectedHits[stageIndex][waveIndex]);
      }
    }
  });
```

가족 전체 보상·점수의 초반/후반 불변 테스트도 추가한다.

```ts
  it('preserves early family gold and score without boosting late families', () => {
    const early = createGame('nightmare-1');
    spawnEnemy(early, 'shadowSlime', 0, 'standard', 2);
    early.enemies[0].hp = 0;
    updateEnemies(early, 0);
    for (const child of early.enemies) child.hp = 0;
    updateEnemies(early, 0);

    expect(early.gold).toBe(291);
    expect(early.stats.combatScore).toBe(40);

    const late = createGame('nightmare-1');
    spawnEnemy(late, 'shadowSlime', 3);
    late.enemies[0].hp = 0;
    updateEnemies(late, 0);
    for (const child of late.enemies) child.hp = 0;
    updateEnemies(late, 0);

    expect(late.gold).toBe(287);
    expect(late.stats.combatScore).toBe(25);
  });
```

- [ ] **Step 2: 분열 집중 테스트가 RED인지 확인**

Run:

```bash
npx vitest run tests/game/nightmareTraits.test.ts
```

Expected: 현재 자식 HP 비율이 25%이므로 17% 기대와 단계별 타격 수 테스트가
FAIL.

- [ ] **Step 3: 자식 HP 비율 최소 변경**

`src/game/simulation/updateEnemies.ts`의 상수를 다음 값으로 바꾼다.

```ts
const SHADOW_SLIME_CHILD_HP_RATIO = 0.17;
```

`splitChildren`의 자식 수, 속도, 보상, 점수, 누수 피해, 세대와 나머지
override는 변경하지 않는다.

- [ ] **Step 4: 백로그 완료 기록**

`docs/backlog.md`의 게임 밸런스 항목에 설계 문서 링크와 완료 항목을 추가한다.

```markdown
> 후속 설계서: [나이트메어 초반 그림자 슬라임 재조정 설계](./superpowers/specs/2026-07-24-nightmare-early-wave-rebalance-design.md)

- [x] N1~N6 첫 3웨이브의 그림자 슬라임 수와 분열체 체력을 낮추고 초반 골드·전투 점수 보전
```

- [ ] **Step 5: Task 2 집중 테스트가 GREEN인지 확인**

Run:

```bash
npx vitest run tests/game/nightmareTraits.test.ts tests/game/waves.test.ts
```

Expected: 두 테스트 파일의 모든 테스트 PASS.

- [ ] **Step 6: Task 2 커밋**

```bash
git add src/game/simulation/updateEnemies.ts \
  tests/game/nightmareTraits.test.ts \
  docs/backlog.md
git commit -m "balance: lower shadow slime child health"
```

---

### Task 3: 전체 검증과 GitHub Pages 배포

**Files:**
- Verify: `dist/index.html`
- Verify: `.github/workflows/deploy-pages.yml`
- Verify: `https://loomingsight.github.io/huchu-duckbae-tower-defense/`

**Interfaces:**
- Consumes: Tasks 1~2의 커밋된 구현
- Produces: `origin/main` 푸시와 성공한 Pages 배포

- [ ] **Step 1: 전체 단위 테스트·타입 검사·프로덕션 빌드**

Run:

```bash
npm run check
```

Expected: 전체 Vitest PASS, `tsc -b` PASS, Vite production build PASS.

- [ ] **Step 2: Pages base와 변경 범위 확인**

Run:

```bash
rg -o '/huchu-duckbae-tower-defense/[^" ]+\.(js|css)' dist/index.html
git diff --check
git status --short --branch
```

Expected:

- JS와 CSS 경로가 모두 `/huchu-duckbae-tower-defense/`로 시작한다.
- `git diff --check` 출력이 없다.
- `main`이 `origin/main`보다 구현 커밋만큼 앞서 있고 미커밋 파일이 없다.

- [ ] **Step 3: main 푸시**

Run:

```bash
git push origin main
```

Expected: `main -> main` 푸시 성공.

- [ ] **Step 4: 배포 워크플로가 현재 HEAD로 성공하는지 확인**

Run:

```bash
HCD_LOCAL_SHA="$(git rev-parse HEAD)"
HCD_RUN_ID="$(env -u GITHUB_TOKEN gh run list \
  --workflow deploy-pages.yml \
  --branch main \
  --limit 10 \
  --json databaseId,headSha \
  --jq ".[] | select(.headSha == \"${HCD_LOCAL_SHA}\") | .databaseId" \
  | head -n 1)"
env -u GITHUB_TOKEN gh run watch "${HCD_RUN_ID}" --exit-status
env -u GITHUB_TOKEN gh run view "${HCD_RUN_ID}" \
  --json headSha,status,conclusion,url \
  --jq '{headSha,status,conclusion,url}'
```

Expected: 현재 HEAD SHA의 `Deploy to GitHub Pages` 실행이
`status: completed`, `conclusion: success`.

- [ ] **Step 5: 공개 HTML과 주요 JS/CSS HTTP 200 확인**

Run:

```bash
HCD_PUBLIC_HTML="/tmp/huchu-pages-index.html"
curl -fsS \
  "https://loomingsight.github.io/huchu-duckbae-tower-defense/" \
  -o "${HCD_PUBLIC_HTML}"
HCD_JS_PATH="$(rg -o \
  '/huchu-duckbae-tower-defense/[^" ]+\.js' \
  "${HCD_PUBLIC_HTML}" \
  | head -n 1)"
HCD_CSS_PATH="$(rg -o \
  '/huchu-duckbae-tower-defense/[^" ]+\.css' \
  "${HCD_PUBLIC_HTML}" \
  | head -n 1)"
curl -fsS -o /dev/null -w '%{http_code}\n' \
  "https://loomingsight.github.io${HCD_JS_PATH}"
curl -fsS -o /dev/null -w '%{http_code}\n' \
  "https://loomingsight.github.io${HCD_CSS_PATH}"
```

Expected: HTML 다운로드 성공, 주요 JS와 CSS가 각각 `200`.

- [ ] **Step 6: 최종 동기화 상태 확인**

Run:

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
```

Expected: `## main...origin/main`, 로컬 HEAD와 `origin/main` SHA가 같다.
