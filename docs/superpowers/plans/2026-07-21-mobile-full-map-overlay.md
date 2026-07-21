# Mobile Full-Map Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 가로형 모바일에서 20×10 맵을 전체 뷰포트에 가깝게 확대하고 HUD·타워 선택 UI를 맵 위에 배치하며, 홈 화면 설치 시 URL 표시줄 없이 실행되는 standalone 웹 앱 설정을 제공한다.

**Architecture:** 게임 시뮬레이션과 투영 원근은 유지하고 `computeCanvasLayout`의 맵 사용 비율만 높인다. DOM 구조는 유지하되 CSS에서 stage를 전체 화면 레이어로, HUD와 타워 트레이를 별도 오버레이 레이어로 전환한다. 설치 모드는 Vite `public/`의 manifest와 앱 아이콘 및 `index.html` 메타데이터만 사용하며 서비스 워커는 추가하지 않는다.

**Tech Stack:** TypeScript 5.8, HTML Canvas 2D, CSS safe-area environment variables, Vite 7, Vitest 3, Playwright 1.52, Web App Manifest

## Global Constraints

- 작업은 기존 격리 worktree `/private/tmp/huchu-defense-v2-3d-preview`와 브랜치 `codex/3d-preview-assets`에서 단일 에이전트 방식으로 수행한다.
- Vite base `/huchu-duckbae-tower-defense/`를 변경하지 않는다.
- 맵은 20×10, 길과 웨이브 및 전투 수치, 원근 비율 `farScale=0.88`과 `nearScale=1.05`를 유지한다.
- 세로 화면에서는 기존 회전 안내와 시뮬레이션 차단을 유지한다.
- 터치 버튼의 최소 크기는 44×44px이다.
- 일반 브라우저 탭에서 URL 표시줄을 강제로 숨기지 않는다.
- 설치 모드는 `display: standalone`을 요청하되 오프라인 캐시와 서비스 워커는 추가하지 않는다.
- 기존 미커밋 Blender VFX 산출물과 런타임 VFX 변경은 이 계획의 각 커밋에서 제외한다.

---

### Task 1: Expand the projected map to the full mobile viewport

**Files:**
- Modify: `src/game/render/layout.ts:1-82`
- Modify: `tests/game/layout.test.ts:15-35`

**Interfaces:**
- Consumes: `computeCanvasLayout(viewport: Viewport): CanvasLayout`
- Produces: 같은 API와 원근 비율을 유지하면서 `mapArea`가 뷰포트 가로 최대 99%, 세로 최대 98%를 사용하는 레이아웃

- [x] **Step 1: Write the failing layout test**

`tests/game/layout.test.ts`의 가로 화면 테스트를 다음 계약으로 변경한다.

```ts
it('maximizes the full perspective board inside an 844 by 390 landscape viewport', () => {
  const layout = computeCanvasLayout({ width: 844, height: 390, dpr: 1 });

  expect(layout.showOrientationPrompt).toBe(false);
  expect(layout.gameArea).toEqual({ x: 0, y: 0, width: 844, height: 390 });
  expect(layout.mapArea.width).toBeLessThanOrEqual(844 * 0.99);
  expect(layout.mapArea.width).toBeGreaterThan(844 * 0.98);
  expect(layout.mapArea.height).toBeCloseTo(390 * 0.98);
  expect(layout.projection.centerX).toBeCloseTo(422);
  expect(layout.projection.topY).toBeCloseTo(layout.mapArea.y);
  expect(layout.projection.farScale).toBe(0.88);
  expect(layout.projection.nearScale).toBe(1.05);
  expect(layout.projection.rowStep)
    .toBeCloseTo(layout.projection.baseCellWidth * 0.965);
  expect(layout.tileWidth).toBeCloseTo(layout.projection.baseCellWidth);
  expect(layout.tileHeight).toBeCloseTo(layout.projection.rowStep);
  expect(layout.mapArea.x).toBeGreaterThanOrEqual(layout.gameArea.x);
  expect(layout.mapArea.y).toBeGreaterThanOrEqual(layout.gameArea.y);
  expect(layout.mapArea.x + layout.mapArea.width).toBeLessThanOrEqual(844);
  expect(layout.mapArea.y + layout.mapArea.height).toBeLessThanOrEqual(390);
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/game/layout.test.ts`

Expected: FAIL because current `MAP_HEIGHT_RATIO = 0.90` produces `mapArea.height = 351`, not `382.2`.

