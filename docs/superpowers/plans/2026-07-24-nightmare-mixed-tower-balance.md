# Nightmare Mixed-Tower Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 나이트메어 초반 그림자 슬라임 물량과 중반 흑요석 골렘 이동 압력을 높이되 골드·점수를 보전해 화살-only는 1별 선택지, 슬로우 혼합은 안정적인 2~3별 선택지가 되게 한다.

**Architecture:** 기존 `BASE_COUNTS`, `killValueMultiplier`와 적 카탈로그만 조정하고 새 런타임 분기는 추가하지 않는다. 웨이브 테스트가 N1~N6 수량·경제·점수를 고정하고, 적 특성 테스트가 골렘의 스테이지별 이동 및 슬로우 대응을 고정한다.

**Tech Stack:** TypeScript, Vitest, Vite, GitHub Actions, GitHub Pages

## Global Constraints

- N1~N6의 1~3웨이브 그림자 슬라임 베이스 수량을 `6/5/4`에서 `7/6/5`로 변경한다.
- 첫 세 그림자 슬라임 그룹의 `killValueMultiplier`를 `2.0`에서 `1.6`으로 변경한다.
- 초반 슬라임 가족 보상은 9G, 전투 점수는 34다.
- 4~10웨이브의 수량·kill value·스폰 간격은 변경하지 않는다.
- 그림자 슬라임은 본체 1마리에서 자식 2마리로 한 번만 분열하고 자식 HP 17%를 유지한다.
- 흑요석 골렘 기본 속도를 `0.44`에서 `0.52`로 변경한다.
- 골렘 HP 620, 보상 28G, 누수 피해 3은 유지한다.
- 다른 적, 타워, 시작 골드, 창고 HP, 스테이지 배율과 별점 기준은 변경하지 않는다.
- Vite base `/huchu-duckbae-tower-defense/`를 유지한다.
- 전체 E2E와 시각 에셋 변경은 제외한다.
- 단일 에이전트로 실행한다.

---

## File Structure

- `src/game/waves/nightmareWaves.ts`
  - 나이트메어 적 조합과 첫 세 그림자 슬라임 그룹의 kill value를 선언한다.
- `src/game/enemies/enemyCatalog.ts`
  - 흑요석 골렘을 포함한 적 기본 전투 수치의 단일 원본이다.
- `tests/game/waves.test.ts`
  - N1~N6 수량, 초반·후반 kill value, 총 골드와 전투 점수를 검증한다.
- `tests/game/nightmareTraits.test.ts`
  - 실제 부모·자식 가족 가치, 골렘 이동 압력과 슬로우 대응을 검증한다.
- `tests/game/enemies.test.ts`
  - 모든 적의 기본 HP·속도와 보상 계약을 검증한다.
- `docs/backlog.md`
  - 이번 조정 완료와 배포 후 실제 플레이 후속 검증을 기록한다.

---

### Task 1: 그림자 슬라임 수량과 경제·점수 재조정

**Files:**
- Modify: `src/game/waves/nightmareWaves.ts:12-69`
- Test: `tests/game/waves.test.ts:78-155`
- Test: `tests/game/nightmareTraits.test.ts:25-42,134-158`

**Interfaces:**
- Consumes: `createNightmareWaves(stageNumber, countMultiplier)`
- Consumes: `spawnEnemy(state, type, waveIndex, variant?, killValueMultiplier?)`
- Produces: 첫 세 그림자 슬라임 그룹 `killValueMultiplier: 1.6`
- Preserves: 후반 가족 7G·25점과 자식 HP 17%

- [ ] **Step 1: 새 수량·경제·점수 실패 테스트 작성**

`tests/game/waves.test.ts`의 N2 일반 적 합계 기대를 변경한다.

```ts
    expect(ordinaryCount).toBe(210);
```

같은 파일의 `eases only the first three shadow slime groups...` 테스트를 다음
계약으로 변경한다.

