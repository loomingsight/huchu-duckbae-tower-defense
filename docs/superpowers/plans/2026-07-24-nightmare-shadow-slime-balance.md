# 나이트메어 그림자 슬라임 초반 밸런스 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 나이트메어 초반 그림자 슬라임의 분열 특성은 유지하면서 화살 타워가 한 무리를 처치하는 데 필요한 공격 횟수를 9회에서 6회로 줄인다.

**Architecture:** 그림자 슬라임 본체 기본 HP를 `90`에서 `72`로 낮추고 분열체 HP 비율을 부모 최대 HP의 `35%`에서 `25%`로 낮춘다. 스테이지·웨이브 HP 배율, 이동 속도, 등장 수, 보상과 분열 횟수는 유지해 후반 난도 상승 구조를 보존한다.

**Tech Stack:** TypeScript, Vitest, 기존 적군 시뮬레이션

## Global Constraints

- N1 웨이브 1 표준 그림자 슬라임 본체는 공격력 `18`인 화살 공격 4회에 처치돼야 한다.
- 본체가 만든 분열체 2마리는 각각 같은 화살 공격 1회에 처치돼야 한다.
- 한 그림자 슬라임 무리를 제거하는 총 화살 공격 수는 `6회`여야 한다.
- 그림자 슬라임의 속도, 보상, 누수 피해, 등장 수, 등장 간격과 분열 횟수는 변경하지 않는다.
- 나이트메어 후반 스테이지·웨이브 HP 배율은 변경하지 않는다.
- 전체 E2E 스위트는 실행하지 않고 단위 테스트와 프로덕션 빌드로 검증한다.

---

### Task 1: 그림자 슬라임 본체와 분열체 HP 조정

**Files:**
- Modify: `src/game/enemies/enemyCatalog.ts`
- Modify: `src/game/simulation/updateEnemies.ts`
- Modify: `tests/game/nightmareTraits.test.ts`
- Modify: `docs/backlog.md`

**Interfaces:**
- Consumes: `ENEMY_CATALOG.shadowSlime`, `TOWER_CATALOG.arrow.damage`
- Produces: N1 본체 HP `72`, 분열체 HP `18`

- [ ] **Step 1: 화살 공격 횟수 실패 테스트 작성**

`tests/game/nightmareTraits.test.ts`에 `TOWER_CATALOG` import를 추가하고 기존
분열 테스트를 새 수치로 바꾼다.

```ts
it('lets the starter arrow tower clear one N1 slime family in six hits', () => {
  const state = createGame('nightmare-1');
  const arrowDamage = TOWER_CATALOG.arrow.damage ?? 0;
  spawnEnemy(state, 'shadowSlime', 0);
  const parent = state.enemies[0];

  expect(parent.maxHp).toBe(72);
  for (let hit = 0; hit < 4; hit += 1) {
    applyEnemyDamage(state, parent, arrowDamage);
  }
  updateEnemies(state, 0);

  expect(state.enemies).toHaveLength(2);
  expect(state.enemies.every(({ maxHp }) => maxHp === 18)).toBe(true);
  for (const child of state.enemies) {
    applyEnemyDamage(state, child, arrowDamage);
  }
  updateEnemies(state, 0);

  expect(state.enemies).toEqual([]);
});
```

기존 `splits a killed parent...` 테스트의 분열체 HP 기대는 다음으로 변경한다.

```ts
expect(state.enemies.every(({ maxHp }) => maxHp === 72 * 0.25)).toBe(true);
```

- [ ] **Step 2: 밸런스 집중 테스트가 실패하는지 확인**

Run:

```bash
npx vitest run tests/game/nightmareTraits.test.ts
```

Expected: 현재 본체 HP `90`, 분열체 HP `31.5`이므로 FAIL.

- [ ] **Step 3: 최소 수치 변경 구현**

`src/game/enemies/enemyCatalog.ts`:

```ts
shadowSlime: {
  hp: 72, speed: 1.1, reward: 4, leak: 1,
  combatScore: 15, boss: false, trait: 'split',
},
```

`src/game/simulation/updateEnemies.ts`:

```ts
const SHADOW_SLIME_CHILD_HP_RATIO = 0.25;

// splitChildren()
maxHp: parent.maxHp * SHADOW_SLIME_CHILD_HP_RATIO,
hp: parent.maxHp * SHADOW_SLIME_CHILD_HP_RATIO,
```

속도, 보상, 점수, 누수 피해와 나머지 분열 로직은 수정하지 않는다.

- [ ] **Step 4: 밸런스 집중 테스트 통과 확인**

Run:

```bash
npx vitest run tests/game/nightmareTraits.test.ts tests/game/waves.test.ts tests/game/stages.test.ts
```

Expected: PASS.

- [ ] **Step 5: 백로그 완료 처리**

`docs/backlog.md`의 다음 항목을 완료로 변경한다.

```markdown
- [x] 나이트메어 초반 슬라임이 화살 타워로 처치하기 지나치게 어렵지 않도록 난이도 조정
```

- [ ] **Step 6: 밸런스 변경 커밋**

```bash
git add src/game/enemies/enemyCatalog.ts src/game/simulation/updateEnemies.ts tests/game/nightmareTraits.test.ts docs/backlog.md
git commit -m "balance: ease early shadow slime pressure"
```

---

### Task 2: 밸런스 전체 회귀 검증

**Files:**
- Verify: `src/game/enemies/enemyCatalog.ts`
- Verify: `src/game/simulation/updateEnemies.ts`
- Verify: `tests/game/nightmareTraits.test.ts`

**Interfaces:**
- Consumes: Task 1의 HP 계약
- Produces: 배포 가능한 밸런스 검증 결과

- [ ] **Step 1: 전체 단위 테스트와 프로덕션 빌드**

Run:

```bash
npm run check
```

Expected: 모든 Vitest 파일 PASS, `tsc -b` PASS, Vite production build PASS.

- [ ] **Step 2: 변경 범위 확인**

Run:

```bash
git diff --check
git status --short
```

Expected: 공백 오류 없음. 에셋, 웨이브 수, 이동 속도와 보상 파일에는 변경이 없다.

