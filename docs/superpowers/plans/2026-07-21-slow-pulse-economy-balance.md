# Slow Pulse and Economy Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 슬로우 타워의 보라색 파동을 게임 시간 기준 3초마다 반복하고, 고급 타워 진입 시점과 처치 보상을 조정해 스테이지 1을 기본 타워 중심으로 시작하게 한다.

**Architecture:** 골드 수치는 기존 카탈로그와 게임 생성 지점에 명시적으로 고정한다. 슬로우 파동은 `GameTower.placedAtSeconds`와 `GameState.elapsedSeconds`만 입력받는 순수 함수가 매 렌더 프레임의 임시 effect 목록을 만들며, 지속 effect 상태에는 저장하지 않는다. 이 구조로 일시정지·2배속·재시작이 기존 게임 시간 정책을 그대로 따르고 중복 링을 만들지 않는다.

**Tech Stack:** TypeScript 5.8, Canvas 2D, Vitest 3, Playwright, Vite 7, GitHub Actions Pages

## Global Constraints

- 슬로우·화살 타워 가격, 공격력, 사거리, 공격 주기, 슬로우 배율은 변경하지 않는다.
- 적 체력·속도·누출 피해, 웨이브 구성은 변경하지 않는다.
- 파동은 기존 보라색 Canvas ground effect를 재사용하며 새 에셋과 의존성을 추가하지 않는다.
- Vite base `/huchu-duckbae-tower-defense/`와 공개 URL `https://loomingsight.github.io/huchu-duckbae-tower-defense/`를 유지한다.
- 구현과 테스트는 단일 에이전트로 수행한다.

---

### Task 1: 스테이지 1 경제 수치 고정

**Files:**
- Modify: `tests/game/placement.test.ts`
- Modify: `tests/game/enemies.test.ts`
- Modify: `tests/app/hud.test.ts`
- Modify: `tests/game/combat.test.ts`
- Modify: `src/game/simulation/createGame.ts`
- Modify: `src/game/towers/towerCatalog.ts`
- Modify: `src/game/enemies/enemyCatalog.ts`

**Interfaces:**
- Produces: `INITIAL_GOLD = 320`
- Changes: 덕배 `420G`, 후추 `560G`
- Changes: 처치 보상 `8/10/15/28/150G`

- [x] **Step 1: 승인 수치를 고정하는 실패 테스트 작성**

```ts
expect(INITIAL_GOLD).toBe(320);
expect(createGame().gold).toBe(INITIAL_GOLD);
expect(TOWER_CATALOG.deokbae.cost).toBe(420);
expect(TOWER_CATALOG.huchu.cost).toBe(560);
expect(Object.values(ENEMY_CATALOG).map(({ reward }) => reward))
  .toEqual([8, 10, 15, 28, 150]);
```

`STAGE_1_WAVES`의 수량과 새 reward 표를 합산해 총 처치 보상 `2,562G`도 검증한다. HUD에서는 시작 직후 덕배와 후추 버튼이 비용 부족으로 비활성인지 확인한다.

- [x] **Step 2: RED 확인**

Run: `npx vitest run tests/game/placement.test.ts tests/game/enemies.test.ts tests/app/hud.test.ts`

Expected: 기존 `450/250/300G`와 이전 보상 표 때문에 새 assertion만 실패한다.

- [x] **Step 3: 시작 골드와 카탈로그 구현**

```ts
export const INITIAL_GOLD = 320;

export function createGame(): GameState {
  return {
    // ...
    gold: INITIAL_GOLD,
  };
}
```

`towerCatalog.ts`에서 덕배/후추를 `420/560`, `enemyCatalog.ts`에서 슬라임/요정/오크/골렘/미노타우르스를 `8/10/15/28/150`으로 바꾼다.

- [x] **Step 4: 전투 테스트의 자금 fixture 분리**

전투 위력만 검증하는 helper는 설치할 타워 비용 이상을 명시적으로 넣는다. 경제 assertion이 아닌 기존 `450G` fixture는 `INITIAL_GOLD` 또는 테스트 의도가 드러나는 별도 금액으로 바꿔 새 가격과 우연히 결합하지 않게 한다.

