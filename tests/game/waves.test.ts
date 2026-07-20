import { describe, expect, it } from 'vitest';
import { STAGE_1_WAVES } from '../../src/game/waves/stage1Waves';

describe('stage 1 waves', () => {
  it('contains ten declarative waves', () => {
    expect(STAGE_1_WAVES).toHaveLength(10);
  });

  it('introduces the minotaur only in wave 10', () => {
    expect(STAGE_1_WAVES.slice(0, 9).flatMap((wave) => wave.groups)
      .some((group) => group.type === 'minotaur')).toBe(false);
    expect(STAGE_1_WAVES[9].groups.some((group) => group.type === 'minotaur')).toBe(true);
  });
});
