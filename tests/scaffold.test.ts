import { readFileSync } from 'node:fs';
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
      'test:e2e': 'playwright test --pass-with-no-tests tests/e2e',
      check: 'npm run test && npm run build',
    });
    expect(html).toContain('id="app"');
  });
});
