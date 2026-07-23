# Combat Feedback and Tower Tray Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Limit placement messages to three seconds, shake the full game shell when the snack warehouse is hit, and let mobile players persistently move the tower tray between the bottom and top.

**Architecture:** Keep simulation unchanged and adapt existing DOM feedback boundaries. Two small timer controllers own transient message and shake cleanup, while the existing preferences and HUD modules own the mobile tray position.

**Tech Stack:** TypeScript 5.8, Vite 7, Vitest 3, DOM/CSS animations, GitHub Pages

## Global Constraints

- `placement-status` messages expire exactly 3,000ms after the latest message.
- Base-hit shake lasts 420ms and is removed no later than 460ms after the latest hit.
- `prefers-reduced-motion: reduce` disables shake animation.
- Tower tray position is `'bottom' | 'top'`, defaults to `bottom`, and persists in preferences v4.
- Position toggle is visible only in landscape viewports no larger than 1024×430px.
- Keep Vite base `/huchu-duckbae-tower-defense/`.
- Do not run E2E tests.

---

### Task 1: Three-second placement messages

**Files:**
- Create: `src/app/transientMessage.ts`
- Create: `tests/app/transientMessage.test.ts`
- Modify: `src/app/hud.ts`
- Modify: `src/app/GameApp.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `TRANSIENT_MESSAGE_DURATION_MS`, `createTransientMessageController(target, scheduler?)`
- Consumes: a target with `textContent` and `hidden`, plus timer `setTimeout`/`clearTimeout`

- [ ] **Step 1: Write the failing controller tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  TRANSIENT_MESSAGE_DURATION_MS,
  createTransientMessageController,
} from '../../src/app/transientMessage';

describe('transient placement messages', () => {
  it('hides the latest message after exactly three seconds', () => {
    vi.useFakeTimers();
    const target = { textContent: '', hidden: true };
    const controller = createTransientMessageController(target);
    controller.show('타워를 선택해 주세요.');
    vi.advanceTimersByTime(TRANSIENT_MESSAGE_DURATION_MS - 1);
    expect(target).toEqual({ textContent: '타워를 선택해 주세요.', hidden: false });
    vi.advanceTimersByTime(1);
    expect(target).toEqual({ textContent: '', hidden: true });
    vi.useRealTimers();
  });

  it('restarts expiry for a newer message and clears on destroy', () => {
    vi.useFakeTimers();
    const target = { textContent: '', hidden: true };
    const controller = createTransientMessageController(target);
    controller.show('첫 메시지');
    vi.advanceTimersByTime(2000);
    controller.show('두 번째 메시지');
    vi.advanceTimersByTime(1000);
    expect(target.textContent).toBe('두 번째 메시지');
    controller.destroy();
    expect(target.hidden).toBe(true);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/app/transientMessage.test.ts`

Expected: FAIL because `src/app/transientMessage.ts` does not exist.

- [ ] **Step 3: Implement the timer controller**

```ts
export const TRANSIENT_MESSAGE_DURATION_MS = 3000;

export type TransientMessageTarget = {
  textContent: string | null;
  hidden: boolean;
};

export function createTransientMessageController(
  target: TransientMessageTarget,
  timers = globalThis,
) {
  let timer = 0;
  function clear() {
    timers.clearTimeout(timer);
    timer = 0;
    target.textContent = '';
    target.hidden = true;
  }
  return {
    show(message: string) {
      clear();
      if (message === '') return;
      target.textContent = message;
      target.hidden = false;
      timer = timers.setTimeout(clear, TRANSIENT_MESSAGE_DURATION_MS);
    },
    clear,
    destroy: clear,
  };
}
```

- [ ] **Step 4: Route every placement message through the controller**

In `createHud`, initialize the element as hidden:

```html
<p class="placement-status" data-placement-status aria-live="polite" hidden></p>
```

In `mountGameApp`, create and register the controller:

```ts
const placementMessage = createTransientMessageController(hud.placementStatus);
scope.add(() => placementMessage.destroy());
```

Replace every `hud.placementStatus.textContent = message` assignment with
`placementMessage.show(message)`. Add the hidden CSS contract:

```css
.placement-status[hidden] {
  display: none;
}
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- tests/app/transientMessage.test.ts tests/app/hud.test.ts`

