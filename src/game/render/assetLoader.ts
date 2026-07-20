import type { EnemyType } from '../enemies/enemyCatalog';
import type { TowerType } from '../towers/towerCatalog';
import {
  ENEMY_SPRITES,
  SPRITE_DIRECTIONS,
  type SpriteDirection,
} from './spriteManifest';

export type LoadedSprite = HTMLImageElement | null;

type DirectionalSprites = Readonly<Record<SpriteDirection, LoadedSprite>>;

export type GameAssets = {
  towers: Readonly<{
    arrow: DirectionalSprites;
    deokbae: LoadedSprite;
    huchu: LoadedSprite;
    slow: LoadedSprite;
  }>;
  enemies: Readonly<Record<EnemyType, DirectionalSprites>>;
};

export const TOWER_SPRITES = {
  arrow: {
    ne: new URL('../../../assets/renders/arrow-tower-3d-v1/mobile/arrow-tower-ne-96-v1.png', import.meta.url).href,
    se: new URL('../../../assets/renders/arrow-tower-3d-v1/mobile/arrow-tower-se-96-v1.png', import.meta.url).href,
    sw: new URL('../../../assets/renders/arrow-tower-3d-v1/mobile/arrow-tower-sw-96-v1.png', import.meta.url).href,
    nw: new URL('../../../assets/renders/arrow-tower-3d-v1/mobile/arrow-tower-nw-96-v1.png', import.meta.url).href,
  },
  deokbae: new URL('../../../assets/renders/mobile/deokbae-tower-96-final.png', import.meta.url).href,
  huchu: new URL('../../../assets/renders/mobile/huchu-tower-96-final.png', import.meta.url).href,
  slow: new URL('../../../assets/renders/slow-tower-3d-v1/mobile/slow-tower-map-96-v1.png', import.meta.url).href,
} as const satisfies Readonly<
  Record<Exclude<TowerType, 'arrow'>, string>
  & { arrow: Readonly<Record<SpriteDirection, string>> }
>;

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
  const [arrow, deokbae, huchu, slow, slime, fairy, orc, golem, minotaur] = await Promise.all([
    loadDirections(TOWER_SPRITES.arrow),
    loadImage(TOWER_SPRITES.deokbae),
    loadImage(TOWER_SPRITES.huchu),
    loadImage(TOWER_SPRITES.slow),
    loadDirections(ENEMY_SPRITES.slime),
    loadDirections(ENEMY_SPRITES.fairy),
    loadDirections(ENEMY_SPRITES.orc),
    loadDirections(ENEMY_SPRITES.golem),
    loadDirections(ENEMY_SPRITES.minotaur),
  ]);

  return {
    towers: { arrow, deokbae, huchu, slow },
    enemies: { slime, fairy, orc, golem, minotaur },
  };
}
