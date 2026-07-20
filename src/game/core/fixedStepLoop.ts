import { FIXED_STEP_SECONDS, MAX_FRAME_DELTA_SECONDS } from '../config';

type FixedStepLoopOptions = {
  update: (deltaSeconds: number) => void;
  render: () => void;
};

export type FixedStepLoop = {
  tick: (frameDeltaSeconds: number, timeScale?: number) => void;
};

export function createFixedStepLoop({ update, render }: FixedStepLoopOptions): FixedStepLoop {
  let accumulator = 0;

  return {
    tick(frameDeltaSeconds, timeScale = 1) {
      const safeFrameDelta = Number.isFinite(frameDeltaSeconds) && frameDeltaSeconds >= 0
        ? Math.min(frameDeltaSeconds, MAX_FRAME_DELTA_SECONDS)
        : 0;
      const safeTimeScale = Number.isFinite(timeScale) && timeScale >= 0 ? timeScale : 0;
      accumulator += safeFrameDelta * safeTimeScale;

      while (accumulator >= FIXED_STEP_SECONDS) {
        update(FIXED_STEP_SECONDS);
        accumulator -= FIXED_STEP_SECONDS;
      }

      render();
    },
  };
}
