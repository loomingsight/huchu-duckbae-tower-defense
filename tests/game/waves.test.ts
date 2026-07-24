import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/game/simulation/createGame';
import { updateWaves } from '../../src/game/simulation/updateWaves';
import { createNightmareWaves } from '../../src/game/waves/nightmareWaves';
import { isValidWaveGroup, STAGE_1_WAVES } from '../../src/game/waves/stage1Waves';
import { getStageDefinition } from '../../src/game/stages/stageCatalog';

describe('stage 1 waves', () => {
  it('contains ten declarative waves', () => {
    expect(STAGE_1_WAVES).toHaveLength(10);
  });

  it('introduces the minotaur only in wave 10', () => {
    expect(STAGE_1_WAVES.slice(0, 9).flatMap((wave) => wave.groups)
      .some((group) => group.type === 'minotaur')).toBe(false);
    expect(STAGE_1_WAVES[9].groups.some((group) => group.type === 'minotaur')).toBe(true);
  });

  it('matches ten seconds of spawning when the same time is partitioned', () => {
    const wholeStep = createGame();
    const partitioned = createGame();

    updateWaves(wholeStep, 10);
    for (let index = 0; index < 10; index += 1) updateWaves(partitioned, 1);

    expect(wholeStep).toEqual(partitioned);
  });

  it('ignores zero or invalid elapsed time without spawning an enemy', () => {
    const state = createGame();

    updateWaves(state, 0);
    updateWaves(state, -1);
    updateWaves(state, Number.NaN);
    updateWaves(state, Number.POSITIVE_INFINITY);

    expect(state.enemies).toEqual([]);
    expect(state.wave.spawnCooldown).toBe(0);
  });

  it('rejects malformed groups so a zero-time spawn loop cannot be scheduled', () => {
    expect(isValidWaveGroup({ type: 'slime', count: 0, spawnInterval: 0 })).toBe(false);
    expect(isValidWaveGroup({ type: 'slime', count: Number.POSITIVE_INFINITY, spawnInterval: 0 }))
      .toBe(false);
    expect(isValidWaveGroup({ type: 'slime', count: 1, spawnInterval: Number.NaN })).toBe(false);
    expect(isValidWaveGroup({
      type: 'skeletonKnight',
      count: 1,
      spawnInterval: 0,
      variant: 'elite',
    })).toBe(true);
    expect(isValidWaveGroup({
      type: 'skeletonKnight',
      count: 1,
      spawnInterval: 0,
      variant: 'legendary',
    })).toBe(false);
  });

  it('creates ten deterministic nightmare waves with one elite and one lich', () => {
    const countMultiplier = getStageDefinition('nightmare-4').countMultiplier;
    const first = createNightmareWaves(4, countMultiplier);
    const second = createNightmareWaves(4, countMultiplier);

    expect(first).toEqual(second);
    expect(first).toHaveLength(10);
    expect(first.flatMap(({ groups }) => groups)
      .filter(({ variant }) => variant === 'elite')).toHaveLength(1);
    expect(first.slice(0, 9).flatMap(({ groups }) => groups)
      .some(({ type }) => type === 'lichKing')).toBe(false);
    expect(first[9].groups.at(-1)).toEqual({
      type: 'lichKing',
      count: 1,
      spawnInterval: 0,
    });
  });

  it('uses the catalog count multiplier and normalizes invalid values', () => {
    const waves = createNightmareWaves(2, 1);
    const ordinaryCount = waves.flatMap(({ groups }) => groups)
      .filter(({ type, variant }) => type !== 'lichKing' && variant !== 'elite')
      .reduce((sum, { count }) => sum + count, 0);

    expect(ordinaryCount).toBe(215);
    expect(createNightmareWaves(2, Number.NaN)).toEqual(waves);
  });
});
