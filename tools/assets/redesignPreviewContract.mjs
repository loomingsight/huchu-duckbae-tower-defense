import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const PREVIEW_ROOT = path.join(
  repositoryRoot,
  'assets/renders/redesign-preview-v1',
);

const asset = (id, group, relativePath, frames = 1) => Object.freeze({
  id,
  group,
  relativePath,
  frames,
  masterFrameSize: 256,
  mobileFrameSize: 128,
});

export const PREVIEW_ASSETS = Object.freeze([
  asset('grass', 'map', 'map/grass.png'),
  asset('road-straight-horizontal', 'map', 'map/road-straight-horizontal.png'),
  asset('road-straight-vertical', 'map', 'map/road-straight-vertical.png'),
  asset('road-corner-north-east', 'map', 'map/road-corner-north-east.png'),
  asset('road-corner-east-south', 'map', 'map/road-corner-east-south.png'),
  asset('road-corner-south-west', 'map', 'map/road-corner-south-west.png'),
  asset('road-corner-west-north', 'map', 'map/road-corner-west-north.png'),
  asset('entry', 'map', 'map/entry.png'),
  asset('snack-chest', 'map', 'map/snack-chest.png'),
  asset('tower-slow-se', 'tower', 'towers/slow-se.png'),
  asset('tower-arrow-se', 'tower', 'towers/arrow-se.png'),
  asset('tower-deokbae-se', 'tower', 'towers/deokbae-se.png'),
  asset('tower-huchu-se', 'tower', 'towers/huchu-se.png'),
  asset('orc-walk-se', 'motion', 'motion/orc-walk-se.png', 6),
  asset('fairy-fly-se', 'motion', 'motion/fairy-fly-se.png', 8),
  asset('arrow-8dir', 'vfx', 'vfx/arrow-8dir.png', 8),
  asset('fireball-flight', 'vfx', 'vfx/fireball-flight.png', 4),
  asset('waterball-flight', 'vfx', 'vfx/waterball-flight.png', 4),
  asset('arrow-impact', 'vfx', 'vfx/arrow-impact.png', 4),
  asset('fire-burst', 'vfx', 'vfx/fire-burst.png', 8),
  asset('aqua-burst', 'vfx', 'vfx/aqua-burst.png', 8),
]);
