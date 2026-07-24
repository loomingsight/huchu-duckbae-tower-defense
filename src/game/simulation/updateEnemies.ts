import { emitEnemyTraitEvent } from '../enemies/enemyTraits';
import { getStageDefinition } from '../stages/stageCatalog';
import type { GameEnemy, GameState } from './createGame';

const SHADOW_SLIME_CHILD_HP_RATIO = 0.17;

function splitChildren(state: GameState, parent: GameEnemy): GameEnemy[] {
  if (parent.type !== 'shadowSlime' || parent.splitGeneration !== 0) return [];
  emitEnemyTraitEvent(state, parent, 'split');
  return Array.from({ length: 2 }, () => {
    const child: GameEnemy = {
      ...parent,
      id: state.nextEnemyId,
      variant: 'split-child',
      maxHp: parent.maxHp * SHADOW_SLIME_CHILD_HP_RATIO,
      hp: parent.maxHp * SHADOW_SLIME_CHILD_HP_RATIO,
      baseSpeed: parent.baseSpeed * 1.25,
      reward: 2,
      combatScore: 5,
      leak: 1,
      splitGeneration: 1,
      shieldHitsRemaining: 0,
      armorStage: 0,
      auraCooldownRemaining: 0,
      lichPhase: 1,
      rewarded: false,
      lastHitAtSeconds: null,
    };
    state.nextEnemyId += 1;
    return child;
  });
}

function updateArmorStage(state: GameState, enemy: GameEnemy): void {
  if (enemy.type !== 'obsidianGolem' || enemy.maxHp <= 0) return;
  const ratio = enemy.hp / enemy.maxHp;
  if (enemy.armorStage < 1 && ratio <= 0.6) {
    enemy.armorStage = 1;
    emitEnemyTraitEvent(state, enemy, 'armor-crack');
  }
  if (enemy.armorStage < 2 && ratio <= 0.3) {
    enemy.armorStage = 2;
    emitEnemyTraitEvent(state, enemy, 'armor-crack');
  }
}

export function updateEnemies(state: GameState, dt: number): void {
  const safeDt = Number.isFinite(dt) && dt >= 0 ? dt : 0;
  const stage = getStageDefinition(state.stageKey);
  const routeLength = stage.map.pathCells.length - 1;
  const survivors: GameEnemy[] = [];
  const children: GameEnemy[] = [];

  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) {
      if (!enemy.rewarded) {
        state.gold += enemy.reward;
        enemy.rewarded = true;
        state.stats.defeatedEnemies += 1;
        state.stats.combatScore += enemy.combatScore;
        if (enemy.boss) state.stats.bossDefeated = true;
        children.push(...splitChildren(state, enemy));
      }
      continue;
    }

    updateArmorStage(state, enemy);
    enemy.progress += enemy.baseSpeed
      * stage.speedMultiplier
      * enemy.slowMultiplier
      * enemy.auraMultiplier
      * safeDt;
    if (enemy.progress >= routeLength) {
      state.baseHp = Math.max(0, state.baseHp - enemy.leak);
      state.stats.leakedEnemies += 1;
      continue;
    }

    survivors.push(enemy);
  }

  state.enemies = [...survivors, ...children];
  if (state.baseHp === 0) {
    state.outcome = 'defeat';
  }
}
