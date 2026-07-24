# 게임 중 스테이지 나가기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 진행 또는 일시정지 중인 게임을 확인창을 거쳐 안전하게 폐기하고 기존 스테이지 선택 화면으로 돌아가는 기능을 추가한다.

**Architecture:** `GameRuntime`은 현재 게임을 초기 상태로 교체하고 `ready`로 전환하는 명령만 담당한다. HUD는 나가기 버튼, 확인용 오버레이 뷰와 오버레이 종류를 인식하는 포커스 관리를 제공하고, `GameApp`이 확인창 열기·계속하기·스테이지 선택 이동을 조율한다.

**Tech Stack:** TypeScript 5.8, HTML Canvas, Vite 7, Vitest 3, Playwright

## Global Constraints

- 확인창 문구는 `게임을 그만둘까요?`, `현재 스테이지 진행은 저장되지 않아요.`, `계속하기`, `스테이지 선택`을 그대로 사용한다.
- 진행 중 확인을 취소하면 게임을 재개하고, 일시정지 중 확인을 취소하면 일시정지를 유지한다.
- 중도 종료는 해금 상태, 최고 점수, 승패 기록과 사용자 설정을 변경하지 않는다.
- 기존 스테이지 선택 화면은 계속 불투명해야 하며 확인창만 반투명 스크림을 사용한다.
- 모든 새 조작 버튼은 최소 `44 × 44px` 터치 영역과 키보드 포커스 표시를 유지한다.
- `Escape`는 현재 진행을 폐기하지 않고 `계속하기`와 동일하게 작동한다.
- Vite base `/huchu-duckbae-tower-defense/`와 GitHub Pages artifact 구조를 변경하지 않는다.
- 개인 토큰 값은 파일, 로그 또는 커밋에 기록하지 않는다.

## 파일 구조

- `src/app/gameRuntime.ts`: 중도 종료 시 현재 게임 상태를 폐기하고 `ready`로 전환한다.
- `src/app/hud.ts`: 나가기 컨트롤, 확인 오버레이 뷰, 두 번째 동작 버튼과 오버레이 전환 포커스를 담당한다.
- `src/app/GameApp.ts`: 확인창 상태와 사용자 입력을 조율하고 기존 스테이지 선택 흐름으로 연결한다.
- `src/styles.css`: 확인 모드의 반투명 스크림, 작은 패널과 두 버튼 레이아웃을 제공한다.
- `tests/app/gameRuntime.test.ts`: 중도 종료 런타임 초기화와 프레임 수명주기를 검증한다.
- `tests/app/hud.test.ts`: 확인 오버레이 문구·가시성·포커스 전환을 검증한다.
- `tests/scaffold.test.ts`: 나가기 버튼의 접근성 및 모바일 터치 영역 계약을 검증한다.
- `e2e/game.spec.ts`: 실제 게임에서 계속하기, `Escape`, 일시정지 유지와 스테이지 선택 복귀를 검증한다.

---

### Task 1: 런타임 중도 종료 명령

**Files:**
- Modify: `src/app/gameRuntime.ts:31-43,110-164`
- Test: `tests/app/gameRuntime.test.ts:26-177`

**Interfaces:**
- Consumes: 기존 `GameRuntimeDependencies.createGame(): GameState`, `FixedStepLoop`, `GamePhase`
- Produces: `GameRuntime.returnToStageSelect(): void`

- [ ] **Step 1: 중도 종료 초기화 실패 테스트 작성**

`tests/app/gameRuntime.test.ts`의 `GameRuntime lifecycle` 묶음에 다음 테스트를 추가한다.

