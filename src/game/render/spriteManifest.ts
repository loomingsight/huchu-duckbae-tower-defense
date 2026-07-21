import type { EnemyType } from '../enemies/enemyCatalog';

export const SPRITE_DIRECTIONS = ['ne', 'se', 'sw', 'nw'] as const;

export type SpriteDirection = (typeof SPRITE_DIRECTIONS)[number];

export const ENEMY_SPRITES = {
  slime: {
    ne: new URL('../../../assets/renders/enemies-v1/mobile/slime/slime-ne-96-v1.png', import.meta.url).href,
    se: new URL('../../../assets/renders/enemies-v1/mobile/slime/slime-se-96-v1.png', import.meta.url).href,
    sw: new URL('../../../assets/renders/enemies-v1/mobile/slime/slime-sw-96-v1.png', import.meta.url).href,
    nw: new URL('../../../assets/renders/enemies-v1/mobile/slime/slime-nw-96-v1.png', import.meta.url).href,
  },
  fairy: {
    ne: new URL('../../../assets/renders/enemies-v1/mobile/fairy/fairy-ne-96-v1.png', import.meta.url).href,
    se: new URL('../../../assets/renders/enemies-v1/mobile/fairy/fairy-se-96-v1.png', import.meta.url).href,
    sw: new URL('../../../assets/renders/enemies-v1/mobile/fairy/fairy-sw-96-v1.png', import.meta.url).href,
    nw: new URL('../../../assets/renders/enemies-v1/mobile/fairy/fairy-nw-96-v1.png', import.meta.url).href,
  },
  orc: {
    ne: new URL('../../../assets/renders/enemies-v1/mobile/orc/orc-ne-96-v1.png', import.meta.url).href,
    se: new URL('../../../assets/renders/enemies-v1/mobile/orc/orc-se-96-v1.png', import.meta.url).href,
    sw: new URL('../../../assets/renders/enemies-v1/mobile/orc/orc-sw-96-v1.png', import.meta.url).href,
    nw: new URL('../../../assets/renders/enemies-v1/mobile/orc/orc-nw-96-v1.png', import.meta.url).href,
  },
  golem: {
    ne: new URL('../../../assets/renders/enemies-v1/mobile/golem/golem-ne-96-v1.png', import.meta.url).href,
    se: new URL('../../../assets/renders/enemies-v1/mobile/golem/golem-se-96-v1.png', import.meta.url).href,
    sw: new URL('../../../assets/renders/enemies-v1/mobile/golem/golem-sw-96-v1.png', import.meta.url).href,
    nw: new URL('../../../assets/renders/enemies-v1/mobile/golem/golem-nw-96-v1.png', import.meta.url).href,
  },
  minotaur: {
    ne: new URL('../../../assets/renders/enemies-v1/mobile/minotaur/minotaur-ne-96-v1.png', import.meta.url).href,
    se: new URL('../../../assets/renders/enemies-v1/mobile/minotaur/minotaur-se-96-v1.png', import.meta.url).href,
    sw: new URL('../../../assets/renders/enemies-v1/mobile/minotaur/minotaur-sw-96-v1.png', import.meta.url).href,
    nw: new URL('../../../assets/renders/enemies-v1/mobile/minotaur/minotaur-nw-96-v1.png', import.meta.url).href,
  },
} as const satisfies Readonly<Record<EnemyType, Readonly<Record<SpriteDirection, string>>>>;

export const MAP_SPRITE_KEYS = [
  'grass',
  'roadHorizontal',
  'roadVertical',
  'roadNorthEast',
  'roadEastSouth',
  'roadSouthWest',
  'roadWestNorth',
  'entry',
  'snackChest',
] as const;

export type MapSpriteKey = (typeof MAP_SPRITE_KEYS)[number];

export const MAP_SPRITES = {
  grass: new URL('../../../assets/renders/redesign-preview-v1/mobile/map/grass.png', import.meta.url).href,
  roadHorizontal: new URL('../../../assets/renders/redesign-preview-v1/mobile/map/road-straight-horizontal.png', import.meta.url).href,
  roadVertical: new URL('../../../assets/renders/redesign-preview-v1/mobile/map/road-straight-vertical.png', import.meta.url).href,
  roadNorthEast: new URL('../../../assets/renders/redesign-preview-v1/mobile/map/road-corner-north-east.png', import.meta.url).href,
  roadEastSouth: new URL('../../../assets/renders/redesign-preview-v1/mobile/map/road-corner-east-south.png', import.meta.url).href,
  roadSouthWest: new URL('../../../assets/renders/redesign-preview-v1/mobile/map/road-corner-south-west.png', import.meta.url).href,
  roadWestNorth: new URL('../../../assets/renders/redesign-preview-v1/mobile/map/road-corner-west-north.png', import.meta.url).href,
  entry: new URL('../../../assets/renders/redesign-preview-v1/mobile/map/entry.png', import.meta.url).href,
  snackChest: new URL('../../../assets/renders/redesign-preview-v1/mobile/map/snack-chest.png', import.meta.url).href,
} as const satisfies Readonly<Record<MapSpriteKey, string>>;

export const TOWER_SPRITES = {
  arrow: new URL('../../../assets/renders/redesign-preview-v1/mobile/towers/arrow-se.png', import.meta.url).href,
  deokbae: new URL('../../../assets/renders/redesign-preview-v1/mobile/towers/deokbae-se.png', import.meta.url).href,
  huchu: new URL('../../../assets/renders/redesign-preview-v1/mobile/towers/huchu-se.png', import.meta.url).href,
  slow: new URL('../../../assets/renders/redesign-preview-v1/mobile/towers/slow-se.png', import.meta.url).href,
} as const;

export const MOTION_SPRITES = {
  orc: { url: new URL('../../../assets/renders/redesign-preview-v1/mobile/motion/orc-walk-se.png', import.meta.url).href, frames: 6, fps: 8 },
  fairy: { url: new URL('../../../assets/renders/redesign-preview-v1/mobile/motion/fairy-fly-se.png', import.meta.url).href, frames: 8, fps: 12 },
} as const;

export const VFX_SPRITES = {
  arrow: { url: new URL('../../../assets/renders/redesign-preview-v1/mobile/vfx/arrow-8dir.png', import.meta.url).href, frames: 8 },
  fireball: { url: new URL('../../../assets/renders/redesign-preview-v1/mobile/vfx/fireball-flight.png', import.meta.url).href, frames: 4 },
  waterball: { url: new URL('../../../assets/renders/redesign-preview-v1/mobile/vfx/waterball-flight.png', import.meta.url).href, frames: 4 },
  arrowImpact: { url: new URL('../../../assets/renders/redesign-preview-v1/mobile/vfx/arrow-impact.png', import.meta.url).href, frames: 4 },
  fireBurst: { url: new URL('../../../assets/renders/redesign-preview-v1/mobile/vfx/fire-burst.png', import.meta.url).href, frames: 8 },
  aquaBurst: { url: new URL('../../../assets/renders/redesign-preview-v1/mobile/vfx/aqua-burst.png', import.meta.url).href, frames: 8 },
} as const;
