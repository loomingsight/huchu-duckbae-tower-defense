import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { PREVIEW_ASSETS } from '../../tools/assets/redesignPreviewContract.mjs';
import { validatePreview } from '../../tools/assets/validateRedesignPreview.mjs';

const expectedIds = [
  'grass',
  'road-straight-horizontal',
  'road-straight-vertical',
  'road-corner-north-east',
  'road-corner-east-south',
  'road-corner-south-west',
  'road-corner-west-north',
  'entry',
  'snack-chest',
  'tower-slow-se',
  'tower-arrow-se',
  'tower-deokbae-se',
  'tower-huchu-se',
  'orc-walk-se',
  'fairy-fly-se',
  'arrow-8dir',
  'fireball-flight',
  'waterball-flight',
  'arrow-impact',
  'fire-burst',
  'aqua-burst',
];

describe('3D redesign preview contract', () => {
  it('defines the exact approval-set assets once', () => {
    expect(PREVIEW_ASSETS.map((asset) => asset.id)).toEqual(expectedIds);
    expect(new Set(PREVIEW_ASSETS.map((asset) => asset.relativePath)).size).toBe(21);
  });

  it('uses fixed master/mobile frame sizes and approved frame counts', () => {
    for (const asset of PREVIEW_ASSETS) {
      expect(asset.masterFrameSize).toBe(256);
      expect(asset.mobileFrameSize).toBe(128);
      expect(asset.relativePath.endsWith('.png')).toBe(true);
    }
    expect(PREVIEW_ASSETS.find((asset) => asset.id === 'orc-walk-se')?.frames).toBe(6);
    expect(PREVIEW_ASSETS.find((asset) => asset.id === 'fairy-fly-se')?.frames).toBe(8);
    expect(PREVIEW_ASSETS.find((asset) => asset.id === 'arrow-8dir')?.frames).toBe(8);
    expect(PREVIEW_ASSETS.find((asset) => asset.id === 'fire-burst')?.frames).toBe(8);
    expect(PREVIEW_ASSETS.find((asset) => asset.id === 'aqua-burst')?.frames).toBe(8);
  });

  it('does not expose the Task 6 contact-sheet command before its implementation exists', async () => {
    const packageJson = await import('../../package.json', { with: { type: 'json' } });

    expect(packageJson.default.scripts['assets:preview:validate'])
      .toBe('node tools/assets/validateRedesignPreview.mjs');
    expect(packageJson.default.scripts['assets:preview:sheet']).toBeUndefined();
  });

  it('preflights missing PNGs before Chromium is started', async () => {
    const launch = vi.fn();
    const missingRoot = path.join(tmpdir(), 'huchu-redesign-preview-missing');

    await expect(validatePreview({
      assets: [PREVIEW_ASSETS[0]],
      previewRoot: missingRoot,
      chromiumApi: { launch },
    })).rejects.toMatchObject({ code: 'ENOENT' });

    expect(launch).not.toHaveBeenCalled();
  });

  it('closes page and browser when PNG inspection fails', async () => {
    const previewRoot = path.join(tmpdir(), `huchu-redesign-preview-${Date.now()}`);
    const asset = PREVIEW_ASSETS[0];
    const page = {
      close: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockRejectedValue(new Error('inspection failed')),
    };
    const browser = {
      close: vi.fn().mockResolvedValue(undefined),
      newPage: vi.fn().mockResolvedValue(page),
    };

    await mkdir(path.join(previewRoot, 'master', 'map'), { recursive: true });
    await mkdir(path.join(previewRoot, 'mobile', 'map'), { recursive: true });
    await writeFile(path.join(previewRoot, 'master', asset.relativePath), 'placeholder');
    await writeFile(path.join(previewRoot, 'mobile', asset.relativePath), 'placeholder');

    try {
      await expect(validatePreview({
        assets: [asset],
        previewRoot,
        chromiumApi: { launch: vi.fn().mockResolvedValue(browser) },
      })).rejects.toThrow('inspection failed');

      expect(page.close).toHaveBeenCalledOnce();
      expect(browser.close).toHaveBeenCalledOnce();
    } finally {
      await rm(previewRoot, { recursive: true, force: true });
    }
  });

  it('closes the browser even when page cleanup fails', async () => {
    const previewRoot = path.join(tmpdir(), `huchu-redesign-preview-cleanup-${Date.now()}`);
    const asset = PREVIEW_ASSETS[0];
    const page = {
      close: vi.fn().mockRejectedValue(new Error('page cleanup failed')),
      evaluate: vi.fn().mockRejectedValue(new Error('inspection failed')),
    };
    const browser = {
      close: vi.fn().mockResolvedValue(undefined),
      newPage: vi.fn().mockResolvedValue(page),
    };

    await mkdir(path.join(previewRoot, 'master', 'map'), { recursive: true });
    await mkdir(path.join(previewRoot, 'mobile', 'map'), { recursive: true });
    await writeFile(path.join(previewRoot, 'master', asset.relativePath), 'placeholder');
    await writeFile(path.join(previewRoot, 'mobile', asset.relativePath), 'placeholder');

    try {
      await expect(validatePreview({
        assets: [asset],
        previewRoot,
        chromiumApi: { launch: vi.fn().mockResolvedValue(browser) },
      })).rejects.toThrow('page cleanup failed');

      expect(browser.close).toHaveBeenCalledOnce();
    } finally {
      await rm(previewRoot, { recursive: true, force: true });
    }
  });
});
