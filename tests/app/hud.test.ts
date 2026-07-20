import { describe, expect, it } from 'vitest';

import { createHudView, TOWER_CARDS } from '../../src/app/hud';

describe('mobile HUD view', () => {
  it('exposes the four tower names, role icons, and prices', () => {
    expect(TOWER_CARDS).toEqual([
      { type: 'slow', name: '느림 장판', roleIcon: '🌀', cost: 80 },
      { type: 'arrow', name: '화살 타워', roleIcon: '🏹', cost: 100 },
      { type: 'deokbae', name: '덕배 타워', roleIcon: '🔥', cost: 250 },
      { type: 'huchu', name: '후추 타워', roleIcon: '💧', cost: 300 },
    ]);
  });

  it('formats live values and accessible control states', () => {
    expect(createHudView({
      gold: 123,
      baseHp: 7,
      waveIndex: 12,
      waveCount: 10,
      phase: 'paused',
      speed: 2,
      muted: true,
    })).toEqual({
      goldText: '123',
      baseHpText: '7',
      waveText: '10/10',
      pauseText: '계속',
      pauseLabel: '게임 계속하기',
      speedText: '2×',
      muteText: '🔇',
      muteLabel: '소리 켜기',
    });
  });
});