```ts
it('returns an abandoned run to a fresh ready state without stopping the RAF', () => {
  const updates: number[] = [];
  const { runtime, scheduler } = setupRuntime((delta) => updates.push(delta));
  runtime.startFrames();
  runtime.startGame();
  runtime.selectTower('arrow');
  runtime.setSelectedCell({ col: 2, row: 5 });

  scheduler.frame(0);
  scheduler.frame(100);
  const abandonedGame = runtime.getSnapshot().game;
  expect(runtime.getSnapshot().elapsedSeconds).toBeGreaterThan(0);

  runtime.returnToStageSelect();

  expect(runtime.getSnapshot()).toMatchObject({
    phase: 'ready',
    selectedTower: null,
    selectedCell: null,
    inspectedTowerId: null,
    elapsedSeconds: 0,
  });
  expect(runtime.getSnapshot().game).not.toBe(abandonedGame);
  expect(scheduler.callbacks.size).toBe(1);

  const updatesAtExit = updates.length;
  scheduler.frame(5_000);
  expect(updates).toHaveLength(updatesAtExit);
  expect(scheduler.callbacks.size).toBe(1);
});
```

- [ ] **Step 2: 테스트가 인터페이스 부재로 실패하는지 확인**

Run:

```bash
npx vitest run tests/app/gameRuntime.test.ts -t "returns an abandoned run"
```

Expected: FAIL with `Property 'returnToStageSelect' does not exist on type 'GameRuntime'`.

- [ ] **Step 3: 최소 런타임 명령 구현**

`GameRuntime` 타입에 메서드를 추가한다.

```ts
export type GameRuntime = Readonly<{
  startFrames(): void;
  startGame(): void;
  returnToStageSelect(): void;
  togglePause(): void;
  // 기존 메서드 유지
}>;
```

`createGameRuntime()` 반환 객체에서 `startGame()` 다음에 구현한다.

```ts
returnToStageSelect() {
  if (phase !== 'playing' && phase !== 'paused') return;
  game = dependencies.createGame();
  phase = 'ready';
  selectedTower = null;
  selectedCell = null;
  inspectedTowerId = null;
  elapsedSeconds = 0;
  lastFrameMs = null;
  loop = makeLoop();
  dependencies.render();
},
```

애니메이션 프레임 예약은 취소하지 않는다. `ready` 상태에서 `canUpdate()`가
`false`를 반환하므로 렌더 루프는 살아 있지만 시뮬레이션은 진행되지 않는다.

- [ ] **Step 4: 런타임 테스트 통과 확인**

Run:

```bash
npx vitest run tests/app/gameRuntime.test.ts
```

Expected: `tests/app/gameRuntime.test.ts` 전체 PASS.

- [ ] **Step 5: 런타임 변경 커밋**

```bash
git add src/app/gameRuntime.ts tests/app/gameRuntime.test.ts
git commit -m "feat: add runtime stage exit reset"
```

---

### Task 2: 나가기 HUD와 확인 오버레이

**Files:**
- Modify: `src/app/hud.ts:46-64,288-354,360-537,701-754`
- Modify: `src/styles.css:48-65,90-160,468-518,737-790,805-835`
- Test: `tests/app/hud.test.ts:1-346`
- Test: `tests/scaffold.test.ts:95-158`

**Interfaces:**
- Consumes: `GamePhase`, 기존 `HudElements`, `createModalFocusManager()`
- Produces:
  - `HudElements.exitButton: HTMLButtonElement`
  - `HudElements.stateSecondaryAction: HTMLButtonElement`
  - `createStateOverlayView(phase, body, actionLabel, exitConfirmationOpen): StateOverlayView`
  - `showStateOverlay(elements: HudElements, phase: GamePhase, body?: string, actionLabel?: string, exitConfirmationOpen?: boolean): void`
  - `createModalFocusManager().prepare({ stateVisible, portraitBlocked, stateKey? }): boolean`

- [ ] **Step 1: 확인 오버레이와 포커스 전환 실패 테스트 작성**

`tests/app/hud.test.ts` import 목록에 `createStateOverlayView`를 추가하고 다음
테스트를 작성한다.