```ts
  it('adds measured early slime pressure without accelerating tower income', () => {
    const expectedCounts = [
      [7, 6, 5, 8, 0, 6, 10, 6, 8, 6],
      [6, 5, 5, 7, 0, 5, 9, 5, 7, 5],
      [6, 5, 4, 7, 0, 5, 9, 5, 7, 5],
      [10, 8, 7, 11, 1, 8, 14, 8, 11, 8],
      [6, 5, 4, 7, 0, 5, 9, 5, 7, 5],
      [8, 7, 6, 9, 0, 7, 12, 7, 9, 7],
    ] as const;
    const previousGold = [165, 154, 132, 220, 132, 198] as const;
    const expectedGold = [162, 144, 135, 225, 135, 189] as const;
    const previousCombatScore = [600, 560, 480, 800, 480, 720] as const;
    const expectedCombatScore = [612, 544, 510, 850, 510, 714] as const;

    for (const [index, stageNumber] of ([1, 2, 3, 4, 5, 6] as const).entries()) {
      const stage = getStageDefinition(`nightmare-${stageNumber}`);
      const waves = createNightmareWaves(stageNumber, stage.countMultiplier);
      const shadowGroups = waves.map(({ groups }) => (
        groups.find(({ type }) => type === 'shadowSlime')
      ));

      expect(shadowGroups.map((group) => group?.count ?? 0))
        .toEqual(expectedCounts[index]);
      expect(shadowGroups.slice(0, 3).map((group) => group?.killValueMultiplier))
        .toEqual([1.6, 1.6, 1.6]);
      expect(shadowGroups.slice(3).every(
        (group) => group?.killValueMultiplier === undefined,
      )).toBe(true);

      const earlyParentCount = shadowGroups.slice(0, 3)
        .reduce((sum, group) => sum + (group?.count ?? 0), 0);
      expect(earlyParentCount * 9).toBe(expectedGold[index]);
      expect(earlyParentCount * 34).toBe(expectedCombatScore[index]);
      expect(Math.round(
        ((expectedGold[index] / previousGold[index]) - 1) * 100,
      )).toBeGreaterThanOrEqual(-6);
      expect(Math.round(
        ((expectedGold[index] / previousGold[index]) - 1) * 100,
      )).toBeLessThanOrEqual(2);
      expect(Math.round(
        ((expectedCombatScore[index] / previousCombatScore[index]) - 1) * 100,
      )).toBeGreaterThanOrEqual(-3);
      expect(Math.round(
        ((expectedCombatScore[index] / previousCombatScore[index]) - 1) * 100,
      )).toBeLessThanOrEqual(6);
    }
  });
```

`tests/game/nightmareTraits.test.ts`의 부모 배율 테스트 기대값을 변경한다.

```ts
    expect(state.enemies[0]).toMatchObject({
      type: 'shadowSlime',
      reward: 5,
      combatScore: 24,
    });
```

같은 파일의 가족 가치 테스트에서 초반 기대값만 변경한다.

```ts
    spawnEnemy(early, 'shadowSlime', 0, 'standard', 1.6);
```

```ts
    expect(early.gold).toBe(289);
    expect(early.stats.combatScore).toBe(34);
```

후반 기대값 `287G`, `25점`은 유지한다.

- [ ] **Step 2: Task 1 RED 확인**

Run:

```bash
npx vitest run tests/game/waves.test.ts tests/game/nightmareTraits.test.ts
```

Expected: 기존 베이스 `6/5/4`, 배율 2.0과 부모 값 7G·30점 때문에 수량,
kill value와 가족 가치 테스트가 FAIL.

- [ ] **Step 3: 초반 베이스 수량과 kill value 최소 변경**

`src/game/waves/nightmareWaves.ts`의 첫 세 배열을 다음처럼 바꾼다.

```ts
const BASE_COUNTS = [
  [7, 0, 0, 0],
  [6, 6, 0, 0],
  [5, 8, 3, 0],
  [8, 4, 6, 0],
  [0, 8, 6, 0],
  [6, 6, 8, 2],
  [10, 8, 6, 3],
  [6, 8, 9, 4],
  [8, 6, 10, 5],
  [6, 8, 10, 5],
] as const;
```

그룹 생성 시 초반 그림자 슬라임 배율만 바꾼다.

```ts
        ...(waveIndex < 3 && typeIndex === 0
          ? { killValueMultiplier: 1.6 }
          : {}),
```

- [ ] **Step 4: Task 1 GREEN 확인**

Run:

```bash
npx vitest run tests/game/waves.test.ts tests/game/nightmareTraits.test.ts
```

Expected: 두 테스트 파일의 모든 테스트 PASS.

- [ ] **Step 5: Task 1 커밋**

```bash
git add src/game/waves/nightmareWaves.ts \
  tests/game/waves.test.ts \
  tests/game/nightmareTraits.test.ts
git commit -m "balance: raise early nightmare slime pressure"
```

---

### Task 2: 흑요석 골렘 속도와 슬로우 대응 강화

**Files:**
- Modify: `src/game/enemies/enemyCatalog.ts:59-61`
- Test: `tests/game/enemies.test.ts:7-24`
- Test: `tests/game/nightmareTraits.test.ts:160-178`
- Modify: `docs/backlog.md:50-60`

**Interfaces:**
- Consumes: `ENEMY_CATALOG.obsidianGolem.speed`
- Consumes: `updateEnemies(state, dt)`의 `baseSpeed × stage.speedMultiplier × slowMultiplier`
- Produces: 흑요석 골렘 기본 속도 0.52
- Preserves: 골렘 HP 620·보상 28G·누수 피해 3

- [ ] **Step 1: 골렘 기본·스테이지·슬로우 속도 실패 테스트 작성**

`tests/game/enemies.test.ts`의 기본 수치 기대값을 변경한다.

```ts
      obsidianGolem: { hp: 620, speed: 0.52 },
```

`tests/game/nightmareTraits.test.ts`의 박쥐 슬로우 테스트 다음에 다음 테스트를
추가한다.

