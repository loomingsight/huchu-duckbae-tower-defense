# 흡혈 박쥐 둔화 저항 안내 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 흡혈 박쥐의 둔화 저항이 실제로 처음 발동할 때 게임을 멈추지 않는 2.5초 설명 배너와 오해 없는 전투 효과를 제공한다.

**Architecture:** 시뮬레이션은 기존 `slow-resist` 이벤트만 유지한다. 새 `traitNotice.ts`가 도전당 최초 1회와 만료 시각을 순수 함수로 계산하고, `GameApp`이 프레임 이벤트를 이 상태에 연결하며, HUD는 전달받은 고정 문구를 비차단 DOM 배너로 렌더링한다. Canvas VFX와 2D 승인 도안에서는 회복처럼 보이는 `+`를 제거하고 보라색 날개 섬광과 끊어진 청색 얼음 고리를 사용한다.

**Tech Stack:** TypeScript, Vite, Vitest, HTML Canvas 2D, CSS, Codex 내장 `image_gen`

## Global Constraints

- 모든 응답과 설계 문서는 가급적 한국어로 작성한다.
- 기존 사용자 변경사항과 승인 대기 중인 2D 도안 파일을 임의로 되돌리지 않는다.
- 안내 중에도 시뮬레이션, 입력과 게임 시간이 계속 진행된다.
- 배너 표시 시간은 정확히 게임 진행 시간 기준 2.5초다.
- 한 번의 게임 도전에서 최초 `slow-resist` 이벤트에만 배너를 표시한다.
- 재도전 시 표시 상태를 초기화한다.
- `localStorage`, preferences v4 스키마와 적 전투 수치는 변경하지 않는다.
- 청록색 `+`와 방패 모양을 둔화 저항에 사용하지 않는다.
- 반투명 가상 방패는 해골 기사 전용으로 유지한다.
- `prefers-reduced-motion: reduce`에서도 배너와 끊어진 청색 고리를 유지한다.
- 사용자가 E2E를 제외했으므로 `npm run test:e2e`를 실행하지 않는다.
- 구현은 사용자가 요청한 단일 에이전트 방식으로 진행한다.

---

### Task 1: 도전 단위 안내 수명 모델

**Files:**
- Create: `src/app/traitNotice.ts`
- Create: `tests/app/traitNotice.test.ts`

**Interfaces:**
- Consumes: `readonly EnemyTraitVisualEvent[]`, 게임 진행 시간 `elapsedSeconds`
- Produces: `SLOW_RESIST_NOTICE_DURATION_SECONDS`
- Produces: `createTraitNoticeState(): TraitNoticeState`
- Produces: `updateTraitNoticeState(state, events, elapsedSeconds): TraitNoticeState`
- Produces: `traitNoticeView(state, elapsedSeconds): TraitNoticeView | null`

- [ ] **Step 1: 최초 1회, 2.5초 만료와 재도전 초기화 실패 테스트 작성**

```ts
import { describe, expect, it } from 'vitest';

import {
  createTraitNoticeState,
  SLOW_RESIST_NOTICE_DURATION_SECONDS,
  traitNoticeView,
  updateTraitNoticeState,
} from '../../src/app/traitNotice';

const slowResistEvent = {
  kind: 'slow-resist' as const,
  enemyId: 4,
  position: { x: 3.5, y: 2.5 },
};

describe('slow resistance onboarding state', () => {
  it('shows the fixed copy for 2.5 seconds after the first event', () => {
    const state = updateTraitNoticeState(
      createTraitNoticeState(),
      [slowResistEvent],
      10,
    );

    expect(SLOW_RESIST_NOTICE_DURATION_SECONDS).toBe(2.5);
    expect(traitNoticeView(state, 10)).toEqual({
      title: '흡혈 박쥐 · 둔화 저항',
      body: '슬로우 효과가 50%만 적용돼요',
    });
    expect(traitNoticeView(state, 12.499)).not.toBeNull();
    expect(traitNoticeView(state, 12.5)).toBeNull();
  });

  it('does not extend the notice for later events in the same attempt', () => {
    const first = updateTraitNoticeState(
      createTraitNoticeState(),
      [slowResistEvent],
      10,
    );
    const repeated = updateTraitNoticeState(first, [slowResistEvent], 11);

    expect(repeated).toEqual(first);
    expect(traitNoticeView(repeated, 12.5)).toBeNull();
  });

  it('ignores unrelated events and resets with a fresh state', () => {
    const untouched = updateTraitNoticeState(
      createTraitNoticeState(),
      [{
        kind: 'shield-block',
        enemyId: 2,
        position: { x: 1.5, y: 2.5 },
      }],
      4,
    );
    expect(traitNoticeView(untouched, 4)).toBeNull();

    const shown = updateTraitNoticeState(
      untouched,
      [slowResistEvent],
      5,
    );
    expect(traitNoticeView(shown, 5)).not.toBeNull();
    expect(traitNoticeView(createTraitNoticeState(), 5)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트를 실행해 모듈 부재로 실패하는지 확인**

Run: `npx vitest run tests/app/traitNotice.test.ts`

Expected: FAIL with `Failed to load url ../../src/app/traitNotice`.

- [ ] **Step 3: 최소 순수 상태 모델 구현**

Create `src/app/traitNotice.ts`:

```ts
import type { EnemyTraitVisualEvent } from '../game/enemies/enemyTraits';