Expected: both files PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/transientMessage.ts src/app/hud.ts src/app/GameApp.ts src/styles.css tests/app/transientMessage.test.ts
git commit -m "feat: expire placement messages"
```

---

### Task 2: Full-screen warehouse-hit shake

**Files:**
- Create: `src/app/baseHitFeedback.ts`
- Create: `tests/app/baseHitFeedback.test.ts`
- Modify: `src/app/GameApp.ts`
- Modify: `src/styles.css`
- Modify: `tests/scaffold.test.ts`

**Interfaces:**
- Produces: `BASE_HIT_SHAKE_DURATION_MS`, `BASE_HIT_SHAKE_CLEANUP_MS`, `createBaseHitFeedback(target, scheduler?)`
- Consumes: `FrameEventBatch.cueTypes` and the existing `leak` cue

- [ ] **Step 1: Write failing repeated-hit and cleanup tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  BASE_HIT_SHAKE_CLEANUP_MS,
  createBaseHitFeedback,
} from '../../src/app/baseHitFeedback';

describe('base hit feedback', () => {
  it('restarts the class pulse for repeated hits and removes it after cleanup', () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const classes = new Set<string>();
    const target = {
      classList: {
        add: (name: string) => { calls.push(`add:${name}`); classes.add(name); },
        remove: (name: string) => { calls.push(`remove:${name}`); classes.delete(name); },
      },
      offsetWidth: 844,
    };
    const feedback = createBaseHitFeedback(target);
    feedback.trigger();
    feedback.trigger();
    expect(calls.filter((call) => call === 'add:game-shell--base-hit')).toHaveLength(2);
    vi.advanceTimersByTime(BASE_HIT_SHAKE_CLEANUP_MS);
    expect(classes.has('game-shell--base-hit')).toBe(false);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/app/baseHitFeedback.test.ts`

Expected: FAIL because `src/app/baseHitFeedback.ts` does not exist.

- [ ] **Step 3: Implement the class-pulse controller**

```ts
export const BASE_HIT_SHAKE_DURATION_MS = 420;
export const BASE_HIT_SHAKE_CLEANUP_MS = 460;
const BASE_HIT_CLASS = 'game-shell--base-hit';

type BaseHitTarget = Readonly<{
  classList: Pick<DOMTokenList, 'add' | 'remove'>;
  offsetWidth: number;
}>;

export function createBaseHitFeedback(target: BaseHitTarget, timers = globalThis) {
  let timer = 0;
  function clear() {
    timers.clearTimeout(timer);
    timer = 0;
    target.classList.remove(BASE_HIT_CLASS);
  }
  return {
    trigger() {
      clear();
      void target.offsetWidth;
      target.classList.add(BASE_HIT_CLASS);
      timer = timers.setTimeout(clear, BASE_HIT_SHAKE_CLEANUP_MS);
    },
    clear,
    destroy: clear,
  };
}
```

- [ ] **Step 4: Trigger from the existing leak cue and add CSS**

Create the controller once in `mountGameApp`, call `trigger()` when
`frame.cueTypes.includes('leak')`, and clear it when starting a new game.

```css
.game-shell--base-hit {
  animation: base-hit-screen-shake 420ms cubic-bezier(.36,.07,.19,.97);
}

@keyframes base-hit-screen-shake {
  0%, 100% { transform: translate3d(0, 0, 0); }
  15% { transform: translate3d(-8px, 3px, 0) rotate(-0.35deg); }
  35% { transform: translate3d(7px, -3px, 0) rotate(0.3deg); }
  55% { transform: translate3d(-5px, 2px, 0) rotate(-0.2deg); }
  75% { transform: translate3d(3px, -1px, 0) rotate(0.1deg); }
}

@media (prefers-reduced-motion: reduce) {
  .game-shell--base-hit { animation: none; }
}
```

- [ ] **Step 5: Verify tests pass**

Run: `npm test -- tests/app/baseHitFeedback.test.ts tests/game/effects.test.ts tests/scaffold.test.ts`