```ts
  it('makes obsidian golems fast enough to reward slow coverage', () => {
    const expectedTravelSeconds = [57.7, 51.9, 47.1, 48.5, 44.0, 41.3] as const;

    for (const [index, stageNumber] of ([1, 2, 3, 4, 5, 6] as const).entries()) {
      const state = createGame(`nightmare-${stageNumber}`);
      const stage = getStageDefinition(state.stageKey);
      spawnEnemy(state, 'obsidianGolem', 5);

      updateEnemies(state, 1);

      const effectiveSpeed = 0.52 * stage.speedMultiplier;
      expect(state.enemies[0].progress).toBeCloseTo(effectiveSpeed);
      expect((stage.map.pathCells.length - 1) / effectiveSpeed)
        .toBeCloseTo(expectedTravelSeconds[index], 1);
    }

    const slowed = createGame('nightmare-1');
    placeTower(slowed, 'slow', { col: 0, row: 6 });
    spawnEnemy(slowed, 'obsidianGolem', 5);

    updateSlow(slowed);
    updateEnemies(slowed, 1);

    expect(slowed.enemies[0].progress).toBeCloseTo(0.52 * 0.62);
    expect(slowed.enemies[0]).toMatchObject({
      maxHp: 620 * (1 + 5 * 0.08),
      reward: 24,
      leak: 3,
    });
  });
```

N1의 나이트메어 보상 배율 0.85 때문에 골렘 실제 보상은
`round(28 × 0.85) = 24G`다.

- [ ] **Step 2: Task 2 RED 확인**

Run:

```bash
npx vitest run tests/game/enemies.test.ts tests/game/nightmareTraits.test.ts
```

Expected: 현재 골렘 기본 속도 0.44 때문에 카탈로그, 이동 거리, 완주 시간과
슬로우 적용 속도 테스트가 FAIL.

- [ ] **Step 3: 골렘 속도 최소 변경**

`src/game/enemies/enemyCatalog.ts`의 흑요석 골렘 정의를 다음처럼 바꾼다.

```ts
  obsidianGolem: {
    hp: 620, speed: 0.52, reward: 28, leak: 3,
    combatScore: 75, boss: false, trait: 'armored',
  },
```

- [ ] **Step 4: 백로그에 완료와 후속 플레이 검증 기록**

`docs/backlog.md`의 게임 밸런스 설계 링크 아래에 새 설계 링크를 추가한다.

```markdown
> 전략 다양화 설계서: [나이트메어 혼합 타워 유도 밸런스 설계](./superpowers/specs/2026-07-24-nightmare-mixed-tower-balance-design.md)
```

게임 밸런스 목록 상단에는 다음 두 항목을 추가한다.

```markdown
- [x] N1~N6 첫 3웨이브 슬라임 물량과 골렘 속도를 높이되 골드·점수를 보전해 슬로우 혼합 전략 유도
- [ ] 배포 후 화살-only 1별 가능 여부와 슬로우 혼합 구성의 2~3별 안정성을 실제 플레이로 확인
```

- [ ] **Step 5: Task 2 GREEN 확인**

Run:

```bash
npx vitest run tests/game/enemies.test.ts tests/game/nightmareTraits.test.ts
```

Expected: 두 테스트 파일의 모든 테스트 PASS.

- [ ] **Step 6: Task 2 커밋**

```bash
git add src/game/enemies/enemyCatalog.ts \
  tests/game/enemies.test.ts \
  tests/game/nightmareTraits.test.ts \
  docs/backlog.md
git commit -m "balance: speed up nightmare golems"
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
- 기능 브랜치에 미커밋 파일이 없다.

- [ ] **Step 3: 검증된 기능 브랜치를 main에 fast-forward하고 재검증**

기능 worktree 검증이 끝난 뒤 기본 저장소
`/Users/jadon/Documents/huchu-defense-v2`에서 실행한다.

Run (workdir: `/Users/jadon/Documents/huchu-defense-v2`):

```bash
git fetch origin main
git merge --ff-only codex/nightmare-mixed-tower-balance
npm run check
```

Expected: 원격 `main`에 새 커밋이 없고 fast-forward 성공, 병합된 `main`에서도
전체 검사 PASS.

- [ ] **Step 4: main 푸시**

주입된 전역 `GITHUB_TOKEN`이 키체인 인증을 방해하지 않도록 해당 변수만
제외한다.

Run (workdir: `/Users/jadon/Documents/huchu-defense-v2`):

```bash
env -u GITHUB_TOKEN git push origin main
```

Expected: `main -> main` 푸시 성공.

- [ ] **Step 5: 현재 HEAD의 Pages 워크플로 성공 확인**

Run (workdir: `/Users/jadon/Documents/huchu-defense-v2`):

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

Expected: 현재 HEAD의 `Deploy to GitHub Pages` 실행이
`status: completed`, `conclusion: success`.

- [ ] **Step 6: 공개 HTML과 주요 JS/CSS HTTP 200 확인**

Run (workdir: `/Users/jadon/Documents/huchu-defense-v2`):

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

- [ ] **Step 7: 최종 동기화 상태 확인**

Run (workdir: `/Users/jadon/Documents/huchu-defense-v2`):

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
```

Expected: `## main...origin/main`, 로컬 HEAD와 `origin/main` SHA가 같다.