export const SLOW_RESIST_NOTICE_DURATION_SECONDS = 2.5;

export type TraitNoticeState = Readonly<{
  slowResistanceShown: boolean;
  slowResistanceEndsAt: number | null;
}>;

export type TraitNoticeView = Readonly<{
  title: '흡혈 박쥐 · 둔화 저항';
  body: '슬로우 효과가 50%만 적용돼요';
}>;

const SLOW_RESISTANCE_VIEW: TraitNoticeView = {
  title: '흡혈 박쥐 · 둔화 저항',
  body: '슬로우 효과가 50%만 적용돼요',
};

function safeTime(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function createTraitNoticeState(): TraitNoticeState {
  return {
    slowResistanceShown: false,
    slowResistanceEndsAt: null,
  };
}

export function updateTraitNoticeState(
  state: TraitNoticeState,
  events: readonly EnemyTraitVisualEvent[],
  elapsedSeconds: number,
): TraitNoticeState {
  if (
    state.slowResistanceShown
    || !events.some(({ kind }) => kind === 'slow-resist')
  ) return state;
  return {
    slowResistanceShown: true,
    slowResistanceEndsAt:
      safeTime(elapsedSeconds) + SLOW_RESIST_NOTICE_DURATION_SECONDS,
  };
}

export function traitNoticeView(
  state: TraitNoticeState,
  elapsedSeconds: number,
): TraitNoticeView | null {
  if (
    state.slowResistanceEndsAt === null
    || safeTime(elapsedSeconds) >= state.slowResistanceEndsAt
  ) return null;
  return SLOW_RESISTANCE_VIEW;
}
```

- [ ] **Step 4: 상태 모델 테스트 통과 확인**

Run: `npx vitest run tests/app/traitNotice.test.ts`

Expected: 3 tests PASS.

- [ ] **Step 5: 상태 모델 커밋**

```bash
git add src/app/traitNotice.ts tests/app/traitNotice.test.ts
git commit -m "feat: model slow resistance notice lifecycle"
```

---

### Task 2: 비차단 HUD 배너

**Files:**
- Modify: `src/app/hud.ts:300-458, 544-559`
- Modify: `src/styles.css:118-163, 731-733`
- Modify: `tests/app/hud.test.ts`

**Interfaces:**
- Consumes: `TraitNoticeView | null` from `src/app/traitNotice.ts`
- Produces: `HudElements.traitNotice: HTMLElement`
- Produces: `createTraitNoticeMarkup(view: TraitNoticeView): string`
- Produces: `renderTraitNotice(elements: HudElements, view: TraitNoticeView | null): void`

- [ ] **Step 1: 고정 문구와 비차단 마크업 실패 테스트 작성**

Add imports and test to `tests/app/hud.test.ts`:

```ts
import {
  createTraitNoticeMarkup,
  // existing imports remain
} from '../../src/app/hud';

it('renders the approved nonblocking slow-resistance notice copy', () => {
  const markup = createTraitNoticeMarkup({
    title: '흡혈 박쥐 · 둔화 저항',
    body: '슬로우 효과가 50%만 적용돼요',
  });

  expect(markup).toContain('<strong>흡혈 박쥐 · 둔화 저항</strong>');
  expect(markup).toContain('<span>슬로우 효과가 50%만 적용돼요</span>');
  expect(markup).not.toContain('button');
  expect(markup).not.toContain('+');
});
```

- [ ] **Step 2: 테스트를 실행해 HUD 함수 부재로 실패하는지 확인**

Run: `npx vitest run tests/app/hud.test.ts`

Expected: FAIL with `createTraitNoticeMarkup is not a function`.

- [ ] **Step 3: HUD 요소와 렌더 함수 추가**

In `src/app/hud.ts`, import `TraitNoticeView`, add `traitNotice` to `HudElements`, place the live region immediately after the canvas, and return it from `createHud`:

```ts
import type { TraitNoticeView } from './traitNotice';

export type HudElements = Readonly<{
  // existing fields
  traitNotice: HTMLElement;
}>;
```

```html
<canvas class="game-canvas" aria-label="20열 10행 타워 배치 게임 보드" tabindex="0"></canvas>
<div class="trait-notice" data-trait-notice role="status"
  aria-live="polite" aria-atomic="true" hidden></div>
```

```ts
traitNotice: requiredElement(root, '[data-trait-notice]'),
```

Add pure markup and transition-safe renderer:

```ts
export function createTraitNoticeMarkup(view: TraitNoticeView): string {
  return `<strong>${view.title}</strong><span>${view.body}</span>`;
}

export function renderTraitNotice(
  elements: HudElements,
  view: TraitNoticeView | null,
): void {
  if (view === null) {
    if (!elements.traitNotice.hidden) {
      elements.traitNotice.hidden = true;
      elements.traitNotice.replaceChildren();
    }
    return;
  }
  if (!elements.traitNotice.hidden) return;
  elements.traitNotice.innerHTML = createTraitNoticeMarkup(view);
  elements.traitNotice.hidden = false;
}
```

- [ ] **Step 4: 모바일 상단 중앙 스타일과 모션 감소 처리**

Add to `src/styles.css` after `.game-stage`:

```css
.trait-notice {
  position: absolute;
  z-index: 4;
  top: max(8px, env(safe-area-inset-top));
  left: 50%;
  display: grid;
  width: min(320px, 42vw);
  min-width: 220px;
  gap: 2px;
  padding: 7px 14px;
  transform: translateX(-50%);
  border: 1px solid rgba(130, 211, 255, 0.54);
  border-radius: 16px;
  background: rgba(24, 22, 48, 0.9);
  box-shadow: 0 6px 20px rgba(5, 4, 18, 0.34);
  color: #f5efff;
  text-align: center;
  pointer-events: none;
  animation: trait-notice-lifetime 2.5s ease both;
}

.trait-notice[hidden] {
  display: none;
}

.trait-notice strong {
  color: #d7b8ff;
  font-size: 0.78rem;
}

.trait-notice span {
  color: #dff7ff;
  font-size: 0.7rem;
  font-weight: 750;
}

@keyframes trait-notice-lifetime {
  0% { opacity: 0; transform: translate(-50%, -6px); }
  8%, 84% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, -3px); }
}
```

Extend the existing reduced-motion media query:

```css
@media (prefers-reduced-motion: reduce) {
  .game-stage--invalid .game-canvas { animation: none; }
  .trait-notice { animation: none; }
}
```

- [ ] **Step 5: HUD 테스트와 프로덕션 타입 검사**

Run: `npx vitest run tests/app/hud.test.ts tests/app/traitNotice.test.ts`

Expected: all tests PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: HUD 배너 커밋**

```bash
git add src/app/hud.ts src/styles.css tests/app/hud.test.ts
git commit -m "feat: add slow resistance notice banner"
```

---

### Task 3: 프레임 이벤트 연결과 전투 효과 계약

**Files:**
- Modify: `src/app/GameApp.ts:1-57, 243-360, 537-548`
- Modify: `src/game/render/drawEffects.ts:294-332`
- Modify: `tests/game/renderer.test.ts`

**Interfaces:**
- Consumes: `FrameEventBatch.traitEvents`
- Consumes: Task 1의 `TraitNoticeState` 함수
- Consumes: Task 2의 `renderTraitNotice`
- Produces: 최초 `slow-resist` 이벤트에서만 활성화되는 HUD 안내
- Preserves: 기존 `RuntimeEffect.kind === 'slow-resist'`의 0.28초 수명과 0.8초 이벤트 제한

- [ ] **Step 1: 둔화 저항 Canvas 효과가 방패와 텍스트 없이 그려지는 테스트 추가**

Add to `tests/game/renderer.test.ts`:

```ts
it('draws slow resistance as purple wings and a broken cyan ring without shield copy', () => {
  const { context, calls } = createRecordingContext();
  const renderer = createCanvasRenderer(createTestCanvas(context), createTestAssets());
  const effects = effectsForTraits([{
    kind: 'slow-resist',
    enemyId: 1,
    position: { x: 2.5, y: 2.5 },
  }]);

  renderer.render(snapshot({ stageKey: 'normal-1' }), {
    timeSeconds: 0.1,
    effects,
  });

  expect(calls.some(({ fillStyle }) => fillStyle === '#a15ce0')).toBe(true);
  expect(calls.filter(({ strokeStyle }) => strokeStyle === '#73d7ff')).toHaveLength(2);
  expect(calls.some(({ method }) => method === 'fillText')).toBe(false);
  expect(calls.some(({ fillStyle }) => (
    fillStyle === 'rgba(105, 126, 220, 0.48)'
  ))).toBe(false);
});
```

- [ ] **Step 2: 기존 효과가 이미 계약을 만족하는지 테스트 확인**

Run: `npx vitest run tests/game/renderer.test.ts`

Expected: PASS. 실패하면 `drawEffects.ts`의 `slow-resist` 분기만 수정해 보라색 wing polygon 2개와 `#73d7ff`의 끊어진 arc 2개만 남긴다. 해골 기사 방패 분기는 수정하지 않는다.

