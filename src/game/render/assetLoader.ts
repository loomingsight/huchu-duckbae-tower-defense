import type { EnemyType } from '../enemies/enemyCatalog';
import {
  ENEMY_SPRITES,
  MAP_SPRITES,
  MOTION_SPRITES,
  SPRITE_DIRECTIONS,
  TOWER_SPRITES,
  VFX_SPRITES,
  type MapSpriteKey,
  type SpriteDirection,
} from './spriteManifest';

export type LoadedSprite = HTMLImageElement | null;

export type DirectionalSprites = Readonly<Record<SpriteDirection, LoadedSprite>>;

const EMPTY_DIRECTIONS: DirectionalSprites = {
  ne: null,
  se: null,
  sw: null,
  nw: null,
};

export type GameAssets = {
  map: Readonly<Record<MapSpriteKey, LoadedSprite>>;
  towers: Readonly<{
    arrow: DirectionalSprites;
    deokbae: LoadedSprite;
    huchu: LoadedSprite;
    slow: LoadedSprite;
  }>;
  enemies: Readonly<Record<EnemyType, DirectionalSprites>>;
  motion: Readonly<{
    orc: LoadedSprite;
    fairy: LoadedSprite;
  }>;
  vfx: Readonly<{
    arrow: LoadedSprite;
    fireball: LoadedSprite;
    waterball: LoadedSprite;
    arrowImpact: LoadedSprite;
    fireBurst: LoadedSprite;
    aquaBurst: LoadedSprite;
  }>;
};

function loadImage(url: string): Promise<LoadedSprite> {
  if (typeof Image === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

async function loadDirections(
  urls: Readonly<Record<SpriteDirection, string>>,
): Promise<DirectionalSprites> {
  const [ne, se, sw, nw] = await Promise.all(
    SPRITE_DIRECTIONS.map((direction) => loadImage(urls[direction])),
  );
  return { ne, se, sw, nw };
}

export async function loadGameAssets(): Promise<GameAssets> {
  const arrowUrls = {
    ne: TOWER_SPRITES.arrow,
    se: TOWER_SPRITES.arrow,
    sw: TOWER_SPRITES.arrow,
    nw: TOWER_SPRITES.arrow,
  } as const;
  const [
    grass,
    roadHorizontal,
    roadVertical,
    roadNorthEast,
    roadEastSouth,
    roadSouthWest,
    roadWestNorth,
    entry,
    snackChest,
    arrow,
    deokbae,
    huchu,
    slow,
    slime,
    fairy,
    orc,
    golem,
    minotaur,
    orcMotion,
    fairyMotion,
    arrowVfx,
    fireball,
    waterball,
    arrowImpact,
    fireBurst,
    aquaBurst,
  ] = await Promise.all([
    loadImage(MAP_SPRITES.grass),
    loadImage(MAP_SPRITES.roadHorizontal),
    loadImage(MAP_SPRITES.roadVertical),
    loadImage(MAP_SPRITES.roadNorthEast),
    loadImage(MAP_SPRITES.roadEastSouth),
    loadImage(MAP_SPRITES.roadSouthWest),
    loadImage(MAP_SPRITES.roadWestNorth),
    loadImage(MAP_SPRITES.entry),
    loadImage(MAP_SPRITES.snackChest),
    loadDirections(arrowUrls),
    loadImage(TOWER_SPRITES.deokbae),
    loadImage(TOWER_SPRITES.huchu),
    loadImage(TOWER_SPRITES.slow),
    loadDirections(ENEMY_SPRITES.slime),
    loadDirections(ENEMY_SPRITES.fairy),
    loadDirections(ENEMY_SPRITES.orc),
    loadDirections(ENEMY_SPRITES.golem),
    loadDirections(ENEMY_SPRITES.minotaur),
    loadImage(MOTION_SPRITES.orc.url),
    loadImage(MOTION_SPRITES.fairy.url),
    loadImage(VFX_SPRITES.arrow.url),
    loadImage(VFX_SPRITES.fireball.url),
    loadImage(VFX_SPRITES.waterball.url),
    loadImage(VFX_SPRITES.arrowImpact.url),
    loadImage(VFX_SPRITES.fireBurst.url),
    loadImage(VFX_SPRITES.aquaBurst.url),
  ]);

  return {
    map: {
      grass,
      roadHorizontal,
      roadVertical,
      roadNorthEast,
      roadEastSouth,
      roadSouthWest,
      roadWestNorth,
      entry,
      snackChest,
    },
    towers: { arrow, deokbae, huchu, slow },
    enemies: {
      slime,
      fairy,
      orc,
      golem,
      minotaur,
      shadowSlime: EMPTY_DIRECTIONS,
      vampireBat: EMPTY_DIRECTIONS,
      skeletonKnight: EMPTY_DIRECTIONS,
      obsidianGolem: EMPTY_DIRECTIONS,
      lichKing: EMPTY_DIRECTIONS,
    },
    motion: { orc: orcMotion, fairy: fairyMotion },
    vfx: { arrow: arrowVfx, fireball, waterball, arrowImpact, fireBurst, aquaBurst },
  };
}
