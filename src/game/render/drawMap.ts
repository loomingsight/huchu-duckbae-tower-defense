import { cellCenter } from '../core/geometry';
import type { StageMap } from '../map/createStageMap';
import type { StageDefinition } from '../stages/stageCatalog';
import {
  NIGHTMARE_THEME_IDS,
  NORMAL_THEME_IDS,
  type StageThemeId,
} from '../stages/stageIdentity';
import type { Cell } from '../types';
import type { GameAssets, LoadedSprite } from './assetLoader';
import type { CanvasLayout } from './layout';
import {
  projectCellPolygon,
  projectWorldPoint,
  projectWorldRing,
  visualScaleAt,
  type ScreenPoint,
} from './projection';
import { drawSpriteFrame } from './spriteSheet';

type StagePalette = Readonly<{
  ground: string;
  land: string;
  alternate: string;
  road: string;
  boardSide: string;
}>;

type NormalThemeId = (typeof NORMAL_THEME_IDS)[number];
type NightmareThemeId = (typeof NIGHTMARE_THEME_IDS)[number];

export const NORMAL_PALETTES: Readonly<Record<NormalThemeId, StagePalette>> = {
  sunnyField: {
    ground: '#17382f', land: '#4f8c65', alternate: '#5d9a70', road: '#e4c99f',
    boardSide: '#2f6247',
  },
  windingStream: {
    ground: '#143b38', land: '#478c70', alternate: '#569b7d', road: '#d8cba8',
    boardSide: '#285f50',
  },
  windyHill: {
    ground: '#21412d', land: '#6d9e62', alternate: '#79aa6c', road: '#ead4aa',
    boardSide: '#3c6846',
  },
  orcCanyon: {
    ground: '#2c3522', land: '#687244', alternate: '#747e4b', road: '#c6a47b',
    boardSide: '#4e542f',
  },
  golemQuarry: {
    ground: '#2a3631', land: '#65786a', alternate: '#718376', road: '#b9b3a1',
    boardSide: '#46534a',
  },
  minotaurGate: {
    ground: '#1d3324', land: '#496b4a', alternate: '#557953', road: '#d6bc82',
    boardSide: '#3a5538',
  },
};

export const NIGHTMARE_PALETTES: Readonly<Record<NightmareThemeId, StagePalette>> = {
  moonlitSwamp: {
    ground: '#0f1728', land: '#18243a', alternate: '#1d3040', road: '#485064',
    boardSide: '#0b1120',
  },
  rottenForest: {
    ground: '#111914', land: '#243326', alternate: '#2b3b2a', road: '#51534b',
    boardSide: '#0d130f',
  },
  ashenRuins: {
    ground: '#171719', land: '#343438', alternate: '#3b3b40', road: '#625f62',
    boardSide: '#111113',
  },
  bloodRavine: {
    ground: '#211012', land: '#482326', alternate: '#54282d', road: '#6a4a49',
    boardSide: '#180b0d',
  },
  obsidianMine: {
    ground: '#100f15', land: '#28242e', alternate: '#302936', road: '#554b58',
    boardSide: '#0b0a0f',
  },
  abyssGate: {
    ground: '#0c0714', land: '#241530', alternate: '#2d193d', road: '#4a3a58',
    boardSide: '#08040d',
  },
};

export const STAGE_PALETTES: Readonly<Record<StageThemeId, StagePalette>> = {
  ...NORMAL_PALETTES,
  ...NIGHTMARE_PALETTES,
};

const OVERLAY_COLORS = {
  grid: 'rgba(36, 74, 61, 0.3)',
  selected: 'rgba(50, 218, 220, 0.38)',
  selectedEdge: '#5ce1e6',
  invalid: 'rgba(255, 92, 92, 0.42)',
  invalidEdge: '#ff8b82',
  range: 'rgba(76, 214, 222, 0.13)',
  rangeEdge: 'rgba(94, 228, 232, 0.62)',
  placementGuide: 'rgba(54, 145, 255, 0.28)',
} as const;

