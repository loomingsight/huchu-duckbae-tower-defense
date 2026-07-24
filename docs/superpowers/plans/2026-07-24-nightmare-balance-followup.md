# 나이트메어 후속 밸런스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 나이트메어 특성 안내를 N1에만 제한하고, N2~N6 난이도를 완만하게 조정하며, 스테이지별 밸런스 설정과 첫 클리어 시간 측정을 하나의 계약으로 정리한다.

**Architecture:** `StageDefinition`을 런타임 밸런스의 유일한 원본으로 확장해 웨이브 HP 증가율, 웨이브 대기 시간, 목표 클리어 시간을 포함한다. 나이트메어 웨이브 수량 생성은 스테이지 카탈로그의 `countMultiplier`를 입력으로 받고, 플레이어의 실제 첫 클리어 시간은 preferences v5에 한 번만 저장한다. 특성 안내 상태는 현재 스테이지 키를 받아 N1에서만 활성화한다.

**Tech Stack:** TypeScript, Canvas, Vitest, Vite, localStorage preferences

## Global Constraints

- 단일 에이전트 방식으로 실행한다.
- 기존 Vite base `/huchu-duckbae-tower-defense/`를 유지한다.
- 시작 골드 280, 창고 체력 12, 보상 배율 0.85와 현재 타워 가격은 변경하지 않는다.
- N2~N6 자동 밸런스 보정은 기존 승인 수치 대비 각 축 최대 10% 범위에서 수행한다.
- E2E는 제외하고 집중 단위 테스트, 전체 단위 테스트, 타입 검사, 프로덕션 빌드와 모바일 스모크로 검증한다.
- 사용자 소유 변경사항을 되돌리지 않는다.

---

### Task 1: 나이트메어 특성 안내를 N1에만 제한

**Files:**
- Modify: `src/app/traitNotice.ts`
- Modify: `src/app/GameApp.ts`
- Test: `tests/app/traitNotice.test.ts`
- Test: `tests/scaffold.test.ts`

**Interfaces:**
- Consumes: `StageKey`와 `stageRef(value)`
- Produces: `createTraitNoticeState(stageKey: unknown): TraitNoticeState`

- [ ] **Step 1: N1에서만 안내 상태가 활성화되는 실패 테스트 작성**

```ts
expect(createTraitNoticeState('nightmare-1').enabled).toBe(true);
expect(createTraitNoticeState('nightmare-2').enabled).toBe(false);
expect(createTraitNoticeState('normal-1').enabled).toBe(false);
expect(traitNoticeView(
  updateTraitNoticeState(
    createTraitNoticeState('nightmare-2'),
    [splitOpenEvent],
    3,
  ),
  3,
)).toBeNull();
```

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/app/traitNotice.test.ts tests/scaffold.test.ts`

Expected: `enabled` 필드와 스테이지 인자가 없어 실패한다.

- [ ] **Step 3: 최소 구현**

`TraitNoticeState`에 `enabled: boolean`을 추가한다. `createTraitNoticeState`는 `stageRef(stageKey).key === 'nightmare-1'`일 때만 활성화하고, 비활성 상태의 `updateTraitNoticeState`와 `traitNoticeView`는 상태 변경과 뷰 생성을 하지 않는다. `GameApp.startNewGame()`은 `createTraitNoticeState(selectedStageKey)`로 초기화한다.

- [ ] **Step 4: GREEN 확인**

Run: `npx vitest run tests/app/traitNotice.test.ts tests/scaffold.test.ts`

Expected: 관련 테스트 전부 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/app/traitNotice.ts src/app/GameApp.ts tests/app/traitNotice.test.ts tests/scaffold.test.ts
git commit -m "fix: limit trait onboarding to nightmare one"
```

---

### Task 2: 스테이지 밸런스 설정을 카탈로그로 통합

