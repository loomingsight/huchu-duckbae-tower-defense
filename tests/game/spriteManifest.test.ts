import { describe, expect, it } from 'vitest';

import { ENEMY_SPRITES } from '../../src/game/render/spriteManifest';

describe('ENEMY_SPRITES', () => {
  it('maps every enemy type to four versioned mobile sprite URLs', () => {
    for (const type of ['slime', 'fairy', 'orc', 'golem', 'minotaur'] as const) {
      expect(Object.keys(ENEMY_SPRITES[type]).sort()).toEqual(['ne', 'nw', 'se', 'sw']);

      for (const url of Object.values(ENEMY_SPRITES[type])) {
        expect(url).toMatch(/-96-v1\.png$/);
      }
    }
  });
});
