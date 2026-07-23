import { isWithinRadius } from '../combat/radius';
import { enemyPosition } from '../combat/targeting';
import type {
  GameEnemy,
  GameState,
} from '../simulation/createGame';
import type { Vec2 } from '../types';

export type EnemyTraitVisualEvent = Readonly<{
  kind:
    | 'shield-open'
    | 'shield-block'
    | 'shield-break'
    | 'damage'
    | 'split'
    | 'slow-resist'
    | 'armor-crack'
    | 'lich-aura'
    | 'lich-phase-two';
  enemyId: number;
  position: Readonly<Vec2>;
  radius?: number;
}>;

function eventPosition(
  state: Readonly<GameState>,
  enemy: Readonly<GameEnemy>,
): Readonly<Vec2> {
  return enemyPosition(enemy, state.stageKey) ?? { x: 0, y: 0 };
}

export function emitEnemyTraitEvent(
  state: GameState,
  enemy: Readonly<GameEnemy>,
  kind: EnemyTraitVisualEvent['kind'],
  radius?: number,
): void {
  state.traitEvents.push({
    kind,
    enemyId: enemy.id,
    position: eventPosition(state, enemy),
    ...(radius === undefined ? {} : { radius }),
  });
}

export function applyEnemyDamage(
  state: GameState,
  enemy: GameEnemy,
  damage: number,
): void {
  if (enemy.hp <= 0 || !Number.isFinite(damage) || damage <= 0) return;
  if (enemy.shieldHitsRemaining > 0) {
    enemy.shieldHitsRemaining -= 1;
    emitEnemyTraitEvent(
      state,
      enemy,
      enemy.shieldHitsRemaining === 0 ? 'shield-break' : 'shield-block',
    );
    return;
  }

  const previousHp = enemy.hp;
  enemy.hp = Math.max(0, enemy.hp - damage);
  if (enemy.hp < previousHp) {
    enemy.lastHitAtSeconds = state.elapsedSeconds;
    emitEnemyTraitEvent(state, enemy, 'damage');
  }
}

function updateAuraDurations(state: GameState, dt: number): void {
  for (const enemy of state.enemies) {
    enemy.auraRemaining = Math.max(0, enemy.auraRemaining - dt);
    if (enemy.auraRemaining === 0) enemy.auraMultiplier = 1;
  }
}

function enterLichPhaseTwo(state: GameState, lich: GameEnemy): void {
  if (
    state.stageKey !== 'nightmare-6'
    || lich.lichPhase !== 1
    || lich.maxHp <= 0
    || lich.hp / lich.maxHp >= 0.5
  ) return;
  lich.lichPhase = 2;
  lich.leak = 12;
  lich.auraCooldownRemaining = Math.min(lich.auraCooldownRemaining, 4.5);
  emitEnemyTraitEvent(state, lich, 'lich-phase-two');
}

function castLichAura(state: GameState, lich: GameEnemy): void {
  const lichPosition = enemyPosition(lich, state.stageKey);
  if (lichPosition === undefined) return;
  const phaseTwo = lich.lichPhase === 2;
  const multiplier = phaseTwo ? 1.3 : 1.2;
  const duration = phaseTwo ? 3.5 : 3;
  for (const target of state.enemies) {
    if (target.id === lich.id || target.hp <= 0) continue;
    const targetPosition = enemyPosition(target, state.stageKey);
    if (targetPosition === undefined || !isWithinRadius(lichPosition, targetPosition, 2.7)) {
      continue;
    }
    target.auraMultiplier = Math.max(target.auraMultiplier, multiplier);
    target.auraRemaining = Math.max(target.auraRemaining, duration);
  }
  emitEnemyTraitEvent(state, lich, 'lich-aura', 2.7);
}

export function updateEnemyTraits(state: GameState, dt: number): void {
  const safeDt = Number.isFinite(dt) && dt >= 0 ? dt : 0;
  updateAuraDurations(state, safeDt);

  for (const lich of state.enemies) {
    if (lich.type !== 'lichKing' || lich.hp <= 0) continue;
    enterLichPhaseTwo(state, lich);
    lich.auraCooldownRemaining -= safeDt;
    if (lich.auraCooldownRemaining > 0) continue;
    castLichAura(state, lich);
    lich.auraCooldownRemaining = lich.lichPhase === 2 ? 4.5 : 7;
  }
}
