import { loadGameAssets, type GameAssets } from '../game/render/assetLoader';
import { SoundEngine } from '../game/audio/SoundEngine';
import { createCanvasRenderer, type CanvasRenderer } from '../game/render/canvasRenderer';
import {
  createFrameEventBuffer,
  createGoldPop,
  effectsForHits,
  effectsForTraits,
  slowPulseEffects,
  updateEffects,
  type RuntimeEffect,
} from '../game/render/effects';
import { createGame } from '../game/simulation/createGame';
import { placeTower, validateTowerPlacement } from '../game/simulation/placeTower';
import { updateGame as updateSimulation } from '../game/simulation/updateGame';
import {
  ALL_STAGE_KEYS,
  getStageDefinition,
} from '../game/stages/stageCatalog';
import {
  GAME_MODES,
  stageKey,
  stageRef,
  type GameMode,
  type StageKey,
} from '../game/stages/stageIdentity';
import { TOWER_CATALOG, TOWER_TYPES, type TowerType } from '../game/towers/towerCatalog';
import { calculateGameScore } from '../game/scoring';
import { createBaseHitFeedback } from './baseHitFeedback';
import {
  createGameRuntime,
  type AnimationFrameScheduler,
  type GameRuntime,
  type GameRuntimeSnapshot,
} from './gameRuntime';
import {
  createHud,
  createModalFocusManager,
  renderStagePicker,
  renderResultPanel,
  renderHud,
  renderTowerInspection,
  renderTowerTrayPosition,
  renderTraitNotice,
  showPlacementActions,
  showStateOverlay,
  stageActionLabel,
} from './hud';
import { isTapGesture, pointerToCell, type ClientPoint } from './input';
import { guardInitialization, LifecycleScope } from './lifecycle';
import {
  browserPreferenceStorage,
  isStageUnlocked,
  loadPreferences,
  recordAttempt,
  recordOutcome,
  saveMutedPreference,
  saveTowerTrayPositionPreference,
  stageRecordFor,
} from './preferences';
import {
  createTraitNoticeState,
  traitNoticeView,
  updateTraitNoticeState,
} from './traitNotice';
import { createTransientMessageController } from './transientMessage';
import { towerAtCell, towerById } from './towerInspection';

export type GameApp = Readonly<{
  destroy(): void;
}>;

type ActivePointer = Readonly<{ id: number; start: ClientPoint }>;

