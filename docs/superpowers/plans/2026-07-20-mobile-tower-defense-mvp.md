# Huchu Defense Mobile MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, playable landscape-mobile HTML Canvas tower-defense MVP using the approved Huchu, Deokbae, arrow, slow, and voxel-enemy art direction.

**Architecture:** A deterministic 60 Hz simulation owns map, waves, economy, targeting, combat, and game state. A separate Canvas renderer consumes read-only snapshots and pre-rendered Blender sprites; DOM controls provide touch-friendly tower selection and game controls. All tuning lives in data modules so deferred balance decisions can be changed without rewriting systems.

**Tech Stack:** Node.js 20+, TypeScript 5.8, Vite 7, Vitest 3, Playwright 1.52, HTML Canvas 2D, CSS

## Global Constraints

- The playfield is landscape 16:9 with a 20-column by 10-row square grid.
- The path is exactly one cell wide, uses only horizontal and vertical segments, and contains no decorative road pattern.
- Towers occupy the exact center of non-path grid cells; rendering pivot, range origin, touch hitbox, and simulation coordinate must agree.
- Tower upgrades, selling, and relocation are not included; duplicate additional placements are allowed.
- Slow tower deals zero damage and continuously applies the strongest non-stacking area slow.
- Arrow tower is cheap, fast, and single-target.
- Huchu fires a slow, high-damage aqua splash projectile.
- Deokbae fires frequent, lower-damage fire splash projectiles.
- Enemies are slime fodder, fast fairy, green orc, stone golem tank, and minotaur boss.
- Automatic targeting chooses the enemy with greatest route progress among enemies in range.
- Simulation runs at a deterministic fixed 1/60 second step independently from rendering frame rate.
- Stage 1 contains 10 waves and targets a five-to-seven-minute first clear.
- The base loses durability when enemies exit; zero durability is defeat and clearing wave 10 is victory.
- Minimum interactive target size is 44 CSS pixels; device-pixel-ratio rendering is capped at 2.
- Blender is the 3D source of truth; Canvas uses transparent pre-rendered PNG sprites.
- Runtime requires no network connection and stores only mute/best-clear preferences in localStorage.
- Defaults that require later playtesting are documented in `docs/decisions/deferred-decisions.md` rather than blocking implementation.

---

### Task 1: Repository scaffold and decision ledger

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/styles.css`
- Create: `docs/decisions/deferred-decisions.md`
- Test: `tests/scaffold.test.ts`

**Interfaces:**
- Produces: Vite entry at `src/main.ts`, root element `#app`, scripts `dev`, `build`, `test`, `test:watch`, `test:e2e`, and `check`.
- Consumes: approved PNG assets under `assets/renders/` and `assets/concepts/enemies/`.

