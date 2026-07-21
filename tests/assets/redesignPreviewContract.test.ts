import { readFileSync } from 'node:fs';
import { access, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { PREVIEW_ASSETS } from '../../tools/assets/redesignPreviewContract.mjs';
import { validatePreview } from '../../tools/assets/validateRedesignPreview.mjs';

const builderPath = path.resolve('tools/assets/buildRedesignPreviewSheet.mjs');
const loadBuilder = () => import(/* @vite-ignore */ pathToFileURL(builderPath).href);

const sharedProceduralFilter = 'procedural current-only; Blender image.scale master-to-mobile';
const expectedProvenanceByRelativePath = Object.freeze({
  'map/grass.png': { sourceReference: 'tools/blender/redesign_preview.py', generator: 'tile_base', filter: sharedProceduralFilter },
  'map/road-straight-horizontal.png': { sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_road horizontal', filter: sharedProceduralFilter },
  'map/road-straight-vertical.png': { sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_road vertical', filter: sharedProceduralFilter },
  'map/road-corner-north-east.png': { sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_road north-east', filter: sharedProceduralFilter },
  'map/road-corner-east-south.png': { sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_road east-south', filter: sharedProceduralFilter },
  'map/road-corner-south-west.png': { sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_road south-west', filter: sharedProceduralFilter },
  'map/road-corner-west-north.png': { sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_road west-north', filter: sharedProceduralFilter },
  'map/entry.png': { sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_road entry posts', filter: sharedProceduralFilter },
  'map/snack-chest.png': { sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_snack_chest', filter: sharedProceduralFilter },
  'towers/slow-se.png': { sourceReference: 'assets/blender/slow-tower-v1.blend', generator: '_append_tower_asset fit_objects_to_tile emit_single', filter: 'slow_predicate exact allow-list; current-only; Blender image.scale master-to-mobile' },
  'towers/arrow-se.png': { sourceReference: 'assets/blender/arrow-tower-v1.blend', generator: '_append_tower_asset turret yaw fit emit_single', filter: 'arrow_predicate exact allow-list; current-only; Blender image.scale master-to-mobile' },
  'towers/deokbae-se.png': { sourceReference: 'assets/blender/character-assets-v2.blend', generator: '_append_tower_asset _refit_character_ratio emit_single', filter: 'Deokbae hierarchy excluding DOG_VFX_WORDS; current-only; Blender image.scale master-to-mobile' },
  'towers/huchu-se.png': { sourceReference: 'assets/blender/character-assets-v2.blend', generator: '_append_tower_asset _refit_character_ratio emit_single', filter: 'Huchu hierarchy excluding DOG_VFX_WORDS; current-only; Blender image.scale master-to-mobile' },
  'motion/orc-walk-se.png': { sourceReference: 'assets/blender/enemies-voxel-v1.blend', generator: '_render_orc_motion_asset _orc_pose_components', filter: 'Orc hierarchy and required-object gate; current-only; Blender image.scale master-to-mobile' },
  'motion/fairy-fly-se.png': { sourceReference: 'assets/blender/enemies-voxel-v1.blend', generator: '_render_fairy_motion_asset _fairy_pose_components', filter: 'Fairy hierarchy and required-object gate; current-only; Blender image.scale master-to-mobile' },
  'vfx/arrow-8dir.png': { sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_arrow inverse-projected yaw', filter: sharedProceduralFilter },
  'vfx/fireball-flight.png': { sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_fireball loop progress', filter: sharedProceduralFilter },
  'vfx/waterball-flight.png': { sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_waterball loop progress', filter: sharedProceduralFilter },
  'vfx/arrow-impact.png': { sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_impact arrow', filter: 'impact final-empty; current-only; Blender image.scale master-to-mobile' },
  'vfx/fire-burst.png': { sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_impact fire', filter: 'impact final-empty; current-only; Blender image.scale master-to-mobile' },
  'vfx/aqua-burst.png': { sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_impact aqua', filter: 'impact final-empty; current-only; Blender image.scale master-to-mobile' },
});

const expectedInventory = (assets = PREVIEW_ASSETS) => {
  const animated = assets.filter((asset) => asset.frames > 1);
  const staticAssets = assets.filter((asset) => asset.frames === 1);
  const logicalFrameCount = assets.reduce((total, asset) => total + asset.frames, 0);
  const animatedLogicalFrameCount = animated.reduce(
    (total, asset) => total + asset.frames,
    0,
  );

  return {
    assetCount: assets.length,
    pngCount: assets.length * 2,
    logicalFrameCount,
    variantThumbnailCount: logicalFrameCount * 2,
    animatedAssetCount: animated.length,
    animatedLogicalFrameCount,
    animatedThumbnailCount: animatedLogicalFrameCount * 2,
    staticAssetCount: staticAssets.length,
    staticThumbnailCount: staticAssets.length * 2,
  };
};

const successfulDomAudit = (assets = PREVIEW_ASSETS) => {
  const inventory = expectedInventory(assets);
  const animatedFrameLabels = Object.fromEntries(
    assets
      .filter((asset) => asset.frames > 1)
      .map((asset) => {
        const labels = Array.from(
          { length: asset.frames },
          (_, index) => `F${String(index + 1).padStart(2, '0')}`,
        );
        return [asset.id, { master: labels, mobile: labels }];
      }),
  );
  return {
    cards: inventory.assetCount,
    cardIds: assets.map((asset) => asset.id),
    panes: inventory.pngCount,
    paneKeys: assets.flatMap((asset) => [
      `${asset.id}:master`,
      `${asset.id}:mobile`,
    ]),
    thumbnails: inventory.variantThumbnailCount,
    thumbnailKeys: assets.flatMap((asset) => ['master', 'mobile'].flatMap(
      (variant) => Array.from(
        { length: asset.frames },
        (_, index) => `${asset.id}:${variant}:${index}`,
      ),
    )),
    frameLabels: inventory.animatedThumbnailCount,
    animatedFrameLabels,
    images: inventory.variantThumbnailCount,
    decodedImages: inventory.variantThumbnailCount,
    mobileMinAxis: 128,
    provenance: assets.map((asset) => ({
      assetId: asset.id,
      ...expectedProvenanceByRelativePath[asset.relativePath],
    })),
  };
};

const successfulBuilderHarness = (assets = PREVIEW_ASSETS) => {
  const page = {
    close: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(successfulDomAudit(assets)),
    screenshot: vi.fn().mockResolvedValue(undefined),
    setContent: vi.fn().mockResolvedValue(undefined),
  };
  const browser = {
    close: vi.fn().mockResolvedValue(undefined),
    newPage: vi.fn().mockResolvedValue(page),
  };
  const dependencies = {
    chromiumApi: { launch: vi.fn().mockResolvedValue(browser) },
    mkdirApi: vi.fn().mockResolvedValue(undefined),
    readFileApi: vi.fn().mockResolvedValue(Buffer.from('preview-png')),
    validatePreviewApi: vi.fn().mockResolvedValue(assets.length * 2),
  };

  return { browser, dependencies, page };
};

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

const expectedIdFramePairs = [
  ['grass', 1],
  ['road-straight-horizontal', 1],
  ['road-straight-vertical', 1],
  ['road-corner-north-east', 1],
  ['road-corner-east-south', 1],
  ['road-corner-south-west', 1],
  ['road-corner-west-north', 1],
  ['entry', 1],
  ['snack-chest', 1],
  ['tower-slow-se', 1],
  ['tower-arrow-se', 1],
  ['tower-deokbae-se', 1],
  ['tower-huchu-se', 1],
  ['orc-walk-se', 6],
  ['fairy-fly-se', 8],
  ['arrow-8dir', 8],
  ['fireball-flight', 4],
  ['waterball-flight', 4],
  ['arrow-impact', 4],
  ['fire-burst', 8],
  ['aqua-burst', 8],
];

describe('3D redesign preview contract', () => {
  it('builds the snack chest without a tile base and faces it toward the camera', () => {
    const source = readFileSync('tools/blender/redesign_preview.py', 'utf8');
    const match = source.match(
      /def build_snack_chest\(\) -> None:\n([\s\S]*?)\n\nMAP_BUILDERS =/,
    );

    expect(match).not.toBeNull();
    const body = match?.[1] ?? '';
    expect(body).not.toContain('tile_base()');
    expect(body).toContain(
      '_transform_active_asset(CHEST_FRONT_YAW, CHEST_GROUND_OFFSET)',
    );
    expect(source).toContain('CHEST_FRONT_YAW = math.atan2(');
    expect(source).toContain('CHEST_GROUND_OFFSET = -0.26');
    expect(source).toContain(
      'is_chest = relative_path.endswith("snack-chest.png")',
    );
    expect(source).toContain('if not is_chest:');
  });

  it('defines the exact approval-set assets once', () => {
    expect(PREVIEW_ASSETS.map((asset) => asset.id)).toEqual(expectedIds);
    expect(PREVIEW_ASSETS.map((asset) => [asset.id, asset.frames]))
      .toEqual(expectedIdFramePairs);
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

  it('exposes the validated Task 6 contact-sheet command and builder API', async () => {
    const packageJson = await import('../../package.json', { with: { type: 'json' } });

    expect(packageJson.default.scripts['assets:preview:validate'])
      .toBe('node tools/assets/validateRedesignPreview.mjs');
    expect(packageJson.default.scripts['assets:preview:sheet'])
      .toBe('node tools/assets/buildRedesignPreviewSheet.mjs');
    await expect(access(builderPath)).resolves.toBeUndefined();

    const builder = await loadBuilder();
    expect(builder.buildRedesignPreviewSheet).toEqual(expect.any(Function));
    expect(builder.auditPreviewSheetDom).toEqual(expect.any(Function));
    expect(builder.derivePreviewInventory).toEqual(expect.any(Function));
    expect(builder.getPreviewProvenance).toEqual(expect.any(Function));
    expect(builder.renderPreviewSheetHtml).toEqual(expect.any(Function));
  });

  it('derives corrected static and animated inventory from the manifest', async () => {
    const { derivePreviewInventory } = await loadBuilder();

    expect(derivePreviewInventory(PREVIEW_ASSETS)).toEqual({
      assetCount: 21,
      pngCount: 42,
      logicalFrameCount: 63,
      variantThumbnailCount: 126,
      animatedAssetCount: 8,
      animatedLogicalFrameCount: 50,
      animatedThumbnailCount: 100,
      staticAssetCount: 13,
      staticThumbnailCount: 26,
    });
    expect(derivePreviewInventory([
      { frames: 1 },
      { frames: 3 },
    ])).toEqual({
      assetCount: 2,
      pngCount: 4,
      logicalFrameCount: 4,
      variantThumbnailCount: 8,
      animatedAssetCount: 1,
      animatedLogicalFrameCount: 3,
      animatedThumbnailCount: 6,
      staticAssetCount: 1,
      staticThumbnailCount: 2,
    });
  });

  it('stops before PNG reads, HTML, and Chromium when full validation fails', async () => {
    const { buildRedesignPreviewSheet } = await loadBuilder();
    const { dependencies, page } = successfulBuilderHarness();
    const gateError = new Error('full preview validation failed');
    dependencies.validatePreviewApi.mockRejectedValue(gateError);

    await expect(buildRedesignPreviewSheet({
      dependencies,
      outputPath: path.join(tmpdir(), 'should-not-exist.png'),
      previewRoot: path.join(tmpdir(), 'preview-gate'),
    })).rejects.toBe(gateError);

    expect(dependencies.validatePreviewApi).toHaveBeenCalledOnce();
    expect(dependencies.validatePreviewApi).toHaveBeenCalledWith(expect.objectContaining({
      assets: PREVIEW_ASSETS,
    }));
    expect(dependencies.readFileApi).not.toHaveBeenCalled();
    expect(dependencies.mkdirApi).not.toHaveBeenCalled();
    expect(dependencies.chromiumApi.launch).not.toHaveBeenCalled();
    expect(page.setContent).not.toHaveBeenCalled();
  });

  it('rejects an incomplete full-validation count before reading any PNG', async () => {
    const { buildRedesignPreviewSheet } = await loadBuilder();
    const { dependencies, page } = successfulBuilderHarness();
    dependencies.validatePreviewApi.mockResolvedValue(41);

    await expect(buildRedesignPreviewSheet({
      dependencies,
      outputPath: path.join(tmpdir(), 'incomplete-validation.png'),
      previewRoot: path.join(tmpdir(), 'preview-incomplete-validation'),
    })).rejects.toThrow('Full preview validation incomplete: expected 42 PNG files, received 41');

    expect(dependencies.readFileApi).not.toHaveBeenCalled();
    expect(dependencies.mkdirApi).not.toHaveBeenCalled();
    expect(dependencies.chromiumApi.launch).not.toHaveBeenCalled();
    expect(page.setContent).not.toHaveBeenCalled();
  });

  it('rejects a non-canonical asset subset before validation or browser work', async () => {
    const { buildRedesignPreviewSheet } = await loadBuilder();
    const subset = [PREVIEW_ASSETS[0]];
    const { dependencies, page } = successfulBuilderHarness(subset);

    await expect(buildRedesignPreviewSheet({
      assets: subset,
      dependencies,
      outputPath: path.join(tmpdir(), 'subset-sheet.png'),
      previewRoot: path.join(tmpdir(), 'preview-subset'),
    })).rejects.toThrow('Contact sheet requires the canonical 21-asset PREVIEW_ASSETS manifest');

    expect(dependencies.validatePreviewApi).not.toHaveBeenCalled();
    expect(dependencies.readFileApi).not.toHaveBeenCalled();
    expect(dependencies.mkdirApi).not.toHaveBeenCalled();
    expect(dependencies.chromiumApi.launch).not.toHaveBeenCalled();
    expect(page.setContent).not.toHaveBeenCalled();
  });

  it('renders manifest-derived provenance and exact approval DOM inventory', async () => {
    const { buildRedesignPreviewSheet, getPreviewProvenance } = await loadBuilder();
    const { dependencies, page } = successfulBuilderHarness();

    const result = await buildRedesignPreviewSheet({
      dependencies,
      outputPath: path.join(tmpdir(), 'approval-sheet.png'),
      previewRoot: path.join(tmpdir(), 'preview-dom'),
    });

    const html = page.setContent.mock.calls[0][0];
    const occurrences = (value: string) => html.split(value).length - 1;
    expect(occurrences('data-preview-card=')).toBe(21);
    expect(occurrences('data-preview-pane=')).toBe(42);
    expect(occurrences('data-preview-thumbnail=')).toBe(126);
    expect(occurrences('data-frame-label=')).toBe(100);
    expect(occurrences('data-source-reference=')).toBe(21);
    expect(occurrences('data-generator=')).toBe(21);
    expect(occurrences('data-filter=')).toBe(21);
    expect(occurrences('data-variant="mobile"')).toBe(63);
    expect(html).toContain('data-sheet-width="844"');
    expect(html).toContain('grid-template-columns: 176px 270px 270px');
    expect(html).toContain('grid-template-columns: repeat(2, 128px)');
    expect(html).toContain('F01');
    expect(html).toContain('F08');
    for (const asset of PREVIEW_ASSETS) {
      const provenance = getPreviewProvenance(asset);
      expect(provenance).toEqual(expectedProvenanceByRelativePath[asset.relativePath]);
      expect(Object.values(provenance).every((value) => value.length > 0)).toBe(true);
      expect(html).toContain(`data-asset-id="${asset.id}"`);
      expect(html).toContain(`data-frame-count="${asset.frames}"`);
      expect(html).toContain(`data-source-reference="${provenance.sourceReference}"`);
      expect(html).toContain(`data-generator="${provenance.generator}"`);
      expect(html).toContain(`data-filter="${provenance.filter}"`);
    }
    expect(result.inventory).toEqual(expectedInventory());
    expect(dependencies.readFileApi).toHaveBeenCalledTimes(42);
    expect(page.screenshot).toHaveBeenCalledWith(expect.objectContaining({
      fullPage: true,
    }));
  });

  it('waits for every image decode and checks DOM before screenshotting', async () => {
    const { buildRedesignPreviewSheet } = await loadBuilder();
    const { dependencies, page } = successfulBuilderHarness();

    await buildRedesignPreviewSheet({
      dependencies,
      outputPath: path.join(tmpdir(), 'decode-sheet.png'),
      previewRoot: path.join(tmpdir(), 'preview-decode'),
    });

    expect(page.evaluate).toHaveBeenCalledOnce();
    expect(page.evaluate.mock.invocationCallOrder[0])
      .toBeLessThan(page.screenshot.mock.invocationCallOrder[0]);
    expect(page.setContent.mock.invocationCallOrder[0])
      .toBeLessThan(page.evaluate.mock.invocationCallOrder[0]);
    expect(page.close).toHaveBeenCalledOnce();
    expect(dependencies.chromiumApi.launch).toHaveBeenCalledOnce();
  });

  it('audits the real DOM contract only after pending image decodes resolve', async () => {
    const { auditPreviewSheetDom } = await loadBuilder();
    const events: string[] = [];
    const images = Array.from({ length: 126 }, (_, index) => ({
      complete: index === 0,
      decode: vi.fn().mockImplementation(async () => {
        events.push(`decode-${index}`);
      }),
      naturalWidth: index === 0 ? 128 : 0,
    }));
    const nodes = (count: number, size = 128) => Array.from({ length: count }, () => ({
      getBoundingClientRect: () => ({ height: size, width: size }),
    }));
    const cardNodes = PREVIEW_ASSETS.map((asset) => ({ dataset: { assetId: asset.id } }));
    const paneNodes = PREVIEW_ASSETS.flatMap((asset) => ['master', 'mobile'].map((variant) => ({
      dataset: { assetId: asset.id, paneVariant: variant },
    })));
    const frameLabelNodes = PREVIEW_ASSETS
      .filter((asset) => asset.frames > 1)
      .flatMap((asset) => ['master', 'mobile'].flatMap((variant) => Array.from(
        { length: asset.frames },
        (_, index) => ({
          dataset: {
            assetId: asset.id,
            frameLabel: `F${String(index + 1).padStart(2, '0')}`,
            variant,
          },
        }),
      )));
    const provenanceNodes = PREVIEW_ASSETS.map((asset) => ({
      dataset: {
        assetId: asset.id,
        ...expectedProvenanceByRelativePath[asset.relativePath],
      },
    }));
    const thumbnailNodes = PREVIEW_ASSETS.flatMap((asset) => ['master', 'mobile'].flatMap(
      (variant) => Array.from({ length: asset.frames }, (_, index) => ({
        dataset: { thumbnailKey: `${asset.id}:${variant}:${index}` },
        getBoundingClientRect: () => ({ height: 128, width: 128 }),
      })),
    ));
    const selectors = new Map([
      ['[data-preview-card]', cardNodes],
      ['[data-preview-pane]', paneNodes],
      ['[data-preview-thumbnail]', thumbnailNodes],
      ['[data-frame-label]', frameLabelNodes],
      ['[data-provenance]', provenanceNodes],
      ['[data-pane-variant="mobile"] [data-preview-thumbnail]', nodes(63)],
    ]);
    const documentApi = {
      images,
      querySelectorAll: vi.fn((selector: string) => selectors.get(selector) ?? []),
    };

    const audit = await auditPreviewSheetDom(documentApi);

    expect(images[0].decode).not.toHaveBeenCalled();
    expect(images[1].decode).toHaveBeenCalledOnce();
    expect(images[125].decode).toHaveBeenCalledOnce();
    expect(events).toEqual(Array.from({ length: 125 }, (_, index) => `decode-${index + 1}`));
    expect(audit).toEqual(successfulDomAudit());
    expect(new Set(audit.cardIds).size).toBe(21);
    expect(audit.thumbnailKeys).toEqual(successfulDomAudit().thumbnailKeys);
    expect(new Set(audit.thumbnailKeys).size).toBe(126);
    for (const asset of PREVIEW_ASSETS.filter((item) => item.frames > 1)) {
      const expectedLabels = Array.from(
        { length: asset.frames },
        (_, index) => `F${String(index + 1).padStart(2, '0')}`,
      );
      expect(audit.animatedFrameLabels[asset.id].master).toEqual(expectedLabels);
      expect(audit.animatedFrameLabels[asset.id].mobile).toEqual(expectedLabels);
    }
  });

  it('rejects a DOM inventory mismatch before screenshotting and still cleans up', async () => {
    const { buildRedesignPreviewSheet } = await loadBuilder();
    const { browser, dependencies, page } = successfulBuilderHarness();
    page.evaluate.mockResolvedValue({
      ...successfulDomAudit(),
      cardIds: [...successfulDomAudit().cardIds].reverse(),
      thumbnails: 125,
    });

    await expect(buildRedesignPreviewSheet({
      dependencies,
      outputPath: path.join(tmpdir(), 'invalid-dom-sheet.png'),
      previewRoot: path.join(tmpdir(), 'preview-invalid-dom'),
    })).rejects.toThrow('Contact sheet DOM inventory mismatch');

    expect(page.screenshot).not.toHaveBeenCalled();
    expect(page.close).toHaveBeenCalledOnce();
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it('closes the browser after newPage failure without masking the primary error', async () => {
    const { buildRedesignPreviewSheet } = await loadBuilder();
    const primaryError = new Error('newPage failed');
    const browser = {
      close: vi.fn().mockRejectedValue(new Error('browser cleanup failed')),
      newPage: vi.fn().mockRejectedValue(primaryError),
    };
    const dependencies = {
      chromiumApi: { launch: vi.fn().mockResolvedValue(browser) },
      mkdirApi: vi.fn().mockResolvedValue(undefined),
      readFileApi: vi.fn().mockResolvedValue(Buffer.from('preview-png')),
      validatePreviewApi: vi.fn().mockResolvedValue(42),
    };

    await expect(buildRedesignPreviewSheet({
      dependencies,
      outputPath: path.join(tmpdir(), 'new-page-failure.png'),
      previewRoot: path.join(tmpdir(), 'preview-new-page-failure'),
    })).rejects.toBe(primaryError);

    expect(browser.close).toHaveBeenCalledOnce();
  });

  it('closes page and browser without masking a screenshot failure', async () => {
    const { buildRedesignPreviewSheet } = await loadBuilder();
    const { browser, dependencies, page } = successfulBuilderHarness();
    const primaryError = new Error('screenshot failed');
    page.screenshot.mockRejectedValue(primaryError);
    page.close.mockRejectedValue(new Error('page cleanup failed'));
    browser.close.mockRejectedValue(new Error('browser cleanup failed'));

    await expect(buildRedesignPreviewSheet({
      dependencies,
      outputPath: path.join(tmpdir(), 'screenshot-failure.png'),
      previewRoot: path.join(tmpdir(), 'preview-screenshot-failure'),
    })).rejects.toBe(primaryError);

    expect(page.close).toHaveBeenCalledOnce();
    expect(browser.close).toHaveBeenCalledOnce();
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
