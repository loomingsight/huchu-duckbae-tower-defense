import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('project scaffold', () => {
  it('exposes the required scripts and app root', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const html = readFileSync('index.html', 'utf8');

    expect(pkg.scripts).toMatchObject({
      dev: 'vite',
      build: 'tsc -b && vite build',
      test: 'vitest run',
      'test:watch': 'vitest',
      'test:e2e': 'playwright test',
      check: 'npm run test && npm run build',
    });
    expect(html).toContain('id="app"');
  });

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

  it('uses compact side rails and an 80-percent tower tray on mobile landscape', () => {
    const css = readFileSync('src/styles.css', 'utf8');

    expect(css).toContain(
      '@media (orientation: landscape) and (max-width: 1024px) and (max-height: 430px)',
    );
    expect(css).toContain(`.game-hud__stats,
  .game-hud__controls {
    min-height: 0;
    flex-direction: column;
    align-items: stretch;
    gap: 3px;
    padding: 3px;
  }`);
    expect(css).toContain(`width: min(496px, calc(80% - env(safe-area-inset-left) - env(safe-area-inset-right)));
    gap: 4px;
    min-height: 50px;
    padding: 4px;`);
    expect(css).toContain('bottom: calc(max(4px, env(safe-area-inset-bottom)) + 60px);');
    expect(css).toContain('bottom: calc(max(4px, env(safe-area-inset-bottom)) + 120px);');
    expect(css).toMatch(/\.game-control\s*\{[^}]*min-width: 44px;[^}]*min-height: 44px;/s);
  });

  it('uses deterministic gold-coin and Wave labels instead of OS emoji', () => {
    const hud = readFileSync('src/app/hud.ts', 'utf8');
    const css = readFileSync('src/styles.css', 'utf8');

    expect(hud).toContain('class="game-stat__coin" aria-hidden="true">G</span>');
    expect(hud).toContain('class="game-stat__label" aria-hidden="true">Wave</span>');
    expect(hud).not.toContain('🪙');
    expect(hud).not.toContain('🌊');
    expect(css).toMatch(/\.game-stat__coin\s*\{[^}]*border-radius: 50%;/s);
  });

  it('renders an opaque independent stage-select screen with accessible 3-by-2 cards', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    const hud = readFileSync('src/app/hud.ts', 'utf8');

    expect(hud).toContain('<section class="stage-select-screen"');
    expect(hud).toContain('stage-picker__number');
    expect(hud).toContain('stage-picker__name');
    expect(hud).toContain('stage-picker__status');
    expect(hud).toContain('stage-picker__record');
    expect(css).toMatch(/\.stage-select-screen\s*\{[^}]*background: #[0-9a-fA-F]{6};/s);
    expect(css).toMatch(/\.stage-picker\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/s);
    const cardSize = css.match(
      /\.stage-picker__button\s*\{[^}]*min-width: (\d+)px;[^}]*min-height: (\d+)px;/s,
    );
    expect(Number(cardSize?.[1])).toBeGreaterThanOrEqual(44);
    expect(Number(cardSize?.[2])).toBeGreaterThanOrEqual(44);
  });

  it('routes central placement messages through the three-second controller', () => {
    const app = readFileSync('src/app/GameApp.ts', 'utf8');
    const hud = readFileSync('src/app/hud.ts', 'utf8');
    const css = readFileSync('src/styles.css', 'utf8');

    expect(app).toContain('createTransientMessageController');
    expect(app).toContain('placementMessage.show(');
    expect(app).not.toContain('hud.placementStatus.textContent =');
    expect(hud).toContain(
      '<p class="placement-status" data-placement-status aria-live="polite" hidden></p>',
    );
    expect(css).toMatch(/\.placement-status\[hidden\]\s*\{[^}]*display: none;/s);
  });

  it('restarts full-shell shake feedback from the existing leak cue', () => {
    const app = readFileSync('src/app/GameApp.ts', 'utf8');
    const css = readFileSync('src/styles.css', 'utf8');

    expect(app).toContain('createBaseHitFeedback');
    expect(app).toContain("frame.cueTypes.includes('leak')");
    expect(css).toMatch(
      /\.game-shell--base-hit\s*\{[^}]*animation: base-hit-screen-shake 420ms/s,
    );
    expect(css).toContain('@keyframes base-hit-screen-shake');
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.game-shell--base-hit\s*\{\s*animation: none;/,
    );
  });

  it('provides a persisted top-or-bottom tower tray control on mobile landscape', () => {
    const app = readFileSync('src/app/GameApp.ts', 'utf8');
    const hud = readFileSync('src/app/hud.ts', 'utf8');
    const css = readFileSync('src/styles.css', 'utf8');

    expect(hud).toContain('data-control="tower-tray-position"');
    expect(hud).toContain('renderTowerTrayPosition');
    expect(app).toContain('saveTowerTrayPositionPreference');
    expect(app).toContain('hud.towerTrayPositionButton');
    expect(css).toMatch(/\.tower-tray__position-toggle\s*\{[^}]*display: none;/s);
    expect(css).toMatch(
      /\.game-shell--tower-tray-top \.tower-tray\s*\{[^}]*top:[^;]+;[^}]*bottom: auto;/s,
    );
  });

  it('provides a compact accessible installed-tower panel', () => {
    const app = readFileSync('src/app/GameApp.ts', 'utf8');
    const hud = readFileSync('src/app/hud.ts', 'utf8');
    const css = readFileSync('src/styles.css', 'utf8');

    expect(hud).toContain('data-tower-inspection');
    expect(hud).toContain('aria-label="설치 타워 정보"');
    expect(hud).toContain('data-tower-inspection-close');
    expect(css).toMatch(/\.tower-inspection\[hidden\]\s*\{[^}]*display: none;/s);
    expect(css).toMatch(
      /\.tower-inspection__close\s*\{[^}]*min-width: 44px;[^}]*min-height: 44px;/s,
    );
    expect(app).toContain('towerAtCell(');
    expect(app).toContain('towerById(');
    expect(app).toContain('renderTowerInspection(');
    expect(app).toContain('runtime.inspectTower(');
  });

  it('provides an accessible in-game exit confirmation control', () => {
    const hud = readFileSync('src/app/hud.ts', 'utf8');
    const css = readFileSync('src/styles.css', 'utf8');

    expect(hud).toContain('data-control="exit"');
    expect(hud).toContain(
      'aria-label="현재 게임을 그만두고 스테이지 선택으로 이동"',
    );
    expect(hud).toContain('data-state-secondary-action');
    expect(css).toMatch(
      /\.stage-select-screen\[data-overlay-mode="confirm"\]\s*\{[^}]*background: rgba\(/s,
    );
    expect(css).toMatch(
      /\.stage-select-screen__secondary-action\s*\{[^}]*min-height: 44px;/s,
    );
  });

  it('resets monster onboarding against the selected stage', () => {
    const app = readFileSync('src/app/GameApp.ts', 'utf8');

    expect(app.match(/createTraitNoticeState\(selectedStageKey\)/g)).toHaveLength(2);
  });

  it('syncs mode, boss, pause, and portrait state into procedural music', () => {
    const app = readFileSync('src/app/GameApp.ts', 'utf8');

    expect(app).toContain('sound.syncMusic({');
    expect(app).toContain("snapshot.phase === 'playing' || snapshot.phase === 'paused'");
    expect(app).toContain('snapshot.game.bossSpawnedAtSeconds !== null');
    expect(app).toContain("snapshot.phase === 'paused' || snapshot.portraitBlocked");
  });
});
