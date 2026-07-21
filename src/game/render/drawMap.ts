import { cellCenter } from '../core/geometry';
import { STAGE_1 } from '../map/stage1';
import type { Cell } from '../types';
import type { GameAssets, LoadedSprite } from './assetLoader';
import type { CanvasLayout } from './layout';
import { alignToDevicePixel } from './layout';
import type { MapSpriteKey } from './spriteManifest';
import { drawSpriteFrame } from './spriteSheet';

const COLORS = {
  ground: '#17382f',
  grid: 'rgba(36, 74, 61, 0.3)',
  selected: 'rgba(50, 218, 220, 0.38)',
  selectedEdge: '#5ce1e6',
  invalid: 'rgba(255, 92, 92, 0.42)',
  invalidEdge: '#ff8b82',
  range: 'rgba(76, 214, 222, 0.13)',
  rangeEdge: 'rgba(94, 228, 232, 0.62)',
} as const;

export type MapSelection = {
  cell?: Readonly<Cell> | null;
  range?: number;
  valid?: boolean;
};

export type ScreenPoint = { x: number; y: number };

type CardinalDirection = 'north' | 'east' | 'south' | 'west';

const pathIndexByKey = new Map(
  STAGE_1.pathCells.map((cell, index) => [`${cell.col}:${cell.row}`, index]),
);

export function isFinitePoint(point: Readonly<{ x: number; y: number }>): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function isRenderablePoint(
  layout: CanvasLayout,
  point: Readonly<{ x: number; y: number }>,
): boolean {
  if (!isFinitePoint(point)) return false;
  const screen = worldToScreen(layout, point);
  const margin = layout.tileWidth * 3;
  return screen.x >= layout.gameArea.x - margin
    && screen.x <= layout.gameArea.x + layout.gameArea.width + margin
    && screen.y >= layout.gameArea.y - margin
    && screen.y <= layout.gameArea.y + layout.gameArea.height + margin;
}

export function worldToScreen(
  layout: CanvasLayout,
  point: Readonly<{ x: number; y: number }>,
): ScreenPoint {
  const x = Number.isFinite(point.x) ? point.x : 0;
  const y = Number.isFinite(point.y) ? point.y : 0;
  const screenX = layout.mapOrigin.x + (x - y) * layout.tileWidth / 2;
  const screenY = layout.mapOrigin.y + (x + y) * layout.tileHeight / 2;
  return {
    x: alignToDevicePixel(screenX, layout.dpr),
    y: alignToDevicePixel(screenY, layout.dpr),
  };
}

export function cellDiamond(
  layout: CanvasLayout,
  cell: Readonly<Cell>,
): readonly ScreenPoint[] {
  const center = worldToScreen(layout, cellCenter(cell));
  return [
    { x: center.x, y: center.y - layout.tileHeight / 2 },
    { x: center.x + layout.tileWidth / 2, y: center.y },
    { x: center.x, y: center.y + layout.tileHeight / 2 },
    { x: center.x - layout.tileWidth / 2, y: center.y },
  ];
}

function traceDiamond(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  cell: Readonly<Cell>,
): void {
  const [top, right, bottom, left] = cellDiamond(layout, cell);
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(right.x, right.y);
  ctx.lineTo(bottom.x, bottom.y);
  ctx.lineTo(left.x, left.y);
  ctx.closePath();
}

function direction(from: Readonly<Cell>, to: Readonly<Cell>): CardinalDirection {
  if (to.col > from.col) return 'east';
  if (to.col < from.col) return 'west';
  if (to.row > from.row) return 'south';
  return 'north';
}

function roadSprite(index: number): MapSpriteKey {
  if (index === 0) return 'entry';
  if (index === STAGE_1.pathCells.length - 1) return 'snackChest';
  const cell = STAGE_1.pathCells[index];
  const directions = new Set<CardinalDirection>([
    direction(cell, STAGE_1.pathCells[index - 1]),
    direction(cell, STAGE_1.pathCells[index + 1]),
  ]);
  if (directions.has('east') && directions.has('west')) return 'roadHorizontal';
  if (directions.has('north') && directions.has('south')) return 'roadVertical';
  if (directions.has('north') && directions.has('east')) return 'roadNorthEast';
  if (directions.has('east') && directions.has('south')) return 'roadEastSouth';
  if (directions.has('south') && directions.has('west')) return 'roadSouthWest';
  return 'roadWestNorth';
}

function drawTileSprite(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  image: LoadedSprite,
  cell: Readonly<Cell>,
): boolean {
  const center = worldToScreen(layout, cellCenter(cell));
  const width = layout.tileWidth * 1.44;
  const height = layout.tileHeight * 2.92;
  return drawSpriteFrame(ctx, image, 0, 128, {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
  });
}

function drawFallbackTile(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  cell: Readonly<Cell>,
  isRoad: boolean,
): void {
  traceDiamond(ctx, layout, cell);
  ctx.fillStyle = isRoad ? '#d5bd8c' : '#6f9f76';
  ctx.fill();
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = Math.max(0.5, 1 / layout.dpr);
  ctx.stroke();
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  selection: MapSelection,
): void {
  if (selection.cell == null) return;
  const { cell } = selection;
  if (
    !Number.isInteger(cell.col)
    || !Number.isInteger(cell.row)
    || cell.col < 0
    || cell.col >= STAGE_1.width
    || cell.row < 0
    || cell.row >= STAGE_1.height
  ) return;

  if (selection.range !== undefined && Number.isFinite(selection.range) && selection.range > 0) {
    const center = worldToScreen(layout, cellCenter(cell));
    const radius = selection.range;
    for (let row = 0; row < STAGE_1.height; row += 1) {
      for (let col = 0; col < STAGE_1.width; col += 1) {
        const dx = col - cell.col;
        const dy = row - cell.row;
        if (Math.hypot(dx, dy) > radius) continue;
        traceDiamond(ctx, layout, { col, row });
        ctx.fillStyle = COLORS.range;
        ctx.fill();
      }
    }
    const radiusX = radius * layout.tileWidth / Math.SQRT2;
    const radiusY = radius * layout.tileHeight / Math.SQRT2;
    if (Number.isFinite(radiusX) && Number.isFinite(radiusY)) {
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.rangeEdge;
      ctx.lineWidth = Math.max(1, 1 / layout.dpr);
      ctx.stroke();
    }
  }

  traceDiamond(ctx, layout, cell);
  ctx.fillStyle = selection.valid === false ? COLORS.invalid : COLORS.selected;
  ctx.fill();
  ctx.strokeStyle = selection.valid === false ? COLORS.invalidEdge : COLORS.selectedEdge;
  ctx.lineWidth = Math.max(2, 2 / layout.dpr);
  ctx.stroke();
}

export function drawMap(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  assets: GameAssets,
  selection: MapSelection = {},
): void {
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(
    layout.gameArea.x,
    layout.gameArea.y,
    layout.gameArea.width,
    layout.gameArea.height,
  );

  for (let depth = 0; depth <= STAGE_1.width + STAGE_1.height - 2; depth += 1) {
    for (let row = 0; row < STAGE_1.height; row += 1) {
      const col = depth - row;
      if (col < 0 || col >= STAGE_1.width) continue;
      const cell = { col, row };
      const pathIndex = pathIndexByKey.get(`${col}:${row}`);
      const spriteKey = pathIndex === undefined ? 'grass' : roadSprite(pathIndex);
      if (!drawTileSprite(ctx, layout, assets.map[spriteKey], cell)) {
        drawFallbackTile(ctx, layout, cell, pathIndex !== undefined);
      }
    }
  }

  drawSelection(ctx, layout, selection);
}
