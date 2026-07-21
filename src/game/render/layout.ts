import { GRID_HEIGHT, GRID_WIDTH } from '../config';

const MAX_DEVICE_PIXEL_RATIO = 2;
const TILE_HEIGHT_RATIO = 0.44;
const MAP_WIDTH_RATIO = 0.92;
const MAP_HEIGHT_RATIO = 0.76;
const MAP_TOP_RATIO = 0.1;
const MAP_BOTTOM_PADDING = 6;
const FAR_SCALE = 0.75;
const NEAR_SCALE = 1.1;

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
  mapOrigin: Readonly<{ x: number; y: number }>;
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

  const dimensionSum = GRID_WIDTH + GRID_HEIGHT;
  const horizontalVisualUnit = Math.max(Number.EPSILON, (width - 12) * 2 / dimensionSum);
  const visualTopPadding = Math.max(8, height * MAP_TOP_RATIO);
  const visualAvailableHeight = Math.max(
    Number.EPSILON,
    height - visualTopPadding - MAP_BOTTOM_PADDING,
  );
  const verticalVisualUnit = visualAvailableHeight * 2 / (dimensionSum * TILE_HEIGHT_RATIO);
  const tileWidth = Math.max(
    Number.EPSILON,
    Math.min(horizontalVisualUnit, verticalVisualUnit),
  );
  const tileHeight = tileWidth * TILE_HEIGHT_RATIO;

  const mapWidth = width * MAP_WIDTH_RATIO;
  const mapHeight = height * MAP_HEIGHT_RATIO;
  const centerX = width / 2;
  const preferredTop = Math.max(8, height * MAP_TOP_RATIO);
  const topY = Math.max(0, Math.min(preferredTop, height - mapHeight));
  const baseCellWidth = mapWidth / (GRID_WIDTH * NEAR_SCALE);
  const rowStep = mapHeight / GRID_HEIGHT;
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
    mapOrigin: { x: centerX, y: topY },
    projection: {
      centerX,
      topY,
      baseCellWidth,
      rowStep,
      farScale: FAR_SCALE,
      nearScale: NEAR_SCALE,
    },
    tileWidth,
    tileHeight,
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
