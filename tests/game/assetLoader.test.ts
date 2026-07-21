import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadGameAssets } from '../../src/game/render/assetLoader';

class MixedResultImage {
  decoding = '';
  onload: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  url = '';

  set src(value: string) {
    this.url = value;
    queueMicrotask(() => {
      const failed = value.includes('/towers/huchu-se.png') || value.includes('slime-ne-96');
      if (failed) this.onerror?.(new Event('error'));
      else this.onload?.(new Event('load'));
    });
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadGameAssets', () => {
  it('preserves successful images while falling back only failed image slots', async () => {
    vi.stubGlobal('Image', MixedResultImage);

    const assets = await loadGameAssets();

    expect(assets.towers.huchu).toBeNull();
    expect(assets.towers.deokbae).toBeInstanceOf(MixedResultImage);
    expect(assets.enemies.slime.ne).toBeNull();
    expect(assets.enemies.slime.se).toBeInstanceOf(MixedResultImage);
    expect(assets.enemies.fairy.ne).toBeInstanceOf(MixedResultImage);
    expect(assets.map.grass).toBeInstanceOf(MixedResultImage);
    expect(assets.motion.orc).toBeInstanceOf(MixedResultImage);
    expect(assets.vfx.aquaBurst).toBeInstanceOf(MixedResultImage);
  });
});
