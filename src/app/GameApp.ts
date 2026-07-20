import { loadGameAssets, type GameAssets } from '../game/render/assetLoader';
import { SoundEngine } from '../game/audio/SoundEngine';
import { createCanvasRenderer, type CanvasRenderer } from '../game/render/canvasRenderer';
import { createGame } from '../game/simulation/createGame';
import { placeTower } from '../game/simulation/placeTower';
import { updateGame } from '../game/simulation/updateGame';
import { TOWER_CATALOG, TOWER_TYPES, type TowerType } from '../game/towers/towerCatalog';
import { STAGE_1_WAVES } from '../game/waves/stage1Waves';
import {
  createGameRuntime,
  type AnimationFrameScheduler,
  type GameRuntime,
  type GameRuntimeSnapshot,
} from './gameRuntime';
import {
  createHud,
  createModalFocusManager,
  renderHud,
  showStateOverlay,
} from './hud';
import { isTapGesture, pointerToCell, type ClientPoint } from './input';
import { guardInitialization, LifecycleScope } from './lifecycle';
import {
  browserPreferenceStorage,
  loadPreferences,
  saveMutedPreference,
  updateBestClear,
} from './preferences';

export type GameApp = Readonly<{
  destroy(): void;
}>;

type ActivePointer = Readonly<{ id: number; start: ClientPoint }>;

const EMPTY_DIRECTIONS = { ne: null, se: null, sw: null, nw: null } as const;
const EMPTY_ASSETS: GameAssets = {
  towers: { arrow: EMPTY_DIRECTIONS, deokbae: null, huchu: null, slow: null },
  enemies: {
    slime: EMPTY_DIRECTIONS,
    fairy: EMPTY_DIRECTIONS,
    orc: EMPTY_DIRECTIONS,
    golem: EMPTY_DIRECTIONS,
    minotaur: EMPTY_DIRECTIONS,
  },
};

const browserAnimationFrameScheduler: AnimationFrameScheduler = {
  request: (callback) => globalThis.requestAnimationFrame(callback),
  cancel: (id) => globalThis.cancelAnimationFrame(id),
};

type DevClockView = Readonly<{
  phase: GameRuntimeSnapshot['phase'];
  elapsedSeconds: number;
  waveIndex: number;
  enemyCount: number;
  baseHp: number;
  gold: number;
  pendingFrames: number;
  totalFrameRequests: number;
}>;

type DevClock = Readonly<{
  advance(milliseconds: number): void;
  snapshot(): DevClockView;
}>;