- [x] **Step 3: Increase only the map usage bounds**

Change the two constants in `src/game/render/layout.ts` without altering the projection scales.

```ts
const MAX_DEVICE_PIXEL_RATIO = 2;
const MAP_WIDTH_RATIO = 0.99;
const MAP_HEIGHT_RATIO = 0.98;
const FAR_SCALE = 0.88;
const NEAR_SCALE = 1.05;
```

- [x] **Step 4: Run focused tests and verify GREEN**

Run: `npx vitest run tests/game/layout.test.ts tests/game/projection.test.ts tests/app/input.test.ts`

Expected: 3 test files pass with zero failures.

- [x] **Step 5: Commit the map layout change**

```bash
git add src/game/render/layout.ts tests/game/layout.test.ts
git commit -m "feat: maximize the mobile game map"
```

---

### Task 2: Layer the HUD and tower controls over the full-screen map

**Files:**
- Modify: `src/styles.css:61-291`
- Modify: `e2e/game.spec.ts:87-128`

**Interfaces:**
- Consumes: existing `.game-shell`, `.game-stage`, `.game-hud`, `.game-hud__stats`, `.game-hud__controls`, `.tower-tray`, `.placement-status`, and `.placement-actions` DOM classes from `createHud`
- Produces: stage/canvas full-viewport bounds, top overlay HUD groups, bottom overlay tower tray, and 44px minimum controls

- [x] **Step 1: Add a failing browser layout contract**

Add this test before the existing touch-flow test in `e2e/game.spec.ts`.

```ts
test('844x390 uses a full-screen board with non-overlapping overlay controls', async ({ page }) => {
  const consoleErrors = captureConsoleErrors(page);
  await startGame(page);

  const viewport = page.viewportSize();
  const stage = await page.locator('.game-stage').boundingBox();
  const canvas = await page.locator('.game-canvas').boundingBox();
  const hud = await page.locator('.game-hud').boundingBox();
  const tray = await page.locator('.tower-tray').boundingBox();
  if (viewport === null || stage === null || canvas === null || hud === null || tray === null) {
    throw new Error('Full-map overlay elements must have layout boxes');
  }

  expect(stage.x).toBeCloseTo(0);
  expect(stage.y).toBeCloseTo(0);
  expect(stage.width).toBeCloseTo(viewport.width);
  expect(stage.height).toBeCloseTo(viewport.height);
  expect(canvas).toEqual(stage);
  expect(hud.y).toBeGreaterThanOrEqual(stage.y);
  expect(tray.y + tray.height).toBeLessThanOrEqual(stage.y + stage.height);
  expect(hud.y + hud.height).toBeLessThan(tray.y);

  for (const button of await page.locator('.game-control').all()) {
    if (!(await button.isVisible())) continue;
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  expect(consoleErrors).toEqual([]);
});
```

- [x] **Step 2: Run the focused E2E test and verify RED**

Run: `npx playwright test e2e/game.spec.ts -g "full-screen board"`

Expected: FAIL because `.game-stage` currently occupies only the grid middle row and its height is smaller than 390px.

- [x] **Step 3: Convert the shell and stage to full-screen layers**

Replace the shell and stage positioning rules in `src/styles.css` with:

```css
.game-shell {
  position: relative;
  display: block;
  width: 100%;
  height: 100svh;
  height: 100dvh;
  padding: 0;
  overflow: hidden;
  background: radial-gradient(circle at 50% 42%, #315444 0, var(--md-sys-color-surface) 72%);
  user-select: none;
}

.game-stage {
  position: absolute;
  z-index: 0;
  inset: env(safe-area-inset-top) env(safe-area-inset-right)
    env(safe-area-inset-bottom) env(safe-area-inset-left);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
```

- [x] **Step 4: Convert top HUD groups to translucent overlays**

Replace the current `.game-hud` and group rules with:

```css
.game-hud {
  position: absolute;
  z-index: 3;
  top: max(4px, env(safe-area-inset-top));
  right: max(6px, env(safe-area-inset-right));
  left: max(6px, env(safe-area-inset-left));
  display: flex;
  min-height: 44px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 0;
  background: transparent;
  box-shadow: none;
  pointer-events: none;
}

.game-hud__stats,
.game-hud__controls {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 5px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--md-sys-shape-medium);
  background: rgba(18, 45, 35, 0.78);
  box-shadow: var(--md-sys-elevation-1);
  backdrop-filter: blur(8px);
  pointer-events: auto;
}
```

