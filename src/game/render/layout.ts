import { GRID_HEIGHT, GRID_WIDTH } from '../config';

const MAX_DEVICE_PIXEL_RATIO = 2;
const TILE_HEIGHT_RATIO = 0.44;
const MAP_TOP_PADDING_RATIO = 0.1;
const MAP_BOTTOM_PADDING = 6;

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

export type CanvasLayout = {
  viewport: Readonly<{ width: number; height: number }>;
  gameArea: Readonly<CanvasRect>;
  mapArea: Readonly<CanvasRect>;
  mapOrigin: Readonly<{ x: number; y: number }>;
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
  const gameArea = {
    x: 0,
    y: 0,
    width,
    height,
  };
  const dimensionSum = GRID_WIDTH + GRID_HEIGHT;
  const horizontalTileWidth = Math.max(1, (width - 12) * 2 / dimensionSum);
  const topPadding = Math.max(8, height * MAP_TOP_PADDING_RATIO);
  const availableHeight = Math.max(1, height - topPadding - MAP_BOTTOM_PADDING);
  const verticalTileWidth = Math.max(
    1,
    availableHeight * 2 / (dimensionSum * TILE_HEIGHT_RATIO),
  );
  const tileWidth = Math.min(horizontalTileWidth, verticalTileWidth);
  const tileHeight = tileWidth * TILE_HEIGHT_RATIO;
  const mapWidth = dimensionSum * tileWidth / 2;
  const mapHeight = dimensionSum * tileHeight / 2;
  const mapArea = {
    x: (width - mapWidth) / 2,
    y: topPadding + Math.max(0, (availableHeight - mapHeight) / 2),
    width: mapWidth,
    height: mapHeight,
  };

  return {
    viewport: { width, height },
    gameArea,
    mapArea,
    mapOrigin: {
      x: mapArea.x + GRID_HEIGHT * tileWidth / 2,
      y: mapArea.y,
    },
    tileWidth,
    tileHeight,
    cellSize: tileWidth,
    dpr,
    backingWidth: Math.max(1, Math.round(width * dpr)),
    backingHeight: Math.max(1, Math.round(height * dpr)),
    showOrientationPrompt: height > width,
  };
}

export function alignToDevicePixel(value: number, dpr: number): number {
  return Math.round(value * dpr) / dpr;
}