function paletteFor(themeId: StageThemeId): StagePalette {
  return STAGE_PALETTES[themeId];
}

export type MapSelection = {
  buildableCells?: readonly Readonly<Cell>[];
  cell?: Readonly<Cell> | null;
  range?: number;
  valid?: boolean;
};

function tracePoints(
  ctx: CanvasRenderingContext2D,
  points: readonly ScreenPoint[],
): boolean {
  if (
    points.length === 0
    || points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))
  ) return false;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  return true;
}

function traceCell(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  cell: Readonly<Cell>,
): boolean {
  return tracePoints(ctx, projectCellPolygon(layout, cell));
}

function drawBoardThickness(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  map: StageMap,
  palette: StagePalette,
): void {
  const left = projectWorldPoint(layout, { x: 0, y: map.height });
  const right = projectWorldPoint(layout, { x: map.width, y: map.height });
  const thickness = Math.max(5, layout.projection.rowStep * 0.22);
  if (!tracePoints(ctx, [
    left,
    right,
    { x: right.x, y: right.y + thickness },
    { x: left.x, y: left.y + thickness },
  ])) return;
  ctx.fillStyle = palette.boardSide;
  ctx.fill();
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  cell: Readonly<Cell>,
  isRoad: boolean,
  palette: StagePalette,
): void {
  if (!traceCell(ctx, layout, cell)) return;
  ctx.fillStyle = isRoad
    ? palette.road
    : cell.row % 2 === 0 ? palette.land : palette.alternate;
  ctx.fill();
  ctx.strokeStyle = OVERLAY_COLORS.grid;
  ctx.lineWidth = Math.max(0.5, 1 / layout.dpr);
  ctx.stroke();
}

function drawPlacementGuide(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  map: StageMap,
  cells: readonly Readonly<Cell>[],
): void {
  for (const cell of cells) {
    if (
      !Number.isInteger(cell.col)
      || !Number.isInteger(cell.row)
      || cell.col < 0
      || cell.col >= map.width
      || cell.row < 0
      || cell.row >= map.height
      || !traceCell(ctx, layout, cell)
    ) continue;
    ctx.fillStyle = OVERLAY_COLORS.placementGuide;
    ctx.fill();
  }
}

function drawLandmark(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  image: LoadedSprite,
  cell: Readonly<Cell>,
  sizeFactor: number,
  groundAnchor: number,
): void {
  const ground = projectWorldPoint(layout, { x: cell.col + 0.5, y: cell.row + 1 });
  const size = layout.tileWidth * sizeFactor * visualScaleAt(layout, cell.row + 0.5);
  drawSpriteFrame(ctx, image, 0, 128, {
    x: ground.x - size / 2,
    y: ground.y - size * groundAnchor,
    width: size,
    height: size,
  });
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  map: StageMap,
  selection: MapSelection,
): void {
  if (selection.cell == null) return;
  const { cell } = selection;
  if (
    !Number.isInteger(cell.col)
    || !Number.isInteger(cell.row)
    || cell.col < 0
    || cell.col >= map.width
    || cell.row < 0
    || cell.row >= map.height
  ) return;

  if (selection.range !== undefined && Number.isFinite(selection.range) && selection.range > 0) {
    const center = cellCenter(cell);
    for (let row = 0; row < map.height; row += 1) {
      for (let col = 0; col < map.width; col += 1) {
        if (Math.hypot(col - cell.col, row - cell.row) > selection.range) continue;
        if (!traceCell(ctx, layout, { col, row })) continue;
        ctx.fillStyle = OVERLAY_COLORS.range;
        ctx.fill();
      }
    }
    if (tracePoints(ctx, projectWorldRing(layout, center, selection.range))) {
      ctx.strokeStyle = OVERLAY_COLORS.rangeEdge;
      ctx.lineWidth = Math.max(1, 1 / layout.dpr);
      ctx.stroke();
    }
  }

  if (!traceCell(ctx, layout, cell)) return;
  ctx.fillStyle = selection.valid === false
    ? OVERLAY_COLORS.invalid
    : OVERLAY_COLORS.selected;
  ctx.fill();
  ctx.strokeStyle = selection.valid === false
    ? OVERLAY_COLORS.invalidEdge
    : OVERLAY_COLORS.selectedEdge;
  ctx.lineWidth = Math.max(2, 2 / layout.dpr);
  ctx.stroke();
}