const EMPTY_DIRECTIONS = { ne: null, se: null, sw: null, nw: null } as const;
const EMPTY_ASSETS: GameAssets = {
  map: {
    grass: null,
    roadHorizontal: null,
    roadVertical: null,
    roadNorthEast: null,
    roadEastSouth: null,
    roadSouthWest: null,
    roadWestNorth: null,
    entry: null,
    snackChest: null,
  },
  towers: { arrow: EMPTY_DIRECTIONS, deokbae: null, huchu: null, slow: null },
  enemies: {
    slime: EMPTY_DIRECTIONS,
    fairy: EMPTY_DIRECTIONS,
    orc: EMPTY_DIRECTIONS,
    golem: EMPTY_DIRECTIONS,
    minotaur: EMPTY_DIRECTIONS,
    shadowSlime: EMPTY_DIRECTIONS,
    vampireBat: EMPTY_DIRECTIONS,
    skeletonKnight: EMPTY_DIRECTIONS,
    obsidianGolem: EMPTY_DIRECTIONS,
    lichKing: EMPTY_DIRECTIONS,
  },
  motion: {
    orc: null,
    fairy: null,
    shadowSlime: null,
    vampireBat: null,
    skeletonKnight: null,
    obsidianGolem: null,
    lichKing: null,
  },
  vfx: {
    arrow: null,
    fireball: null,
    waterball: null,
    arrowImpact: null,
    fireBurst: null,
    aquaBurst: null,
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
  maxEnemyProgress: number;
  damagedEnemyCount: number;
  baseHp: number;
  gold: number;
  towerCells: ReadonlyArray<Readonly<{ col: number; row: number }>>;
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
        maxEnemyProgress: snapshot.game.enemies.reduce(
          (maximum, enemy) => Math.max(maximum, enemy.progress),
          0,
        ),
        damagedEnemyCount: snapshot.game.enemies.filter((enemy) => enemy.hp < enemy.maxHp).length,
        baseHp: snapshot.game.baseHp,
        gold: snapshot.game.gold,
        towerCells: snapshot.game.towers.map(({ cell }) => ({ ...cell })),
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
    renderTowerTrayPosition(hud, preferences.towerTrayPosition);
    const highestNightmareStage = preferences.highestUnlockedByMode.nightmare;
    let selectedStageKey: StageKey = highestNightmareStage !== 0
      ? stageKey('nightmare', highestNightmareStage)
      : stageKey('normal', preferences.highestUnlockedByMode.normal);
    let activeMode: GameMode = stageRef(selectedStageKey).mode;
    let pickerNotice = '';
    let activePointer: ActivePointer | null = null;
    let invalidTimer = 0;
    let lastHudKey = '';
    let lastOverlayKey = '';
    let runtime: GameRuntime;
    let renderedGame: GameRuntimeSnapshot['game'] | null = null;
    let effects: RuntimeEffect[] = [];
    let lastEffectTimeSeconds = 0;
    let lastRenderedGold = 0;
    let newBestScore = false;
    let newBadge = false;
    let traitNoticeState = createTraitNoticeState(selectedStageKey);
    const frameEvents = createFrameEventBuffer();
    const renderer = await createRendererWithFallback(hud.canvas);
    const reducedMotionQuery = typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    const sound = new SoundEngine();
    sound.setMuted(preferences.muted);
    scope.add(() => { void sound.destroy(); });
    const placementMessage = createTransientMessageController(hud.placementStatus);
    scope.add(() => placementMessage.destroy());
    const baseHitFeedback = createBaseHitFeedback(hud.shell);
    scope.add(() => baseHitFeedback.destroy());

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
      if (pickerNotice !== '') return pickerNotice;
      if (snapshot.phase === 'ready') {
        return '스테이지를 고르고 게임 시작을 눌러 주세요.';
      }
      if (snapshot.phase === 'victory') {
        return '기록을 확인하고 다음 도전을 선택해 주세요.';
      }
      if (snapshot.phase === 'defeat') {
        return '기록을 확인하고 다시 도전할 스테이지를 골라 주세요.';
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
      const stage = getStageDefinition(snapshot.game.stageKey);
      if (renderedGame !== snapshot.game) {
        renderedGame = snapshot.game;
        effects = [];
        lastEffectTimeSeconds = snapshot.elapsedSeconds;
        lastRenderedGold = snapshot.game.gold;
        frameEvents.reset();
      }
      const frame = frameEvents.peek();
      if (frame.cueTypes.includes('leak')) baseHitFeedback.trigger();
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
      const effectDelta = Math.max(0, snapshot.elapsedSeconds - lastEffectTimeSeconds);
      const nextEffects = [
        ...updateEffects(effects, effectDelta),
        ...effectsForHits(frame.hitEvents),
        ...effectsForTraits(frame.traitEvents),
      ];
      const earnedGold = snapshot.game.gold - lastRenderedGold;
      const lastHitPosition = frame.hitEvents.at(-1)?.position;
      if (earnedGold > 0 && lastHitPosition !== undefined) {
        const gold = createGoldPop(lastHitPosition, earnedGold);
        if (gold !== null) nextEffects.push(gold);
      }
      const placementValidation = snapshot.selectedTower === null || snapshot.selectedCell === null
        ? null
        : validateTowerPlacement(snapshot.game, snapshot.selectedTower, snapshot.selectedCell);
      const inspectedTower = snapshot.inspectedTowerId === null
        ? null
        : towerById(snapshot.game.towers, snapshot.inspectedTowerId);
      const placingTower = snapshot.selectedTower !== null && snapshot.selectedCell !== null;
      const mapSelectedCell = placingTower
        ? snapshot.selectedCell
        : inspectedTower?.cell ?? null;
      const selectedRange = placingTower && snapshot.selectedTower !== null
        ? TOWER_CATALOG[snapshot.selectedTower].range
        : inspectedTower === null
          ? undefined
          : TOWER_CATALOG[inspectedTower.type].range;
      const placementGuideCells = snapshot.selectedTower !== null
        && snapshot.phase === 'playing'
        && !snapshot.portraitBlocked
        ? stage.map.buildableCells(snapshot.game.towers.map((tower) => tower.cell))
        : undefined;
      renderer.render(snapshot.game, {
        placementGuideCells,
        selectedCell: mapSelectedCell,
        selectedRange,
        selectedValid: placementValidation?.ok,
        previewTower: snapshot.selectedTower === null || snapshot.selectedCell === null
          ? null
          : {
            type: snapshot.selectedTower,
            cell: snapshot.selectedCell,
            valid: placementValidation?.ok ?? false,
          },
        paused: snapshot.phase === 'paused',
        timeSeconds: snapshot.elapsedSeconds,
        effects: [
          ...nextEffects,
          ...slowPulseEffects(snapshot.game.towers, snapshot.elapsedSeconds),
        ],
        reducedMotion: reducedMotionQuery?.matches === true,
      });
      sound.syncMusic({
        mode: stage.mode,
        active: snapshot.phase === 'playing' || snapshot.phase === 'paused',
        bossActive: snapshot.game.bossSpawnedAtSeconds !== null,
        ducked: snapshot.phase === 'paused' || snapshot.portraitBlocked,
      });
      for (const cue of frame.cueTypes) sound.play(cue);
      effects = nextEffects;
      lastEffectTimeSeconds = snapshot.elapsedSeconds;
      lastRenderedGold = snapshot.game.gold;
      frameEvents.clear();

      const body = overlayBody(snapshot);
      const pickerVisible = stateOverlayVisible(snapshot);
      renderStagePicker(
        hud,
        activeMode,
        selectedStageKey,
        preferences,
        pickerVisible,
      );
      const overlayKey = [
        snapshot.phase,
        body,
        snapshot.game.stageKey,
        selectedStageKey,
        activeMode,
        preferences.highestUnlockedByMode.normal,
        preferences.highestUnlockedByMode.nightmare,
      ].join('|');
      if (overlayKey !== lastOverlayKey) {
        lastOverlayKey = overlayKey;
        showStateOverlay(
          hud,
          snapshot.phase,
          body,
          stageActionLabel(snapshot.phase, snapshot.game.stageKey, selectedStageKey),
        );
        if (snapshot.phase === 'victory' || snapshot.phase === 'defeat') {
          const stageRecord = stageRecordFor(preferences, snapshot.game.stageKey);
          const score = calculateGameScore(
            snapshot.game,
            snapshot.game.outcome,
            snapshot.elapsedSeconds,
          );
          renderResultPanel(hud, {
            modeLabel: stage.mode === 'nightmare' ? '나이트메어' : '노멀',
            stageName: stage.name,
            score: score.total,
            stars: score.stars,
            newBestScore,
            newBadge,
            completedWaves: snapshot.game.stats.completedWaves,
            defeatedEnemies: snapshot.game.stats.defeatedEnemies,
            combatScore: score.breakdown.combatScore,
            baseHp: snapshot.game.baseHp,
            bossDefeated: snapshot.game.stats.bossDefeated,
            elapsedText: clearTime(snapshot.elapsedSeconds),
            timeBonus: score.breakdown.timeBonus,
            difficultyBonus: score.breakdown.difficultyBonus,
            bestScore: stageRecord.bestScore,
            bestClearText: stageRecord.bestClearSeconds === null
              ? '--:--'
              : clearTime(stageRecord.bestClearSeconds),
            firstClearText: stageRecord.firstClearSeconds === null
              ? '--:--'
              : clearTime(stageRecord.firstClearSeconds),
            targetClearText: `${clearTime(stage.targetClearSeconds.min)}~${clearTime(stage.targetClearSeconds.max)}`,
            totalAttempts: preferences.totalAttempts,
            totalVictories: preferences.totalVictories,
            nextGoalText: score.nextStarScore === null
              ? '최고 등급 달성! 더 빠른 클리어에 도전해 보세요.'
              : `별 하나를 더 받으려면 ${Math.max(0, score.nextStarScore - score.total).toLocaleString('ko-KR')}점이 필요해요.`,
          });
        } else {
          renderResultPanel(hud, null);
        }
      }
      const modalityChanged = focusManager.prepare({
        stateVisible: stateOverlayVisible(snapshot),
        portraitBlocked: snapshot.portraitBlocked,
      });

      const hudKey = [
        snapshot.game.stageKey,
        snapshot.game.gold,
        snapshot.game.baseHp,
        snapshot.game.wave.index,
        snapshot.phase,
        snapshot.speed,
        preferences.muted,
        snapshot.selectedTower,
        snapshot.selectedCell?.col ?? '',
        snapshot.selectedCell?.row ?? '',
        snapshot.inspectedTowerId ?? '',
        snapshot.portraitBlocked,
      ].join('|');
      if (hudKey !== lastHudKey) {
        lastHudKey = hudKey;
        renderHud(hud, {
          stageKey: snapshot.game.stageKey,
          gold: snapshot.game.gold,
          baseHp: snapshot.game.baseHp,
          waveIndex: snapshot.game.wave.index,
          waveCount: stage.waves.length,
          phase: snapshot.phase,
          speed: snapshot.speed,
          muted: preferences.muted,
          portraitBlocked: snapshot.portraitBlocked,
        }, snapshot.selectedTower);
        showPlacementActions(
          hud,
          snapshot.selectedTower,
          snapshot.selectedCell !== null && placementValidation?.ok === true,
        );
        renderTowerInspection(hud, inspectedTower?.type ?? null);
      }
      if (modalityChanged) focusManager.commit();
    }

    const scheduler = createAppScheduler(scope, () => runtime.getSnapshot());
    runtime = createGameRuntime({
      scheduler,
      createGame: () => createGame(selectedStageKey),
      updateGame(game, deltaSeconds) {
        const nextProjectileId = game.nextProjectileId;
        const baseHp = game.baseHp;
        updateSimulation(game, deltaSeconds);
        frameEvents.recordStep({
          hitEvents: game.hitEvents,
          traitEvents: game.traitEvents,
          shot: game.nextProjectileId > nextProjectileId,
          leak: game.baseHp < baseHp,
        });
      },
      render,
      onOutcome(outcome, elapsedSeconds) {
        const game = runtime.getSnapshot().game;
        sound.syncMusic({
          mode: stageRef(game.stageKey).mode,
          active: false,
          bossActive: game.bossSpawnedAtSeconds !== null,
          ducked: false,
        });
        sound.play(outcome);
        const score = calculateGameScore(game, outcome, elapsedSeconds);
        const recorded = recordOutcome(storage, {
          stageKey: game.stageKey,
          score: score.total,
          stars: score.stars,
          bossDefeated: game.stats.bossDefeated,
          victory: outcome === 'victory',
          elapsedSeconds,
        }, preferences);
        preferences = recorded.preferences;
        newBestScore = recorded.newBestScore;
        newBadge = recorded.newBadge;
        if (outcome === 'victory') {
          selectedStageKey = recorded.unlockedStageKey ?? game.stageKey;
          activeMode = stageRef(selectedStageKey).mode;
        }
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
      placementMessage.show(message);
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
      placementMessage.show('타워를 선택해 주세요.');
      preferences = recordAttempt(storage, preferences);
      runtime.startGame();
    }

    function unlockAudio(): void {
      void sound.unlock();
    }

    function previewSelectedTower(point: ClientPoint): void {
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
      const result = validateTowerPlacement(snapshot.game, snapshot.selectedTower, cell);
      if (!result.ok) {
        showInvalidPlacement(result.reason === 'insufficient-gold'
          ? '골드가 부족해요.'
          : '길에 맞닿은 빈 칸에만 설치할 수 있어요.');
        runtime.renderNow();
        return;
      }
      placementMessage.show('사거리를 확인하고 배치 또는 취소를 눌러 주세요.');
      runtime.renderNow();
    }

    function inspectTowerAt(point: ClientPoint): void {
      const snapshot = runtime.getSnapshot();
      if (
        (snapshot.phase !== 'playing' && snapshot.phase !== 'paused')
        || snapshot.selectedTower !== null
        || snapshot.portraitBlocked
      ) return;
      const cell = pointerToCell(point, renderer.getLayout(), hud.canvas.getBoundingClientRect());
      const tower = cell === null ? null : towerAtCell(snapshot.game.towers, cell);
      runtime.inspectTower(tower?.id ?? null);
    }

    function confirmPlacement(): void {
      const snapshot = runtime.getSnapshot();
      if (
        snapshot.selectedTower === null
        || snapshot.selectedCell === null
        || snapshot.phase !== 'playing'
        || snapshot.portraitBlocked
      ) return;
      const result = placeTower(snapshot.game, snapshot.selectedTower, snapshot.selectedCell);
      if (!result.ok) {
        showInvalidPlacement(result.reason === 'insufficient-gold'
          ? '골드가 부족해요.'
          : '이 칸에는 더 이상 설치할 수 없어요.');
        runtime.renderNow();
        return;
      }
      placementMessage.show('타워를 설치했어요. 같은 타워를 계속 배치할 수 있어요.');
      sound.play('placement');
      runtime.setSelectedCell(null);
      runtime.renderNow();
    }

    function cancelPlacement(): void {
      runtime.setSelectedCell(null);
      placementMessage.show('배치를 취소했어요. 다른 칸을 선택할 수 있어요.');
    }

    scope.listen(hud.stateAction, 'click', () => {
      unlockAudio();
      const phase = runtime.getSnapshot().phase;
      if (phase === 'ready' || phase === 'victory' || phase === 'defeat') startNewGame();
    });
    for (const mode of GAME_MODES) {
      scope.listen(hud.modeTabs[mode], 'click', () => {
        const phase = runtime.getSnapshot().phase;
        if (
          phase !== 'ready'
          && phase !== 'victory'
          && phase !== 'defeat'
        ) return;
        if (mode === 'nightmare' && preferences.highestUnlockedByMode.nightmare === 0) {
          pickerNotice = '노멀 6을 클리어하면 열려요.';
          runtime.renderNow();
          return;
        }
        pickerNotice = '';
        activeMode = mode;
        selectedStageKey = mode === 'normal'
          ? stageKey('normal', preferences.highestUnlockedByMode.normal)
          : stageKey('nightmare', preferences.highestUnlockedByMode.nightmare || 1);
        runtime.renderNow();
      });
    }
    for (const key of ALL_STAGE_KEYS) {
      scope.listen(hud.stageButtons[key], 'click', () => {
        const phase = runtime.getSnapshot().phase;
        if (
          phase !== 'ready'
          && phase !== 'victory'
          && phase !== 'defeat'
        ) return;
        if (!isStageUnlocked(preferences, key)) return;
        pickerNotice = '';
        selectedStageKey = key;
        activeMode = stageRef(key).mode;
        runtime.renderNow();
      });
    }
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
      preferences = saveMutedPreference(storage, !preferences.muted, preferences);
      sound.setMuted(preferences.muted);
      runtime.renderNow();
    });
    scope.listen(hud.towerTrayPositionButton, 'click', () => {
      const nextPosition = preferences.towerTrayPosition === 'bottom'
        ? 'top'
        : 'bottom';
      preferences = saveTowerTrayPositionPreference(
        storage,
        nextPosition,
        preferences,
      );
      renderTowerTrayPosition(hud, preferences.towerTrayPosition);
    });
    scope.listen(hud.placementConfirm, 'click', () => {
      unlockAudio();
      confirmPlacement();
    });
    scope.listen(hud.placementCancel, 'click', cancelPlacement);
    scope.listen(hud.towerInspectionClose, 'click', () => runtime.inspectTower(null));
    for (const type of TOWER_TYPES) {
      scope.listen(hud.towerButtons[type], 'click', () => {
        unlockAudio();
        const snapshot = runtime.getSnapshot();
        if (snapshot.phase !== 'playing' || snapshot.portraitBlocked) return;
        const selected: TowerType | null = snapshot.selectedTower === type ? null : type;
        runtime.selectTower(selected);
        placementMessage.show(selected === null
          ? '타워 선택을 취소했어요.'
          : `${hud.towerButtons[type].textContent?.trim() ?? '타워'} 선택`);
      });
    }
    scope.listen(hud.canvas, 'pointerdown', (event) => {
      unlockAudio();
      const pointer = event as PointerEvent;
      const snapshot = runtime.getSnapshot();
      const canPlace = snapshot.phase === 'playing' && snapshot.selectedTower !== null;
      const canInspect = (snapshot.phase === 'playing' || snapshot.phase === 'paused')
        && snapshot.selectedTower === null;
      if (snapshot.portraitBlocked || (!canPlace && !canInspect)) return;
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
      if (!isTapGesture(active.start, end)) return;
      if (runtime.getSnapshot().selectedTower === null) inspectTowerAt(end);
      else previewSelectedTower(end);
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
