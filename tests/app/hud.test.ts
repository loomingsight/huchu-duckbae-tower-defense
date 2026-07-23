import { describe, expect, it } from 'vitest';

import {
  createHudView,
  createModalFocusManager,
  createResultPanelMarkup,
  createStageSelectView,
  createTraitNoticeMarkup,
  GAME_NAME,
  stageActionLabel,
  TOWER_CARDS,
  towerTrayPositionView,
  towerCardAvailability,
  type ModalFocusTarget,
} from '../../src/app/hud';
import {
  defaultPreferences,
  type StageRecord,
} from '../../src/app/preferences';
import { createGame } from '../../src/game/simulation/createGame';

function clearedRecord(score: number, stars: 1 | 2 | 3 = 2): StageRecord {
  return {
    bestScore: score,
    bestClearScore: score,
    bestClearSeconds: 95,
    bestStars: stars,
    bossDefeated: true,
  };
}

describe('mobile HUD view', () => {
  it('uses the approved game name', () => {
    expect(GAME_NAME).toBe('후추덕배 타워 디펜스');
  });

  it('renders the approved nonblocking slow-resistance notice copy', () => {
    const markup = createTraitNoticeMarkup({
      title: '흡혈 박쥐 · 둔화 저항',
      body: '슬로우 효과가 50%만 적용돼요',
    });

    expect(markup).toContain('<strong>흡혈 박쥐 · 둔화 저항</strong>');
    expect(markup).toContain('<span>슬로우 효과가 50%만 적용돼요</span>');
    expect(markup).not.toContain('button');
    expect(markup).not.toContain('+');
  });

  it('exposes the four tower names, role icons, and prices', () => {
    expect(TOWER_CARDS).toEqual([
      { type: 'slow', name: '슬로우 타워', roleIcon: '🌀', cost: 80 },
      { type: 'arrow', name: '화살 타워', roleIcon: '🏹', cost: 100 },
      { type: 'deokbae', name: '덕배', roleIcon: '🔥', cost: 420 },
      { type: 'huchu', name: '후추', roleIcon: '💧', cost: 560 },
    ]);
  });

  it('describes the mobile tower tray position toggle accessibly', () => {
    expect(towerTrayPositionView('bottom')).toEqual({
      icon: '↑',
      label: '타워 버튼 위로 이동',
      pressed: false,
    });
    expect(towerTrayPositionView('top')).toEqual({
      icon: '↓',
      label: '타워 버튼 아래로 이동',
      pressed: true,
    });
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
      stageKey: 'normal-1',
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
      stageKey: 'normal-1',
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
      stageKey: 'normal-4',
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

  it('builds stage cards with names, progression states, and saved records', () => {
    const cards = createStageSelectView('normal', 'normal-2', {
      ...defaultPreferences(),
      highestUnlockedByMode: { normal: 2, nightmare: 0 },
      stageRecords: {
        'normal-1': clearedRecord(8400),
        'normal-2': {
          bestScore: 2200,
          bestClearScore: 0,
          bestClearSeconds: null,
          bestStars: 0,
          bossDefeated: false,
        },
      },
    });

    expect(cards).toHaveLength(6);
    expect(cards[0]).toMatchObject({
      key: 'normal-1',
      mode: 'normal',
      number: 1,
      name: '초록 들판',
      selected: false,
      locked: false,
      status: 'cleared',
      bestStars: 2,
    });
    expect(cards[0].recordText).toContain('★★☆');
    expect(cards[1]).toMatchObject({
      key: 'normal-2',
      selected: true,
      locked: false,
      status: 'available',
    });
    expect(cards[1].recordText).toContain('최고 2,200점');
    expect(cards[2]).toMatchObject({
      key: 'normal-3',
      locked: true,
      status: 'locked',
    });
  });

  it('shows only the active mode six-card set and separate records', () => {
    const view = createStageSelectView(
      'nightmare',
      'nightmare-1',
      {
        ...defaultPreferences(),
        highestUnlockedByMode: { normal: 6, nightmare: 1 },
        stageRecords: {
          'normal-1': clearedRecord(9000),
          'nightmare-1': clearedRecord(23000, 3),
        },
      },
    );
    expect(view).toHaveLength(6);
    expect(view[0]).toMatchObject({
      key: 'nightmare-1',
      name: '달빛 늪',
      selected: true,
      locked: false,
    });
    expect(view[0].recordText).toContain('★★★');
  });

  it('shows an unlocked stage without a score as having no record', () => {
    const stage = createStageSelectView(
      'normal',
      'normal-1',
      defaultPreferences(),
    )[0];

    expect(stage.recordText).toBe('기록 없음');
    expect(stage.ariaLabel).toContain('기록 없음');
  });

  it('uses the approved progression action labels', () => {
    expect(stageActionLabel('ready', 'normal-1', 'normal-1')).toBe('게임 시작');
    expect(stageActionLabel('defeat', 'normal-3', 'normal-3')).toBe('다시 도전');
    expect(stageActionLabel('victory', 'normal-3', 'normal-4')).toBe('다음 스테이지');
    expect(stageActionLabel('victory', 'nightmare-6', 'nightmare-6')).toBe('다시 하기');
    expect(stageActionLabel('victory', 'normal-3', 'normal-2')).toBe('스테이지 2 시작');
    expect(stageActionLabel('victory', 'normal-6', 'nightmare-1'))
      .toBe('나이트메어 1 시작');
  });

  it('renders nightmare result bonuses, zero stars, and the guardian badge', () => {
    const markup = createResultPanelMarkup({
      modeLabel: '나이트메어',
      stageName: '심연의 성문',
      score: 1800,
      stars: 0,
      newBestScore: true,
      newBadge: true,
      completedWaves: 2,
      defeatedEnemies: 8,
      combatScore: 200,
      baseHp: 0,
      bossDefeated: false,
      elapsedText: '1:32',
      timeBonus: 0,
      difficultyBonus: 600,
      bestScore: 1800,
      bestClearText: '--:--',
      totalAttempts: 3,
      totalVictories: 1,
      nextGoalText: '별 하나를 더 받으려면 16,700점이 필요해요.',
    });

    expect(markup).toContain('나이트메어 · 심연의 성문');
    expect(markup).toContain('aria-label="별 0개">☆☆☆');
    expect(markup).toContain('전투 점수');
    expect(markup).toContain('200');
    expect(markup).toContain('나이트메어 보너스 ×1.5');
    expect(markup).toContain('+600');
    expect(markup).toContain('심연의 수호자');
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
