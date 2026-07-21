import { describe, expect, it } from 'vitest';
import { PREVIEW_ASSETS } from '../../tools/assets/redesignPreviewContract.mjs';

const expectedIds = [
  'grass',
  'road-straight-horizontal',
  'road-straight-vertical',
  'road-corner-north-east',
  'road-corner-east-south',
  'road-corner-south-west',
  'road-corner-west-north',
  'entry',
  'snack-chest',
  'tower-slow-se',
  'tower-arrow-se',
  'tower-deokbae-se',
  'tower-huchu-se',
  'orc-walk-se',
  'fairy-fly-se',
  'arrow-8dir',
  'fireball-flight',
  'waterball-flight',
  'arrow-impact',
  'fire-burst',
  'aqua-burst',
];

describe('3D redesign preview contract', () => {
  it('defines the exact approval-set assets once', () => {
    expect(PREVIEW_ASSETS.map((asset) => asset.id)).toEqual(expectedIds);
    expect(new Set(PREVIEW_ASSETS.map((asset) => asset.relativePath)).size).toBe(21);
  });

  it('uses fixed master/mobile frame sizes and approved frame counts', () => {
    for (const asset of PREVIEW_ASSETS) {
      expect(asset.masterFrameSize).toBe(256);
      expect(asset.mobileFrameSize).toBe(128);
      expect(asset.relativePath.endsWith('.png')).toBe(true);
    }
    expect(PREVIEW_ASSETS.find((asset) => asset.id === 'orc-walk-se')?.frames).toBe(6);
    expect(PREVIEW_ASSETS.find((asset) => asset.id === 'fairy-fly-se')?.frames).toBe(8);
    expect(PREVIEW_ASSETS.find((asset) => asset.id === 'arrow-8dir')?.frames).toBe(8);
    expect(PREVIEW_ASSETS.find((asset) => asset.id === 'fire-burst')?.frames).toBe(8);
    expect(PREVIEW_ASSETS.find((asset) => asset.id === 'aqua-burst')?.frames).toBe(8);
  });
});