```ts
it('builds the approved in-game exit confirmation view', () => {
  expect(createStateOverlayView('paused', '', undefined, true)).toEqual({
    visible: true,
    mode: 'confirm',
    title: '게임을 그만둘까요?',
    body: '현재 스테이지 진행은 저장되지 않아요.',
    primaryAction: '계속하기',
    primaryDisabled: false,
    secondaryAction: '스테이지 선택',
    secondaryVisible: true,
  });

  expect(createStateOverlayView('playing', '', undefined, false).visible).toBe(false);
});

it('refocuses the primary action when the state overlay changes identity', () => {
  class FakeTarget implements ModalFocusTarget {
    inert = false;
    isConnected = true;
    focusCount = 0;
    focus() { this.focusCount += 1; }
  }
  const origin = new FakeTarget();
  const stateAction = new FakeTarget();
  const manager = createModalFocusManager({
    backgrounds: [new FakeTarget()],
    stateOverlay: new FakeTarget(),
    stateAction,
    portraitPrompt: new FakeTarget(),
    fallback: new FakeTarget(),
    getActiveElement: () => origin,
  });

  manager.sync({
    stateVisible: true,
    portraitBlocked: false,
    stateKey: 'exit-confirm',
  });
  manager.sync({
    stateVisible: true,
    portraitBlocked: false,
    stateKey: 'stage-select',
  });

  expect(stateAction.focusCount).toBe(2);
  expect(origin.focusCount).toBe(0);
});
```

`tests/scaffold.test.ts`에는 정적 접근성 계약을 추가한다.

```ts
it('provides an accessible in-game exit confirmation control', () => {
  const hud = readFileSync('src/app/hud.ts', 'utf8');
  const css = readFileSync('src/styles.css', 'utf8');

  expect(hud).toContain('data-control="exit"');
  expect(hud).toContain(
    'aria-label="현재 게임을 그만두고 스테이지 선택으로 이동"',
  );
  expect(hud).toContain('data-state-secondary-action');
  expect(css).toMatch(
    /\.stage-select-screen\[data-overlay-mode="confirm"\]\s*\{[^}]*background: rgba\(/s,
  );
  expect(css).toMatch(
    /\.stage-select-screen__secondary-action\s*\{[^}]*min-height: 44px;/s,
  );
});
```

- [ ] **Step 2: HUD 테스트가 새 뷰 부재로 실패하는지 확인**

Run:

```bash
npx vitest run tests/app/hud.test.ts tests/scaffold.test.ts -t "exit confirmation|overlay changes identity"
```

Expected: FAIL because `createStateOverlayView`와 새 DOM 계약이 아직 없다.

- [ ] **Step 3: 순수 확인 오버레이 뷰와 렌더 함수 구현**

`src/app/hud.ts`에 다음 타입과 뷰 함수를 `showStateOverlay()` 위에 추가한다.

```ts
export type StateOverlayView = Readonly<{
  visible: boolean;
  mode: 'stage-select' | 'confirm';
  title: string;
  body: string;
  primaryAction: string;
  primaryDisabled: boolean;
  secondaryAction: string;
  secondaryVisible: boolean;
}>;

export function createStateOverlayView(
  phase: GamePhase,
  body = '',
  actionLabel?: string,
  exitConfirmationOpen = false,
): StateOverlayView {
  if (exitConfirmationOpen) {
    return {
      visible: true,
      mode: 'confirm',
      title: '게임을 그만둘까요?',
      body: '현재 스테이지 진행은 저장되지 않아요.',
      primaryAction: '계속하기',
      primaryDisabled: false,
      secondaryAction: '스테이지 선택',
      secondaryVisible: true,
    };
  }

  const content: Partial<Record<GamePhase, { title: string; action: string }>> = {
    loading: { title: '게임 준비 중', action: '잠시만요' },
    ready: { title: '간식 창고를 지켜 주세요', action: '게임 시작' },
    victory: { title: '간식 창고를 지켜줘서 고마워요', action: '다시 하기' },
    defeat: { title: '간식 창고가 다 털려버렸어요', action: '다시 도전' },
  };
  const state = content[phase];
  return {
    visible: state !== undefined,
    mode: 'stage-select',
    title: state?.title ?? '',
    body,
    primaryAction: actionLabel ?? state?.action ?? '',
    primaryDisabled: phase === 'loading',
    secondaryAction: '스테이지 선택',
    secondaryVisible: false,
  };
}
```