type AtmosphereKind = 'pollen' | 'glint' | 'leaf' | 'dust' | 'sparkle' | 'ember' | 'mote';
type AtmosphereOverlay =
  | 'sunwash'
  | 'mist'
  | 'cloud'
  | 'shade'
  | 'mineral'
  | 'lightSweep'
  | 'vignette'
  | null;

export type AtmosphereProfile = Readonly<{
  kind: AtmosphereKind;
  colors: readonly string[];
  count: number;
  speed: number;
  driftX: number;
  driftY: number;
  minSize: number;
  maxSize: number;
  overlay: AtmosphereOverlay;
}>;

export const ATMOSPHERE_PROFILES: Readonly<Record<StageThemeId, AtmosphereProfile>> = {
  sunnyField: {
    kind: 'pollen',
    colors: ['#ffd66b', '#fff0a3'],
    count: 12,
    speed: 0.016,
    driftX: 0.22,
    driftY: -1,
    minSize: 0.025,
    maxSize: 0.055,
    overlay: 'sunwash',
  },
  windingStream: {
    kind: 'glint',
    colors: ['#8fe9ee', '#c8fbf7'],
    count: 12,
    speed: 0.02,
    driftX: 0.38,
    driftY: -0.45,
    minSize: 0.04,
    maxSize: 0.09,
    overlay: 'mist',
  },
  windyHill: {
    kind: 'leaf',
    colors: ['#d9ee80', '#a9d66f'],
    count: 12,
    speed: 0.024,
    driftX: 1,
    driftY: 0.1,
    minSize: 0.04,
    maxSize: 0.085,
    overlay: 'cloud',
  },
  orcCanyon: {
    kind: 'dust',
    colors: ['#c6784f', '#d69a6a'],
    count: 12,
    speed: 0.014,
    driftX: 0.4,
    driftY: -0.7,
    minSize: 0.035,
    maxSize: 0.08,
    overlay: 'shade',
  },
  golemQuarry: {
    kind: 'sparkle',
    colors: ['#c9d2cf', '#eef3e9'],
    count: 12,
    speed: 0.011,
    driftX: 0.08,
    driftY: -0.5,
    minSize: 0.035,
    maxSize: 0.075,
    overlay: 'mineral',
  },
  minotaurGate: {
    kind: 'ember',
    colors: ['#ffbd55', '#ffe08a'],
    count: 12,
    speed: 0.022,
    driftX: 0.18,
    driftY: -1,
    minSize: 0.03,
    maxSize: 0.075,
    overlay: 'lightSweep',
  },
  moonlitSwamp: {
    kind: 'mote', colors: ['#57d7c2'], count: 12, speed: 0.018,
    driftX: 0, driftY: -1, minSize: 0.055, maxSize: 0.109, overlay: null,
  },
  rottenForest: {
    kind: 'mote', colors: ['#bb77db'], count: 12, speed: 0.018,
    driftX: 0, driftY: -1, minSize: 0.055, maxSize: 0.109, overlay: null,
  },
  ashenRuins: {
    kind: 'mote', colors: ['#d4cfd8'], count: 12, speed: 0.018,
    driftX: 0, driftY: -1, minSize: 0.055, maxSize: 0.109, overlay: null,
  },
  bloodRavine: {
    kind: 'mote', colors: ['#d95058'], count: 12, speed: 0.018,
    driftX: 0, driftY: -1, minSize: 0.055, maxSize: 0.109, overlay: null,
  },
  obsidianMine: {
    kind: 'mote', colors: ['#ff923d'], count: 12, speed: 0.018,
    driftX: 0, driftY: -1, minSize: 0.055, maxSize: 0.109, overlay: null,
  },
  abyssGate: {
    kind: 'mote', colors: ['#a45ce0'], count: 12, speed: 0.018,
    driftX: 0, driftY: -1, minSize: 0.055, maxSize: 0.109, overlay: 'vignette',
  },
};