**Files:**
- Modify: `src/game/stages/stageCatalog.ts`
- Modify: `src/game/waves/nightmareWaves.ts`
- Modify: `src/game/simulation/updateWaves.ts`
- Test: `tests/game/stages.test.ts`
- Test: `tests/game/waves.test.ts`
- Test: `tests/game/stageSimulation.test.ts`

**Interfaces:**
- Produces: `StageDefinition.waveHpGrowth`, `StageDefinition.interWaveDelaySeconds`, `StageDefinition.targetClearSeconds`
- Produces: `createNightmareWaves(stageNumber, countMultiplier)`
- Consumes: `stage.waveHpGrowth`, `stage.interWaveDelaySeconds`

- [ ] **Step 1: 새 스테이지 계약과 완화된 곡선의 실패 테스트 작성**

나이트메어 프로필을 다음 값으로 고정한다.

| Stage | HP | Speed | Spawn interval | Count | 2-star | 3-star |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| N1 | 1.00 | 1.00 | 1.00 | 1.00 | 18,500 | 23,000 |
| N2 | 1.04 | 1.00 | 1.00 | 1.00 | 18,500 | 23,000 |
| N3 | 1.10 | 1.02 | 0.98 | 1.02 | 19,000 | 23,500 |
| N4 | 1.20 | 1.03 | 0.96 | 1.05 | 19,500 | 24,000 |
| N5 | 1.34 | 1.05 | 0.93 | 1.09 | 19,500 | 24,000 |
| N6 | 1.46 | 1.07 | 0.90 | 1.12 | 20,500 | 25,000 |

모든 스테이지는 `waveHpGrowth: 0.08`, `interWaveDelaySeconds: 5`, `targetClearSeconds: { min: 300, max: 420 }`을 가진다. `createNightmareWaves(2, 1)`의 일반 적 총수는 215마리이며 엘리트와 보스는 각 1마리다.

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/game/stages.test.ts tests/game/waves.test.ts tests/game/stageSimulation.test.ts`

Expected: 새 필드가 없고 기존 N2~N6 수치 및 웨이브 생성 시그니처가 달라 실패한다.

- [ ] **Step 3: 최소 구현**

`stageCatalog.ts`에 나이트메어 프로필 객체 배열을 만들고 같은 객체에서 웨이브 수량과 스테이지 배율을 구성한다. `nightmareWaves.ts`의 중복 `COUNT_MULTIPLIERS`를 제거하고 두 번째 인자를 검증한 뒤 수량 계산에 사용한다. `updateWaves.ts`는 HP를 `1 + waveIndex * stage.waveHpGrowth`로 계산하고 웨이브 대기 시간을 `stage.interWaveDelaySeconds`에서 읽는다.

- [ ] **Step 4: GREEN 확인**

Run: `npx vitest run tests/game/stages.test.ts tests/game/waves.test.ts tests/game/stageSimulation.test.ts`

Expected: 관련 테스트 전부 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/game/stages/stageCatalog.ts src/game/waves/nightmareWaves.ts src/game/simulation/updateWaves.ts tests/game/stages.test.ts tests/game/waves.test.ts tests/game/stageSimulation.test.ts
git commit -m "balance: smooth nightmare stage progression"
```

---

### Task 3: 실제 첫 클리어 시간을 preferences v5에 기록

**Files:**
- Modify: `src/app/preferences.ts`
- Modify: `src/app/hud.ts`
- Modify: `src/app/GameApp.ts`
- Test: `tests/app/preferences.test.ts`
- Test: `tests/app/hud.test.ts`

**Interfaces:**
- Produces: `StageRecord.firstClearSeconds: number | null`
- Produces: `ResultPanelView.firstClearText`, `ResultPanelView.targetClearText`

- [ ] **Step 1: 첫 기록 보존과 결과 표시 실패 테스트 작성**

