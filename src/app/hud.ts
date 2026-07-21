import { TOWER_CATALOG, TOWER_TYPES, type TowerType } from '../game/towers/towerCatalog';

export const GAME_NAME = '후추덕배 타워 디펜스';

export type GamePhase = 'loading' | 'ready' | 'playing' | 'paused' | 'victory' | 'defeat';
export type GameSpeed = 1 | 2;

export const TOWER_CARDS = [
  { type: 'slow', name: '슬로우 타워', roleIcon: '🌀', cost: TOWER_CATALOG.slow.cost },
  { type: 'arrow', name: '화살 타워', roleIcon: '🏹', cost: TOWER_CATALOG.arrow.cost },
  { type: 'deokbae', name: '덕배', roleIcon: '🔥', cost: TOWER_CATALOG.deokbae.cost },
  { type: 'huchu', name: '후추', roleIcon: '💧', cost: TOWER_CATALOG.huchu.cost },
] as const;

export type HudViewInput = Readonly<{
  gold: number;
  baseHp: number;
  waveIndex: number;
  waveCount: number;
  phase: GamePhase;
  speed: GameSpeed;
  muted: boolean;
  portraitBlocked: boolean;
}>;

export type HudView = Readonly<{
  goldText: string;
  goldLabel: string;
  baseHpText: string;
  baseHpLabel: string;
  waveText: string;
  waveLabel: string;
  pauseText: string;
  pauseLabel: string;
  speedText: string;
  speedLabel: string;
  muteText: string;
  muteLabel: string;
  hudControlsDisabled: boolean;
  towerControlsDisabled: boolean;
}>;

export function towerCardAvailability(
  input: Pick<HudViewInput, 'gold' | 'phase' | 'portraitBlocked'>,
  cost: number,
): Readonly<{ disabled: boolean; unaffordable: boolean }> {
  const unaffordable = !Number.isFinite(input.gold)
    || !Number.isFinite(cost)
    || input.gold < cost;
  return {
    unaffordable,
    disabled: input.portraitBlocked || input.phase !== 'playing' || unaffordable,
  };
}