기존 `showStateOverlay()`를 이 뷰를 적용하도록 교체한다.

```ts
export function showStateOverlay(
  elements: HudElements,
  phase: GamePhase,
  body = '',
  actionLabel?: string,
  exitConfirmationOpen = false,
): void {
  const view = createStateOverlayView(
    phase,
    body,
    actionLabel,
    exitConfirmationOpen,
  );
  elements.stateOverlay.hidden = !view.visible;
  elements.stateOverlay.dataset.overlayMode = view.mode;
  elements.stateTitle.textContent = view.title;
  elements.stateBody.textContent = view.body;
  elements.stateAction.textContent = view.primaryAction;
  elements.stateAction.disabled = view.primaryDisabled;
  elements.stateSecondaryAction.textContent = view.secondaryAction;
  elements.stateSecondaryAction.hidden = !view.secondaryVisible;
}
```

- [ ] **Step 4: HUD DOM과 활성화 규칙 구현**

상단 컨트롤 마지막에 버튼을 추가한다.

```html
<button class="game-control icon-control" data-control="exit" type="button"
  aria-label="현재 게임을 그만두고 스테이지 선택으로 이동">나가기</button>
```

상태 동작을 버튼 그룹으로 교체한다.

```html
<div class="stage-select-screen__actions">
  <button class="game-control stage-select-screen__action"
    data-state-action type="button" disabled>잠시만요</button>
  <button class="game-control stage-select-screen__secondary-action"
    data-state-secondary-action type="button" hidden>스테이지 선택</button>
</div>
```

`HudElements`와 `createHud()` 반환값에 두 요소를 추가한다.

```ts
exitButton: HTMLButtonElement;
stateSecondaryAction: HTMLButtonElement;
```

```ts
exitButton: requiredElement(root, '[data-control="exit"]'),
stateSecondaryAction: requiredElement(root, '[data-state-secondary-action]'),
```

`renderHud()`에서 나가기 버튼은 기존 게임 컨트롤과 같은 활성화 규칙을 사용한다.

```ts
elements.exitButton.disabled = view.hudControlsDisabled;
```

- [ ] **Step 5: 오버레이 종류 변경을 인식하는 포커스 관리 구현**

`createModalFocusManager()`의 `prepare`와 `sync` 입력에 선택적 `stateKey`를
추가하고 현재 키를 저장한다.

```ts
let mode: ModalMode = 'none';
let activeStateKey = '';

function prepare(state: Readonly<{
  stateVisible: boolean;
  portraitBlocked: boolean;
  stateKey?: string;
}>): boolean {
  const nextMode: ModalMode = state.portraitBlocked
    ? 'portrait'
    : state.stateVisible ? 'state' : 'none';
  const nextStateKey = nextMode === 'state' ? state.stateKey ?? 'state' : '';
  const stateIdentityChanged = mode === 'state'
    && nextMode === 'state'
    && activeStateKey !== nextStateKey;
  if (nextMode === mode && !stateIdentityChanged) return false;

  if (mode === 'none' && nextMode !== 'none') previousFocus = options.getActiveElement();
  const modalVisible = nextMode !== 'none';
  for (const target of options.backgrounds) target.inert = modalVisible;
  options.stateOverlay.inert = nextMode === 'portrait';

  mode = nextMode;
  activeStateKey = nextStateKey;
  if (mode === 'portrait') pendingFocus = options.portraitPrompt;
  else if (mode === 'state') pendingFocus = options.stateAction;
  else {
    const restore = previousFocus?.isConnected === false ? options.fallback : previousFocus;
    pendingFocus = restore ?? options.fallback;
    previousFocus = null;
  }
  return true;
}
```

