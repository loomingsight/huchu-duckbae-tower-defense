import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

export const NIGHTMARE_V1_ROOT = path.join(
  repositoryRoot,
  'assets/renders/nightmare-v1',
);

export const NIGHTMARE_V2_ROOT = path.join(
  repositoryRoot,
  'assets/renders/nightmare-v2',
);

export const NIGHTMARE_ROOT = NIGHTMARE_V2_ROOT;

export const NIGHTMARE_THEME_IDS = Object.freeze([
  'moonlitSwamp',
  'rottenForest',
  'ashenRuins',
  'bloodRavine',
  'obsidianMine',
  'abyssGate',
]);

export const NIGHTMARE_MAP_PIECES = Object.freeze([
  'ground',
  'road-horizontal',
  'road-vertical',
  'road-corner-north-east',
  'road-corner-east-south',
  'road-corner-south-west',
  'road-corner-west-north',
  'boundary-stone',
  'snack-chest',
]);

const asset = ({
  id,
  group,
  relativePath,
  root,
  frames = 1,
  theme,
}) => Object.freeze({
  id,
  group,
  relativePath,
  root,
  frames,
  masterFrameSize: 256,
  mobileFrameSize: 128,
  ...(theme === undefined ? {} : { theme }),
});

const motionAssets = [
  ['shadow-slime-bounce', 6],
  ['vampire-bat-fly', 8],
  ['skeleton-knight-walk', 6],
  ['obsidian-golem-walk', 6],
  ['lich-king-float', 8],
].map(([id, frames]) => asset({
  id,
  group: 'motion',
  relativePath: `motion/${id}.png`,
  root: NIGHTMARE_V2_ROOT,
  frames,
}));

const vfxAssets = [
  ['shield-open', 6],
  ['shield-block', 4],
  ['shield-break', 6],
  ['split-burst', 6],
  ['slow-resist', 4],
  ['lich-aura', 8],
  ['lich-phase-two', 8],
  ['elite-rune', 4],
].map(([id, frames]) => asset({
  id,
  group: 'vfx',
  relativePath: `vfx/${id}.png`,
  root: NIGHTMARE_V1_ROOT,
  frames,
}));

const mapAssets = NIGHTMARE_THEME_IDS.flatMap((theme) => (
  NIGHTMARE_MAP_PIECES.map((piece) => asset({
    id: `${theme}-${piece}`,
    group: 'map',
    relativePath: `map/${theme}/${piece}.png`,
    root: NIGHTMARE_V1_ROOT,
    theme,
  }))
));

export const NIGHTMARE_ASSETS = Object.freeze([
  ...motionAssets,
  ...vfxAssets,
  ...mapAssets,
]);
