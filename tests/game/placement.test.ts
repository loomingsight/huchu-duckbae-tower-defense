import { describe, expect, it } from 'vitest';
import { createGame, INITIAL_GOLD } from '../../src/game/simulation/createGame';
import { placeTower } from '../../src/game/simulation/placeTower';
import { TOWER_CATALOG } from '../../src/game/towers/towerCatalog';

describe('tower placement', () => {
  it('defines the exact four tower defaults', () => {
    expect(TOWER_CATALOG).toEqual({
      slow: { cost: 80, range: 2.4, multiplier: 0.62 },
      arrow: { cost: 100, range: 3.2, damage: 18, cooldown: 0.55, projectileSpeed: 8 },
      deokbae: {
        cost: 420,
        range: 3,
        damage: 14,
        cooldown: 0.42,
        projectileSpeed: 6.5,
        splash: 0.85,
      },
      huchu: {
        cost: 560,
        range: 3.4,
        damage: 72,
        cooldown: 1.8,
        projectileSpeed: 5,
        splash: 1.25,
      },
    });
  });

  it('starts stage one with the approved basic-tower budget', () => {
    expect(INITIAL_GOLD).toBe(320);
    expect(createGame().gold).toBe(INITIAL_GOLD);
  });

  it('rejects a tower when there is insufficient gold', () => {
    const state = createGame();
    state.gold = TOWER_CATALOG.arrow.cost - 1;

    expect(placeTower(state, 'arrow', { col: 2, row: 1 })).toEqual({
      ok: false,
      reason: 'insufficient-gold',
    });
    expect(state.towers).toEqual([]);
    expect(state.gold).toBe(99);
  });

  it('rejects path and occupied cells without charging gold', () => {
    const state = createGame();

    expect(placeTower(state, 'arrow', { col: 2, row: 2 })).toEqual({
      ok: false,
      reason: 'not-buildable',
    });
    expect(placeTower(state, 'arrow', { col: 2, row: 1 }).ok).toBe(true);
    expect(placeTower(state, 'slow', { col: 2, row: 1 })).toEqual({
      ok: false,
      reason: 'not-buildable',
    });
    expect(state.gold).toBe(220);
  });

  it('rejects empty cells that are not one of the eight neighbors of the road', () => {
    const state = createGame();

    expect(placeTower(state, 'arrow', { col: 2, row: 5 })).toEqual({
      ok: false,
      reason: 'not-buildable',
    });
    expect(state.gold).toBe(INITIAL_GOLD);
  });

  it.each([
    { col: -1, row: 1 },
    { col: 20, row: 1 },
    { col: 1, row: -1 },
    { col: 1, row: 10 },
    { col: 1.5, row: 1 },
    { col: 1, row: Number.NaN },
    { col: Number.POSITIVE_INFINITY, row: 1 },
  ])('rejects the invalid grid cell $col:$row directly', (cell) => {
    const state = createGame();

    expect(placeTower(state, 'arrow', cell)).toEqual({
      ok: false,
      reason: 'not-buildable',
    });
    expect(state.towers).toEqual([]);
    expect(state.gold).toBe(INITIAL_GOLD);
  });

  it('places towers at exact cell centers and allows duplicate types on different cells', () => {
    const state = createGame();

    expect(placeTower(state, 'arrow', { col: 2, row: 1 }).ok).toBe(true);
    expect(placeTower(state, 'arrow', { col: 3, row: 1 }).ok).toBe(true);

    expect(state.towers.map((tower) => ({
      type: tower.type,
      cell: tower.cell,
      position: tower.position,
    }))).toEqual([
      { type: 'arrow', cell: { col: 2, row: 1 }, position: { x: 2.5, y: 1.5 } },
      { type: 'arrow', cell: { col: 3, row: 1 }, position: { x: 3.5, y: 1.5 } },
    ]);
    expect(state.gold).toBe(120);
  });
});