`sync`에도 동일한 입력 타입을 사용한다. 기존 호출은 `stateKey`가 선택적이므로
그대로 동작한다.

- [ ] **Step 6: 반투명 확인 모드와 버튼 레이아웃 구현**

`src/styles.css`에 다음 스타일을 추가하고 기존
`.stage-select-screen__action`의 `margin-top`은 동작 그룹으로 이동한다.

```css
.stage-select-screen[data-overlay-mode="confirm"] {
  background: rgba(7, 20, 16, 0.76);
  backdrop-filter: blur(4px);
}

.stage-select-screen[data-overlay-mode="confirm"] .stage-select-screen__panel {
  width: min(88vw, 420px);
}

.stage-select-screen[data-overlay-mode="confirm"] .stage-mode-tabs,
.stage-select-screen[data-overlay-mode="confirm"] .stage-picker,
.stage-select-screen[data-overlay-mode="confirm"] .stage-select-screen__badge,
.stage-select-screen[data-overlay-mode="confirm"] .game-result {
  display: none;
}

.stage-select-screen__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
}

.stage-select-screen__action,
.stage-select-screen__secondary-action {
  min-width: 150px;
  min-height: 44px;
  margin-top: 0;
  padding: 8px 18px;
  border-radius: var(--md-sys-shape-small);
  font-weight: 900;
}

.stage-select-screen__action {
  background: var(--md-sys-color-secondary);
  color: #2d2419;
}

.stage-select-screen__secondary-action {
  border-color: rgba(255, 255, 255, 0.34);
  background: var(--md-sys-color-surface-container-high);
}
```

- [ ] **Step 7: HUD와 정적 계약 테스트 통과 확인**

Run:

```bash
npx vitest run tests/app/hud.test.ts tests/scaffold.test.ts
```

Expected: 두 테스트 파일 전체 PASS.

- [ ] **Step 8: HUD 변경 커밋**

```bash
git add src/app/hud.ts src/styles.css tests/app/hud.test.ts tests/scaffold.test.ts
git commit -m "feat: add stage exit confirmation HUD"
```

---

### Task 3: 앱 상태 연결과 실제 사용자 흐름

**Files:**
- Modify: `src/app/GameApp.ts:268-330,419-524,602-618,693-810`
- Test: `e2e/game.spec.ts:34-54,93-158`

**Interfaces:**
- Consumes:
  - `GameRuntime.returnToStageSelect(): void`
  - `HudElements.exitButton`
  - `HudElements.stateSecondaryAction`
  - `showStateOverlay(elements: HudElements, phase: GamePhase, body?: string, actionLabel?: string, exitConfirmationOpen?: boolean): void`
  - `createModalFocusManager().prepare({ stateVisible: boolean; portraitBlocked: boolean; stateKey?: string }): boolean`
- Produces:
  - 게임 중 확인창 열기·계속하기·중도 종료 동작
  - `Escape` 안전 취소
  - 중도 종료 뒤 선택된 기존 스테이지와 보존된 환경설정

- [ ] **Step 1: 실제 나가기 사용자 흐름 E2E 테스트 작성**

`e2e/game.spec.ts`에 다음 테스트를 추가한다.

