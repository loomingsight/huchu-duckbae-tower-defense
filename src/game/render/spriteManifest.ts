import type { EnemyType } from '../enemies/enemyCatalog';

export const SPRITE_DIRECTIONS = ['ne', 'se', 'sw', 'nw'] as const;

export type SpriteDirection = (typeof SPRITE_DIRECTIONS)[number];

export const SPRITE_FRAME_SIZES = {
  map: 128,
  enemy: 256,
  tower: 256,
  motion: 256,
  vfx: 256,
} as const;

function frontFacingSprites(url: string): Readonly<Record<SpriteDirection, string>> {
  return { ne: url, se: url, sw: url, nw: url };
}

export const ENEMY_SPRITES = {
  slime: frontFacingSprites(new URL('../../../assets/renders/enemies-v1/slime/slime-se-v1.png', import.meta.url).href),
  fairy: frontFacingSprites(new URL('../../../assets/renders/enemies-v1/fairy/fairy-se-v1.png', import.meta.url).href),
  orc: frontFacingSprites(new URL('../../../assets/renders/enemies-v1/orc/orc-se-v1.png', import.meta.url).href),
  golem: frontFacingSprites(new URL('../../../assets/renders/enemies-v1/golem/golem-se-v1.png', import.meta.url).href),
  minotaur: frontFacingSprites(new URL('../../../assets/renders/enemies-v1/minotaur/minotaur-se-v1.png', import.meta.url).href),
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
  arrow: new URL('../../../assets/renders/redesign-preview-v1/master/towers/arrow-se.png', import.meta.url).href,
  deokbae: new URL('../../../assets/renders/redesign-preview-v1/master/towers/deokbae-se.png', import.meta.url).href,
  huchu: new URL('../../../assets/renders/redesign-preview-v1/master/towers/huchu-se.png', import.meta.url).href,
  slow: new URL('../../../assets/renders/redesign-preview-v1/master/towers/slow-se.png', import.meta.url).href,
} as const;

export const MOTION_SPRITES = {
  orc: { url: new URL('../../../assets/renders/redesign-preview-v1/master/motion/orc-walk-se.png', import.meta.url).href, frames: 6, fps: 8 },
  fairy: { url: new URL('../../../assets/renders/redesign-preview-v1/master/motion/fairy-fly-se.png', import.meta.url).href, frames: 8, fps: 12 },
} as const;

export const VFX_SPRITES = {
  arrow: { url: new URL('../../../assets/renders/redesign-preview-v1/master/vfx/arrow-8dir.png', import.meta.url).href, frames: 8 },
  fireball: { url: new URL('../../../assets/renders/redesign-preview-v1/master/vfx/fireball-flight.png', import.meta.url).href, frames: 4 },
  waterball: { url: new URL('../../../assets/renders/redesign-preview-v1/master/vfx/waterball-flight.png', import.meta.url).href, frames: 4 },
  arrowImpact: { url: new URL('../../../assets/renders/redesign-preview-v1/master/vfx/arrow-impact.png', import.meta.url).href, frames: 4 },
  fireBurst: { url: new URL('../../../assets/renders/redesign-preview-v1/master/vfx/fire-burst.png', import.meta.url).href, frames: 8 },
  aquaBurst: { url: new URL('../../../assets/renders/redesign-preview-v1/master/vfx/aqua-burst.png', import.meta.url).href, frames: 8 },
} as const;