function wholeNumber(value: number): string {
  return String(Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
}

export function createHudView(input: HudViewInput): HudView {
  const waveCount = Number.isFinite(input.waveCount) ? Math.max(1, Math.floor(input.waveCount)) : 1;
  const wave = Number.isFinite(input.waveIndex)
    ? Math.min(waveCount, Math.max(1, Math.floor(input.waveIndex) + 1))
    : 1;
  const paused = input.phase === 'paused';
  const goldText = wholeNumber(input.gold);
  const baseHpText = wholeNumber(input.baseHp);
  const waveText = `${wave}/${waveCount}`;
  const speedText = `${input.speed}×`;
  const isLivePhase = input.phase === 'playing' || input.phase === 'paused';
  return {
    goldText,
    goldLabel: `골드 ${goldText}`,
    baseHpText,
    baseHpLabel: `기지 체력 ${baseHpText}`,
    waveText,
    waveLabel: `현재 웨이브 ${waveText}`,
    pauseText: paused ? '계속' : '정지',
    pauseLabel: paused ? '게임 계속하기' : '게임 일시정지',
    speedText,
    speedLabel: `게임 속도 ${speedText}, 변경`,
    muteText: input.muted ? '🔇' : '🔊',
    muteLabel: input.muted ? '소리 켜기' : '소리 끄기',
    hudControlsDisabled: input.portraitBlocked || !isLivePhase,
    towerControlsDisabled: input.portraitBlocked || input.phase !== 'playing',
  };
}

export type ModalFocusTarget = {
  inert: boolean;
  readonly isConnected?: boolean;
  focus(): void;
};

type ModalMode = 'none' | 'state' | 'portrait';

export function createModalFocusManager(options: Readonly<{
  backgrounds: readonly ModalFocusTarget[];
  stateOverlay: ModalFocusTarget;
  stateAction: ModalFocusTarget;
  portraitPrompt: ModalFocusTarget;
  fallback: ModalFocusTarget;
  getActiveElement(): ModalFocusTarget | null;
}>) {
  let mode: ModalMode = 'none';
  let previousFocus: ModalFocusTarget | null = null;
  let pendingFocus: ModalFocusTarget | null = null;

  function prepare(state: Readonly<{ stateVisible: boolean; portraitBlocked: boolean }>): boolean {
    const nextMode: ModalMode = state.portraitBlocked
      ? 'portrait'
      : state.stateVisible ? 'state' : 'none';
    if (nextMode === mode) return false;

    if (mode === 'none' && nextMode !== 'none') previousFocus = options.getActiveElement();
    const modalVisible = nextMode !== 'none';
    for (const target of options.backgrounds) target.inert = modalVisible;
    options.stateOverlay.inert = nextMode === 'portrait';

    mode = nextMode;
    if (mode === 'portrait') pendingFocus = options.portraitPrompt;
    else if (mode === 'state') pendingFocus = options.stateAction;
    else {
      const restore = previousFocus?.isConnected === false ? options.fallback : previousFocus;
      pendingFocus = restore ?? options.fallback;
      previousFocus = null;
    }
    return true;
  }

  function commit(): void {
    pendingFocus?.focus();
    pendingFocus = null;
  }

  function sync(state: Readonly<{ stateVisible: boolean; portraitBlocked: boolean }>): void {
    if (prepare(state)) commit();
  }

  return {
    prepare,
    commit,
    sync,
    destroy() {
      pendingFocus = null;
      for (const target of options.backgrounds) target.inert = false;
      options.stateOverlay.inert = false;
    },
  };
}

export type HudElements = Readonly<{
  shell: HTMLElement;
  header: HTMLElement;
  stage: HTMLElement;
  tray: HTMLElement;
  canvas: HTMLCanvasElement;
  gold: HTMLElement;
  goldStat: HTMLElement;
  baseHp: HTMLElement;
  baseHpStat: HTMLElement;
  wave: HTMLElement;
  waveStat: HTMLElement;
  pauseButton: HTMLButtonElement;
  speedButton: HTMLButtonElement;
  muteButton: HTMLButtonElement;
  towerButtons: Readonly<Record<TowerType, HTMLButtonElement>>;
  placementStatus: HTMLElement;
  placementActions: HTMLElement;
  placementName: HTMLElement;
  placementCost: HTMLElement;
  placementConfirm: HTMLButtonElement;
  placementCancel: HTMLButtonElement;
  orientationPrompt: HTMLElement;
  stateOverlay: HTMLElement;
  stateTitle: HTMLElement;
  stateBody: HTMLElement;
  resultPanel: HTMLElement;
  stateAction: HTMLButtonElement;
}>;

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing game shell element: ${selector}`);
  return element;
}

export function createHud(root: HTMLElement): HudElements {
  root.innerHTML = `
    <main class="game-shell">
      <header class="game-hud" aria-label="게임 상태와 조작">
        <div class="game-hud__stats">
          <span class="game-stat" data-stat="gold" aria-label="골드 0"><span aria-hidden="true">🪙</span><strong data-hud="gold">0</strong></span>
          <span class="game-stat" data-stat="base-hp" aria-label="기지 체력 20"><span aria-hidden="true">❤️</span><strong data-hud="base-hp">20</strong></span>
          <span class="game-stat" data-stat="wave" aria-label="현재 웨이브 1/10"><span aria-hidden="true">🌊</span><strong data-hud="wave">1/10</strong></span>
        </div>
        <div class="game-hud__controls">
          <button class="game-control icon-control" data-control="pause" type="button" aria-label="게임 일시정지">정지</button>
          <button class="game-control icon-control" data-control="speed" type="button" aria-label="게임 속도 1×, 변경">1×</button>
          <button class="game-control icon-control" data-control="mute" type="button" aria-label="소리 끄기" aria-pressed="false">🔊</button>
        </div>
      </header>
      <section class="game-stage" aria-label="게임 보드">
        <canvas class="game-canvas" aria-label="20열 10행 타워 배치 게임 보드" tabindex="0"></canvas>
        <p class="placement-status" data-placement-status aria-live="polite"></p>
        <div class="placement-actions" data-placement-actions role="group" aria-label="타워 배치 확인" hidden>
          <span class="placement-actions__copy"><strong data-placement-name>타워</strong><small data-placement-cost>0G</small></span>
          <button class="game-control placement-actions__confirm" data-placement-confirm type="button">배치</button>
          <button class="game-control placement-actions__cancel" data-placement-cancel type="button">취소</button>
        </div>
      </section>
      <nav class="tower-tray" aria-label="타워 선택">
        ${TOWER_CARDS.map((card) => `
          <button class="game-control tower-card" data-tower="${card.type}" type="button"
            aria-label="${card.name}, ${card.cost} 골드" aria-pressed="false">
            <span class="tower-card__icon" aria-hidden="true">${card.roleIcon}</span>
            <span class="tower-card__copy"><strong>${card.name}</strong><small>${card.cost}G</small></span>
          </button>
        `).join('')}
      </nav>
      <div class="orientation-prompt" data-orientation-prompt role="dialog" aria-modal="true" aria-labelledby="orientation-title" tabindex="-1" hidden>
        <span aria-hidden="true">↻</span>
        <strong id="orientation-title">가로 화면으로 돌려 주세요</strong>
      </div>
      <section class="game-overlay" data-state-overlay role="dialog" aria-modal="true" aria-labelledby="game-state-title">
        <div class="game-overlay__panel">
          <p class="game-overlay__eyebrow">${GAME_NAME}</p>
          <h1 id="game-state-title" data-state-title>게임 준비 중</h1>
          <p data-state-body>캐릭터를 불러오고 있어요.</p>
          <div class="game-result" data-result-panel hidden></div>
          <button class="game-control game-overlay__action" data-state-action type="button" disabled>잠시만요</button>
        </div>
      </section>
    </main>
  `;

  const towerButtons = Object.fromEntries(TOWER_TYPES.map((type) => [
    type,
    requiredElement<HTMLButtonElement>(root, `[data-tower="${type}"]`),
  ])) as Record<TowerType, HTMLButtonElement>;

  return {
    shell: requiredElement(root, '.game-shell'),
    header: requiredElement(root, '.game-hud'),
    stage: requiredElement(root, '.game-stage'),
    tray: requiredElement(root, '.tower-tray'),
    canvas: requiredElement(root, '.game-canvas'),
    gold: requiredElement(root, '[data-hud="gold"]'),
    goldStat: requiredElement(root, '[data-stat="gold"]'),
    baseHp: requiredElement(root, '[data-hud="base-hp"]'),
    baseHpStat: requiredElement(root, '[data-stat="base-hp"]'),
    wave: requiredElement(root, '[data-hud="wave"]'),
    waveStat: requiredElement(root, '[data-stat="wave"]'),
    pauseButton: requiredElement(root, '[data-control="pause"]'),
    speedButton: requiredElement(root, '[data-control="speed"]'),
    muteButton: requiredElement(root, '[data-control="mute"]'),
    towerButtons,
    placementStatus: requiredElement(root, '[data-placement-status]'),
    placementActions: requiredElement(root, '[data-placement-actions]'),
    placementName: requiredElement(root, '[data-placement-name]'),
    placementCost: requiredElement(root, '[data-placement-cost]'),
    placementConfirm: requiredElement(root, '[data-placement-confirm]'),
    placementCancel: requiredElement(root, '[data-placement-cancel]'),
    orientationPrompt: requiredElement(root, '[data-orientation-prompt]'),
    stateOverlay: requiredElement(root, '[data-state-overlay]'),
    stateTitle: requiredElement(root, '[data-state-title]'),
    stateBody: requiredElement(root, '[data-state-body]'),
    resultPanel: requiredElement(root, '[data-result-panel]'),
    stateAction: requiredElement(root, '[data-state-action]'),
  };
}

export type ResultPanelView = Readonly<{
  score: number;
  stars: 1 | 2 | 3;
  newBestScore: boolean;
  completedWaves: number;
  defeatedEnemies: number;
  baseHp: number;
  bossDefeated: boolean;
  elapsedText: string;
  timeBonus: number;
  bestScore: number;
  bestClearText: string;
  totalAttempts: number;
  totalVictories: number;
  nextGoalText: string;
}>;

export function renderResultPanel(
  elements: HudElements,
  view: ResultPanelView | null,
): void {
  elements.resultPanel.hidden = view === null;
  if (view === null) {
    elements.resultPanel.replaceChildren();
    return;
  }
  const stars = `${'★'.repeat(view.stars)}${'☆'.repeat(3 - view.stars)}`;
  elements.resultPanel.innerHTML = `
    <div class="game-result__hero">
      <span class="game-result__stars" aria-label="별 ${view.stars}개">${stars}</span>
      <strong class="game-result__score">${view.score.toLocaleString('ko-KR')}점</strong>
      ${view.newBestScore ? '<span class="game-result__badge">새 최고 기록</span>' : ''}
    </div>
    <dl class="game-result__breakdown">
      <div><dt>웨이브</dt><dd>${view.completedWaves}/10</dd></div>
      <div><dt>처치</dt><dd>${view.defeatedEnemies}</dd></div>
      <div><dt>남은 체력</dt><dd>${view.baseHp}</dd></div>
      <div><dt>보스</dt><dd>${view.bossDefeated ? '처치 완료' : '미처리'}</dd></div>
      <div><dt>시간</dt><dd>${view.elapsedText}</dd></div>
      <div><dt>시간 보너스</dt><dd>+${view.timeBonus.toLocaleString('ko-KR')}</dd></div>
    </dl>
    <div class="game-result__records">
      <span>최고 ${view.bestScore.toLocaleString('ko-KR')}점</span>
      <span>최단 ${view.bestClearText}</span>
      <span>도전 ${view.totalAttempts}회 · 승리 ${view.totalVictories}회</span>
    </div>
    <p class="game-result__goal">${view.nextGoalText}</p>
  `;
}

export function showPlacementActions(
  elements: HudElements,
  type: TowerType | null,
  visible: boolean,
): void {
  const card = type === null ? undefined : TOWER_CARDS.find((candidate) => candidate.type === type);
  const show = visible && card !== undefined;
  elements.placementActions.hidden = !show;
  if (!show || card === undefined) return;
  elements.placementName.textContent = card.name;
  elements.placementCost.textContent = `${card.cost}G`;
  elements.placementConfirm.setAttribute('aria-label', `${card.name} 배치 확정`);
  elements.placementCancel.setAttribute('aria-label', `${card.name} 배치 취소`);
}

export function renderHud(
  elements: HudElements,
  input: HudViewInput,
  selectedTower: TowerType | null,
): void {
  const view = createHudView(input);
  elements.gold.textContent = view.goldText;
  elements.goldStat.setAttribute('aria-label', view.goldLabel);
  elements.baseHp.textContent = view.baseHpText;
  elements.baseHpStat.setAttribute('aria-label', view.baseHpLabel);
  elements.wave.textContent = view.waveText;
  elements.waveStat.setAttribute('aria-label', view.waveLabel);
  elements.pauseButton.textContent = view.pauseText;
  elements.pauseButton.setAttribute('aria-label', view.pauseLabel);
  elements.speedButton.textContent = view.speedText;
  elements.speedButton.setAttribute('aria-label', view.speedLabel);
  elements.muteButton.textContent = view.muteText;
  elements.muteButton.setAttribute('aria-label', view.muteLabel);
  elements.muteButton.setAttribute('aria-pressed', String(input.muted));
  elements.pauseButton.disabled = view.hudControlsDisabled;
  elements.speedButton.disabled = view.hudControlsDisabled;
  elements.muteButton.disabled = view.hudControlsDisabled;

  for (const card of TOWER_CARDS) {
    const button = elements.towerButtons[card.type];
    const isSelected = selectedTower === card.type;
    const availability = towerCardAvailability(input, card.cost);
    button.disabled = availability.disabled;
    button.setAttribute('aria-pressed', String(isSelected));
    button.classList.toggle('tower-card--selected', isSelected);
    button.classList.toggle('tower-card--unaffordable', availability.unaffordable);
  }
}

export function showStateOverlay(
  elements: HudElements,
  phase: GamePhase,
  body = '',
): void {
  const content: Partial<Record<GamePhase, { title: string; action: string }>> = {
    loading: { title: '게임 준비 중', action: '잠시만요' },
    ready: { title: '간식 창고를 지켜 주세요', action: '게임 시작' },
    victory: { title: '간식 창고를 지켜줘서 고마워요', action: '다시 하기' },
    defeat: { title: '간식 창고가 다 털려버렸어요', action: '다시 도전' },
  };
  const state = content[phase];
  elements.stateOverlay.hidden = state === undefined;
  if (state === undefined) return;
  elements.stateTitle.textContent = state.title;
  elements.stateBody.textContent = body;
  elements.stateAction.textContent = state.action;
  elements.stateAction.disabled = phase === 'loading';
}
