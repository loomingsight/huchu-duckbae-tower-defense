# HUD 및 나이트메어 특성 안내 백로그 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 좌상단 HUD 표기를 명확하게 다듬고, 분열 슬라임의 첫 등장 특성을 안내하며, 의미 없는 흑요석 골렘의 균열 표식을 제거한다.

**Architecture:** HUD 아이콘은 DOM/CSS 계약으로 고정해 운영체제별 이모지 차이를 없앤다. 분열 안내는 적 생성 시 UI 전용 `split-open` 이벤트를 발행하고 기존 비차단 특성 안내 상태가 플레이당 한 번만 소비한다. 골렘의 내부 체력 단계는 전투 수치 호환을 위해 유지하되, 사용자에게 잘못된 의미를 주는 지속·순간 균열 VFX는 렌더 파이프라인에서 제거한다.

**Tech Stack:** TypeScript, Canvas 2D, DOM/CSS, Vitest, Vite

## Global Constraints

- 기존 미커밋 `docs/backlog.md` 변경을 보존하고 이번 범위의 세 항목만 완료 처리한다.
- 골드 HUD는 OS 이모지 대신 CSS로 그린 금색 원형 코인을 사용한다.
- 웨이브 HUD의 파도 이모지는 제거하고 화면에 `Wave` 텍스트를 표시한다.
- 분열 안내 문구는 `분열 슬라임 · 분열`과 `처치하면 작은 슬라임 2마리로 나뉘어요`를 사용한다.
- 분열 안내는 새 게임마다 최초 출현 시 한 번만 2.5초 동안 표시한다.
- 골렘의 HP·속도·보상·웨이브 구성은 변경하지 않는다.
- 전체 E2E 스위트는 실행하지 않고 단위 테스트, 타입 검사, 프로덕션 빌드와 모바일 브라우저 스모크 테스트로 검증한다.

---

### Task 1: 좌상단 HUD 금화 및 Wave 표기

**Files:**
- Modify: `src/app/hud.ts`
- Modify: `src/styles.css`
- Modify: `tests/scaffold.test.ts`

**Interfaces:**
- Produces: `.game-stat__coin`
- Produces: `.game-stat__label`
- Consumes: 기존 `data-stat="gold"`, `data-stat="wave"` HUD 구조

- [ ] **Step 1: HUD 마크업 실패 테스트 작성**

`tests/scaffold.test.ts`에서 `src/app/hud.ts`와 `src/styles.css`를 읽어 다음 계약을 검증한다.

```ts
expect(hud).toContain('class="game-stat__coin" aria-hidden="true">G</span>');
expect(hud).toContain('class="game-stat__label" aria-hidden="true">Wave</span>');
expect(hud).not.toContain('🪙');
expect(hud).not.toContain('🌊');
expect(css).toMatch(/\.game-stat__coin\s*\{[^}]*border-radius: 50%;/s);
```

- [ ] **Step 2: HUD 집중 테스트의 RED 확인**

Run:

```bash
npx vitest run tests/scaffold.test.ts
```

Expected: 현재 이모지 마크업과 코인 CSS 때문에 FAIL.

- [ ] **Step 3: 최소 HUD 마크업과 CSS 구현**

`src/app/hud.ts`의 골드·웨이브 아이콘을 다음처럼 변경한다.

```html
<span class="game-stat__coin" aria-hidden="true">G</span>
<span class="game-stat__label" aria-hidden="true">Wave</span>
```

`src/styles.css`에는 18px 원형 금색 코인과 작은 `Wave` 레이블 스타일을 추가한다. 기존 숫자와 접근성 `aria-label`은 유지한다.

- [ ] **Step 4: HUD 집중 테스트의 GREEN 확인**

Run:

```bash
npx vitest run tests/scaffold.test.ts tests/app/hud.test.ts
```

Expected: PASS.

---

### Task 2: 분열 슬라임 최초 출현 안내

**Files:**
- Modify: `src/game/enemies/enemyTraits.ts`
- Modify: `src/game/simulation/updateWaves.ts`
- Modify: `src/game/render/effects.ts`
- Modify: `src/app/traitNotice.ts`
- Modify: `tests/app/traitNotice.test.ts`
- Modify: `tests/game/nightmareTraits.test.ts`
- Modify: `tests/game/effects.test.ts`

**Interfaces:**
- Produces: `EnemyTraitVisualEvent['kind']`의 `split-open`
- Produces: `TraitNoticeState.splitShown`
- Consumes: `spawnEnemy()`, `updateTraitNoticeState()`, `traitNoticeView()`

- [ ] **Step 1: 최초 등장 이벤트와 안내 상태 실패 테스트 작성**

`tests/game/nightmareTraits.test.ts`에서 그림자 슬라임 생성 직후 다음을 검증한다.

```ts
expect(state.traitEvents.at(-1)?.kind).toBe('split-open');
```

`tests/app/traitNotice.test.ts`에는 다음 안내 계약을 추가한다.

```ts
const splitOpenEvent = {
  kind: 'split-open' as const,
  enemyId: 1,
  position: { x: 0.5, y: 0.5 },
};
const first = updateTraitNoticeState(createTraitNoticeState(), [splitOpenEvent], 3);
expect(traitNoticeView(first, 3)).toEqual({
  title: '분열 슬라임 · 분열',
  body: '처치하면 작은 슬라임 2마리로 나뉘어요',
});
expect(updateTraitNoticeState(first, [splitOpenEvent], 6)).toEqual({
  ...first,
  activeNotice: null,
  noticeEndsAt: null,
});
```

