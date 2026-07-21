# Mobile HUD and Enemy Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모바일 가로 화면의 HUD를 좌우 세로 열과 20% 작은 하단 트레이로 정리하고, 모든 몬스터의 체력과 요정·오크 속도를 승인 수치로 상향한다.

**Architecture:** HUD DOM과 Canvas 구조는 유지하고 `src/styles.css`의 모바일 가로 media query만 교체한다. 몬스터 난이도는 `ENEMY_CATALOG`의 기본 수치를 직접 변경해 기존 웨이브 배율과 이동 로직이 새 값을 자동 소비하게 한다. CSS는 source contract, 전투 수치는 실제 카탈로그와 스폰 결과를 단위 테스트로 고정한다.

**Tech Stack:** TypeScript 5.8, CSS, Canvas 2D, Vitest 3, Vite 7, GitHub Actions Pages

## Global Constraints

- 단일 에이전트로 구현한다.
- E2E와 Playwright는 실행하지 않는다.
- 모바일 가로 변경 경계는 `(orientation: landscape) and (max-width: 1024px) and (max-height: 430px)`이다.
- 상단 통계는 왼쪽 세로 열, 조작은 오른쪽 세로 열이며 각 조작 버튼은 최소 `44×44px`이다.
- 하단 트레이는 `496px`, 가용 폭 약 `80%`, 최소 높이 `50px`, gap/padding `4px` 계약을 사용한다.
- 몬스터 HP는 `50.4/38.4/132/384/2160`, 요정 속도는 `2.28`, 오크 속도는 `1.035`다.
- 타워, 보상, 누출 피해, 웨이브, 맵, 투영, 에셋과 애니메이션 FPS는 변경하지 않는다.
- 새 런타임 의존성과 에셋을 추가하지 않는다.
- Vite base `/huchu-duckbae-tower-defense/`를 유지한다.

---

### Task 1: 몬스터 체력과 이동 속도 상향

**Files:**
- Modify: `tests/game/enemies.test.ts`
- Modify: `src/game/enemies/enemyCatalog.ts`

**Interfaces:**
- Produces: `ENEMY_CATALOG` HP `50.4/38.4/132/384/2160`
- Produces: fairy speed `2.28`, orc speed `1.035`
- Preserves: reward `8/10/15/28/150`, leak `1/1/2/3/8`

- [ ] **Step 1: 승인된 기본 수치를 고정하는 실패 테스트 작성**

`tests/game/enemies.test.ts`의 첫 catalog test를 다음 exact contract로 교체한다.

```ts
it('uses the approved durability and movement pressure', () => {
  expect(Object.fromEntries(Object.entries(ENEMY_CATALOG).map(([type, enemy]) => [
    type,
    { hp: enemy.hp, speed: enemy.speed },
  ]))).toEqual({
    slime: { hp: 50.4, speed: 1.15 },
    fairy: { hp: 38.4, speed: 2.28 },
    orc: { hp: 132, speed: 1.035 },
    golem: { hp: 384, speed: 0.52 },
    minotaur: { hp: 2160, speed: 0.48 },
  });
});
```

웨이브 스케일 테스트의 golem 기대값도 다음처럼 변경한다.

```ts
expect(state.enemies[0].maxHp).toBeCloseTo(384 * 1.4);
expect(state.enemies[0].hp).toBeCloseTo(384 * 1.4);
```

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/game/enemies.test.ts`

Expected: 기존 HP `42/32/110/320/1800`, fairy `1.9`, orc `0.9` 때문에 exact contract와 wave-scale test가 실패한다.

- [ ] **Step 3: 카탈로그에 승인 수치 구현**

`src/game/enemies/enemyCatalog.ts`의 catalog를 다음 값으로 교체한다.

```ts
export const ENEMY_CATALOG: Readonly<Record<EnemyType, EnemyDefinition>> = {
  slime: { hp: 50.4, speed: 1.15, reward: 8, leak: 1 },
  fairy: { hp: 38.4, speed: 2.28, reward: 10, leak: 1 },
  orc: { hp: 132, speed: 1.035, reward: 15, leak: 2 },
  golem: { hp: 384, speed: 0.52, reward: 28, leak: 3 },
  minotaur: { hp: 2160, speed: 0.48, reward: 150, leak: 8 },
};
```

- [ ] **Step 4: GREEN 확인**

Run: `npx vitest run tests/game/enemies.test.ts tests/game/waves.test.ts tests/game/combat.test.ts`

Expected: enemy/wave/combat focused suites 전부 통과하고 reward total은 `2,562G`를 유지한다.

- [ ] **Step 5: 커밋**

```bash
git add src/game/enemies/enemyCatalog.ts tests/game/enemies.test.ts
git commit -m "balance: raise enemy durability and speed"
```

### Task 2: 모바일 HUD 좌우 세로 열과 20% 작은 하단 트레이

**Files:**
- Modify: `tests/scaffold.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: 기존 `.game-hud`, `.game-hud__stats`, `.game-hud__controls`, `.tower-tray`
- Produces: mobile landscape CSS source contract
- Preserves: HUD DOM, aria labels, four-column tower order, global `.game-control` minimum `44px`