- [ ] **Step 3: GameApp에 도전 단위 상태와 HUD 연결**

In `src/app/GameApp.ts`, add imports:

```ts
import {
  createTraitNoticeState,
  traitNoticeView,
  updateTraitNoticeState,
} from './traitNotice';
```

Add `renderTraitNotice` to the existing import list from `./hud`. Initialize beside other per-run rendering state:

```ts
let traitNoticeState = createTraitNoticeState();
```

Immediately after `const frame = frameEvents.peek();`:

```ts
traitNoticeState = updateTraitNoticeState(
  traitNoticeState,
  frame.traitEvents,
  snapshot.elapsedSeconds,
);
renderTraitNotice(
  hud,
  snapshot.phase === 'playing' || snapshot.phase === 'paused'
    ? traitNoticeView(traitNoticeState, snapshot.elapsedSeconds)
    : null,
);
```

Reset in `startNewGame()` before `runtime.startGame()`:

```ts
traitNoticeState = createTraitNoticeState();
renderTraitNotice(hud, null);
```

Do not call `pause`, `togglePause`, change `snapshot.speed`, or alter simulation delta while the notice is visible.

- [ ] **Step 4: 전체 단위 테스트와 프로덕션 빌드**

Run: `npm test`

Expected: 245 tests PASS (current 240 plus Task 1의 3 tests, HUD 1 test and renderer 1 test).

