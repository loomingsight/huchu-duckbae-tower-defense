import type { GameAssets } from '../../src/game/render/assetLoader';

export type RecordedCall = {
  method: string;
  args: readonly unknown[];
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
};

export type TaggedImage = {
  readonly tag: string;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
};

export function taggedImage(tag: string, naturalWidth = 128): HTMLImageElement {
  return { tag, naturalWidth, naturalHeight: 128 } as unknown as HTMLImageElement;
}

export function createTestAssets(): GameAssets {
  const directions = (tag: string) => ({
    ne: taggedImage(`${tag}-ne`),
    se: taggedImage(`${tag}-se`),
    sw: taggedImage(`${tag}-sw`),
    nw: taggedImage(`${tag}-nw`),
  });

  return {
    map: {
      grass: taggedImage('map-grass'),
      roadHorizontal: taggedImage('map-road-horizontal'),
      roadVertical: taggedImage('map-road-vertical'),
      roadNorthEast: taggedImage('map-road-ne'),
      roadEastSouth: taggedImage('map-road-es'),
      roadSouthWest: taggedImage('map-road-sw'),
      roadWestNorth: taggedImage('map-road-wn'),
      entry: taggedImage('map-entry'),
      snackChest: taggedImage('map-snack-chest'),
    },
    towers: {
      arrow: directions('tower-arrow'),
      deokbae: taggedImage('tower-deokbae'),
      huchu: taggedImage('tower-huchu'),
      slow: taggedImage('tower-slow'),
    },
    enemies: {
      slime: directions('enemy-slime'),
      fairy: directions('enemy-fairy'),
      orc: directions('enemy-orc'),
      golem: directions('enemy-golem'),
      minotaur: directions('enemy-minotaur'),
    },
    motion: {
      orc: taggedImage('motion-orc', 128 * 6),
      fairy: taggedImage('motion-fairy', 128 * 8),
    },
    vfx: {
      arrow: taggedImage('vfx-arrow', 128 * 8),
      fireball: taggedImage('vfx-fireball', 128 * 4),
      waterball: taggedImage('vfx-waterball', 128 * 4),
      arrowImpact: taggedImage('vfx-arrow-impact', 128 * 4),
      fireBurst: taggedImage('vfx-fire-burst', 128 * 8),
      aquaBurst: taggedImage('vfx-aqua-burst', 128 * 8),
    },
  };
}

export function createRecordingContext(options: { rejectNonFinite?: boolean } = {}) {
  const calls: RecordedCall[] = [];
  const state = {
    fillStyle: '#000000' as string | CanvasGradient | CanvasPattern,
    strokeStyle: '#000000' as string | CanvasGradient | CanvasPattern,
  };
  const record = (method: string, args: readonly unknown[]) => {
    if (
      options.rejectNonFinite === true
      && args.some((value) => typeof value === 'number' && !Number.isFinite(value))
    ) {
      throw new Error(`${method} received a non-finite number`);
    }
    calls.push({ method, args, fillStyle: state.fillStyle, strokeStyle: state.strokeStyle });
  };
  const context = {
    get fillStyle() { return state.fillStyle; },
    set fillStyle(value) { state.fillStyle = value; },
    get strokeStyle() { return state.strokeStyle; },
    set strokeStyle(value) { state.strokeStyle = value; },
    lineWidth: 1,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    imageSmoothingEnabled: false,
    setTransform: (...args: unknown[]) => record('setTransform', args),
    clearRect: (...args: unknown[]) => record('clearRect', args),
    fillRect: (...args: unknown[]) => record('fillRect', args),
    strokeRect: (...args: unknown[]) => record('strokeRect', args),
    save: (...args: unknown[]) => record('save', args),
    restore: (...args: unknown[]) => record('restore', args),
    beginPath: (...args: unknown[]) => record('beginPath', args),
    closePath: (...args: unknown[]) => record('closePath', args),
    rect: (...args: unknown[]) => record('rect', args),
    clip: (...args: unknown[]) => record('clip', args),
    moveTo: (...args: unknown[]) => record('moveTo', args),
    lineTo: (...args: unknown[]) => record('lineTo', args),
    translate: (...args: unknown[]) => record('translate', args),
    scale: (...args: unknown[]) => record('scale', args),
    arc: (...args: unknown[]) => record('arc', args),
    ellipse: (...args: unknown[]) => record('ellipse', args),
    roundRect: (...args: unknown[]) => record('roundRect', args),
    fill: (...args: unknown[]) => record('fill', args),
    stroke: (...args: unknown[]) => record('stroke', args),
    drawImage: (...args: unknown[]) => record('drawImage', args),
    fillText: (...args: unknown[]) => record('fillText', args),
    createRadialGradient: (...args: unknown[]) => {
      record('createRadialGradient', args);
      return { addColorStop: (...colorArgs: unknown[]) => record('addColorStop', colorArgs) };
    },
  } as unknown as CanvasRenderingContext2D;

  return { context, calls };
}

export function createTestCanvas(context: CanvasRenderingContext2D) {
  const canvas = {
    width: 844,
    height: 390,
    clientWidth: 844,
    clientHeight: 390,
    style: { width: '', height: '' },
    getContext: (kind: string) => kind === '2d' ? context : null,
  } as unknown as HTMLCanvasElement;
  return canvas;
}

export function imageTag(call: RecordedCall): string | undefined {
  return (call.args[0] as TaggedImage | undefined)?.tag;
}
