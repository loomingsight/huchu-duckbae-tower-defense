import { createFixedStepLoop, type FixedStepLoop } from '../game/core/fixedStepLoop';
import { loadGameAssets, type GameAssets } from '../game/render/assetLoader';
import { createCanvasRenderer, type CanvasRenderer } from '../game/render/canvasRenderer';
import { createGame } from '../game/simulation/createGame';
import { placeTower } from '../game/simulation/placeTower';
import { updateGame } from '../game/simulation/updateGame';
import { TOWER_CATALOG, TOWER_TYPES, type TowerType } from '../game/towers/towerCatalog';
import { STAGE_1_WAVES } from '../game/waves/stage1Waves';
import type { Cell } from '../game/types';
import {
  createHud,
  renderHud,
  showStateOverlay,
  type GamePhase,
  type GameSpeed,
} from './hud';
import { isTapGesture, pointerToCell, type ClientPoint } from './input';
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

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clearTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const remaining = Math.floor(safe % 60);
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

export async function mountGameApp(root: HTMLElement): Promise<GameApp> {
  const hud = createHud(root);
  const storage = browserPreferenceStorage();
  let preferences = loadPreferences(storage);
  let phase: GamePhase = 'loading';
  let speed: GameSpeed = 1;
  let selectedTower: TowerType | null = null;
  let selectedCell: Cell | null = null;
  let activePointer: ActivePointer | null = null;
  let game = createGame();
  let elapsedSeconds = 0;
  let renderer: CanvasRenderer | null = null;
  let loop: FixedStepLoop | null = null;
  let animationFrame = 0;
  let lastFrameMs: number | null = null;
  let invalidTimer = 0;
  let destroyed = false;
  let resizeObserver: ResizeObserver | null = null;
  const removeListeners: Array<() => void> = [];

  function listen(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler, options);
    removeListeners.push(() => target.removeEventListener(type, handler, options));
  }

  function renderStateOverlay(): void {
    if (phase === 'loading') {
      showStateOverlay(hud, phase, '캐릭터를 불러오고 있어요.');
    } else if (phase === 'ready') {
      showStateOverlay(hud, phase, '타워를 고르고 빈 칸을 탭해 적을 막으세요.');
    } else if (phase === 'victory') {
      const best = preferences.bestClearSeconds === null
        ? ''
        : ` · 최고 ${clearTime(preferences.bestClearSeconds)}`;
      showStateOverlay(hud, phase, `클리어 ${clearTime(elapsedSeconds)}${best}`);
    } else if (phase === 'defeat') {
      showStateOverlay(hud, phase, `웨이브 ${Math.min(game.wave.index + 1, STAGE_1_WAVES.length)}에서 멈췄어요.`);
    } else {
      showStateOverlay(hud, phase);
    }
  }

  function render(): void {
    if (renderer === null) return;
    const selectedRange = selectedTower === null ? undefined : TOWER_CATALOG[selectedTower].range;
    renderer.render(game, {
      selectedCell,
      selectedRange,
      paused: phase === 'paused',
      timeSeconds: elapsedSeconds,
    });
    renderHud(hud, {
      gold: game.gold,
      baseHp: game.baseHp,
      waveIndex: game.wave.index,
      waveCount: STAGE_1_WAVES.length,
      phase,
      speed,
      muted: preferences.muted,
    }, selectedTower);
    renderStateOverlay();
  }

  function finishGame(): void {
    if (game.outcome === 'victory') {
      phase = 'victory';
      preferences = updateBestClear(storage, elapsedSeconds);
    } else if (game.outcome === 'defeat') {
      phase = 'defeat';
    }
  }

  function createLoop(): FixedStepLoop {
    return createFixedStepLoop({
      update(deltaSeconds) {
        if (phase !== 'playing') return;
        updateGame(game, deltaSeconds);
        elapsedSeconds += deltaSeconds;
        if (game.outcome !== 'playing') finishGame();
      },
      render,
    });
  }

  function startNewGame(): void {
    globalThis.clearTimeout(invalidTimer);
    hud.stage.classList.remove('game-stage--invalid');
    game = createGame();
    elapsedSeconds = 0;
    speed = 1;
    selectedTower = null;
    selectedCell = null;
    activePointer = null;
    phase = 'playing';
    loop = createLoop();
    hud.placementStatus.textContent = '타워를 선택해 주세요.';
    render();
  }

  function resize(): void {
    if (renderer === null || destroyed) return;
    const rect = hud.stage.getBoundingClientRect();
    const fallbackWidth = finitePositive(globalThis.innerWidth, 1);
    const fallbackHeight = finitePositive(globalThis.innerHeight, 1);
    const layout = renderer.resize({
      width: finitePositive(rect.width, fallbackWidth),
      height: finitePositive(rect.height, fallbackHeight),
      dpr: finitePositive(globalThis.devicePixelRatio, 1),
    });
    hud.orientationPrompt.hidden = !layout.showOrientationPrompt;
    hud.orientationPrompt.setAttribute('aria-hidden', String(!layout.showOrientationPrompt));
    hud.shell.classList.toggle('game-shell--portrait', layout.showOrientationPrompt);
    render();
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

  function placeSelectedTower(point: ClientPoint): void {
    if (renderer === null || selectedTower === null || phase !== 'playing') return;
    const cell = pointerToCell(point, renderer.getLayout(), hud.canvas.getBoundingClientRect());
    if (cell === null) {
      showInvalidPlacement('그리드 안의 빈 칸을 탭해 주세요.');
      return;
    }
    selectedCell = cell;
    const result = placeTower(game, selectedTower, cell);
    if (!result.ok) {
      showInvalidPlacement(result.reason === 'insufficient-gold'
        ? '골드가 부족해요.'
        : '길이나 사용 중인 칸에는 설치할 수 없어요.');
      render();
      return;
    }
    hud.placementStatus.textContent = '타워를 설치했어요.';
    render();
  }

  listen(hud.stateAction, 'click', () => {
    if (phase === 'ready' || phase === 'victory' || phase === 'defeat') startNewGame();
  });
  listen(hud.pauseButton, 'click', () => {
    if (phase === 'playing') phase = 'paused';
    else if (phase === 'paused') phase = 'playing';
    render();
  });
  listen(hud.speedButton, 'click', () => {
    if (phase !== 'playing' && phase !== 'paused') return;
    speed = speed === 1 ? 2 : 1;
    render();
  });
  listen(hud.muteButton, 'click', () => {
    preferences = saveMutedPreference(storage, !preferences.muted);
    render();
  });
  for (const type of TOWER_TYPES) {
    listen(hud.towerButtons[type], 'click', () => {
      if (phase !== 'playing') return;
      selectedTower = selectedTower === type ? null : type;
      if (selectedTower === null) selectedCell = null;
      hud.placementStatus.textContent = selectedTower === null
        ? '타워 선택을 취소했어요.'
        : `${hud.towerButtons[type].textContent?.trim() ?? '타워'} 선택`;
      render();
    });
  }
  listen(hud.canvas, 'pointerdown', (event) => {
    const pointer = event as PointerEvent;
    if (phase !== 'playing' || selectedTower === null) return;
    activePointer = { id: pointer.pointerId, start: { x: pointer.clientX, y: pointer.clientY } };
    try {
      hud.canvas.setPointerCapture(pointer.pointerId);
    } catch {
      // Pointer capture is optional on older embedded browsers.
    }
  });
  listen(hud.canvas, 'pointerup', (event) => {
    const pointer = event as PointerEvent;
    const active = activePointer;
    activePointer = null;
    if (active === null || active.id !== pointer.pointerId) return;
    const end = { x: pointer.clientX, y: pointer.clientY };
    if (isTapGesture(active.start, end)) placeSelectedTower(end);
  });
  listen(hud.canvas, 'pointercancel', () => {
    activePointer = null;
  });
  listen(globalThis, 'resize', resize as EventListener, { passive: true });

  try {
    const assets = await loadGameAssets();
    if (destroyed) return { destroy() {} };
    renderer = createCanvasRenderer(hud.canvas, assets);
  } catch {
    if (destroyed) return { destroy() {} };
    renderer = createCanvasRenderer(hud.canvas, EMPTY_ASSETS);
    hud.placementStatus.textContent = '일부 그림 대신 간단한 표시로 진행해요.';
  }

  phase = 'ready';
  loop = createLoop();
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(hud.stage);
  }
  resize();

  function frame(timestampMs: number): void {
    if (destroyed) return;
    const safeTimestamp = Number.isFinite(timestampMs) ? timestampMs : (lastFrameMs ?? 0);
    const deltaSeconds = lastFrameMs === null ? 0 : Math.max(0, (safeTimestamp - lastFrameMs) / 1000);
    lastFrameMs = safeTimestamp;
    loop?.tick(phase === 'playing' ? deltaSeconds * speed : 0);
    animationFrame = globalThis.requestAnimationFrame(frame);
  }
  animationFrame = globalThis.requestAnimationFrame(frame);

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      globalThis.cancelAnimationFrame(animationFrame);
      globalThis.clearTimeout(invalidTimer);
      resizeObserver?.disconnect();
      for (const remove of removeListeners) remove();
    },
  };
}