- [x] **Step 5: GREEN 확인**

Run: `npx vitest run tests/game/placement.test.ts tests/game/enemies.test.ts tests/app/hud.test.ts tests/game/combat.test.ts`

Expected: focused suites 전부 통과.

- [x] **Step 6: 커밋**

```bash
git add src/game/simulation/createGame.ts src/game/towers/towerCatalog.ts src/game/enemies/enemyCatalog.ts tests/game/placement.test.ts tests/game/enemies.test.ts tests/app/hud.test.ts tests/game/combat.test.ts
git commit -m "balance: tighten stage one economy"
```

### Task 2: 타워별 설치 시각과 반복 슬로우 파동

**Files:**
- Modify: `tests/game/placement.test.ts`
- Modify: `tests/game/effects.test.ts`
- Modify: `tests/game/renderer.test.ts`
- Modify: `tests/game/targeting.test.ts`
- Modify: `src/game/simulation/createGame.ts`
- Modify: `src/game/simulation/placeTower.ts`
- Modify: `src/game/render/effects.ts`
- Modify: `src/app/GameApp.ts`

**Interfaces:**
- Adds: `GameTower.placedAtSeconds: number`
- Produces: `SLOW_PULSE_INTERVAL_SECONDS = 3`
- Produces: `SLOW_PULSE_DURATION_SECONDS = 0.6`
- Produces: `slowPulseEffects(towers, elapsedSeconds): RuntimeEffect[]`

- [x] **Step 1: 설치 시간 기록 실패 테스트 작성**

`state.elapsedSeconds = 4.25`에서 슬로우 타워를 설치하고 생성된 타워의 `placedAtSeconds`가 `4.25`인지 검증한다. `NaN`, 음수 시간은 `0`으로 저장하며 실패한 설치에는 타워가 추가되지 않아야 한다.

- [x] **Step 2: 파동 시간 경계 실패 테스트 작성**

```ts
expect(slowPulseEffects([slowTower], 0)).toHaveLength(1);
expect(slowPulseEffects([slowTower], 0.599)).toHaveLength(1);
expect(slowPulseEffects([slowTower], 0.6)).toHaveLength(0);
expect(slowPulseEffects([slowTower], 3)).toHaveLength(1);
expect(slowPulseEffects([slowTower], 3.6)).toHaveLength(0);
expect(slowPulseEffects([slowTower], 6)).toHaveLength(1);
```

서로 다른 설치 시각의 슬로우 타워는 독립 phase를 가지고, 일반 타워는 결과에서 제외되며, 입력 객체가 변하지 않는지 함께 검증한다.

- [x] **Step 3: RED 확인**

Run: `npx vitest run tests/game/placement.test.ts tests/game/effects.test.ts`

Expected: `placedAtSeconds`, 반복 파동 상수와 순수 함수가 없어 실패한다.

- [x] **Step 4: 설치 시각과 순수 파동 계산 구현**

```ts
export const SLOW_PULSE_INTERVAL_SECONDS = 3;
export const SLOW_PULSE_DURATION_SECONDS = 0.6;

export function slowPulseEffects(
  towers: readonly GameTower[],
  elapsedSeconds: number,
): RuntimeEffect[] {
  // 유효 시간을 0 이상으로 정규화하고, 각 slow tower의
  // (now - placedAt) % interval 값이 duration 미만일 때만 새 effect를 반환한다.
}
```

`placeTower()`는 성공 시 정규화된 `state.elapsedSeconds`를 타워에 기록한다. 모든 테스트용 `GameTower` literal에는 의도에 맞는 `placedAtSeconds`를 추가한다.

- [x] **Step 5: 렌더 파이프라인에 임시 파동 합성**

`GameApp.render()`에서 `slowPulseEffects(snapshot.towers, snapshot.elapsedSeconds)`를 계산하고 일반 effect와 합쳐 renderer에만 전달한다. `confirmPlacement()`의 수동 `createSlowPulse()` 호출은 제거한다. 반복 파동을 runtime effect buffer에 넣지 않아 프레임마다 누적되거나 설치 직후 두 겹으로 그려지지 않게 한다.