Expected: all three files PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/baseHitFeedback.ts src/app/GameApp.ts src/styles.css tests/app/baseHitFeedback.test.ts tests/scaffold.test.ts
git commit -m "feat: shake screen on warehouse hits"
```

---

### Task 3: Persistent mobile tower-tray position

**Files:**
- Modify: `src/app/preferences.ts`
- Modify: `src/app/hud.ts`
- Modify: `src/app/GameApp.ts`
- Modify: `src/styles.css`
- Modify: `tests/app/preferences.test.ts`
- Modify: `tests/app/hud.test.ts`
- Modify: `tests/scaffold.test.ts`

**Interfaces:**
- Produces: `TowerTrayPosition`, `saveTowerTrayPositionPreference`, `towerTrayPositionView`, `renderTowerTrayPosition`
- Consumes: `GamePreferences.towerTrayPosition`

- [ ] **Step 1: Write failing preference and HUD view tests**

Add preference expectations:

```ts
expect(defaultPreferences().towerTrayPosition).toBe('bottom');
expect(loadPreferences(storageWith({
  'huchu-defense.preferences.v4': JSON.stringify({ towerTrayPosition: 'top' }),
})).towerTrayPosition).toBe('top');
expect(loadPreferences(storageWith({
  'huchu-defense.preferences.v4': JSON.stringify({ towerTrayPosition: 'left' }),
})).towerTrayPosition).toBe('bottom');
```

Add HUD view expectations:

```ts
expect(towerTrayPositionView('bottom')).toEqual({
  icon: '↑',
  label: '타워 버튼 위로 이동',
  pressed: false,
});
expect(towerTrayPositionView('top')).toEqual({
  icon: '↓',
  label: '타워 버튼 아래로 이동',
  pressed: true,
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- tests/app/preferences.test.ts tests/app/hud.test.ts`

Expected: FAIL because the new preference and HUD functions do not exist.

- [ ] **Step 3: Implement preference normalization and save**

```ts
export type TowerTrayPosition = 'bottom' | 'top';

function safeTowerTrayPosition(value: unknown): TowerTrayPosition {
  return value === 'top' ? 'top' : 'bottom';
}

export function saveTowerTrayPositionPreference(
  storage: PreferencesStorage | null | undefined,
  towerTrayPosition: TowerTrayPosition,
  current: GamePreferences = loadPreferences(storage),
): GamePreferences {
  return savePreferences(storage, { ...current, towerTrayPosition });
}
```

Add `towerTrayPosition: 'bottom'` to every default/migration result and normalize
the current v4 value with `safeTowerTrayPosition`.

- [ ] **Step 4: Add and render the position button**

Place this button inside `.tower-tray` after the four tower cards:

```html
<button class="game-control tower-tray__position-toggle"
  data-control="tower-tray-position" type="button"
  aria-label="타워 버튼 위로 이동" aria-pressed="false">↑</button>
```

Implement:

```ts
export function towerTrayPositionView(position: TowerTrayPosition) {
  return position === 'top'
    ? { icon: '↓', label: '타워 버튼 아래로 이동', pressed: true }
    : { icon: '↑', label: '타워 버튼 위로 이동', pressed: false };
}

export function renderTowerTrayPosition(
  elements: HudElements,
  position: TowerTrayPosition,
): void {
  const view = towerTrayPositionView(position);
  elements.shell.classList.toggle('game-shell--tower-tray-top', view.pressed);
  elements.towerTrayPositionButton.textContent = view.icon;
  elements.towerTrayPositionButton.setAttribute('aria-label', view.label);
  elements.towerTrayPositionButton.setAttribute('aria-pressed', String(view.pressed));
}
```

- [ ] **Step 5: Wire persistence and responsive CSS**

Render the saved position at mount, and on button click save the opposite value
and render it immediately.

```css
.tower-tray__position-toggle { display: none; }

@media (orientation: landscape) and (max-width: 1024px) and (max-height: 430px) {
  .tower-tray__position-toggle {
    position: absolute;
    top: -48px;
    right: 4px;
    display: grid;
    width: 44px;
    min-width: 44px;
    place-items: center;
  }
  .game-shell--tower-tray-top .tower-tray {
    top: max(4px, env(safe-area-inset-top));
    bottom: auto;
  }
  .game-shell--tower-tray-top .tower-tray__position-toggle {
    top: auto;
    bottom: -48px;
  }
  .game-shell--tower-tray-top .trait-notice {
    top: calc(max(8px, env(safe-area-inset-top)) + 58px);
  }
}
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `npm test -- tests/app/preferences.test.ts tests/app/hud.test.ts tests/scaffold.test.ts`

Expected: all three files PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/preferences.ts src/app/hud.ts src/app/GameApp.ts src/styles.css tests/app/preferences.test.ts tests/app/hud.test.ts tests/scaffold.test.ts
git commit -m "feat: move mobile tower tray"
```

---

### Task 4: Final verification and deployment

**Files:**
- Modify: `docs/backlog.md`

**Interfaces:**
- Consumes: all completed feature contracts
- Produces: checked backlog items and deployed `main`

- [ ] **Step 1: Mark the three backlog entries complete**

Change only the three approved entries from `[ ]` to `[x]`.

- [ ] **Step 2: Run full verification**

Run: `npm run check`

Expected: every Vitest file passes and Vite production build succeeds.

Run: `rg -o '/huchu-duckbae-tower-defense/[^\" ]+\\.(js|css)' dist/index.html`

Expected: both emitted paths start with `/huchu-duckbae-tower-defense/`.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 3: Run manual mobile smoke**

Start Vite on an available local port and verify a landscape viewport:

- Placement message becomes hidden after three seconds.
- Simulated leak adds then removes `game-shell--base-hit`.
- Position button changes label, icon, tray position, and persists after reload.
- No browser console errors are introduced.

- [ ] **Step 4: Commit backlog completion**

```bash
git add docs/backlog.md
git commit -m "docs: complete combat feedback backlog"
```

- [ ] **Step 5: Push and verify GitHub Pages**

Push `main`, wait for `.github/workflows/deploy-pages.yml` to complete with
`success`, then verify:

```text
https://loomingsight.github.io/huchu-duckbae-tower-defense/
```

The public HTML, referenced JS bundle, and CSS bundle must each return HTTP 200.
