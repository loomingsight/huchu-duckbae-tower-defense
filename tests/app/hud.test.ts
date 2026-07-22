import { describe, expect, it } from 'vitest';

import {
  createHudView,
  createModalFocusManager,
  createStagePickerView,
  GAME_NAME,
  stageActionLabel,
  TOWER_CARDS,
  towerCardAvailability,
  type ModalFocusTarget,
} from '../../src/app/hud';
import { createGame } from '../../src/game/simulation/createGame';

describe('mobile HUD view', () => {
  it('uses the approved game name', () => {
    expect(GAME_NAME).toBe('후추덕배 타워 디펜스');
  });

  it('exposes the four tower names, role icons, and prices', () => {
    expect(TOWER_CARDS).toEqual([
      { type: 'slow', name: '슬로우 타워', roleIcon: '🌀', cost: 80 },
      { type: 'arrow', name: '화살 타워', roleIcon: '🏹', cost: 100 },
      { type: 'deokbae', name: '덕배', roleIcon: '🔥', cost: 420 },
      { type: 'huchu', name: '후추', roleIcon: '💧', cost: 560 },
    ]);
  });

  it('keeps both advanced towers unaffordable at the start of stage one', () => {
    const state = createGame();

    for (const type of ['deokbae', 'huchu'] as const) {
      const card = TOWER_CARDS.find((candidate) => candidate.type === type);
      expect(card).toBeDefined();
      expect(towerCardAvailability({
        gold: state.gold,
        phase: 'playing',
        portraitBlocked: false,
      }, card!.cost)).toEqual({ disabled: true, unaffordable: true });
    }
  });

  it('disables unaffordable tower cards at the exact cost boundary', () => {
    expect(towerCardAvailability({
      gold: 99,
      phase: 'playing',
      portraitBlocked: false,
    }, 100)).toEqual({ disabled: true, unaffordable: true });
    expect(towerCardAvailability({
      gold: 100,
      phase: 'playing',
      portraitBlocked: false,
    }, 100)).toEqual({ disabled: false, unaffordable: false });
  });

  it('keeps tower cards disabled outside active landscape play', () => {
    expect(towerCardAvailability({
      gold: 100,
      phase: 'paused',
      portraitBlocked: false,
    }, 100).disabled).toBe(true);
    expect(towerCardAvailability({
      gold: 100,
      phase: 'playing',
      portraitBlocked: true,
    }, 100).disabled).toBe(true);
  });

  it('formats live values and accessible control states', () => {
    expect(createHudView({
      stageId: 1,
      gold: 123,
      baseHp: 7,
      waveIndex: 12,
      waveCount: 10,
      phase: 'paused',
      speed: 2,
      muted: true,
      portraitBlocked: false,
    })).toEqual({
      goldText: '123',
      goldLabel: '골드 123',
      baseHpText: '7',
      baseHpLabel: '기지 체력 7',
      waveText: 'S1 · 10/10',
      waveLabel: '스테이지 1, 현재 웨이브 10/10',
      pauseText: '계속',
      pauseLabel: '게임 계속하기',
      speedText: '2×',
      speedLabel: '게임 속도 2×, 변경',
      muteText: '🔇',
      muteLabel: '소리 켜기',
      hudControlsDisabled: false,
      towerControlsDisabled: true,
    });
  });

  it('disables every game control while portrait blocks play', () => {
    const view = createHudView({
      stageId: 1,
      gold: 450,
      baseHp: 20,
      waveIndex: 0,
      waveCount: 10,
      phase: 'playing',
      speed: 1,
      muted: false,
      portraitBlocked: true,
    });

    expect(view.goldLabel).toBe('골드 450');
    expect(view.baseHpLabel).toBe('기지 체력 20');
    expect(view.waveLabel).toBe('스테이지 1, 현재 웨이브 1/10');
    expect(view.speedLabel).toBe('게임 속도 1×, 변경');
    expect(view.hudControlsDisabled).toBe(true);
    expect(view.towerControlsDisabled).toBe(true);
  });

  it('formats the selected stage into the compact wave status', () => {
    const view = createHudView({
      stageId: 4,
      gold: 320,
      baseHp: 20,
      waveIndex: 2,
      waveCount: 10,
      phase: 'playing',
      speed: 1,
      muted: false,
      portraitBlocked: false,
    });

    expect(view.waveText).toBe('S4 · 3/10');
    expect(view.waveLabel).toBe('스테이지 4, 현재 웨이브 3/10');
  });

  it('marks only unlocked stage buttons as selectable', () => {
    expect(createStagePickerView(2, 3)).toEqual([
      { id: 1, selected: false, locked: false },
      { id: 2, selected: true, locked: false },
      { id: 3, selected: false, locked: false },
      { id: 4, selected: false, locked: true },
      { id: 5, selected: false, locked: true },
      { id: 6, selected: false, locked: true },
    ]);
  });

  it('uses the approved progression action labels', () => {
    expect(stageActionLabel('ready', 1, 1)).toBe('게임 시작');
    expect(stageActionLabel('defeat', 3, 3)).toBe('다시 도전');
    expect(stageActionLabel('victory', 3, 4)).toBe('다음 스테이지');
    expect(stageActionLabel('victory', 6, 6)).toBe('다시 하기');
    expect(stageActionLabel('victory', 3, 2)).toBe('스테이지 2 시작');
  });

  it('moves focus and inert state only when modal visibility changes', () => {
    class FakeTarget implements ModalFocusTarget {
      inert = false;
      isConnected = true;
      focusCount = 0;
      focus() { this.focusCount += 1; }
    }
    const origin = new FakeTarget();
    const stateOverlay = new FakeTarget();
    const stateAction = new FakeTarget();
    const portraitPrompt = new FakeTarget();
    const fallback = new FakeTarget();
    const backgrounds = [new FakeTarget(), new FakeTarget(), new FakeTarget()];
    const manager = createModalFocusManager({
      backgrounds,
      stateOverlay,
      stateAction,
      portraitPrompt,
      fallback,
      getActiveElement: () => origin,
    });

    manager.sync({ stateVisible: true, portraitBlocked: false });
    manager.sync({ stateVisible: true, portraitBlocked: false });
    expect(backgrounds.every((target) => target.inert)).toBe(true);
    expect(stateAction.focusCount).toBe(1);

    manager.sync({ stateVisible: true, portraitBlocked: true });
    manager.sync({ stateVisible: true, portraitBlocked: true });
    expect(stateOverlay.inert).toBe(true);
    expect(portraitPrompt.focusCount).toBe(1);

    manager.sync({ stateVisible: false, portraitBlocked: false });
    expect(backgrounds.every((target) => !target.inert)).toBe(true);
    expect(stateOverlay.inert).toBe(false);
    expect(origin.focusCount).toBe(1);
    expect(fallback.focusCount).toBe(0);
  });

  it('can capture modal transitions before controls change and focus after they update', () => {
    class FakeTarget implements ModalFocusTarget {
      inert = false;
      isConnected = true;
      focusCount = 0;
      focus() { this.focusCount += 1; }
    }
    const origin = new FakeTarget();
    const prompt = new FakeTarget();
    const manager = createModalFocusManager({
      backgrounds: [new FakeTarget()],
      stateOverlay: new FakeTarget(),
      stateAction: new FakeTarget(),
      portraitPrompt: prompt,
      fallback: new FakeTarget(),
      getActiveElement: () => origin,
    });

    expect(manager.prepare({ stateVisible: false, portraitBlocked: true })).toBe(true);
    expect(prompt.focusCount).toBe(0);
    manager.commit();
    expect(prompt.focusCount).toBe(1);

    expect(manager.prepare({ stateVisible: false, portraitBlocked: false })).toBe(true);
    expect(origin.focusCount).toBe(0);
    manager.commit();
    expect(origin.focusCount).toBe(1);
  });
});
