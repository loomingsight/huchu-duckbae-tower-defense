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

export function taggedImage(tag: string, naturalWidth = 256, naturalHeight = 256): HTMLImageElement {
  return { tag, naturalWidth, naturalHeight } as unknown as HTMLImageElement;
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
      grass: taggedImage('map-grass', 128, 128),
      roadHorizontal: taggedImage('map-road-horizontal', 128, 128),
      roadVertical: taggedImage('map-road-vertical', 128, 128),
      roadNorthEast: taggedImage('map-road-ne', 128, 128),
      roadEastSouth: taggedImage('map-road-es', 128, 128),
      roadSouthWest: taggedImage('map-road-sw', 128, 128),
      roadWestNorth: taggedImage('map-road-wn', 128, 128),
      entry: taggedImage('map-entry', 128, 128),
      snackChest: taggedImage('map-snack-chest', 128, 128),
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
      shadowSlime: directions('enemy-shadow-slime'),
      vampireBat: directions('enemy-vampire-bat'),
      skeletonKnight: directions('enemy-skeleton-knight'),
      obsidianGolem: directions('enemy-obsidian-golem'),
      lichKing: directions('enemy-lich-king'),
    },
    motion: {
      orc: taggedImage('motion-orc', 256 * 6),
      fairy: taggedImage('motion-fairy', 256 * 8),
      shadowSlime: taggedImage('motion-shadow-slime', 256 * 6),
      vampireBat: taggedImage('motion-vampire-bat', 256 * 8),
      skeletonKnight: taggedImage('motion-skeleton-knight', 256 * 6),
      obsidianGolem: taggedImage('motion-obsidian-golem', 256 * 6),
      lichKing: taggedImage('motion-lich-king', 256 * 8),
    },
    vfx: {
      arrow: taggedImage('vfx-arrow', 256 * 8),
      fireball: taggedImage('vfx-fireball', 256 * 4),
      waterball: taggedImage('vfx-waterball', 256 * 4),
      arrowImpact: taggedImage('vfx-arrow-impact', 256 * 4),
      fireBurst: taggedImage('vfx-fire-burst', 256 * 8),
      aquaBurst: taggedImage('vfx-aqua-burst', 256 * 8),
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
