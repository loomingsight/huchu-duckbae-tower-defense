import { GRID_HEIGHT, GRID_WIDTH } from '../config';

const GAME_ASPECT_RATIO = 16 / 9;
const MAX_DEVICE_PIXEL_RATIO = 2;

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
  const viewportAspect = width / height;
  const gameWidth = viewportAspect > GAME_ASPECT_RATIO
    ? height * GAME_ASPECT_RATIO
    : width;
  const gameHeight = gameWidth / GAME_ASPECT_RATIO;
  const gameArea = {
    x: (width - gameWidth) / 2,
    y: (height - gameHeight) / 2,
    width: gameWidth,
    height: gameHeight,
  };
  const cellSize = Math.min(gameWidth / GRID_WIDTH, gameHeight / GRID_HEIGHT);
  const mapWidth = cellSize * GRID_WIDTH;
  const mapHeight = cellSize * GRID_HEIGHT;

  return {
    viewport: { width, height },
    gameArea,
    mapArea: {
      x: gameArea.x + (gameWidth - mapWidth) / 2,
      y: gameArea.y + (gameHeight - mapHeight) / 2,
      width: mapWidth,
      height: mapHeight,
    },
    cellSize,
    dpr,
    backingWidth: Math.max(1, Math.round(width * dpr)),
    backingHeight: Math.max(1, Math.round(height * dpr)),
    showOrientationPrompt: height > width,
  };
}

export function alignToDevicePixel(value: number, dpr: number): number {
  return Math.round(value * dpr) / dpr;
}