Run: `npm run build`

Expected: PASS and no candidate Nightmare PNG imports.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 5: 안내 연결과 방패 피드백 변경 커밋**

The worktree already contains the approved shield-shape feedback in `src/game/render/drawEffects.ts` and `tests/game/renderer.test.ts`. Include it with this combat-cue commit, but do not stage concept images yet.

```bash
git add src/app/GameApp.ts src/game/render/drawEffects.ts tests/game/renderer.test.ts
git commit -m "feat: trigger slow resistance onboarding"
```

---

### Task 4: 둔화 저항 2D 참고 포즈 v3와 사용자 승인 게이트

**Files:**
- Create: `assets/concepts/nightmare-v1/nightmare-enemy-lineup-v3.png`
- Create: `assets/concepts/nightmare-v1/nightmare-enemy-lineup-mobile-v3.png`
- Modify: `docs/assets/nightmare-concepts-v1.md`

**Interfaces:**
- Consumes: `assets/concepts/nightmare-v1/nightmare-enemy-lineup-v2.png`
- Produces: Blender Task 8 입력으로 승인받을 최종 정면 라인업
- Gate: 사용자 승인 없이는 Blender MCP를 호출하거나 런타임 manifest를 변경하지 않는다.

- [ ] **Step 1: imagegen으로 하단 둔화 저항 포즈만 교정**

Use the built-in `image_gen` edit mode with
`assets/concepts/nightmare-v1/nightmare-enemy-lineup-v2.png` as the edit target and this exact prompt:

