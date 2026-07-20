import { FIXED_STEP_SECONDS, MAX_FRAME_DELTA_SECONDS } from '../config';

type FixedStepLoopOptions = {
  update: (deltaSeconds: number) => void;
  render: () => void;
};

export type FixedStepLoop = {
  tick: (frameDeltaSeconds: number) => void;
};

export function createFixedStepLoop({ update, render }: FixedStepLoopOptions): FixedStepLoop {
  let accumulator = 0;

  return {
    tick(frameDeltaSeconds) {
      accumulator += Math.min(frameDeltaSeconds, MAX_FRAME_DELTA_SECONDS);

      while (accumulator >= FIXED_STEP_SECONDS) {
        update(FIXED_STEP_SECONDS);
        accumulator -= FIXED_STEP_SECONDS;
      }

      render();
    },
  };
}