- [ ] **Step 1: 모바일 HUD CSS 계약 실패 테스트 작성**

`tests/scaffold.test.ts`에 다음 test를 추가한다.

```ts
it('uses compact side rails and an 80-percent tower tray on mobile landscape', () => {
  const css = readFileSync('src/styles.css', 'utf8');

  expect(css).toContain(
    '@media (orientation: landscape) and (max-width: 1024px) and (max-height: 430px)',
  );
  expect(css).toContain(`.game-hud__stats,
  .game-hud__controls {
    min-height: 0;
    flex-direction: column;
    align-items: stretch;
    gap: 3px;
    padding: 3px;
  }`);
  expect(css).toContain(`width: min(496px, calc(80% - env(safe-area-inset-left) - env(safe-area-inset-right)));
    gap: 4px;
    min-height: 50px;
    padding: 4px;`);
  expect(css).toContain('bottom: calc(max(4px, env(safe-area-inset-bottom)) + 60px);');
  expect(css).toContain('bottom: calc(max(4px, env(safe-area-inset-bottom)) + 120px);');
  expect(css).toMatch(/\.game-control\s*\{[^}]*min-width: 44px;[^}]*min-height: 44px;/s);
});
```

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/scaffold.test.ts`

Expected: 새 mobile media query와 `496px/80%/50px` rule이 없어 새 test만 실패한다.

- [ ] **Step 3: 기존 짧은 화면 media query를 모바일 가로 계약으로 교체**

`src/styles.css`의 기존 `@media (max-height: 430px)` block을 다음 block으로 교체한다.

```css
@media (orientation: landscape) and (max-width: 1024px) and (max-height: 430px) {
  .game-hud {
    min-height: 44px;
  }

  .game-hud__stats,
  .game-hud__controls {
    min-height: 0;
    flex-direction: column;
    align-items: stretch;
    gap: 3px;
    padding: 3px;
  }

  .game-stat {
    min-width: 48px;
    padding-inline: 6px;
    font-size: 0.82rem;
  }

  .icon-control {
    width: 44px;
    min-width: 44px;
    padding-inline: 4px;
  }

  .tower-tray {
    width: min(496px, calc(80% - env(safe-area-inset-left) - env(safe-area-inset-right)));
    gap: 4px;
    min-height: 50px;
    padding: 4px;
  }

  .tower-card {
    gap: 4px;
    padding: 3px;
  }

  .tower-card__copy small {
    margin-top: 1px;
  }

  .placement-actions {
    bottom: calc(max(4px, env(safe-area-inset-bottom)) + 60px);
  }

  .placement-status {
    bottom: calc(max(4px, env(safe-area-inset-bottom)) + 120px);
  }
}
```

- [ ] **Step 4: 중복된 580px override 정리**

`@media (max-width: 580px)`에서는 portrait·작은 desktop의 기존 규칙만 남기고, 새 mobile landscape block과 중복되는 다음 두 선언을 제거한다.

```css
.game-hud__stats,
.game-hud__controls { gap: 3px; }
.icon-control { min-width: 44px; padding-inline: 4px; }
```

`.game-stat`, `.game-hud`, `.tower-card__copy strong` 규칙은 유지한다.

- [ ] **Step 5: GREEN 확인**

Run: `npx vitest run tests/scaffold.test.ts tests/app/hud.test.ts tests/game/layout.test.ts`

Expected: scaffold/HUD/layout focused suites 전부 통과.

- [ ] **Step 6: 커밋**

```bash
git add src/styles.css tests/scaffold.test.ts
git commit -m "feat: compact mobile game controls"
```

### Task 3: 백로그 완료와 전체 로컬 검증

**Files:**
- Modify: `docs/backlog.md`
- Verify: `dist/index.html`

**Interfaces:**
- Consumes: Task 1과 Task 2의 검증된 결과
- Produces: 미완료 5개 항목이 완료된 canonical backlog

- [ ] **Step 1: 백로그 5개 항목 완료 처리**

`docs/backlog.md`에서 다음 항목의 checkbox를 `[x]`로 바꾼다.

```md
- [x] 상단 버튼을 세로로 배치해 모바일에서 맵을 가리는 영역 최소화
- [x] 하단 타워 버튼 크기를 현재보다 20% 축소
- [x] 모든 몬스터의 체력을 현재보다 20% 증가
- [x] 빠른 요정의 이동 속도를 현재보다 20% 증가
- [x] 녹색 오크의 이동 속도를 현재보다 15% 증가
```

E2E 제외 정책 문구는 그대로 유지한다.

- [ ] **Step 2: 전체 unit/type/build 검증**

Run: `npm run check`

Expected: 모든 Vitest test file 통과, `tsc -b` 성공, Vite production build 성공.

- [ ] **Step 3: E2E 미실행과 Vite base 검증**

`npm run test:e2e`는 실행하지 않는다.

Run: `rg -o '/huchu-duckbae-tower-defense/[^\" ]+' dist/index.html`

Expected: manifest, icon, JS와 CSS 경로가 모두 `/huchu-duckbae-tower-defense/`로 시작한다.

- [ ] **Step 4: 변경 범위 검증**

Run: `git diff --check && git status --short && git diff --stat origin/main...HEAD`

Expected: enemy catalog/test, mobile CSS/test, backlog, spec/plan만 변경되고 whitespace 오류가 없다.

- [ ] **Step 5: 커밋**

```bash
git add docs/backlog.md docs/superpowers/plans/2026-07-21-mobile-hud-enemy-balance.md
git commit -m "docs: complete mobile balance backlog"
```

### Task 4: GitHub Pages 배포와 공개 검증

**Files:**
- Verify: `.github/workflows/deploy-pages.yml`
- Verify: deployed `index.html`, JS, CSS, manifest and representative enemy asset

- [ ] **Step 1: main과 원격 동기화 확인**

Run: `git status --short --branch && git rev-parse HEAD`

Expected: clean `main`, local commit SHA 확인.

- [ ] **Step 2: main push**

Run: `env -u GITHUB_TOKEN git push origin main`

Expected: `main -> main` 성공.

- [ ] **Step 3: Pages Actions 완료 확인**

Run: `env -u GITHUB_TOKEN gh run list --repo loomingsight/huchu-duckbae-tower-defense --branch main --workflow deploy-pages.yml --limit 1 --json databaseId,headSha,status,conclusion,url`

새 run을 `gh run watch <run-id> --repo loomingsight/huchu-duckbae-tower-defense --exit-status --interval 5`로 완료까지 확인한다.

Expected: run `headSha`가 push SHA와 같고 conclusion `success`.

- [ ] **Step 4: 공개 리소스 검증**

다음 URL과 새 `dist/index.html`이 가리키는 JS/CSS를 확인한다.

```text
https://loomingsight.github.io/huchu-duckbae-tower-defense/
https://loomingsight.github.io/huchu-duckbae-tower-defense/manifest.webmanifest
```

Expected: index, JS, CSS, manifest, 대표 enemy asset 모두 HTTP 200.

- [ ] **Step 5: 공개 JS/CSS artifact 일치 검증**

로컬 `dist/assets/index-*.js`, `dist/assets/index-*.css`와 공개 URL의 SHA-256을 각각 비교한다.

Expected: 로컬과 공개 JS/CSS hash가 각각 동일하다.

## Final Acceptance

- 모바일 가로 화면에서 왼쪽 통계와 오른쪽 조작이 각각 세로 열이다.
- 하단 트레이는 `496px/80%/50px` 계약이고 타워 터치 영역은 최소 `44px`이다.
- 몬스터 HP와 요정·오크 속도가 승인 수치다.
- reward, leak, wave와 tower 정책은 변하지 않는다.
- 백로그 미완료 항목이 모두 완료다.
- E2E 없이 unit/type/build와 Pages/public artifact 검증이 통과한다.