```text
Use case: precise-object-edit
Asset type: final 2D character-design lineup sheet for later Blender modeling.
Input image: the provided v2 lineup is the edit target.

Change only bottom inset groups 4 and 5, counting inset groups from left to right.
Group 4 currently shows a single slime with cyan speed lines and plus signs. Replace it with
a clear shadow-slime split key pose: one deep-purple parent blob separating into two smaller
purple child blobs moving left and right, with a short purple split burst and no cyan marks.
Group 5 currently shows a skeleton knight with cyan plus signs. Replace that entire group with the same front-facing
Vampire Bat from the top row demonstrating slow resistance: its broad dark-plum wings flash
purple for an instant while one cyan-blue frost ring around its body is visibly broken into
two separated arc pieces. The effect must communicate partial resistance to slowing, not
healing. Remove every plus sign, medical cross, shield shape, recovery sparkle, and green glow
from groups 4 and 5. Keep the bat's face and wing silhouette readable at 128px.

Preserve exactly everything else: all five top-row characters, order, designs, proportions,
colors, poses, spacing, front-facing full bodies, neutral light-gray review background, and
bottom groups 1, 2, 3, and 6. Bottom group 3 must retain the single semi-transparent
blue-violet spectral shield in front of the skeleton. Do not add or remove any group or
character. No text, labels, captions, boxes, borders, floor, cast shadows, projectile balls,
logos, or watermark. Make no changes outside bottom groups 4 and 5.
```

- [ ] **Step 2: 생성 파일을 직접 검수**

Use `view_image` on the generated result. Reject and repeat one targeted edit if any of these is true:

- top-row five characters changed or moved materially;
- group 3 lost its single spectral shield;
- group 4 is not a purple parent slime separating into two children;
- group 4 or group 5 contains `+` or healing-like green marks;
- group 5 is not the vampire bat or contains a shield;
- the broken cyan ring is not two separated arcs;
- the bat face or wings collapse at mobile size.

- [ ] **Step 3: 프로젝트 v3와 모바일 검수본 저장**

Copy the accepted built-in output from the exact `$CODEX_HOME/generated_images/...` path returned by the image tool. Pass that returned path verbatim as the first argument to `cp`; do not derive or guess it. Then run:

```bash
sips -Z 844 assets/concepts/nightmare-v1/nightmare-enemy-lineup-v3.png \
  --out assets/concepts/nightmare-v1/nightmare-enemy-lineup-mobile-v3.png
```

Run:

```bash
sips -g pixelWidth -g pixelHeight \
  assets/concepts/nightmare-v1/nightmare-enemy-lineup-v3.png \
  assets/concepts/nightmare-v1/nightmare-enemy-lineup-mobile-v3.png
```

Expected: original dimensions close to 1692×929 and mobile long edge exactly 844.

- [ ] **Step 4: 승인 문서 갱신과 자체 검수**

Update `docs/assets/nightmare-concepts-v1.md`:

- current files point to v3;
- v3 change says the split pose uses shadow-slime children and slow resistance uses the Vampire Bat;
- remove `+` from the approved effect description;
- checklist confirms group 3 spectral shield, group 4 split burst and group 5 broken frost ring;
- status remains `사용자 승인 대기`;
- `사용자 승인 완료` remains `미승인`.

Run:

```bash
rg -n "현재 원본|현재 모바일|사용자 승인 대기|사용자 승인 완료|흡혈 박쥐|가상 방패|얼음 고리" \
  docs/assets/nightmare-concepts-v1.md
```

Expected: every required entry is present and no current-path entry points to v1 or v2.

- [ ] **Step 5: 사용자에게 v3 원본과 모바일 검수본을 보여주고 중단**

Ask for `전체 승인` or a character/effect-specific revision. Do not call Blender MCP and do not commit concept assets in the same turn.

- [ ] **Step 6: 명시적 전체 승인 후 도안만 커밋**

After user says `전체 승인`, run `date +%F`, replace `미승인` with the exact date, then:

```bash
git add assets/concepts/nightmare-v1 docs/assets/nightmare-concepts-v1.md
git commit -m "art: approve nightmare enemy concepts"
```

Run:

```bash
git status --short
```

Expected: no concept or concept-doc changes remain unstaged.

---

## Final Verification Before Returning to the Nightmare Expansion Plan

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Confirm `npm run test:e2e` was not executed.
- [ ] Confirm the v3 concept status is approved before invoking Blender MCP.
- [ ] Continue at Task 8 of `docs/superpowers/plans/2026-07-23-nightmare-mode-expansion.md`.