`tests/game/effects.test.ts`에서는 UI 전용 이벤트가 Canvas VFX로 변환되지 않는지 검증한다.

```ts
expect(effectsForTraits([splitOpenEvent])).toEqual([]);
```

- [ ] **Step 2: 특성 안내 집중 테스트의 RED 확인**

Run:

```bash
npx vitest run tests/app/traitNotice.test.ts tests/game/nightmareTraits.test.ts tests/game/effects.test.ts
```

Expected: `split-open` 타입·이벤트·안내가 없어 FAIL.

- [ ] **Step 3: 이벤트 발행과 플레이당 한 번 안내 구현**

`src/game/enemies/enemyTraits.ts` 이벤트 종류에 `split-open`을 추가한다. `spawnEnemy()`는 `shadowSlime` 생성 직후 `split-open`을 발행한다.

`src/app/traitNotice.ts` 상태는 다음 필드를 사용한다.

```ts
type TraitNoticeState = Readonly<{
  slowResistanceShown: boolean;
  splitShown: boolean;
  activeNotice: 'slow-resistance' | 'split' | null;
  noticeEndsAt: number | null;
}>;
```

진행 중 안내는 유지하고, 만료된 뒤 아직 보여주지 않은 `split-open` 또는 `slow-resist` 이벤트만 2.5초 안내로 연다. `effectsForTraits()`는 `split-open`을 반환하지 않는다.

- [ ] **Step 4: 특성 안내 집중 테스트의 GREEN 확인**

Run:

```bash
npx vitest run tests/app/traitNotice.test.ts tests/game/nightmareTraits.test.ts tests/game/effects.test.ts
```

Expected: PASS.

---

### Task 3: 흑요석 골렘의 무의미한 균열 표식 제거

**Files:**
- Modify: `src/game/render/drawEntities.ts`
- Modify: `src/game/render/drawEffects.ts`
- Modify: `src/game/render/effects.ts`
- Modify: `tests/game/renderer.test.ts`
- Modify: `tests/game/effects.test.ts`

**Interfaces:**
- Consumes: 내부 `armorStage`, `armor-crack` 이벤트
- Produces: 골렘의 주황색 지속 표식과 순간 균열 VFX가 없는 렌더 결과

- [ ] **Step 1: 골렘 표식 제거 실패 테스트 작성**

`tests/game/renderer.test.ts`에서 `armorStage: 2`인 흑요석 골렘을 그린 뒤 다음을 검증한다.

```ts
expect(calls.some((call) => (
  call.method === 'stroke' && call.strokeStyle === '#ff8a38'
))).toBe(false);
```

`tests/game/effects.test.ts`에는 다음 계약을 추가한다.

```ts
expect(effectsForTraits([{
  kind: 'armor-crack',
  enemyId: 4,
  position: { x: 3.5, y: 2.5 },
}])).toEqual([]);
```

- [ ] **Step 2: 골렘 렌더 집중 테스트의 RED 확인**

Run:

```bash
npx vitest run tests/game/renderer.test.ts tests/game/effects.test.ts
```

Expected: 주황색 지속 표식과 `armor-crack` RuntimeEffect 때문에 FAIL.

- [ ] **Step 3: 지속·순간 균열 렌더 제거**

`drawEntities.ts`의 `enemy.armorStage > 0` 주황색 stroke 블록을 삭제한다. `effectsForTraits()`는 `armor-crack` 이벤트를 무시하며, `TraitRuntimeEffectKind`·`TRAIT_EFFECTS`·`drawEffects.ts`에서 `armor-crack` 렌더 분기를 제거한다.

- [ ] **Step 4: 골렘 렌더 집중 테스트의 GREEN 확인**

Run:

```bash
npx vitest run tests/game/renderer.test.ts tests/game/effects.test.ts tests/game/nightmareTraits.test.ts
```

Expected: PASS.

---

### Task 4: 백로그 완료 및 배포 검증

**Files:**
- Modify: `docs/backlog.md`
- Verify: `dist/index.html`
- Verify: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: Task 1~3 결과
- Produces: 동기화된 `main`과 GitHub Pages 배포

- [ ] **Step 1: 백로그 세 항목 완료 처리**

`docs/backlog.md`의 금화, `Wave`, 분열 안내 항목을 `[x]`로 변경한다. 골렘 표식 제거는 전투 피드백 완료 항목으로 기록한다.

- [ ] **Step 2: 전체 단위 테스트와 프로덕션 빌드**

Run:

```bash
npm run check
```

Expected: 모든 Vitest 파일 PASS, `tsc -b` PASS, Vite production build PASS.

- [ ] **Step 3: Pages base와 변경 범위 확인**

Run:

```bash
rg -o '/huchu-duckbae-tower-defense/[^" ]+\.(js|css)' dist/index.html
git diff --check
git status --short
```

Expected: JS/CSS가 `/huchu-duckbae-tower-defense/`로 시작하고 공백 오류가 없다.

- [ ] **Step 4: 모바일 브라우저 스모크**

844×390 가로 뷰포트에서 금화·`Wave` 표기, 분열 슬라임 첫 등장 안내, 골렘 주황색 표식 부재를 확인한다. 브라우저 콘솔 오류가 없어야 한다.

- [ ] **Step 5: 커밋과 배포**

의도한 파일만 커밋하고 `main`을 `origin`에 푸시한다. 새 head SHA의 GitHub Actions `Deploy to GitHub Pages`가 `completed/success`인지 확인한다.

- [ ] **Step 6: 공개 자산 확인**

공개 게임 HTML이 새 JS/CSS 해시를 참조하고 게임 URL과 두 번들이 HTTP 200인지 확인한다.
