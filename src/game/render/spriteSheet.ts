import type { LoadedSprite } from './assetLoader';

export type SpriteDestination = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export function drawSpriteFrame(
  ctx: CanvasRenderingContext2D,
  image: LoadedSprite,
  frameIndex: number,
  frameSize: number,
  destination: SpriteDestination,
): boolean {
  if (
    image === null
    || !Number.isFinite(frameIndex)
    || !Number.isFinite(frameSize)
    || frameSize <= 0
  ) return false;

  const availableFrames = Math.max(1, Math.floor(image.naturalWidth / frameSize));
  const frame = Math.max(0, Math.min(availableFrames - 1, Math.floor(frameIndex)));
  ctx.drawImage(
    image,
    frame * frameSize,
    0,
    frameSize,
    Math.min(frameSize, image.naturalHeight),
    destination.x,
    destination.y,
    destination.width,
    destination.height,
  );
  return true;
}