function createAppScheduler(
  scope: LifecycleScope,
  getSnapshot: () => GameRuntimeSnapshot,
): AnimationFrameScheduler {
  const isDevelopment = (import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV;
  if (!isDevelopment) return browserAnimationFrameScheduler;
  const debugClockRequested = new URLSearchParams(globalThis.location.search).get('debug-clock') === '1';
  if (!debugClockRequested) return browserAnimationFrameScheduler;

  let nextId = 1;
  let nowMs = 0;
  let primed = false;
  let totalFrameRequests = 0;
  const pending = new Map<number, FrameRequestCallback>();
  const scheduler: AnimationFrameScheduler = {
    request(callback) {
      const id = nextId;
      nextId += 1;
      totalFrameRequests += 1;
      pending.set(id, callback);
      return id;
    },
    cancel(id) {
      pending.delete(id);
    },
  };

  function fireFrame(timestampMs: number): void {
    const callbacks = [...pending.values()];
    pending.clear();
    for (const callback of callbacks) callback(timestampMs);
  }

  const clock: DevClock = Object.freeze({
    advance(milliseconds) {
      const requested = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
      if (!primed) {
        primed = true;
        fireFrame(nowMs);
      }
      let remaining = requested;
      while (remaining > 0) {
        const step = Math.min(250, remaining);
        nowMs += step;
        fireFrame(nowMs);
        remaining -= step;
      }
    },
    snapshot() {
      const snapshot = getSnapshot();
      return {
        phase: snapshot.phase,
        elapsedSeconds: snapshot.elapsedSeconds,
        waveIndex: snapshot.game.wave.index,
        enemyCount: snapshot.game.enemies.length,
        baseHp: snapshot.game.baseHp,
        gold: snapshot.game.gold,
        pendingFrames: pending.size,
        totalFrameRequests,
      };
    },
  });
  const debugScope = globalThis as typeof globalThis & { __HUCHU_DEV_CLOCK__?: DevClock };
  debugScope.__HUCHU_DEV_CLOCK__ = clock;
  scope.add(() => {
    pending.clear();
    delete debugScope.__HUCHU_DEV_CLOCK__;
  });
  return scheduler;
}

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clearTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const remaining = Math.floor(safe % 60);
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

type RendererDependencies = Readonly<{
  loadAssets(): Promise<GameAssets>;
  createRenderer(canvas: HTMLCanvasElement, assets: GameAssets): CanvasRenderer;
}>;

const DEFAULT_RENDERER_DEPENDENCIES: RendererDependencies = {
  loadAssets: loadGameAssets,
  createRenderer: createCanvasRenderer,
};

export async function createRendererWithFallback(
  canvas: HTMLCanvasElement,
  dependencies: RendererDependencies = DEFAULT_RENDERER_DEPENDENCIES,
): Promise<CanvasRenderer> {
  let assets = EMPTY_ASSETS;
  try {
    assets = await dependencies.loadAssets();
  } catch {
    // A rejected asset batch uses the primitive fallback set.
  }
  try {
    return dependencies.createRenderer(canvas, assets);
  } catch {
    return dependencies.createRenderer(canvas, EMPTY_ASSETS);
  }
}

export async function mountGameApp(root: HTMLElement): Promise<GameApp> {
  const scope = new LifecycleScope();

  return guardInitialization(scope, async () => {
    const hud = createHud(root);
    const storage = browserPreferenceStorage();
    let preferences = loadPreferences(storage);
    let activePointer: ActivePointer | null = null;
    let invalidTimer = 0;
    let lastHudKey = '';
    let lastOverlayKey = '';
    let runtime: GameRuntime;
    let observedGame: GameRuntimeSnapshot['game'] | null = null;
    let observedNextProjectileId = 0;
    let observedBaseHp = 0;
    let observedHitEvents: GameRuntimeSnapshot['game']['hitEvents'] | null = null;
    const renderer = await createRendererWithFallback(hud.canvas);
    const sound = new SoundEngine();
    sound.setMuted(preferences.muted);
    scope.add(() => { void sound.destroy(); });

    const focusManager = createModalFocusManager({
      backgrounds: [hud.header, hud.stage, hud.tray],
      stateOverlay: hud.stateOverlay,
      stateAction: hud.stateAction,
      portraitPrompt: hud.orientationPrompt,
      fallback: hud.canvas,
      getActiveElement: () => {
        const active = document.activeElement;
        return active instanceof HTMLElement && active !== document.body ? active : null;
      },
    });
    scope.add(() => focusManager.destroy());
    scope.add(() => globalThis.clearTimeout(invalidTimer));

    function overlayBody(snapshot: GameRuntimeSnapshot): string {
      if (snapshot.phase === 'ready') {
        return '타워를 고르고 빈 칸을 탭해 적을 막으세요.';
      }
      if (snapshot.phase === 'victory') {
        const best = preferences.bestClearSeconds === null
          ? ''
          : ` · 최고 ${clearTime(preferences.bestClearSeconds)}`;
        return `클리어 ${clearTime(snapshot.elapsedSeconds)}${best}`;
      }
      if (snapshot.phase === 'defeat') {
        return `웨이브 ${Math.min(snapshot.game.wave.index + 1, STAGE_1_WAVES.length)}에서 멈췄어요.`;
      }
      return '';
    }

    function stateOverlayVisible(snapshot: GameRuntimeSnapshot): boolean {
      return snapshot.phase === 'ready'
        || snapshot.phase === 'victory'
        || snapshot.phase === 'defeat';
    }

    function render(): void {
      const snapshot = runtime.getSnapshot();
      if (observedGame !== snapshot.game) {
        observedGame = snapshot.game;
        observedNextProjectileId = snapshot.game.nextProjectileId;
        observedBaseHp = snapshot.game.baseHp;
        observedHitEvents = snapshot.game.hitEvents;
      } else {
        if (snapshot.game.nextProjectileId > observedNextProjectileId) sound.play('shot');
        if (snapshot.game.baseHp < observedBaseHp) sound.play('leak');
        if (
          snapshot.game.hitEvents !== observedHitEvents
          && snapshot.game.hitEvents.length > 0
        ) sound.play('hit');
        observedNextProjectileId = snapshot.game.nextProjectileId;
        observedBaseHp = snapshot.game.baseHp;
        observedHitEvents = snapshot.game.hitEvents;
      }
      const selectedRange = snapshot.selectedTower === null
        ? undefined
        : TOWER_CATALOG[snapshot.selectedTower].range;
      renderer.render(snapshot.game, {
        selectedCell: snapshot.selectedCell,
        selectedRange,
        paused: snapshot.phase === 'paused',
        timeSeconds: snapshot.elapsedSeconds,
      });

      const body = overlayBody(snapshot);
      const overlayKey = `${snapshot.phase}|${body}`;
      if (overlayKey !== lastOverlayKey) {
        lastOverlayKey = overlayKey;
        showStateOverlay(hud, snapshot.phase, body);
      }
      const modalityChanged = focusManager.prepare({
        stateVisible: stateOverlayVisible(snapshot),
        portraitBlocked: snapshot.portraitBlocked,
      });

      const hudKey = [
        snapshot.game.gold,
        snapshot.game.baseHp,
        snapshot.game.wave.index,
        snapshot.phase,
        snapshot.speed,
        preferences.muted,
        snapshot.selectedTower,
        snapshot.portraitBlocked,
      ].join('|');
      if (hudKey !== lastHudKey) {
        lastHudKey = hudKey;
        renderHud(hud, {
          gold: snapshot.game.gold,
          baseHp: snapshot.game.baseHp,
          waveIndex: snapshot.game.wave.index,
          waveCount: STAGE_1_WAVES.length,
          phase: snapshot.phase,
          speed: snapshot.speed,
          muted: preferences.muted,
          portraitBlocked: snapshot.portraitBlocked,
        }, snapshot.selectedTower);
      }
      if (modalityChanged) focusManager.commit();
    }

    const scheduler = createAppScheduler(scope, () => runtime.getSnapshot());
    runtime = createGameRuntime({
      scheduler,
      createGame,
      updateGame,
      render,
      onOutcome(outcome, elapsedSeconds) {
        sound.play(outcome);
        if (outcome === 'victory') preferences = updateBestClear(storage, elapsedSeconds);
      },
    });
    scope.add(() => runtime.destroy());

    function resize(): void {
      const rect = hud.stage.getBoundingClientRect();
      const fallbackWidth = finitePositive(globalThis.innerWidth, 1);
      const fallbackHeight = finitePositive(globalThis.innerHeight, 1);
      const layout = renderer.resize({
        width: finitePositive(rect.width, fallbackWidth),
        height: finitePositive(rect.height, fallbackHeight),
        dpr: finitePositive(globalThis.devicePixelRatio, 1),
      });
      if (hud.orientationPrompt.hidden === layout.showOrientationPrompt) {
        hud.orientationPrompt.hidden = !layout.showOrientationPrompt;
        hud.orientationPrompt.setAttribute('aria-hidden', String(!layout.showOrientationPrompt));
        hud.shell.classList.toggle('game-shell--portrait', layout.showOrientationPrompt);
      }
      const portraitChanged = runtime.getSnapshot().portraitBlocked !== layout.showOrientationPrompt;
      runtime.setPortraitBlocked(layout.showOrientationPrompt);
      if (!portraitChanged) runtime.renderNow();
    }

    function showInvalidPlacement(message: string): void {
      hud.placementStatus.textContent = message;
      hud.stage.classList.remove('game-stage--invalid');
      void hud.stage.offsetWidth;
      hud.stage.classList.add('game-stage--invalid');
      globalThis.clearTimeout(invalidTimer);
      invalidTimer = globalThis.setTimeout(() => {
        hud.stage.classList.remove('game-stage--invalid');
      }, 360);
    }

    function startNewGame(): void {
      globalThis.clearTimeout(invalidTimer);
      hud.stage.classList.remove('game-stage--invalid');
      activePointer = null;
      hud.placementStatus.textContent = '타워를 선택해 주세요.';
      runtime.startGame();
    }

    function unlockAudio(): void {
      void sound.unlock();
    }

    function placeSelectedTower(point: ClientPoint): void {
      const snapshot = runtime.getSnapshot();
      if (
        snapshot.selectedTower === null
        || snapshot.phase !== 'playing'
        || snapshot.portraitBlocked
      ) return;
      const cell = pointerToCell(point, renderer.getLayout(), hud.canvas.getBoundingClientRect());
      if (cell === null) {
        showInvalidPlacement('그리드 안의 빈 칸을 탭해 주세요.');
        return;
      }
      runtime.setSelectedCell(cell);
      const result = placeTower(snapshot.game, snapshot.selectedTower, cell);
      if (!result.ok) {
        showInvalidPlacement(result.reason === 'insufficient-gold'
          ? '골드가 부족해요.'
          : '길이나 사용 중인 칸에는 설치할 수 없어요.');
        runtime.renderNow();
        return;
      }
      hud.placementStatus.textContent = '타워를 설치했어요.';
      sound.play('placement');
      runtime.renderNow();
    }

    scope.listen(hud.stateAction, 'click', () => {
      unlockAudio();
      const phase = runtime.getSnapshot().phase;
      if (phase === 'ready' || phase === 'victory' || phase === 'defeat') startNewGame();
    });
    scope.listen(hud.pauseButton, 'click', () => {
      unlockAudio();
      if (!runtime.getSnapshot().portraitBlocked) runtime.togglePause();
    });
    scope.listen(hud.speedButton, 'click', () => {
      unlockAudio();
      if (!runtime.getSnapshot().portraitBlocked) runtime.toggleSpeed();
    });
    scope.listen(hud.muteButton, 'click', () => {
      unlockAudio();
      if (runtime.getSnapshot().portraitBlocked) return;
      preferences = saveMutedPreference(storage, !preferences.muted);
      sound.setMuted(preferences.muted);
      runtime.renderNow();
    });
    for (const type of TOWER_TYPES) {
      scope.listen(hud.towerButtons[type], 'click', () => {
        unlockAudio();
        const snapshot = runtime.getSnapshot();
        if (snapshot.phase !== 'playing' || snapshot.portraitBlocked) return;
        const selected: TowerType | null = snapshot.selectedTower === type ? null : type;
        runtime.selectTower(selected);
        hud.placementStatus.textContent = selected === null
          ? '타워 선택을 취소했어요.'
          : `${hud.towerButtons[type].textContent?.trim() ?? '타워'} 선택`;
      });
    }
    scope.listen(hud.canvas, 'pointerdown', (event) => {
      unlockAudio();
      const pointer = event as PointerEvent;
      const snapshot = runtime.getSnapshot();
      if (
        snapshot.phase !== 'playing'
        || snapshot.selectedTower === null
        || snapshot.portraitBlocked
      ) return;
      activePointer = { id: pointer.pointerId, start: { x: pointer.clientX, y: pointer.clientY } };
      try {
        hud.canvas.setPointerCapture(pointer.pointerId);
      } catch {
        // Pointer capture is optional on older embedded browsers.
      }
    });
    scope.listen(hud.canvas, 'pointerup', (event) => {
      const pointer = event as PointerEvent;
      const active = activePointer;
      activePointer = null;
      if (active === null || active.id !== pointer.pointerId) return;
      const end = { x: pointer.clientX, y: pointer.clientY };
      if (isTapGesture(active.start, end)) placeSelectedTower(end);
    });
    scope.listen(hud.canvas, 'pointercancel', () => {
      activePointer = null;
    });
    scope.listen(globalThis, 'resize', resize as EventListener, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(resize);
      scope.add(() => observer.disconnect());
      observer.observe(hud.stage);
    }

    resize();
    runtime.startFrames();

    return { destroy: () => scope.dispose() };
  });
}
