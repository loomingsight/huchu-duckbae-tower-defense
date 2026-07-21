import type {
  GameEnemy,
  GameHitEvent,
  GameProjectile,
  GameTower,
  Outcome,
  WaveState,
} from '../simulation/createGame';
import type { Cell } from '../types';
import type { GameAssets } from './assetLoader';
import { drawEntities, type TowerPreview } from './drawEntities';
import {
  drawBossPresentation,
  drawForegroundEffects,
  drawGroundEffects,
  drawPauseOverlay,
  type FloatingGold,
} from './drawEffects';
import { drawMap } from './drawMap';
import type { RuntimeEffect } from './effects';
import {
  computeCanvasLayout,
  type CanvasLayout,
  type Viewport,
} from './layout';

export type GameSnapshot = {
  readonly gold: number;
  readonly baseHp: number;
  readonly outcome: Outcome;
  readonly enemies: readonly Readonly<GameEnemy>[];
  readonly towers: readonly Readonly<GameTower>[];
  readonly projectiles: readonly Readonly<GameProjectile>[];
  readonly hitEvents: readonly Readonly<GameHitEvent>[];
  readonly wave: Readonly<WaveState>;
  readonly bossSpawnedAtSeconds?: number | null;
};

export type RenderOptions = {
  readonly placementGuideCells?: readonly Readonly<Cell>[];
  readonly selectedCell?: Readonly<Cell> | null;
  readonly selectedRange?: number;
  readonly selectedValid?: boolean;
  readonly previewTower?: TowerPreview | null;
  readonly paused?: boolean;
  readonly timeSeconds?: number;
  readonly floatingGold?: readonly FloatingGold[];
  readonly effects?: readonly RuntimeEffect[];
};

export type CanvasRenderer = {
  resize(viewport: Viewport): CanvasLayout;
  render(snapshot: GameSnapshot, options?: RenderOptions): void;
  getLayout(): CanvasLayout;
};

function initialViewport(canvas: HTMLCanvasElement): Viewport {
  return {
    width: canvas.clientWidth || canvas.width || 1,
    height: canvas.clientHeight || canvas.height || 1,
    dpr: globalThis.devicePixelRatio ?? 1,
  };
}

function canvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Canvas 2D context is unavailable');
  return context;
}

export function createCanvasRenderer(
  canvas: HTMLCanvasElement,
  assets: GameAssets,
): CanvasRenderer {
  const context = canvasContext(canvas);
  let layout = computeCanvasLayout(initialViewport(canvas));

  function resize(viewport: Viewport): CanvasLayout {
    layout = computeCanvasLayout(viewport);
    canvas.width = layout.backingWidth;
    canvas.height = layout.backingHeight;
    canvas.style.width = `${layout.viewport.width}px`;
    canvas.style.height = `${layout.viewport.height}px`;
    return layout;
  }

  function render(snapshot: GameSnapshot, options: RenderOptions = {}): void {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
    context.imageSmoothingEnabled = true;
    context.fillStyle = '#20362c';
    context.fillRect(0, 0, layout.viewport.width, layout.viewport.height);

    context.save();
    context.beginPath();
    context.rect(
      layout.gameArea.x,
      layout.gameArea.y,
      layout.gameArea.width,
      layout.gameArea.height,
    );
    context.clip();
    drawMap(context, layout, assets, {
      buildableCells: options.placementGuideCells,
      cell: options.selectedCell,
      range: options.selectedRange,
      valid: options.selectedValid,
    });
    const timeSeconds = Number.isFinite(options.timeSeconds) ? options.timeSeconds ?? 0 : 0;
    const effects = options.effects ?? [];
    drawGroundEffects(context, layout, effects);
    drawEntities(context, layout, snapshot, assets, {
      timeSeconds,
      previewTower: options.previewTower,
    });
    drawForegroundEffects(
      context,
      layout,
      snapshot,
      options.floatingGold ?? [],
      effects,
      assets,
      timeSeconds,
    );
    drawBossPresentation(context, layout, snapshot.bossSpawnedAtSeconds, timeSeconds);
    if (options.paused === true) drawPauseOverlay(context, layout);
    context.restore();

  }

  resize(initialViewport(canvas));
  return { resize, render, getLayout: () => layout };
}
