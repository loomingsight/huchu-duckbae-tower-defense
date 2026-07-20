import { TOWER_CATALOG, TOWER_TYPES, type TowerType } from '../game/towers/towerCatalog';

export type GamePhase = 'loading' | 'ready' | 'playing' | 'paused' | 'victory' | 'defeat';
export type GameSpeed = 1 | 2;

export const TOWER_CARDS = [
  { type: 'slow', name: '느림 장판', roleIcon: '🌀', cost: TOWER_CATALOG.slow.cost },
  { type: 'arrow', name: '화살 타워', roleIcon: '🏹', cost: TOWER_CATALOG.arrow.cost },
  { type: 'deokbae', name: '덕배 타워', roleIcon: '🔥', cost: TOWER_CATALOG.deokbae.cost },
  { type: 'huchu', name: '후추 타워', roleIcon: '💧', cost: TOWER_CATALOG.huchu.cost },
] as const;

export type HudViewInput = Readonly<{
  gold: number;
  baseHp: number;
  waveIndex: number;
  waveCount: number;
  phase: GamePhase;
  speed: GameSpeed;
  muted: boolean;
}>;

export type HudView = Readonly<{
  goldText: string;
  baseHpText: string;
  waveText: string;
  pauseText: string;
  pauseLabel: string;
  speedText: string;
  muteText: string;
  muteLabel: string;
}>;

function wholeNumber(value: number): string {
  return String(Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
}

export function createHudView(input: HudViewInput): HudView {
  const waveCount = Number.isFinite(input.waveCount) ? Math.max(1, Math.floor(input.waveCount)) : 1;
  const wave = Number.isFinite(input.waveIndex)
    ? Math.min(waveCount, Math.max(1, Math.floor(input.waveIndex) + 1))
    : 1;
  const paused = input.phase === 'paused';
  return {
    goldText: wholeNumber(input.gold),
    baseHpText: wholeNumber(input.baseHp),
    waveText: `${wave}/${waveCount}`,
    pauseText: paused ? '계속' : '정지',
    pauseLabel: paused ? '게임 계속하기' : '게임 일시정지',
    speedText: `${input.speed}×`,
    muteText: input.muted ? '🔇' : '🔊',
    muteLabel: input.muted ? '소리 켜기' : '소리 끄기',
  };
}

export type HudElements = Readonly<{
  shell: HTMLElement;
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  gold: HTMLElement;
  baseHp: HTMLElement;
  wave: HTMLElement;
  pauseButton: HTMLButtonElement;
  speedButton: HTMLButtonElement;
  muteButton: HTMLButtonElement;
  towerButtons: Readonly<Record<TowerType, HTMLButtonElement>>;
  placementStatus: HTMLElement;
  orientationPrompt: HTMLElement;
  stateOverlay: HTMLElement;
  stateTitle: HTMLElement;
  stateBody: HTMLElement;
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
          <span class="game-stat" aria-label="골드"><span aria-hidden="true">🪙</span><strong data-hud="gold">0</strong></span>
          <span class="game-stat" aria-label="기지 체력"><span aria-hidden="true">❤️</span><strong data-hud="base-hp">20</strong></span>
          <span class="game-stat" aria-label="현재 웨이브"><span aria-hidden="true">🌊</span><strong data-hud="wave">1/10</strong></span>
        </div>
        <div class="game-hud__controls">
          <button class="game-control icon-control" data-control="pause" type="button" aria-label="게임 일시정지">정지</button>
          <button class="game-control icon-control" data-control="speed" type="button" aria-label="게임 속도 변경">1×</button>
          <button class="game-control icon-control" data-control="mute" type="button" aria-label="소리 끄기" aria-pressed="false">🔊</button>
        </div>
      </header>
      <section class="game-stage" aria-label="게임 보드">
        <canvas class="game-canvas" aria-label="20열 10행 타워 배치 게임 보드"></canvas>
        <p class="placement-status" data-placement-status aria-live="polite"></p>
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
      <div class="orientation-prompt" data-orientation-prompt role="status" hidden>
        <span aria-hidden="true">↻</span>
        <strong>가로 화면으로 돌려 주세요</strong>
      </div>
      <section class="game-overlay" data-state-overlay role="dialog" aria-modal="true" aria-labelledby="game-state-title">
        <div class="game-overlay__panel">
          <p class="game-overlay__eyebrow">후추 디펜스</p>
          <h1 id="game-state-title" data-state-title>게임 준비 중</h1>
          <p data-state-body>캐릭터를 불러오고 있어요.</p>
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
    stage: requiredElement(root, '.game-stage'),
    canvas: requiredElement(root, '.game-canvas'),
    gold: requiredElement(root, '[data-hud="gold"]'),
    baseHp: requiredElement(root, '[data-hud="base-hp"]'),
    wave: requiredElement(root, '[data-hud="wave"]'),
    pauseButton: requiredElement(root, '[data-control="pause"]'),
    speedButton: requiredElement(root, '[data-control="speed"]'),
    muteButton: requiredElement(root, '[data-control="mute"]'),
    towerButtons,
    placementStatus: requiredElement(root, '[data-placement-status]'),
    orientationPrompt: requiredElement(root, '[data-orientation-prompt]'),
    stateOverlay: requiredElement(root, '[data-state-overlay]'),
    stateTitle: requiredElement(root, '[data-state-title]'),
    stateBody: requiredElement(root, '[data-state-body]'),
    stateAction: requiredElement(root, '[data-state-action]'),
  };
}

export function renderHud(
  elements: HudElements,
  input: HudViewInput,
  selectedTower: TowerType | null,
): void {
  const view = createHudView(input);
  elements.gold.textContent = view.goldText;
  elements.baseHp.textContent = view.baseHpText;
  elements.wave.textContent = view.waveText;
  elements.pauseButton.textContent = view.pauseText;
  elements.pauseButton.setAttribute('aria-label', view.pauseLabel);
  elements.speedButton.textContent = view.speedText;
  elements.muteButton.textContent = view.muteText;
  elements.muteButton.setAttribute('aria-label', view.muteLabel);
  elements.muteButton.setAttribute('aria-pressed', String(input.muted));
  const controlsEnabled = input.phase === 'playing' || input.phase === 'paused';
  elements.pauseButton.disabled = !controlsEnabled;
  elements.speedButton.disabled = !controlsEnabled;

  for (const card of TOWER_CARDS) {
    const button = elements.towerButtons[card.type];
    const isSelected = selectedTower === card.type;
    button.disabled = input.phase !== 'playing';
    button.setAttribute('aria-pressed', String(isSelected));
    button.classList.toggle('tower-card--selected', isSelected);
    button.classList.toggle('tower-card--unaffordable', input.gold < card.cost);
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
    victory: { title: '간식 창고를 지켰어요!', action: '다시 하기' },
    defeat: { title: '간식 창고가 비었어요', action: '다시 도전' },
  };
  const state = content[phase];
  elements.stateOverlay.hidden = state === undefined;
  if (state === undefined) return;
  elements.stateTitle.textContent = state.title;
  elements.stateBody.textContent = body;
  elements.stateAction.textContent = state.action;
  elements.stateAction.disabled = phase === 'loading';
}