- [x] **Step 5: Convert the tower tray and placement UI to bottom overlays**

Replace `.tower-tray` positioning and adjust placement offsets:

```css
.tower-tray {
  position: absolute;
  z-index: 3;
  left: 50%;
  bottom: max(4px, env(safe-area-inset-bottom));
  display: grid;
  width: min(620px, calc(100% - 12px - env(safe-area-inset-left) - env(safe-area-inset-right)));
  min-height: 62px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
  padding: 5px;
  transform: translateX(-50%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--md-sys-shape-medium);
  background: rgba(18, 45, 35, 0.82);
  box-shadow: var(--md-sys-elevation-2);
  backdrop-filter: blur(8px);
}

.placement-status {
  bottom: calc(max(4px, env(safe-area-inset-bottom)) + 132px);
}

.placement-actions {
  bottom: calc(max(4px, env(safe-area-inset-bottom)) + 72px);
}
```

Keep `.tower-card` minimum touch size through the existing `.game-control` 44×44px contract. Update the compact-height media query to keep `.game-hud { min-height: 44px; }` and `.tower-tray { min-height: 58px; }` without restoring grid rows.

- [x] **Step 6: Verify E2E and existing touch flow GREEN**

Run: `npx playwright test e2e/game.spec.ts -g "full-screen board|touch flow"`

Expected: both tests pass; the stage and canvas are 844×390, buttons remain at least 44×44px, and touch placement still succeeds.

- [x] **Step 7: Run static and TypeScript checks**

Run: `npx vitest run tests/game/layout.test.ts tests/game/projection.test.ts tests/app/input.test.ts tests/app/hud.test.ts`

Expected: all focused unit suites pass.

Run: `npx tsc -b --pretty false`

Expected: exit code 0 with no diagnostics.

- [x] **Step 8: Commit the overlay layout**

```bash
git add src/styles.css e2e/game.spec.ts
git commit -m "feat: overlay controls on the full mobile map"
```

---

### Task 3: Add standalone home-screen metadata and install icons

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/icons/app-icon-180.png`
- Create: `public/icons/app-icon-192.png`
- Create: `public/icons/app-icon-512.png`
- Modify: `index.html:4-10`
- Modify: `tests/scaffold.test.ts:4-19`

**Interfaces:**
- Consumes: Vite public-file copy behavior and canonical base `/huchu-duckbae-tower-defense/`
- Produces: `manifest.webmanifest` with relative `start_url`/`scope`, standalone display mode, landscape orientation, and three PNG icons

- [x] **Step 1: Write the failing standalone metadata test**

Extend `tests/scaffold.test.ts` with imports and a second test:

```ts
import { existsSync, readFileSync } from 'node:fs';