- [ ] **Step 1: Write the failing scaffold test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('project scaffold', () => {
  it('exposes the required scripts and app root', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const html = readFileSync('index.html', 'utf8');
    expect(pkg.scripts).toMatchObject({ dev: 'vite', build: 'tsc -b && vite build', test: 'vitest run' });
    expect(html).toContain('id="app"');
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm test -- tests/scaffold.test.ts`

Expected: FAIL because the package and entry files do not exist yet.

- [ ] **Step 3: Create the minimal Vite/TypeScript scaffold**

Use this package contract:

```json
{
  "name": "huchu-defense-v2",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check": "npm run test && npm run build"
  },
  "devDependencies": {
    "@playwright/test": "^1.52.0",
    "typescript": "^5.8.3",
    "vite": "^7.0.0",
    "vitest": "^3.2.0"
  }
}
```

`src/main.ts` must import `src/styles.css` and render a visible loading shell into `#app`. `index.html` must set viewport-fit and disable double-tap zoom only on game controls, not globally. The decision ledger must record every numerical default from Tasks 3–8 with rationale and one-line change location.

- [ ] **Step 4: Install and verify GREEN**

Run: `npm install`

Run: `npm test -- tests/scaffold.test.ts`

Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add .gitignore package.json package-lock.json tsconfig.json vite.config.ts index.html src/main.ts src/styles.css tests/scaffold.test.ts docs/decisions/deferred-decisions.md
git commit -m "chore: scaffold mobile canvas game"
```

---

### Task 2: Twelve-agent project harness

**Files:**
- Create: `.codex/agents/game-architect.md`
- Create: `.codex/agents/simulation-engineer.md`
- Create: `.codex/agents/canvas-renderer.md`
- Create: `.codex/agents/mobile-input-designer.md`
- Create: `.codex/agents/level-wave-designer.md`
- Create: `.codex/agents/balance-economy-designer.md`
- Create: `.codex/agents/blender-asset-producer.md`
- Create: `.codex/agents/sprite-pipeline-engineer.md`
- Create: `.codex/agents/vfx-audio-designer.md`
- Create: `.codex/agents/unit-test-engineer.md`
- Create: `.codex/agents/browser-qa.md`
- Create: `.codex/agents/performance-accessibility-reviewer.md`
- Create: `.codex/skills/<matching-name>/skill.md` for each agent
- Create: `.codex/skills/huchu-defense-orchestrator/skill.md`
- Test: `tests/harness.test.ts`

**Interfaces:**
- Produces: 12 agent definitions, 12 specialist skills, and one orchestrator skill.
- Consumes: the Global Constraints in this plan.

- [ ] **Step 1: Write the failing harness structure test**

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('project harness', () => {
  it('defines at least twelve agents and matching skills', () => {
    const agents = readdirSync('.codex/agents').filter((name) => name.endsWith('.md'));
    expect(agents).toHaveLength(12);
    for (const file of agents) {
      const name = file.replace(/\.md$/, '');
      expect(readFileSync(`.codex/skills/${name}/skill.md`, 'utf8')).toContain(`name: ${name}`);
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm test -- tests/harness.test.ts`

Expected: FAIL because `.codex/agents` does not exist.

- [ ] **Step 3: Create definitions and matching skills**

Every agent file must contain YAML `name` and `description`, then `핵심 역할`, `작업 원칙`, `출력 형식`, and `협업`. Every matching skill must contain YAML `name` and `description`, then `워크플로우`, `검증`, and `출력 규칙`. The orchestrator must route asset production through producer/reviewer gates and code work through test-first implementer/reviewer gates.

- [ ] **Step 4: Verify GREEN and command absence**

Run: `npm test -- tests/harness.test.ts`

Run: `test ! -d .codex/commands`

Expected: 1 harness test passes and no `.codex/commands` directory exists.

- [ ] **Step 5: Commit**

```bash
git add .codex/agents .codex/skills tests/harness.test.ts
git commit -m "chore: add twelve-agent game production harness"
```

---

### Task 3: Grid map, geometry, and deterministic fixed-step loop

**Files:**
- Create: `src/game/types.ts`
- Create: `src/game/config.ts`
- Create: `src/game/map/stage1.ts`
- Create: `src/game/core/geometry.ts`
- Create: `src/game/core/fixedStepLoop.ts`
- Test: `tests/game/geometry.test.ts`
- Test: `tests/game/fixedStepLoop.test.ts`
- Test: `tests/game/stage1.test.ts`

**Interfaces:**
- Produces: `Cell`, `Vec2`, `STAGE_1`, `cellCenter(cell)`, `worldToCell(point)`, `createFixedStepLoop(options)`.
- Consumes: 20×10 map and exact-cell constraints.

- [ ] **Step 1: Write geometry and stage tests**

```ts
expect(cellCenter({ col: 3, row: 4 })).toEqual({ x: 3.5, y: 4.5 });
expect(worldToCell({ x: 3.99, y: 4.01 })).toEqual({ col: 3, row: 4 });
expect(STAGE_1.width).toBe(20);
expect(STAGE_1.height).toBe(10);
expect(STAGE_1.pathCells.every((cell, index, all) => index === 0 || Math.abs(cell.col - all[index - 1].col) + Math.abs(cell.row - all[index - 1].row) === 1)).toBe(true);
expect(new Set(STAGE_1.pathCells.map(({ col, row }) => `${col}:${row}`)).size).toBe(STAGE_1.pathCells.length);
```

The fixed-step test must feed `0.1` seconds and assert exactly six updates of `1 / 60` while render is called once.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- tests/game/geometry.test.ts tests/game/fixedStepLoop.test.ts tests/game/stage1.test.ts`

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement map and loop**

Stage 1 path is the expanded integer-cell chain through waypoints `(0,2) → (5,2) → (5,7) → (12,7) → (12,3) → (19,3)`. `pathCells` must contain every intermediate cell exactly once. `isBuildableCell` returns false for path cells, occupied cells, and out-of-bounds cells. The loop clamps a single frame delta to `0.25` seconds, accumulates time, and executes updates while accumulator is at least `1/60`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- tests/game/geometry.test.ts tests/game/fixedStepLoop.test.ts tests/game/stage1.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/game tests/game
git commit -m "feat: add deterministic grid simulation foundation"
```

---

### Task 4: Enemies, waves, economy, base damage, and game outcome

**Files:**
- Create: `src/game/enemies/enemyCatalog.ts`
- Create: `src/game/waves/stage1Waves.ts`
- Create: `src/game/simulation/createGame.ts`
- Create: `src/game/simulation/updateEnemies.ts`
- Create: `src/game/simulation/updateWaves.ts`
- Create: `src/game/simulation/updateGame.ts`
- Test: `tests/game/enemies.test.ts`
- Test: `tests/game/waves.test.ts`
- Test: `tests/game/outcome.test.ts`

**Interfaces:**
- Produces: `ENEMY_CATALOG`, `STAGE_1_WAVES`, `createGame(seed?)`, `updateGame(state, dt)`, outcome values `playing | victory | defeat`.
- Consumes: `STAGE_1.pathCells` and fixed `dt`.

- [ ] **Step 1: Write failing behavior tests**

Test that a fairy advances farther than a slime over one second, a golem has more HP than an orc, a minotaur exists only in wave 10, killing an enemy grants its configured reward exactly once, an exiting enemy reduces base HP by its leak damage, base HP reaching zero sets defeat, and clearing the final active enemy after wave 10 sets victory.

```ts
expect(ENEMY_CATALOG.fairy.speed).toBeGreaterThan(ENEMY_CATALOG.slime.speed);
expect(ENEMY_CATALOG.golem.hp).toBeGreaterThan(ENEMY_CATALOG.orc.hp);
expect(STAGE_1_WAVES.slice(0, 9).flatMap((wave) => wave.groups).some((group) => group.type === 'minotaur')).toBe(false);
expect(STAGE_1_WAVES[9].groups.some((group) => group.type === 'minotaur')).toBe(true);
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- tests/game/enemies.test.ts tests/game/waves.test.ts tests/game/outcome.test.ts`

Expected: FAIL because enemy and wave modules do not exist.

- [ ] **Step 3: Implement data and state updates**

Use initial defaults: starting gold `450`, base HP `20`, inter-wave delay `5`, and enemy values `slime { hp: 42, speed: 1.15, reward: 10, leak: 1 }`, `fairy { hp: 32, speed: 1.9, reward: 14, leak: 1 }`, `orc { hp: 110, speed: 0.9, reward: 20, leak: 2 }`, `golem { hp: 320, speed: 0.52, reward: 38, leak: 3 }`, `minotaur { hp: 1800, speed: 0.48, reward: 200, leak: 8 }`. Scale group HP by `1 + (waveIndex * 0.08)`. Store distance-along-route as the canonical progress value.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/game/enemies.test.ts tests/game/waves.test.ts tests/game/outcome.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/game/enemies src/game/waves src/game/simulation tests/game
git commit -m "feat: add five enemies and ten-wave stage flow"
```

---

### Task 5: Tower placement, targeting, projectiles, splash, and slow

**Files:**
- Create: `src/game/towers/towerCatalog.ts`
- Create: `src/game/combat/targeting.ts`
- Create: `src/game/combat/updateSlow.ts`
- Create: `src/game/combat/updateTowers.ts`
- Create: `src/game/combat/updateProjectiles.ts`
- Create: `src/game/simulation/placeTower.ts`
- Modify: `src/game/simulation/updateGame.ts`
- Test: `tests/game/placement.test.ts`
- Test: `tests/game/targeting.test.ts`
- Test: `tests/game/combat.test.ts`

**Interfaces:**
- Produces: `TOWER_CATALOG`, `placeTower(state, type, cell)`, `selectTarget(tower, enemies)`, projectile and hit-event collections.
- Consumes: buildability, gold, enemy progress, and enemy positions.

- [ ] **Step 1: Write failing placement and combat tests**

Test insufficient gold, path rejection, occupied-cell rejection, exact center coordinates, duplicate tower types on different cells, highest-progress targeting, arrow single damage, Huchu and Deokbae radius damage, slow zero damage, and strongest non-stacking slow.

```ts
expect(placeTower(state, 'arrow', { col: 2, row: 5 }).ok).toBe(true);
expect(state.towers[0].position).toEqual({ x: 2.5, y: 5.5 });
expect(selectTarget(tower, [behindEnemy, aheadEnemy])?.id).toBe(aheadEnemy.id);
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- tests/game/placement.test.ts tests/game/targeting.test.ts tests/game/combat.test.ts`

Expected: FAIL because tower/combat modules do not exist.

- [ ] **Step 3: Implement tower defaults and combat**

Use defaults: `slow { cost: 80, range: 2.4, multiplier: 0.62 }`, `arrow { cost: 100, range: 3.2, damage: 18, cooldown: 0.55, projectileSpeed: 8 }`, `deokbae { cost: 250, range: 3.0, damage: 14, cooldown: 0.42, projectileSpeed: 6.5, splash: 0.85 }`, `huchu { cost: 300, range: 3.4, damage: 72, cooldown: 1.8, projectileSpeed: 5, splash: 1.25 }`. Recompute slow from active aura towers before moving enemies. Projectiles home toward a living target; if the target dies before contact, remove the projectile. Apply rewards after damage resolution and prevent duplicate rewards.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/game/placement.test.ts tests/game/targeting.test.ts tests/game/combat.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/game/towers src/game/combat src/game/simulation tests/game
git commit -m "feat: implement four tower combat roles"
```

---

### Task 6: Blender voxel enemies and sprite manifest

**Files:**
- Create: `assets/blender/enemies-voxel-v1.blend`
- Create: `assets/renders/enemies-v1/<type>/<type>-{ne,se,sw,nw}-v1.png` for five types
- Create: `assets/renders/enemies-v1/mobile/<type>/<type>-{ne,se,sw,nw}-96-v1.png`
- Create: `src/game/render/spriteManifest.ts`
- Create: `docs/assets/enemies-v1.md`
- Test: `tests/game/spriteManifest.test.ts`

**Interfaces:**
- Produces: four diagonal transparent sprites per enemy type and `ENEMY_SPRITES[type][direction]` URLs.
- Consumes: approved lineup `assets/concepts/enemies/enemy-lineup-2d-v2.png`.

- [ ] **Step 1: Write the failing manifest test**

```ts
for (const type of ['slime', 'fairy', 'orc', 'golem', 'minotaur'] as const) {
  expect(Object.keys(ENEMY_SPRITES[type]).sort()).toEqual(['ne', 'nw', 'se', 'sw']);
  for (const url of Object.values(ENEMY_SPRITES[type])) expect(url).toMatch(/-96-v1\.png$/);
}
```

- [ ] **Step 2: Run test and confirm RED**

Run: `npm test -- tests/game/spriteManifest.test.ts`

Expected: FAIL because the manifest does not exist.

- [ ] **Step 3: Build a single Blender source with five rooted models**

Use Blender MCP and procedural block geometry. Each root is at foot contact `(0,0,0)`, Z-up, local `+Y` forward, scale `1`, and dimensions snapped to `1/16` BU. Models are named `Enemy_<Type>_Root`; each body and VFX root is separate. Slime is a low stepped opaque green blob, fairy is a pointed-ear humanoid with four diamond wings, orc has tusks and short club, golem has asymmetric stone blocks and irregular amber cracks, and minotaur has broad chest and large ivory horns.

- [ ] **Step 4: Render and document**

Render the same model at yaw `45`, `135`, `225`, and `315` degrees using one orthographic camera, transparent background, identical light, and 256×256 output. Downsample to 96×96 with alpha. Save the `.blend` file and write exact root names, dimensions, camera settings, and output paths into the asset document.

- [ ] **Step 5: Implement manifest and verify GREEN**

Run: `npm test -- tests/game/spriteManifest.test.ts`

Run: `find assets/renders/enemies-v1/mobile -name '*-96-v1.png' | wc -l`

Expected: manifest test passes and count is `20`.

- [ ] **Step 6: Commit**

```bash
git add assets/blender/enemies-voxel-v1.blend assets/renders/enemies-v1 src/game/render/spriteManifest.ts docs/assets/enemies-v1.md tests/game/spriteManifest.test.ts
git commit -m "feat: add five voxel enemy sprite sets"
```

---

### Task 7: Asset loading and Canvas renderer

**Files:**
- Create: `src/game/render/assetLoader.ts`
- Create: `src/game/render/layout.ts`
- Create: `src/game/render/canvasRenderer.ts`
- Create: `src/game/render/drawMap.ts`
- Create: `src/game/render/drawEntities.ts`
- Create: `src/game/render/drawEffects.ts`
- Test: `tests/game/layout.test.ts`
- Test: `tests/game/direction.test.ts`

**Interfaces:**
- Produces: `loadGameAssets()`, `computeCanvasLayout(viewport)`, `movementDirection(vector)`, and `createCanvasRenderer(canvas, assets)`.
- Consumes: game snapshot, approved 96 px tower sprites, enemy manifest, and hit events.

- [ ] **Step 1: Write failing pure-render tests**

Test that a 390×844 portrait viewport produces a 16:9 letterboxed game area with an orientation prompt, 844×390 produces a centered landscape area, DPR is capped at 2, and vectors map to `ne`, `se`, `sw`, or `nw` deterministically.

```ts
expect(movementDirection({ x: 1, y: -1 })).toBe('ne');
expect(movementDirection({ x: -1, y: 1 })).toBe('sw');
expect(computeCanvasLayout({ width: 844, height: 390, dpr: 3 }).dpr).toBe(2);
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- tests/game/layout.test.ts tests/game/direction.test.ts`

Expected: FAIL because renderer modules do not exist.

- [ ] **Step 3: Implement renderer**

Draw a muted green checker-free grid, flat sand path, entry and snack-box goal, selected-cell highlight, range circle, towers, enemies, HP bars, projectiles, splash rings, slow aura, floating gold, and pause overlay. Use `imageSmoothingEnabled = true` for approved 3D sprites and pixel-aligned world-to-screen transforms. Arrow sprites select a diagonal direction from target vector; enemy sprites select from movement vector. Renderer never mutates simulation state.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/game/layout.test.ts tests/game/direction.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/game/render tests/game
git commit -m "feat: render grid combat with approved sprites"
```

---

### Task 8: Mobile HUD, placement controls, game states, and local preferences

**Files:**
- Create: `src/app/GameApp.ts`
- Create: `src/app/input.ts`
- Create: `src/app/hud.ts`
- Create: `src/app/preferences.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Test: `tests/app/input.test.ts`
- Test: `tests/app/preferences.test.ts`

**Interfaces:**
- Produces: start, pause, speed `1×/2×`, mute, restart, tower selection, grid tap placement, and landscape orientation overlay.
- Consumes: simulation and renderer interfaces.

- [ ] **Step 1: Write failing input/preference tests**

Test client-coordinate conversion through letterboxing, tap-to-cell conversion, drag cancellation above eight CSS pixels, mute persistence, best-clear persistence, and corrupt localStorage fallback.

```ts
expect(pointerToCell({ x: 100, y: 100 }, layout)).toEqual({ col: 2, row: 4 });
expect(loadPreferences(storageWith('{bad json'))).toEqual({ muted: false, bestClearSeconds: null });
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- tests/app/input.test.ts tests/app/preferences.test.ts`

Expected: FAIL because app modules do not exist.

- [ ] **Step 3: Implement the game shell**

Create a compact top HUD for gold, base HP, wave, pause, speed, and mute; a bottom four-card tower tray with name, role icon, and price; start/victory/defeat overlays; invalid placement shake; selected range preview; and portrait rotation prompt. Each button must be at least 44×44 CSS pixels and expose an accessible name. The simulation continues during combat and stops while paused or after outcome.

- [ ] **Step 4: Verify GREEN and build**

Run: `npm test -- tests/app/input.test.ts tests/app/preferences.test.ts`

Run: `npm run build`

Expected: tests pass and Vite build exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/app src/main.ts src/styles.css tests/app
git commit -m "feat: add touch-first mobile game shell"
```

---

### Task 9: Runtime VFX, synthesized audio, browser QA, and release verification

**Files:**
- Create: `src/game/audio/SoundEngine.ts`
- Modify: `src/game/render/drawEffects.ts`
- Create: `playwright.config.ts`
- Create: `e2e/game.spec.ts`
- Create: `README.md`
- Create: `docs/qa/mvp-verification.md`
- Test: `tests/game/effects.test.ts`

**Interfaces:**
- Produces: small Web Audio cues, deterministic effect lifetimes, browser smoke coverage, and run documentation.
- Consumes: hit events, preferences, built game.

- [ ] **Step 1: Write failing effect lifetime test**

```ts
const next = updateEffects([{ kind: 'splash', age: 0, duration: 0.4 }], 0.41);
expect(next).toEqual([]);
```

- [ ] **Step 2: Run test and confirm RED**

Run: `npm test -- tests/game/effects.test.ts`

Expected: FAIL because effect update behavior does not exist.

- [ ] **Step 3: Implement minimal effects and audio**

Use Canvas primitives for aqua splash, fire burst, arrow impact, gold pop, and slow pulse. Use Web Audio oscillators/noise for placement, shot, hit, leak, victory, and defeat; create the audio context only after a user gesture and respect mute. Do not fetch audio files.

- [ ] **Step 4: Add Playwright acceptance flow**

At viewport `844×390`, start the game, select the arrow tower, place it on a buildable grid cell, assert gold decreases, toggle `2×`, pause/resume, advance with a debug-only deterministic clock hook, and assert either an enemy HP bar or wave progress changes. At `390×844`, assert the rotate prompt is visible. Assert no browser console errors.

- [ ] **Step 5: Run full verification**

Run: `npm run test`

Run: `npm run build`

Run: `npm run test:e2e`

Expected: every command exits 0 with no failed tests and no console errors.

- [ ] **Step 6: Document and commit**

`README.md` must include install, dev, build, test, controls, asset attribution to user-provided dog photos, and exact default balance location. `docs/qa/mvp-verification.md` must record commands, test counts, viewport screenshots, and deferred decisions.

```bash
git add src/game/audio src/game/render/drawEffects.ts playwright.config.ts e2e README.md docs/qa tests/game/effects.test.ts
git commit -m "test: verify playable mobile tower defense MVP"
```

---

## Plan Self-Review

- Spec coverage: landscape Canvas, 20×10 exact grid, orthogonal path, four towers, five enemies, ten waves, economy, base outcome, mobile controls, Blender sprites, 10+ harness agents, and verification each have an owning task.
- Placeholder scan: no implementation step depends on TBD, TODO, or an undefined follow-up.
- Type consistency: `Cell`, `Vec2`, `STAGE_1`, `createGame`, `updateGame`, `placeTower`, `ENEMY_SPRITES`, `movementDirection`, and renderer/app interfaces are introduced before consumption.
- Deferred choices: numerical tuning and final art polish are executable defaults documented in one decision ledger; they do not block the MVP.
