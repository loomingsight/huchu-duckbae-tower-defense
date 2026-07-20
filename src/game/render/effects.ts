import type { GameHitEvent } from '../simulation/createGame';
import type { Vec2 } from '../types';

export type TimedEffect = Readonly<{
  age: number;
  duration: number;
}>;

type PositionedEffect = TimedEffect & Readonly<{
  position: Readonly<Vec2>;
}>;

export type RuntimeEffect =
  | (PositionedEffect & Readonly<{ kind: 'aqua-splash' }>)
  | (PositionedEffect & Readonly<{ kind: 'fire-burst' }>)
  | (PositionedEffect & Readonly<{ kind: 'arrow-impact' }>)
  | (PositionedEffect & Readonly<{ kind: 'slow-pulse' }>)
  | (PositionedEffect & Readonly<{ kind: 'gold-pop'; value: number }>);

export type FrameCue = 'shot' | 'hit' | 'leak';

export type FrameEventBatch = Readonly<{
  hitEvents: readonly Readonly<GameHitEvent>[];
  cueTypes: readonly FrameCue[];
}>;

export type FrameEventBuffer = Readonly<{
  recordStep(step: Readonly<{
    hitEvents: readonly Readonly<GameHitEvent>[];
    shot: boolean;
    leak: boolean;
  }>): void;
  peek(): FrameEventBatch;
  clear(): void;
  reset(): void;
}>;

export function createFrameEventBuffer(): FrameEventBuffer {
  let hitEvents: GameHitEvent[] = [];
  const cueTypes = new Set<FrameCue>();

  function clear(): void {
    hitEvents = [];
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
    },
    peek() {
      return {
        hitEvents: hitEvents.map((event) => ({ ...event, position: { ...event.position } })),
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
  return { kind: 'slow-pulse', position: { ...position }, age: 0, duration: 0.6 };
}