첫 승리 360초 후 더 빠른 330초 승리를 기록해도 `firstClearSeconds`는 360, `bestClearSeconds`는 330이어야 한다. v4 레코드 마이그레이션은 최초 기록을 추정하지 않고 `firstClearSeconds: null`을 사용한다. 결과 마크업은 `첫 클리어 6:00`과 `목표 5:00~7:00`을 포함해야 한다.

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/app/preferences.test.ts tests/app/hud.test.ts`

Expected: 새 저장 필드와 결과 패널 필드가 없어 실패한다.

- [ ] **Step 3: 최소 구현**

현재 키를 `huchu-defense.preferences.v5`로 올리고 v4 키를 읽는 마이그레이션 경로를 추가한다. `recordOutcome`은 유효한 첫 승리에서만 `firstClearSeconds`를 기록한다. 결과 패널 레코드 영역에 첫 클리어와 스테이지 목표 범위를 추가하고 `GameApp`에서 현재 기록과 `StageDefinition.targetClearSeconds`를 포맷해 전달한다.

- [ ] **Step 4: GREEN 확인**

Run: `npx vitest run tests/app/preferences.test.ts tests/app/hud.test.ts`

Expected: 관련 테스트 전부 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/app/preferences.ts src/app/hud.ts src/app/GameApp.ts tests/app/preferences.test.ts tests/app/hud.test.ts
git commit -m "feat: record first stage clear times"
```

---

### Task 4: decision 감사 결과와 백로그 완료 상태 기록

**Files:**
- Modify: `docs/decisions/deferred-decisions.md`
- Modify: `docs/backlog.md`

**Interfaces:**
- Consumes: Tasks 1~3의 실제 최종 수치와 파일 위치
- Produces: 적용 완료·후속 검증·대체됨 상태 표

- [ ] **Step 1: decision 감사 표 추가**

문서 상단에 각 그룹의 상태를 기록한다.

- 맵·시뮬레이션: 적용 완료
- 경제·웨이브: 현재 12스테이지 값으로 대체 또는 적용 완료
- 타워: 슬로우·화살 유지, 덕배·후추 가격은 420/560으로 대체
- 적 스프라이트: 4방향 런타임 출력은 정면 표시·모션 시트로 대체
- 레이아웃: 16:9 고정은 전체 뷰포트 원근 맵으로 대체
- 조작·preferences: 적용 완료, preferences v5

- [ ] **Step 2: 백로그 5개 완료 처리**

현재 미완료인 특성 안내, N2~N6 난이도, 첫 클리어 측정, 스테이지별 설정 통합, decision 최신화 항목을 `[x]`로 변경한다.

- [ ] **Step 3: 문서 검증과 커밋**

Run: `git diff --check`

Expected: 출력 없음.

```bash
git add docs/decisions/deferred-decisions.md docs/backlog.md
git commit -m "docs: close deferred balance decisions"
```

---

### Task 5: 전체 검증과 배포

**Files:**
- Verify: `dist/index.html`
- Verify: `.github/workflows/deploy-pages.yml`

- [ ] **Step 1: 전체 검사**

Run: `npm run check`

Expected: 모든 Vitest 테스트, TypeScript 빌드와 Vite 프로덕션 빌드 통과.

- [ ] **Step 2: Pages base 확인**

Run: `rg -o '/huchu-duckbae-tower-defense/[^" ]+\.(js|css)' dist/index.html`

Expected: JS와 CSS 경로 모두 `/huchu-duckbae-tower-defense/`로 시작한다.

- [ ] **Step 3: 모바일 스모크**

844×390 뷰포트에서 스테이지 선택, 게임 시작, HUD, 결과 패널 마크업과 콘솔 오류를 확인한다. E2E 스위트는 실행하지 않는다.

- [ ] **Step 4: main 병합과 푸시**

검증된 기능 브랜치를 `main`에 fast-forward 병합하고 `git push origin main`으로 배포 워크플로를 시작한다.

- [ ] **Step 5: 배포 완료 확인**

GitHub Actions 결론이 `success`인지 확인하고 공개 HTML이 새 JS/CSS 해시를 참조하며 세 URL이 HTTP 200인지 확인한다.
