import { cellCenter } from '../core/geometry';
import type { StageMap } from '../map/createStageMap';
import type { StageDefinition } from '../stages/stageCatalog';
import type { StageThemeId } from '../stages/stageIdentity';
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

const NORMAL_PALETTE: StagePalette = {
  ground: '#17382f',
  land: '#4f8c65',
  alternate: '#5d9a70',
  road: '#e4c99f',
  boardSide: '#2f6247',
};

export const NIGHTMARE_PALETTES: Readonly<
  Record<Exclude<StageThemeId, 'normal'>, StagePalette>
> = {
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
  return themeId === 'normal' ? NORMAL_PALETTE : NIGHTMARE_PALETTES[themeId];
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

const ATMOSPHERE_COLORS: Readonly<Record<Exclude<StageThemeId, 'normal'>, string>> = {
  moonlitSwamp: '#57d7c2',
  rottenForest: '#bb77db',
  ashenRuins: '#d4cfd8',
  bloodRavine: '#d95058',
  obsidianMine: '#ff923d',
  abyssGate: '#a45ce0',
};

function wrapped(value: number): number {
  return ((value % 1) + 1) % 1;
}

export function drawStageAtmosphere(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  themeId: StageThemeId,
  timeSeconds: number,
  reducedMotion = false,
): void {
  if (themeId === 'normal') return;
  const time = Number.isFinite(timeSeconds) ? Math.max(0, timeSeconds) : 0;
  const count = reducedMotion ? 6 : 12;
  const color = ATMOSPHERE_COLORS[themeId];
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = reducedMotion ? 0.055 : 0.09;
  for (let index = 0; index < count; index += 1) {
    const seed = index * 0.61803398875;
    const drift = wrapped(seed + time * (0.018 + (index % 3) * 0.004));
    const x = layout.gameArea.x
      + wrapped(seed * 1.71 + Math.sin(time * 0.12 + index) * 0.035)
        * layout.gameArea.width;
    const y = layout.gameArea.y + (1 - drift) * layout.gameArea.height;
    const radius = Math.max(1.5, layout.tileWidth * (0.055 + (index % 4) * 0.018));
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  if (themeId === 'abyssGate') {
    const centerX = layout.gameArea.x + layout.gameArea.width / 2;
    const centerY = layout.gameArea.y + layout.gameArea.height / 2;
    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      layout.gameArea.height * 0.12,
      centerX,
      centerY,
      layout.gameArea.width * 0.62,
    );
    gradient.addColorStop(0, 'rgba(28, 12, 42, 0)');
    gradient.addColorStop(
      1,
      `rgba(12, 4, 22, ${reducedMotion ? 0.16 : 0.3})`,
    );
    ctx.globalAlpha = 1;
    ctx.fillStyle = gradient;
    ctx.fillRect(
      layout.gameArea.x,
      layout.gameArea.y,
      layout.gameArea.width,
      layout.gameArea.height,
    );
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