```ts
test('in-game exit confirmation resumes safely and returns to stage select', async ({ page }) => {
  const consoleErrors = captureConsoleErrors(page);
  await startGame(page);
  await page.locator('[data-tower="arrow"]').click();
  await page.locator('canvas').click({
    position: await canvasPositionForCell(page, 2, 1),
  });
  await expect(page.getByRole('button', { name: '화살 타워 배치 확정' })).toBeVisible();
  const preferencesBeforeExit = await page.evaluate(() => (
    Object.fromEntries(
      Array.from({ length: localStorage.length }, (_, index) => {
        const key = localStorage.key(index) ?? '';
        return [key, localStorage.getItem(key)];
      }),
    )
  ));

  const exitButton = page.getByRole('button', {
    name: '현재 게임을 그만두고 스테이지 선택으로 이동',
  });
  await exitButton.click();
  await expect(page.getByRole('heading', { name: '게임을 그만둘까요?' })).toBeVisible();
  await expect(page.getByText('현재 스테이지 진행은 저장되지 않아요.')).toBeVisible();
  const pausedByDialog = await clockSnapshot(page);
  expect(pausedByDialog.phase).toBe('paused');
  expect((await advance(page, 2_000)).elapsedSeconds).toBe(pausedByDialog.elapsedSeconds);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('dialog', { name: '가로 화면으로 돌려 주세요' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('heading', { name: '게임을 그만둘까요?' })).toBeVisible();

  await page.getByRole('button', { name: '계속하기', exact: true }).click();
  await expect(page.getByRole('button', { name: '화살 타워 배치 확정' })).toBeVisible();
  await page.getByRole('button', { name: '화살 타워 배치 확정' }).click();
  const resumed = await advance(page, 1_000);
  expect(resumed.phase).toBe('playing');
  expect(resumed.elapsedSeconds).toBeGreaterThan(pausedByDialog.elapsedSeconds);
  expect(resumed.towerCells).toContainEqual({ col: 2, row: 1 });

  await page.getByRole('button', { name: '게임 일시정지' }).click();
  await exitButton.click();
  await page.keyboard.press('Escape');
  const manuallyPaused = await clockSnapshot(page);
  expect(manuallyPaused.phase).toBe('paused');
  expect((await advance(page, 2_000)).elapsedSeconds).toBe(manuallyPaused.elapsedSeconds);

  await exitButton.click();
  await page.getByRole('button', { name: '스테이지 선택', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '간식 창고를 지켜 주세요' }),
  ).toBeVisible();
  await expect(page.locator('[data-stage-key="normal-1"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await clockSnapshot(page)).toMatchObject({
    phase: 'ready',
    elapsedSeconds: 0,
    towerCells: [],
  });
  expect(await page.evaluate(() => (
    Object.fromEntries(
      Array.from({ length: localStorage.length }, (_, index) => {
        const key = localStorage.key(index) ?? '';
        return [key, localStorage.getItem(key)];
      }),
    )
  ))).toEqual(preferencesBeforeExit);
  expect(consoleErrors).toEqual([]);
});
```

- [ ] **Step 2: E2E 테스트가 나가기 버튼 부재로 실패하는지 확인**

Run:

```bash
npx playwright test e2e/game.spec.ts --grep "in-game exit confirmation"
```

Expected: FAIL while locating the button named
`현재 게임을 그만두고 스테이지 선택으로 이동`.

- [ ] **Step 3: 확인창 상태와 오버레이 렌더 연결**

`GameApp` 지역 상태에 다음 값을 추가한다.

```ts
let exitConfirmationOpen = false;
let resumeAfterExitConfirmation = false;
```

기존 스테이지 화면 판별을 분리한다.

```ts
function stageSelectionVisible(snapshot: GameRuntimeSnapshot): boolean {
  return snapshot.phase === 'ready'
    || snapshot.phase === 'victory'
    || snapshot.phase === 'defeat';
}

function stateOverlayVisible(snapshot: GameRuntimeSnapshot): boolean {
  return exitConfirmationOpen || stageSelectionVisible(snapshot);
}
```

`render()`에서 스테이지 카드 가시성, 오버레이 키, 오버레이 렌더와 포커스 키를
다음과 같이 연결한다.

