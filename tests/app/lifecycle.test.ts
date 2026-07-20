import { describe, expect, it } from 'vitest';

import {
  LifecycleScope,
  guardInitialization,
} from '../../src/app/lifecycle';
import { createRendererWithFallback } from '../../src/app/GameApp';
import type { GameAssets } from '../../src/game/render/assetLoader';

describe('app initialization lifecycle', () => {
  it('removes listeners, disconnects observers, and clears timers on destroy', () => {
    const events: string[] = [];
    const target = {
      addEventListener: () => events.push('add-listener'),
      removeEventListener: () => events.push('remove-listener'),
    };
    const scope = new LifecycleScope();
    scope.listen(target, 'resize', () => undefined);
    scope.add(() => events.push('disconnect-observer'));
    scope.add(() => events.push('clear-timer'));

    scope.dispose();
    scope.dispose();

    expect(events).toEqual([
      'add-listener',
      'clear-timer',
      'disconnect-observer',
      'remove-listener',
    ]);
  });

  it('cleans every registered resource when initialization rejects', async () => {
    const cleaned: string[] = [];
    const scope = new LifecycleScope();

    await expect(guardInitialization(scope, async () => {
      scope.add(() => cleaned.push('raf'));
      scope.add(() => cleaned.push('observer'));
      scope.add(() => cleaned.push('listener'));
      throw new Error('renderer unavailable');
    })).rejects.toThrow('renderer unavailable');

    expect(cleaned).toEqual(['listener', 'observer', 'raf']);
    expect(scope.disposed).toBe(true);
  });

  it('cleans initialized resources when both renderer attempts fail', async () => {
    const cleaned: string[] = [];
    const scope = new LifecycleScope();
    let rendererAttempts = 0;
    scope.add(() => cleaned.push('listener'));
    scope.add(() => cleaned.push('observer'));

    await expect(guardInitialization(scope, () => createRendererWithFallback(
      {} as HTMLCanvasElement,
      {
        loadAssets: async () => ({}) as GameAssets,
        createRenderer: () => {
          rendererAttempts += 1;
          throw new Error('no 2d context');
        },
      },
    ))).rejects.toThrow('no 2d context');

    expect(rendererAttempts).toBe(2);
    expect(cleaned).toEqual(['observer', 'listener']);
  });
});
