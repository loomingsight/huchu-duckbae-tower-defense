import { describe, expect, it } from 'vitest';

import {
  ENEMY_SPRITES,
  MAP_SPRITES,
  MOTION_SPRITES,
  SPRITE_FRAME_SIZES,
  TOWER_SPRITES,
  VFX_SPRITES,
} from '../../src/game/render/spriteManifest';

describe('ENEMY_SPRITES', () => {
  const types = ['slime', 'fairy', 'orc', 'golem', 'minotaur'] as const;
  const directions = ['ne', 'se', 'sw', 'nw'] as const;

  it('maps every enemy direction slot to one high-resolution front sprite', () => {
    for (const type of types) {
      expect(Object.keys(ENEMY_SPRITES[type]).sort()).toEqual(['ne', 'nw', 'se', 'sw']);

      for (const direction of directions) {
        expect(ENEMY_SPRITES[type][direction]).toMatch(
          new RegExp(`/enemies-v1/${type}/${type}-se-v1\\.png$`),
        );
      }
      expect(new Set(directions.map((direction) => ENEMY_SPRITES[type][direction])).size).toBe(1);
    }
  });

  it('uses 256px master sprites for entities and effects while maps stay at 128px', () => {
    expect(SPRITE_FRAME_SIZES).toEqual({
      map: 128,
      enemy: 256,
      tower: 256,
      motion: 256,
      vfx: 256,
    });

    for (const url of Object.values(TOWER_SPRITES)) {
      expect(url).toContain('/redesign-preview-v1/master/towers/');
    }
    for (const sprite of Object.values(MOTION_SPRITES)) {
      expect(sprite.url).toContain('/redesign-preview-v1/master/motion/');
    }
    for (const sprite of Object.values(VFX_SPRITES)) {
      expect(sprite.url).toContain('/redesign-preview-v1/master/vfx/');
    }
    for (const url of Object.values(MAP_SPRITES)) {
      expect(url).toContain('/redesign-preview-v1/mobile/map/');
    }

    expect(new Set(types.map((type) => ENEMY_SPRITES[type].se)).size).toBe(types.length);
  });
});
