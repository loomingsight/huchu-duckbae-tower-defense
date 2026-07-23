import type { EnemyTraitVisualEvent } from '../enemies/enemyTraits';
import type { GameHitEvent, GameTower } from '../simulation/createGame';
import type { Vec2 } from '../types';

export const SLOW_PULSE_INTERVAL_SECONDS = 3;
export const SLOW_PULSE_DURATION_SECONDS = 0.6;

export type TimedEffect = Readonly<{
  age: number;
  duration: number;
}>;

type PositionedEffect = TimedEffect & Readonly<{
  position: Readonly<Vec2>;
}>;

export type TraitRuntimeEffectKind =
  | 'shield-open'
  | 'shield-block'
  | 'shield-break'
  | 'split-burst'
  | 'slow-resist'
  | 'armor-crack'
  | 'lich-aura'
  | 'lich-phase-two';

export type RuntimeEffect =
  | (PositionedEffect & Readonly<{ kind: 'aqua-splash' }>)
  | (PositionedEffect & Readonly<{ kind: 'fire-burst' }>)
  | (PositionedEffect & Readonly<{ kind: 'arrow-impact' }>)
  | (PositionedEffect & Readonly<{ kind: 'slow-pulse' }>)
  | (PositionedEffect & Readonly<{ kind: 'gold-pop'; value: number }>)
  | (PositionedEffect & Readonly<{
    kind: TraitRuntimeEffectKind;
    radius: number;
  }>);

export type FrameCue = 'shot' | 'hit' | 'leak';

export type FrameEventBatch = Readonly<{
  hitEvents: readonly Readonly<GameHitEvent>[];
  traitEvents: readonly EnemyTraitVisualEvent[];
  cueTypes: readonly FrameCue[];
}>;

export type FrameEventBuffer = Readonly<{
  recordStep(step: Readonly<{
    hitEvents: readonly Readonly<GameHitEvent>[];
    traitEvents?: readonly EnemyTraitVisualEvent[];
    shot: boolean;
    leak: boolean;
  }>): void;
  peek(): FrameEventBatch;
  clear(): void;
  reset(): void;
}>;

export function createFrameEventBuffer(): FrameEventBuffer {
  let hitEvents: GameHitEvent[] = [];
  let traitEvents: EnemyTraitVisualEvent[] = [];
  const cueTypes = new Set<FrameCue>();

  function clear(): void {
    hitEvents = [];
    traitEvents = [];
    cueTypes.clear();
  }

  return {
    recordStep(step) {
      if (step.shot) cueTypes.add('shot');
      if (step.hitEvents.length > 0) cueTypes.add('hit');
      if (step.leak) cueTypes.add('leak');
      for (const event of step.hitEvents) {
        hitEvents.push({
          kind: 'hit',
          towerType: event.towerType,
          position: { ...event.position },
          radius: event.radius,
        });
      }
      for (const event of step.traitEvents ?? []) {
        traitEvents.push({
          kind: event.kind,
          enemyId: event.enemyId,
          position: { ...event.position },
          ...(event.radius === undefined ? {} : { radius: event.radius }),
        });
      }
    },
    peek() {
      return {
        hitEvents: hitEvents.map((event) => ({ ...event, position: { ...event.position } })),
        traitEvents: traitEvents.map((event) => ({
          ...event,
          position: { ...event.position },
        })),
        cueTypes: [...cueTypes],
      };
    },
    clear,
    reset: clear,
  };
}

export function updateEffects<T extends TimedEffect>(
  effects: readonly T[],
  deltaSeconds: number,
): T[] {
  const elapsed = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
  return effects.flatMap((effect) => {
    if (
      !Number.isFinite(effect.age)
      || !Number.isFinite(effect.duration)
      || effect.duration <= 0
    ) return [];
    const age = Math.max(0, effect.age) + elapsed;
    return age < effect.duration ? [{ ...effect, age }] : [];
  });
}

export function effectForHit(event: Readonly<GameHitEvent>): RuntimeEffect | null {
  if (!Number.isFinite(event.position.x) || !Number.isFinite(event.position.y)) return null;
  const position = { ...event.position };
  if (event.towerType === 'huchu') {
    return { kind: 'aqua-splash', position, age: 0, duration: 0.48 };
  }
  if (event.towerType === 'deokbae') {
    return { kind: 'fire-burst', position, age: 0, duration: 0.34 };
  }
  return { kind: 'arrow-impact', position, age: 0, duration: 0.22 };
}

export function effectsForHits(events: readonly Readonly<GameHitEvent>[]): RuntimeEffect[] {
  return events.flatMap((event) => {
    const effect = effectForHit(event);
    return effect === null ? [] : [effect];
  });
}

const TRAIT_EFFECTS: Readonly<Record<
  Exclude<EnemyTraitVisualEvent['kind'], 'damage' | 'split'> | 'split-burst',
  number
>> = {
  'shield-open': 0.35,
  'shield-block': 0.12,
  'shield-break': 0.24,
  'split-burst': 0.4,
  'slow-resist': 0.28,
  'armor-crack': 0.35,
  'lich-aura': 0.4,
  'lich-phase-two': 0.8,
};

export function effectsForTraits(
  events: readonly EnemyTraitVisualEvent[],
): RuntimeEffect[] {
  return events.flatMap((event) => {
    if (
      event.kind === 'damage'
      || !Number.isFinite(event.position.x)
      || !Number.isFinite(event.position.y)
    ) return [];
    const kind: TraitRuntimeEffectKind = event.kind === 'split'
      ? 'split-burst'
      : event.kind;
    const radius = Number.isFinite(event.radius)
      ? Math.max(0, event.radius ?? 0)
      : 0;
    return [{
      kind,
      position: { ...event.position },
      radius,
      age: 0,
      duration: TRAIT_EFFECTS[kind],
    }];
  });
}

export function createGoldPop(position: Readonly<Vec2>, value: number): RuntimeEffect | null {
  if (
    !Number.isFinite(position.x)
    || !Number.isFinite(position.y)
    || !Number.isFinite(value)
    || value <= 0
  ) return null;
  return {
    kind: 'gold-pop',
    position: { ...position },
    value,
    age: 0,
    duration: 0.9,
  };
}

export function createSlowPulse(position: Readonly<Vec2>): RuntimeEffect | null {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return null;
  return {
    kind: 'slow-pulse',
    position: { ...position },
    age: 0,
    duration: SLOW_PULSE_DURATION_SECONDS,
  };
}

export function slowPulseEffects(
  towers: readonly Readonly<GameTower>[],
  elapsedSeconds: number,
): RuntimeEffect[] {
  const now = Number.isFinite(elapsedSeconds) && elapsedSeconds >= 0 ? elapsedSeconds : 0;
  return towers.flatMap((tower) => {
    if (tower.type !== 'slow') return [];
    const placedAt = Number.isFinite(tower.placedAtSeconds) && tower.placedAtSeconds >= 0
      ? tower.placedAtSeconds
      : 0;
    const age = Math.max(0, now - placedAt) % SLOW_PULSE_INTERVAL_SECONDS;
    if (age >= SLOW_PULSE_DURATION_SECONDS) return [];
    const effect = createSlowPulse(tower.position);
    return effect === null ? [] : [{ ...effect, age }];
  });
}
