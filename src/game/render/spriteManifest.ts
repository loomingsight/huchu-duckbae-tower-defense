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