function wrapped(value: number): number {
  return ((value % 1) + 1) % 1;
}

function drawAtmosphereOverlay(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  overlay: AtmosphereOverlay,
  time: number,
  reducedMotion: boolean,
): void {
  if (overlay === null) return;
  const { x, y, width, height } = layout.gameArea;
  if (overlay === 'vignette') {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      height * 0.12,
      centerX,
      centerY,
      width * 0.62,
    );
    gradient.addColorStop(0, 'rgba(28, 12, 42, 0)');
    gradient.addColorStop(1, `rgba(12, 4, 22, ${reducedMotion ? 0.16 : 0.3})`);
    ctx.globalAlpha = 1;
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
    return;
  }

  const motionTime = time * (reducedMotion ? 0.2 : 1);
  ctx.globalAlpha = reducedMotion ? 0.05 : 0.08;
  if (overlay === 'sunwash') {
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, 'rgba(255, 244, 176, 0.8)');
    gradient.addColorStop(0.46, 'rgba(255, 234, 139, 0.18)');
    gradient.addColorStop(1, 'rgba(255, 230, 120, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
  } else if (overlay === 'mist') {
    const gradient = ctx.createLinearGradient(x, y + height, x, y);
    gradient.addColorStop(0, 'rgba(198, 248, 244, 0.68)');
    gradient.addColorStop(0.55, 'rgba(150, 224, 221, 0.12)');
    gradient.addColorStop(1, 'rgba(150, 224, 221, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
  } else if (overlay === 'cloud') {
    const cloudWidth = width * 0.32;
    const cloudX = x + wrapped(motionTime * 0.012) * (width + cloudWidth) - cloudWidth;
    ctx.fillStyle = 'rgba(33, 64, 42, 0.42)';
    ctx.fillRect(cloudX, y, cloudWidth, height);
  } else if (overlay === 'shade') {
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    gradient.addColorStop(0, 'rgba(99, 51, 32, 0.45)');
    gradient.addColorStop(0.5, 'rgba(99, 51, 32, 0)');
    gradient.addColorStop(1, 'rgba(72, 42, 30, 0.35)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
  } else if (overlay === 'mineral') {
    const gradient = ctx.createRadialGradient(
      x + width * 0.68,
      y + height * 0.44,
      0,
      x + width * 0.68,
      y + height * 0.44,
      width * 0.42,
    );
    gradient.addColorStop(0, 'rgba(218, 235, 226, 0.58)');
    gradient.addColorStop(1, 'rgba(218, 235, 226, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
  } else {
    const sweepWidth = width * 0.22;
    const sweepX = x + wrapped(motionTime * 0.018) * (width + sweepWidth) - sweepWidth;
    const gradient = ctx.createLinearGradient(sweepX, y, sweepX + sweepWidth, y);
    gradient.addColorStop(0, 'rgba(255, 213, 112, 0)');
    gradient.addColorStop(0.5, 'rgba(255, 220, 132, 0.72)');
    gradient.addColorStop(1, 'rgba(255, 213, 112, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(sweepX, y, sweepWidth, height);
  }
}

function drawAtmosphereElement(
  ctx: CanvasRenderingContext2D,
  kind: AtmosphereKind,
  color: string,
  x: number,
  y: number,
  size: number,
  index: number,
): void {
  if (kind === 'glint') {
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y - size * 0.16);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, size * 0.18);
    ctx.stroke();
    return;
  }
  if (kind === 'leaf') {
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x, y - size * 0.42);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size * 0.42);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    return;
  }
  if (kind === 'sparkle') {
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.8, size * 0.12);
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  const radius = kind === 'ember'
    ? size * (0.72 + (index % 2) * 0.18)
    : size;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