- [x] **Step 6: 렌더 순서 회귀 테스트**

기존 recording context로 보라색 stroke가 타워 sprite보다 먼저 호출되는지 확인한다. 파동이 없는 phase에서는 보라색 stroke가 없어야 한다.

- [x] **Step 7: GREEN 확인**

Run: `npx vitest run tests/game/placement.test.ts tests/game/effects.test.ts tests/game/renderer.test.ts tests/game/targeting.test.ts`

Expected: focused suites 전부 통과.

- [x] **Step 8: 커밋**

```bash
git add src/app/GameApp.ts src/game/simulation/createGame.ts src/game/simulation/placeTower.ts src/game/render/effects.ts tests/game/placement.test.ts tests/game/effects.test.ts tests/game/renderer.test.ts tests/game/targeting.test.ts
git commit -m "feat: repeat slow tower pulse"
```

### Task 3: E2E 실행 제외 결정 반영

2026-07-21 사용자 지시에 따라 이번 변경은 정책 수치와 반복 VFX 로직 수정으로 분류하고 E2E 실행을 제외한다. RED 확인 중 기존 E2E가 새 시작 골드와 고급 타워 잠금 정책에서 실패하는 것까지만 확인했으며, 작업 중 작성한 미검증 구매 시나리오는 모두 되돌렸다.

- [x] **Step 1: E2E 실행 중단**
- [x] **Step 2: 미검증 `e2e/game.spec.ts` 변경 제거**
- [x] **Step 3: 단위 테스트, 타입 검사, production build로 검증 범위 한정**

### Task 4: 전체 검증, main 통합, Pages 배포

**Files:**
- Verify: `dist/index.html`
- Verify: `.github/workflows/deploy-pages.yml`

- [x] **Step 1: 전체 로컬 검증**

Run: `npm run check`

Expected: 모든 Vitest 테스트와 production build 통과.

- [ ] **Step 2: 빌드 base와 변경 범위 검증**

Run: `rg -o '/huchu-duckbae-tower-defense/[^\" ]+' dist/index.html`

Expected: JS/CSS 경로가 모두 `/huchu-duckbae-tower-defense/`로 시작한다.

Run: `git status --short && git diff main...HEAD --stat && git diff --check main...HEAD`

Expected: 의도한 코드·테스트·설계 문서만 변경되고 whitespace 오류가 없다.

- [ ] **Step 3: 승인된 브랜치를 main에 통합하고 푸시**

격리 브랜치의 커밋을 기존 작업을 보존하는 방식으로 `main`에 통합한다. 통합한 `main`에서 `npm run check`를 다시 실행한 뒤 `origin/main`으로 push한다.

- [ ] **Step 4: GitHub Actions 완료 확인**

`env -u GITHUB_TOKEN gh run list --branch main --workflow deploy-pages.yml --limit 1`로 새 run을 찾고 완료될 때까지 확인한다.

Expected: conclusion `success`.

- [ ] **Step 5: 공개 배포 검증**

공개 게임 URL, `index.html`이 참조하는 주요 JS/CSS, manifest와 대표 타워/몬스터 asset이 모두 HTTP 200인지 확인한다. 배포된 JS에 `320`, `420`, `560` 계약과 반복 파동 코드가 포함된 새 commit의 artifact인지 Actions run SHA로 대조한다.

## Final Acceptance

- 슬로우 타워가 설치 직후와 게임 시간 `3.0초` 간격으로 `0.6초` 동안 보라색 파동을 반복한다.
- 일시정지 중 phase가 멈추고, 2배속에서는 게임 시간 기준으로 빨라지며, 재시작에는 schedule이 남지 않는다.
- 시작 골드 `320G`, 덕배 `420G`, 후추 `560G`, 적 보상 `8/10/15/28/150G`가 적용된다.
- 시작 직후 고급 타워 버튼은 비활성이다.
- 단위 테스트, 타입 검사, production build, GitHub Actions와 공개 리소스 검증이 모두 통과한다.
- 모바일 E2E와 실제 승리 난이도 검증은 이번 배포에서 사용자 결정으로 제외하며 후속 플레이 피드백에서 조정한다.