```ts
const pickerVisible = stageSelectionVisible(snapshot);
renderStagePicker(
  hud,
  activeMode,
  selectedStageKey,
  preferences,
  pickerVisible,
);

const overlayKey = [
  snapshot.phase,
  exitConfirmationOpen,
  body,
  snapshot.game.stageKey,
  selectedStageKey,
  activeMode,
  preferences.highestUnlockedByMode.normal,
  preferences.highestUnlockedByMode.nightmare,
].join('|');

showStateOverlay(
  hud,
  snapshot.phase,
  body,
  stageActionLabel(snapshot.phase, snapshot.game.stageKey, selectedStageKey),
  exitConfirmationOpen,
);

const modalityChanged = focusManager.prepare({
  stateVisible: stateOverlayVisible(snapshot),
  portraitBlocked: snapshot.portraitBlocked,
  stateKey: exitConfirmationOpen ? 'exit-confirm' : 'stage-select',
});
```

- [ ] **Step 4: 공통 전투 UI 정리와 세 가지 나가기 동작 구현**

`startNewGame()`의 공통 초기화를 다음 함수로 추출한다.

```ts
function resetTransientGameUi(): void {
  globalThis.clearTimeout(invalidTimer);
  hud.stage.classList.remove('game-stage--invalid');
  baseHitFeedback.clear();
  activePointer = null;
  frameEvents.reset();
  effects = [];
  renderedGame = null;
  newBestScore = false;
  newBadge = false;
  traitNoticeState = createTraitNoticeState(selectedStageKey);
  renderTraitNotice(hud, null);
  pickerNotice = '';
}

function startNewGame(): void {
  resetTransientGameUi();
  placementMessage.show('타워를 선택해 주세요.');
  preferences = recordAttempt(storage, preferences);
  runtime.startGame();
}
```

세 확인 동작을 추가한다.

```ts
function openExitConfirmation(): void {
  if (exitConfirmationOpen) return;
  const snapshot = runtime.getSnapshot();
  if (
    snapshot.portraitBlocked
    || (snapshot.phase !== 'playing' && snapshot.phase !== 'paused')
  ) return;

  exitConfirmationOpen = true;
  resumeAfterExitConfirmation = snapshot.phase === 'playing';
  if (resumeAfterExitConfirmation) runtime.togglePause();
  else runtime.renderNow();
}

function continueAfterExitConfirmation(): void {
  if (!exitConfirmationOpen) return;
  const shouldResume = resumeAfterExitConfirmation;
  exitConfirmationOpen = false;
  resumeAfterExitConfirmation = false;
  if (shouldResume && runtime.getSnapshot().phase === 'paused') runtime.togglePause();
  else runtime.renderNow();
}

function confirmStageExit(): void {
  if (!exitConfirmationOpen) return;
  const currentStageKey = runtime.getSnapshot().game.stageKey;
  selectedStageKey = currentStageKey;
  activeMode = stageRef(currentStageKey).mode;
  exitConfirmationOpen = false;
  resumeAfterExitConfirmation = false;
  resetTransientGameUi();
  placementMessage.clear();
  runtime.returnToStageSelect();
}
```

- [ ] **Step 5: 버튼과 Escape 이벤트 연결**

기존 `hud.stateAction` 리스너는 확인창의 안전 동작을 먼저 처리한다.

```ts
scope.listen(hud.stateAction, 'click', () => {
  unlockAudio();
  if (exitConfirmationOpen) {
    continueAfterExitConfirmation();
    return;
  }
  const phase = runtime.getSnapshot().phase;
  if (phase === 'ready' || phase === 'victory' || phase === 'defeat') startNewGame();
});
```

새 버튼과 키보드 이벤트를 연결한다.

```ts
scope.listen(hud.stateSecondaryAction, 'click', confirmStageExit);
scope.listen(hud.exitButton, 'click', () => {
  unlockAudio();
  openExitConfirmation();
});
scope.listen(globalThis, 'keydown', ((event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !exitConfirmationOpen) return;
  event.preventDefault();
  continueAfterExitConfirmation();
}) as EventListener);
```

