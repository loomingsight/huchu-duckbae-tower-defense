# Deferred balance and presentation decisions

All values below are executable MVP defaults. They are deliberately centralized
here until playtesting establishes replacement values; change the referenced
location together with its focused tests.

## Task 3 — map and simulation timing

| Default | Rationale | Change location |
| --- | --- | --- |
| Map: 20 columns × 10 rows | Fits a landscape phone canvas while leaving room for four tower roles. | `src/game/map/stage1.ts` |
| Route waypoints: (0,2) → (5,2) → (5,7) → (12,7) → (12,3) → (19,3) | Creates the approved orthogonal, readable Stage 1 route. | `src/game/map/stage1.ts` |
| Simulation: 60 updates/sec (dt = 1/60 sec) | Stable deterministic combat cadence on common mobile refresh rates. | `src/game/core/fixedStepLoop.ts` |
| Maximum accepted frame delta: 0.25 sec | Prevents a suspended browser frame from causing a large catch-up simulation jump. | `src/game/core/fixedStepLoop.ts` |

## Task 4 — enemies, economy, and waves

| Default | Rationale | Change location |
| --- | --- | --- |
| Starting gold: 450 | Lets players explore early tower choices immediately. | `src/game/simulation/createGame.ts` |
| Base HP: 20 | Allows several readable leaks before defeat. | `src/game/simulation/createGame.ts` |
| Inter-wave delay: 5 sec | Gives mobile players time to choose and place a tower. | `src/game/simulation/updateWaves.ts` |
| Stage length: 10 waves | Defines the first-clear MVP scope. | `src/game/waves/stage1Waves.ts` |
| Target first-clear duration: 5–7 min | Initial pacing target for later playtests, not a correctness gate. | `src/game/waves/stage1Waves.ts` |
| Group HP multiplier: 1 + waveIndex × 0.08 | Makes each wave progressively sturdier without per-wave hand tuning. | `src/game/waves/stage1Waves.ts` |
| Slime: HP 42, speed 1.15, reward 10, leak 1 | Baseline slow, low-risk enemy. | `src/game/enemies/enemyCatalog.ts` |
| Fairy: HP 32, speed 1.9, reward 14, leak 1 | Fragile but fast enemy tests target priority. | `src/game/enemies/enemyCatalog.ts` |
| Orc: HP 110, speed 0.9, reward 20, leak 2 | Mid-tier durable enemy with meaningful leak pressure. | `src/game/enemies/enemyCatalog.ts` |
| Golem: HP 320, speed 0.52, reward 38, leak 3 | Slow damage sponge validates sustained fire. | `src/game/enemies/enemyCatalog.ts` |
| Minotaur: HP 1800, speed 0.48, reward 200, leak 8 | Wave-10 boss creates a clear final spike. | `src/game/enemies/enemyCatalog.ts` |

## Task 5 — tower and combat tuning

| Default | Rationale | Change location |
| --- | --- | --- |
| Slow: cost 80, range 2.4, multiplier 0.62 | Low-cost support tower with a noticeable but bounded aura. | `src/game/towers/towerCatalog.ts` |
| Arrow: cost 100, range 3.2, damage 18, cooldown 0.55 sec, projectile speed 8 | Affordable single-target baseline. | `src/game/towers/towerCatalog.ts` |
| Deokbae: cost 250, range 3.0, damage 14, cooldown 0.42 sec, projectile speed 6.5, splash 0.85 | Frequent short-radius splash trade-off. | `src/game/towers/towerCatalog.ts` |
| Huchu: cost 300, range 3.4, damage 72, cooldown 1.8 sec, projectile speed 5, splash 1.25 | Premium high-impact splash role. | `src/game/towers/towerCatalog.ts` |

## Task 6 — enemy sprite production

| Default | Rationale | Change location |
| --- | --- | --- |
| Model coordinate convention: foot contact (0,0,0), Z-up, +Y forward, scale 1 | Keeps render placement and directional mapping predictable. | `assets/blender/enemies-voxel-v1.blend` |
| Geometry increment: 1/16 BU | Preserves a consistent voxel-like silhouette. | `assets/blender/enemies-voxel-v1.blend` |
| Enemy set: 5 types | Covers the Stage 1 catalog without introducing unused art. | `src/game/render/spriteManifest.ts` |
| Camera yaws: 45°, 135°, 225°, 315° | Supplies the four diagonal directions used by the renderer. | `assets/blender/enemies-voxel-v1.blend` |
| Source render: 256 × 256 px; runtime sprite: 96 × 96 px | Retains source clarity while meeting mobile memory and layout needs. | `assets/renders/enemies-v1/` |
| Runtime output count: 20 sprites (5 types × 4 directions) | One mobile sprite is required for each enemy-direction pair. | `assets/renders/enemies-v1/mobile/` |

## Task 7 — responsive canvas rendering

| Default | Rationale | Change location |
| --- | --- | --- |
| Game area aspect ratio: 16:9 | Matches the landscape-first mobile game composition. | `src/game/render/layout.ts` |
| Portrait reference viewport: 390 × 844 px | Standard phone portrait check for the rotation prompt and letterboxing. | `src/game/render/layout.ts` |
| Landscape reference viewport: 844 × 390 px | Standard phone landscape check for centered play space. | `src/game/render/layout.ts` |
| Device pixel ratio cap: 2 | Avoids excessive canvas memory and fill-rate cost on dense mobile displays. | `src/game/render/layout.ts` |
| Approved tower sprite display source: 96 px | Maintains the supplied mobile asset contract. | `src/game/render/assetLoader.ts` |

## Task 8 — mobile controls and preferences

| Default | Rationale | Change location |
| --- | --- | --- |
| Combat speed choices: 1× and 2× | Provides a single readable speed-up without introducing more pacing modes. | `src/app/GameApp.ts` |
| Minimum control hit target: 44 × 44 CSS px | Meets touch accessibility expectations. | `src/app/hud.ts` and `src/styles.css` |
| Tower tray: 4 cards | Keeps all four tower roles available within a compact landscape layout. | `src/app/hud.ts` |
| Drag-cancel threshold: 8 CSS px | Separates intended taps from small finger movement. | `src/app/input.ts` |
| Default preferences: muted false; best clear time null | Keeps sound enabled initially and has no fabricated record. | `src/app/preferences.ts` |
