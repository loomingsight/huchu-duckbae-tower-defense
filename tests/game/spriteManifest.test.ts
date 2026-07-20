import { describe, expect, it } from 'vitest';

import { ENEMY_SPRITES } from '../../src/game/render/spriteManifest';

describe('ENEMY_SPRITES', () => {
  const types = ['slime', 'fairy', 'orc', 'golem', 'minotaur'] as const;
  const directions = ['ne', 'se', 'sw', 'nw'] as const;

  it('maps every enemy direction to its exact versioned mobile sprite URL', () => {
    for (const type of types) {
      expect(Object.keys(ENEMY_SPRITES[type]).sort()).toEqual(['ne', 'nw', 'se', 'sw']);

      for (const direction of directions) {
        expect(ENEMY_SPRITES[type][direction]).toMatch(
          new RegExp(`/mobile/${type}/${type}-${direction}-96-v1\\.png$`),
        );
      }
    }
  });

  it('keeps all 20 enemy direction URLs unique', () => {
    const urls = types.flatMap((type) => directions.map((direction) => ENEMY_SPRITES[type][direction]));

    expect(new Set(urls).size).toBe(20);
  });
});