- [ ] **Step 6: 타겟 E2E와 관련 단위 테스트 통과 확인**

Run:

```bash
npx vitest run tests/app/gameRuntime.test.ts tests/app/hud.test.ts tests/scaffold.test.ts
npx playwright test e2e/game.spec.ts --grep "in-game exit confirmation"
```

Expected: 관련 Vitest와 새 Playwright 테스트 모두 PASS.

- [ ] **Step 7: 앱 연결 변경 커밋**

```bash
git add src/app/GameApp.ts e2e/game.spec.ts
git commit -m "feat: return active games to stage select"
```

---

### Task 4: 전체 검증과 GitHub Pages 배포

**Files:**
- Verify only: `dist/index.html`
- Verify only: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: Task 1~3의 커밋과 `main` 브랜치 Pages 워크플로
- Produces: 성공한 GitHub Actions 배포와 HTTP 200 공개 게임

- [ ] **Step 1: 전체 단위 테스트·타입 검사·프로덕션 빌드**

Run:

```bash
npm run check
```

Expected: 전체 Vitest PASS, `tsc -b` PASS, Vite production build PASS.

- [ ] **Step 2: 프로덕션 base 경로 검증**

Run:

```bash
rg -n 'src="/huchu-duckbae-tower-defense/|href="/huchu-duckbae-tower-defense/' dist/index.html
```

Expected: 생성된 JS와 CSS 경로가 모두
`/huchu-duckbae-tower-defense/`로 시작한다.

- [ ] **Step 3: 작업 트리와 최종 커밋 범위 확인**

Run:

```bash
git status --short --branch
git log -4 --oneline
```

Expected: 작업 트리가 깨끗하고 설계, 계획, 런타임, HUD, 앱 연결 커밋만
`origin/main`보다 앞서 있다.

- [ ] **Step 4: `main` 푸시**

Run:

```bash
env -u GITHUB_TOKEN git push origin main
```

Expected: `main -> main` push 성공. 키체인 인증이 불가능할 때만 프로세스 범위에서
`GH_TOKEN="$LOOMINGSIGHT_GITHUB_TOKEN"`을 사용하는 GitHub CLI 인증으로
재시도하며 토큰 값은 출력하지 않는다.

- [ ] **Step 5: GitHub Pages 워크플로 완료 확인**

Run:

```bash
deploy_pages_run_id=$(env -u GITHUB_TOKEN gh run list \
  --workflow deploy-pages.yml \
  --branch main \
  --limit 1 \
  --json databaseId \
  --jq '.[0].databaseId')
env -u GITHUB_TOKEN gh run watch "$deploy_pages_run_id" --exit-status
```

Expected: 방금 푸시한 커밋의 `deploy-pages.yml` 실행 결론이 `success`.

- [ ] **Step 6: 공개 HTML과 번들 HTTP 200 검증**

Run:

```bash
curl -fsS \
  https://loomingsight.github.io/huchu-duckbae-tower-defense/ \
  -o /tmp/huchu-defense-pages-index.html
rg -o '/huchu-duckbae-tower-defense/assets/[^"]+\\.(js|css)' \
  /tmp/huchu-defense-pages-index.html |
while read -r deployed_asset_path; do
  curl -fsSI "https://loomingsight.github.io${deployed_asset_path}"
done
```

Expected: HTML이 HTTP 200이고 응답에서 확인한 최신 JS 및 CSS 경로도 각각
`curl -fsSI` 요청에 HTTP 200을 반환한다.

- [ ] **Step 7: 배포 결과 보고**

최종 보고에는 다음을 포함한다.

- 나가기 확인창, 계속하기 상태 복원, 스테이지 선택 복귀 결과
- `npm run check`와 타겟 Playwright 결과
- 배포 커밋, GitHub Actions `success`
- 공개 URL 및 HTML/JS/CSS HTTP 200
