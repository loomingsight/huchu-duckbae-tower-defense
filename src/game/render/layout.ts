import { GRID_HEIGHT, GRID_WIDTH } from '../config';

const MAX_DEVICE_PIXEL_RATIO = 2;
const MAP_WIDTH_RATIO = 0.96;
const MAP_HEIGHT_RATIO = 0.90;
const FAR_SCALE = 0.88;
const NEAR_SCALE = 1.05;
const MID_SCALE = (FAR_SCALE + NEAR_SCALE) / 2;

export type Viewport = {
  width: number;
  height: number;
  dpr?: number;
};

export type CanvasRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PerspectiveProjection = Readonly<{
  centerX: number;
  topY: number;
  baseCellWidth: number;
  rowStep: number;
  farScale: number;
  nearScale: number;
}>;

export type CanvasLayout = {
  viewport: Readonly<{ width: number; height: number }>;
  gameArea: Readonly<CanvasRect>;
  mapArea: Readonly<CanvasRect>;
  projection: PerspectiveProjection;
  tileWidth: number;
  tileHeight: number;
  cellSize: number;
  dpr: number;
  backingWidth: number;
  backingHeight: number;
  showOrientationPrompt: boolean;
};

function positiveDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function computeCanvasLayout(viewport: Viewport): CanvasLayout {
  const width = positiveDimension(viewport.width);
  const height = positiveDimension(viewport.height);
  const requestedDpr = Number.isFinite(viewport.dpr) ? viewport.dpr ?? 1 : 1;
  const dpr = Math.min(MAX_DEVICE_PIXEL_RATIO, Math.max(1, requestedDpr));
  const gameArea = { x: 0, y: 0, width, height };

  const maxMapWidth = Math.max(Number.EPSILON, width * MAP_WIDTH_RATIO);
  const maxMapHeight = Math.max(Number.EPSILON, height * MAP_HEIGHT_RATIO);
  const widthLimitedCell = maxMapWidth / (GRID_WIDTH * NEAR_SCALE);
  const heightLimitedCell = maxMapHeight / (GRID_HEIGHT * MID_SCALE);
  const baseCellWidth = Math.max(
    Number.EPSILON,
    Math.min(widthLimitedCell, heightLimitedCell),
  );
  const rowStep = baseCellWidth * MID_SCALE;
  const mapWidth = baseCellWidth * GRID_WIDTH * NEAR_SCALE;
  const mapHeight = rowStep * GRID_HEIGHT;
  const centerX = width / 2;
  const topY = Math.max(0, (height - mapHeight) / 2);
  const mapArea = {
    x: centerX - mapWidth / 2,
    y: topY,
    width: mapWidth,
    height: mapHeight,
  };

  return {
    viewport: { width, height },
    gameArea,
    mapArea,
    projection: {
      centerX,
      topY,
      baseCellWidth,
      rowStep,
      farScale: FAR_SCALE,
      nearScale: NEAR_SCALE,
    },
    tileWidth: baseCellWidth,
    tileHeight: rowStep,
    cellSize: baseCellWidth,
    dpr,
    backingWidth: Math.max(1, Math.round(width * dpr)),
    backingHeight: Math.max(1, Math.round(height * dpr)),
    showOrientationPrompt: height > width,
  };
}

export function alignToDevicePixel(value: number, dpr: number): number {
  return Math.round(value * dpr) / dpr;
}