export function drawStageAtmosphere(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  themeId: StageThemeId,
  timeSeconds: number,
  reducedMotion = false,
): void {
  const time = Number.isFinite(timeSeconds) ? Math.max(0, timeSeconds) : 0;
  const profile = ATMOSPHERE_PROFILES[themeId];
  const count = Math.min(profile.count, reducedMotion ? 6 : 12);
  const motionScale = reducedMotion ? 0.2 : 1;
  ctx.save();
  if (profile.overlay !== 'vignette') {
    drawAtmosphereOverlay(ctx, layout, profile.overlay, time, reducedMotion);
  }
  ctx.globalAlpha = reducedMotion ? 0.055 : 0.09;
  for (let index = 0; index < count; index += 1) {
    const seed = index * 0.61803398875;
    if (profile.kind === 'mote') {
      const drift = wrapped(
        seed + time * (profile.speed + (index % 3) * 0.004) * motionScale,
      );
      const x = layout.gameArea.x
        + wrapped(seed * 1.71 + Math.sin(time * 0.12 * motionScale + index) * 0.035)
          * layout.gameArea.width;
      const y = layout.gameArea.y + (1 - drift) * layout.gameArea.height;
      const radius = Math.max(
        1.5,
        layout.tileWidth * (profile.minSize + (index % 4) * 0.018),
      );
      drawAtmosphereElement(
        ctx,
        profile.kind,
        profile.colors[index % profile.colors.length],
        x,
        y,
        radius,
        index,
      );
      continue;
    }
    const progress = time * profile.speed * motionScale;
    const x = layout.gameArea.x + wrapped(
      seed * 1.71 + progress * profile.driftX + Math.sin(time * 0.11 + index) * 0.018,
    ) * layout.gameArea.width;
    const y = layout.gameArea.y + wrapped(
      seed * 2.37 + progress * profile.driftY,
    ) * layout.gameArea.height;
    const sizeFraction = profile.minSize
      + (index % 4) / 3 * (profile.maxSize - profile.minSize);
    drawAtmosphereElement(
      ctx,
      profile.kind,
      profile.colors[index % profile.colors.length],
      x,
      y,
      Math.max(1.25, layout.tileWidth * sizeFraction),
      index,
    );
  }
  if (profile.overlay === 'vignette') {
    drawAtmosphereOverlay(ctx, layout, profile.overlay, time, reducedMotion);
  }
  ctx.restore();
}

export function drawMap(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  assets: GameAssets,
  stage: StageDefinition,
  selection: MapSelection = {},
  timeSeconds = 0,
  reducedMotion = false,
): void {
  const { map } = stage;
  const palette = paletteFor(stage.themeId);
  ctx.fillStyle = palette.ground;
  ctx.fillRect(
    layout.gameArea.x,
    layout.gameArea.y,
    layout.gameArea.width,
    layout.gameArea.height,
  );
  drawBoardThickness(ctx, layout, map, palette);

  for (let row = 0; row < map.height; row += 1) {
    for (let col = 0; col < map.width; col += 1) {
      drawCell(ctx, layout, { col, row }, map.isPathCell({ col, row }), palette);
    }
  }

  drawStageAtmosphere(ctx, layout, stage.themeId, timeSeconds, reducedMotion);
  drawPlacementGuide(ctx, layout, map, selection.buildableCells ?? []);
  const chest = map.pathCells[map.pathCells.length - 1];
  drawLandmark(ctx, layout, assets.map.snackChest, chest, 2.05, 0.86);
  drawSelection(ctx, layout, map, selection);
}