it('configures an installable standalone game at the canonical subpath', () => {
  const html = readFileSync('index.html', 'utf8');
  const manifestPath = 'public/manifest.webmanifest';
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : null;

  expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
  expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
  expect(html).toContain('<meta name="apple-mobile-web-app-title" content="후추덕배 타워 디펜스" />');
  expect(html).toContain('<link rel="apple-touch-icon" href="/icons/app-icon-180.png" />');
  expect(manifest).toMatchObject({
    id: './',
    name: '후추덕배 타워 디펜스',
    short_name: '후추덕배 TD',
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'landscape',
    theme_color: '#10271f',
    background_color: '#10271f',
  });
  expect(manifest.icons).toEqual([
    { src: 'icons/app-icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/app-icon-512.png', sizes: '512x512', type: 'image/png' },
  ]);
  for (const size of [180, 192, 512]) {
    expect(existsSync(`public/icons/app-icon-${size}.png`)).toBe(true);
  }
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/scaffold.test.ts`

Expected: FAIL because `index.html` has no manifest/Apple metadata and the manifest is `null`.

- [x] **Step 3: Create the relative-scope manifest**

Create `public/manifest.webmanifest` with exactly:

```json
{
  "id": "./",
  "name": "후추덕배 타워 디펜스",
  "short_name": "후추덕배 TD",
  "description": "후추와 덕배가 간식 창고를 지키는 모바일 타워 디펜스 게임",
  "lang": "ko",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "landscape",
  "theme_color": "#10271f",
  "background_color": "#10271f",
  "icons": [
    {
      "src": "icons/app-icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icons/app-icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [x] **Step 4: Add HTML metadata using Vite-rewritten public paths**

Add these entries after the existing viewport and theme color in `index.html`:

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="후추덕배 타워 디펜스" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/icons/app-icon-180.png" />
```

- [x] **Step 5: Generate deterministic icon sizes from the approved Huchu tower render**

Create the output directory and generate three PNGs from the 256px transparent Huchu master render without modifying the source:

```bash
mkdir -p public/icons
sips -z 180 180 assets/renders/redesign-preview-v1/master/towers/huchu-se.png --out public/icons/app-icon-180.png
sips -z 192 192 assets/renders/redesign-preview-v1/master/towers/huchu-se.png --out public/icons/app-icon-192.png
sips -z 512 512 assets/renders/redesign-preview-v1/master/towers/huchu-se.png --out public/icons/app-icon-512.png
```

Verify exact dimensions:

```bash
sips -g pixelWidth -g pixelHeight public/icons/app-icon-180.png public/icons/app-icon-192.png public/icons/app-icon-512.png
```

Expected: each width and height equals its filename size.

- [x] **Step 6: Verify focused metadata tests GREEN**

Run: `npx vitest run tests/scaffold.test.ts`

Expected: all scaffold tests pass.

- [x] **Step 7: Verify Vite production path rewriting**

Run: `npm run build`

Expected: exit code 0; `dist/index.html` references `/huchu-duckbae-tower-defense/manifest.webmanifest` and `/huchu-duckbae-tower-defense/icons/app-icon-180.png`.

Run: `rg -n "/huchu-duckbae-tower-defense/(manifest.webmanifest|icons/app-icon-180.png|assets/)" dist/index.html`

Expected: manifest, Apple icon, JS, and CSS all use the canonical base.

- [x] **Step 8: Commit install metadata and icons**

```bash
git add index.html public/manifest.webmanifest public/icons tests/scaffold.test.ts
git commit -m "feat: add standalone mobile install mode"
```

---

### Task 4: Integrate, visually verify, and hand back to the existing deployment plan

**Files:**
- Modify: `e2e/game.spec.ts:87-145` only if visual verification reveals an assertion gap
- Update generated screenshot: `docs/qa/landscape-844x390.png`
- Modify: `docs/superpowers/plans/2026-07-21-mobile-full-map-overlay.md` checkboxes only

**Interfaces:**
- Consumes: Tasks 1-3 plus the existing backlog implementation commits and pending Blender VFX files
- Produces: fresh unit/build/E2E evidence and a reviewed 844×390 screenshot ready for the existing merge/deploy workflow

- [x] **Step 1: Run all unit tests and production build**

Run: `npm run check`

Expected: all Vitest files pass and Vite production build exits 0.

- [x] **Step 2: Run the full mobile E2E suite and refresh QA screenshots**

Run: `UPDATE_QA_SCREENSHOTS=1 npm run test:e2e`

Expected: all Playwright tests pass, `docs/qa/landscape-844x390.png` is refreshed, and captured browser console errors remain empty.

- [x] **Step 3: Inspect the 844×390 screenshot**

Open `docs/qa/landscape-844x390.png` and verify:

- the full map nearly reaches all four viewport edges;
- top stats and controls are readable and do not overlap;
- the bottom tower tray stays inside the viewport and preserves four 44px controls;
- path enemies remain visible through the translucent overlays;
- the placement guide and selected-cell range remain aligned to projected tiles.

If any item fails, add one focused E2E assertion that reproduces the issue, observe RED, apply the smallest CSS/layout correction, then rerun the focused test and screenshot.

- [x] **Step 4: Revalidate the pending VFX asset group**

Run: `npm run assets:preview:validate -- --group vfx`

Expected: `VALIDATED 6 assets / 12 PNG files`.

- [x] **Step 5: Check the complete diff and repository hygiene**

Run: `git diff --check`

Expected: exit code 0 with no whitespace errors.

Run: `git status --short`

Expected: only the explicitly approved VFX files, updated QA screenshot, and plan checkbox changes remain uncommitted; no unexpected source or build output appears.

- [x] **Step 6: Commit the verified QA evidence**

```bash
git add docs/qa/landscape-844x390.png docs/superpowers/plans/2026-07-21-mobile-full-map-overlay.md
git commit -m "test: verify the full-map mobile layout"
```

- [x] **Step 7: Resume the existing backlog deployment plan**

Return to `docs/superpowers/plans/2026-07-21-backlog-visual-polish-batch.md` for VFX commit, root backlog preservation, final `npm run check`, full E2E, merge to `main`, push, GitHub Actions success, and public URL/asset HTTP 200 verification.

