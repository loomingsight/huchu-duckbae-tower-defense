import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { PREVIEW_ASSETS, PREVIEW_ROOT } from './redesignPreviewContract.mjs';
import { validatePreview } from './validateRedesignPreview.mjs';

const VARIANTS = Object.freeze(['master', 'mobile']);
const OUTPUT_FILE_NAME = 'redesign-preview-contact-sheet.png';
const SHEET_WIDTH = 844;
const sharedProceduralFilter = 'procedural current-only; Blender image.scale master-to-mobile';

const freezeProvenance = (provenance) => Object.freeze(provenance);
const PROVENANCE_BY_RELATIVE_PATH = Object.freeze({
  'map/grass.png': freezeProvenance({ sourceReference: 'tools/blender/redesign_preview.py', generator: 'tile_base', filter: sharedProceduralFilter }),
  'map/road-straight-horizontal.png': freezeProvenance({ sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_road horizontal', filter: sharedProceduralFilter }),
  'map/road-straight-vertical.png': freezeProvenance({ sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_road vertical', filter: sharedProceduralFilter }),
  'map/road-corner-north-east.png': freezeProvenance({ sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_road north-east', filter: sharedProceduralFilter }),
  'map/road-corner-east-south.png': freezeProvenance({ sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_road east-south', filter: sharedProceduralFilter }),
  'map/road-corner-south-west.png': freezeProvenance({ sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_road south-west', filter: sharedProceduralFilter }),
  'map/road-corner-west-north.png': freezeProvenance({ sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_road west-north', filter: sharedProceduralFilter }),
  'map/entry.png': freezeProvenance({ sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_road entry posts', filter: sharedProceduralFilter }),
  'map/snack-chest.png': freezeProvenance({ sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_snack_chest', filter: sharedProceduralFilter }),
  'towers/slow-se.png': freezeProvenance({ sourceReference: 'assets/blender/slow-tower-v1.blend', generator: '_append_tower_asset fit_objects_to_tile emit_single', filter: 'slow_predicate exact allow-list; current-only; Blender image.scale master-to-mobile' }),
  'towers/arrow-se.png': freezeProvenance({ sourceReference: 'assets/blender/arrow-tower-v1.blend', generator: '_append_tower_asset turret yaw fit emit_single', filter: 'arrow_predicate exact allow-list; current-only; Blender image.scale master-to-mobile' }),
  'towers/deokbae-se.png': freezeProvenance({ sourceReference: 'assets/blender/character-assets-v2.blend', generator: '_append_tower_asset _refit_character_ratio emit_single', filter: 'Deokbae hierarchy excluding DOG_VFX_WORDS; current-only; Blender image.scale master-to-mobile' }),
  'towers/huchu-se.png': freezeProvenance({ sourceReference: 'assets/blender/character-assets-v2.blend', generator: '_append_tower_asset _refit_character_ratio emit_single', filter: 'Huchu hierarchy excluding DOG_VFX_WORDS; current-only; Blender image.scale master-to-mobile' }),
  'motion/orc-walk-se.png': freezeProvenance({ sourceReference: 'assets/blender/enemies-voxel-v1.blend', generator: '_render_orc_motion_asset _orc_pose_components', filter: 'Orc hierarchy and required-object gate; current-only; Blender image.scale master-to-mobile' }),
  'motion/fairy-fly-se.png': freezeProvenance({ sourceReference: 'assets/blender/enemies-voxel-v1.blend', generator: '_render_fairy_motion_asset _fairy_pose_components', filter: 'Fairy hierarchy and required-object gate; current-only; Blender image.scale master-to-mobile' }),
  'vfx/arrow-8dir.png': freezeProvenance({ sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_arrow inverse-projected yaw', filter: sharedProceduralFilter }),
  'vfx/fireball-flight.png': freezeProvenance({ sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_fireball loop progress', filter: sharedProceduralFilter }),
  'vfx/waterball-flight.png': freezeProvenance({ sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_waterball loop progress', filter: sharedProceduralFilter }),
  'vfx/arrow-impact.png': freezeProvenance({ sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_impact arrow', filter: 'impact final-empty; current-only; Blender image.scale master-to-mobile' }),
  'vfx/fire-burst.png': freezeProvenance({ sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_impact fire', filter: 'impact final-empty; current-only; Blender image.scale master-to-mobile' }),
  'vfx/aqua-burst.png': freezeProvenance({ sourceReference: 'tools/blender/redesign_preview.py', generator: 'build_impact aqua', filter: 'impact final-empty; current-only; Blender image.scale master-to-mobile' }),
});

const defaultDependencies = Object.freeze({
  chromiumApi: chromium,
  mkdirApi: mkdir,
  readFileApi: readFile,
  validatePreviewApi: validatePreview,
});

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character]);

const frameLabel = (index) => `F${String(index + 1).padStart(2, '0')}`;

const assertProvenanceManifest = (assets) => {
  const assetPaths = assets.map((asset) => asset.relativePath);
  const provenancePaths = Object.keys(PROVENANCE_BY_RELATIVE_PATH);
  if (
    new Set(assetPaths).size !== assetPaths.length
    || assetPaths.length !== provenancePaths.length
    || assetPaths.some((relativePath) => !PROVENANCE_BY_RELATIVE_PATH[relativePath])
    || provenancePaths.some((relativePath) => !assetPaths.includes(relativePath))
  ) {
    throw new Error('Preview provenance manifest does not exactly match PREVIEW_ASSETS');
  }
};

assertProvenanceManifest(PREVIEW_ASSETS);

export function getPreviewProvenance(asset) {
  const provenance = PROVENANCE_BY_RELATIVE_PATH[asset.relativePath];
  if (!provenance) {
    throw new Error(`Missing preview provenance: ${asset.relativePath}`);
  }
  return provenance;
}

export function derivePreviewInventory(assets) {
  const animated = assets.filter((asset) => asset.frames > 1);
  const staticAssets = assets.filter((asset) => asset.frames === 1);
  const logicalFrameCount = assets.reduce((total, asset) => total + asset.frames, 0);
  const animatedLogicalFrameCount = animated.reduce(
    (total, asset) => total + asset.frames,
    0,
  );
  return {
    assetCount: assets.length,
    pngCount: assets.length * VARIANTS.length,
    logicalFrameCount,
    variantThumbnailCount: logicalFrameCount * VARIANTS.length,
    animatedAssetCount: animated.length,
    animatedLogicalFrameCount,
    animatedThumbnailCount: animatedLogicalFrameCount * VARIANTS.length,
    staticAssetCount: staticAssets.length,
    staticThumbnailCount: staticAssets.length * VARIANTS.length,
  };
}

const assertCanonicalAssets = (assets) => {
  const fields = [
    'id',
    'group',
    'relativePath',
    'frames',
    'masterFrameSize',
    'mobileFrameSize',
  ];
  if (
    assets.length !== PREVIEW_ASSETS.length
    || assets.some((asset, index) => fields.some(
      (field) => asset[field] !== PREVIEW_ASSETS[index][field],
    ))
  ) {
    throw new Error('Contact sheet requires the canonical 21-asset PREVIEW_ASSETS manifest');
  }
};

const buildVariantPane = (card, variant) => {
  const asset = card.asset;
  const animated = asset.frames > 1;
  const thumbnails = Array.from({ length: asset.frames }, (_, index) => {
    const label = frameLabel(index);
    const thumbnailKey = `${asset.id}:${variant}:${index}`;
    return `
      <figure class="thumbnail ${animated ? 'thumbnail--animated' : 'thumbnail--static'}"
        data-preview-thumbnail="" data-asset-id="${escapeHtml(asset.id)}"
        data-variant="${variant}" data-frame-index="${index}"
        data-thumbnail-key="${escapeHtml(thumbnailKey)}">
        <div class="checker frame-crop" style="--frame-count:${asset.frames};--frame-index:${index}">
          <img src="${card.variants[variant].dataUrl}"
            alt="${escapeHtml(`${asset.id} ${variant} ${label}`)}">
        </div>
        ${animated ? `<figcaption data-frame-label="${label}" data-asset-id="${escapeHtml(asset.id)}" data-frame-variant="${variant}">${label}</figcaption>` : ''}
      </figure>`;
  }).join('');
  return `
    <section class="variant-pane variant-pane--${variant} ${animated ? 'variant-pane--animated' : 'variant-pane--static'}"
      data-preview-pane="" data-asset-id="${escapeHtml(asset.id)}" data-pane-variant="${variant}">
      <h3>${variant.toUpperCase()} <span>${variant === 'master' ? '256px source cell' : '128px review cell'}</span></h3>
      <div class="${animated ? 'frame-grid' : 'static-frame'}">${thumbnails}</div>
    </section>`;
};

const buildCard = (card) => {
  const { asset, provenance } = card;
  return `
    <article class="card" data-preview-card="" data-asset-id="${escapeHtml(asset.id)}"
      data-group="${escapeHtml(asset.group)}" data-frame-count="${asset.frames}">
      <header class="card-header">
        <div><strong>${escapeHtml(asset.id)}</strong><small>${escapeHtml(asset.group)} · ${asset.frames} logical frame${asset.frames === 1 ? '' : 's'}</small></div>
        <code>${escapeHtml(asset.relativePath)}</code>
      </header>
      <div class="evidence-grid">
        <aside class="provenance" data-provenance="" data-asset-id="${escapeHtml(asset.id)}"
          data-source-reference="${escapeHtml(provenance.sourceReference)}"
          data-generator="${escapeHtml(provenance.generator)}"
          data-filter="${escapeHtml(provenance.filter)}">
          <h3>SOURCE</h3>
          <dl>
            <dt>sourceReference</dt><dd><code>${escapeHtml(provenance.sourceReference)}</code></dd>
            <dt>generator</dt><dd>${escapeHtml(provenance.generator)}</dd>
            <dt>filter</dt><dd>${escapeHtml(provenance.filter)}</dd>
            <dt>metadata</dt><dd>${escapeHtml(asset.id)} · ${escapeHtml(asset.group)} · ${asset.frames}f</dd>
          </dl>
        </aside>
        ${buildVariantPane(card, 'master')}
        ${buildVariantPane(card, 'mobile')}
      </div>
    </article>`;
};

export function renderPreviewSheetHtml(cards, inventory = derivePreviewInventory(cards.map(({ asset }) => asset))) {
  const groupedCards = new Map();
  for (const card of cards) {
    const group = groupedCards.get(card.asset.group) ?? [];
    group.push(card);
    groupedCards.set(card.asset.group, group);
  }
  const sections = [...groupedCards.entries()].map(([group, assets]) => `
    <section class="asset-group" data-group-section="${escapeHtml(group)}">
      <h2>${escapeHtml(group.toUpperCase())}</h2>
      <div class="card-list">${assets.map(buildCard).join('')}</div>
    </section>`).join('');

  return `<!doctype html>
<html lang="ko" data-sheet-width="${SHEET_WIDTH}">
<head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: ${SHEET_WIDTH}px; }
  body { padding: 16px; color: #24352d; background: #e8f0eb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .sheet-header { padding: 22px 24px; border-radius: 20px; color: #f7fff9; background: linear-gradient(135deg, #274b39, #52755f); }
  h1, h2, h3, p, dl, dd, figure { margin: 0; }
  h1 { font-size: 30px; letter-spacing: -.02em; }
  .sheet-header p { margin-top: 8px; font-size: 14px; line-height: 1.5; }
  .inventory { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
  .inventory span { padding: 5px 8px; border-radius: 999px; color: #294234; background: #e9f5ed; font-size: 12px; font-weight: 700; }
  .asset-group { margin-top: 22px; }
  .asset-group > h2 { margin: 0 0 8px 5px; color: #486656; font-size: 17px; letter-spacing: .16em; }
  .card-list { display: grid; grid-template-columns: 1fr; gap: 14px; }
  .card { padding: 14px; border: 1px solid #d8e2db; border-radius: 18px; background: #fff; box-shadow: 0 5px 16px #16342412; }
  .card-header { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .card-header strong { display: block; font-size: 18px; }
  .card-header small { display: block; margin-top: 2px; color: #6a786f; font-size: 12px; }
  .card-header code { color: #52675b; font-size: 11px; }
  .evidence-grid { display: grid; grid-template-columns: 176px 270px 270px; gap: 12px; align-items: start; }
  .provenance, .variant-pane { min-width: 0; padding: 10px; border-radius: 12px; background: #f5f8f6; }
  .provenance { min-height: 178px; overflow-wrap: anywhere; }
  .provenance h3, .variant-pane h3 { margin-bottom: 8px; color: #3f5b4b; font-size: 12px; letter-spacing: .08em; }
  .provenance dt { margin-top: 8px; color: #728078; font-size: 10px; font-weight: 700; }
  .provenance dd { margin-top: 2px; font-size: 11px; line-height: 1.35; }
  .provenance code { font-size: 10px; }
  .variant-pane h3 { display: flex; justify-content: space-between; }
  .variant-pane h3 span { color: #77847c; font-size: 9px; font-weight: 500; letter-spacing: 0; }
  .frame-grid { display: grid; grid-template-columns: repeat(2, 128px); gap: 8px; }
  .static-frame { display: grid; min-height: 256px; place-items: center; }
  .thumbnail { display: grid; width: max-content; gap: 4px; }
  .thumbnail figcaption { color: #52645a; font-size: 10px; font-weight: 800; text-align: center; }
  .checker { overflow: hidden; background-color: #eef1ef; background-image: linear-gradient(45deg,#d1d9d4 25%,transparent 25%),linear-gradient(-45deg,#d1d9d4 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d1d9d4 75%),linear-gradient(-45deg,transparent 75%,#d1d9d4 75%); background-size: 16px 16px; background-position: 0 0,0 8px,8px -8px,-8px 0; }
  .frame-crop { width: 128px; height: 128px; }
  .frame-crop img { display: block; width: calc(128px * var(--frame-count)); max-width: none; height: 128px; transform: translateX(calc(-128px * var(--frame-index))); }
  .variant-pane--static.variant-pane--master .frame-crop { width: 256px; height: 256px; }
  .variant-pane--static.variant-pane--master .frame-crop img { width: 256px; height: 256px; transform: none; }
  .variant-pane--static.variant-pane--mobile .static-frame { min-height: 256px; }
  .variant-pane--static.variant-pane--mobile .frame-crop { width: 128px; height: 128px; }
</style></head>
<body>
  <header class="sheet-header">
    <h1>후추 디펜스 3D 리뉴얼 승인 보드</h1>
    <p>sourceReference | master | mobile · 844 CSS px landscape review · DPR 1</p>
    <div class="inventory">
      <span>${inventory.assetCount} assets</span><span>${inventory.pngCount} PNG</span>
      <span>${inventory.logicalFrameCount} logical frames</span><span>${inventory.variantThumbnailCount} thumbnails</span>
      <span>animated ${inventory.animatedAssetCount} / ${inventory.animatedLogicalFrameCount}f / ${inventory.animatedThumbnailCount} cells</span>
      <span>static ${inventory.staticAssetCount} / ${inventory.staticThumbnailCount} cells</span>
    </div>
  </header>
  ${sections}
</body></html>`;
}

export async function auditPreviewSheetDom(documentApi = globalThis.document) {
  const images = Array.from(documentApi.images);
  await Promise.all(images.map(async (image) => {
    if (!image.complete || image.naturalWidth === 0) {
      await image.decode();
    }
  }));
  const cards = Array.from(documentApi.querySelectorAll('[data-preview-card]'));
  const panes = Array.from(documentApi.querySelectorAll('[data-preview-pane]'));
  const thumbnails = Array.from(documentApi.querySelectorAll('[data-preview-thumbnail]'));
  const frameLabels = Array.from(documentApi.querySelectorAll('[data-frame-label]'));
  const provenance = Array.from(documentApi.querySelectorAll('[data-provenance]'));
  const mobileThumbnails = Array.from(
    documentApi.querySelectorAll('[data-pane-variant="mobile"] [data-preview-thumbnail]'),
  );
  const animatedFrameLabels = {};
  for (const node of frameLabels) {
    const { assetId, frameLabel: label } = node.dataset;
    const variant = node.dataset.frameVariant ?? node.dataset.variant;
    animatedFrameLabels[assetId] ??= { master: [], mobile: [] };
    animatedFrameLabels[assetId][variant].push(label);
  }
  return {
    cards: cards.length,
    cardIds: cards.map((node) => node.dataset.assetId),
    panes: panes.length,
    paneKeys: panes.map((node) => `${node.dataset.assetId}:${node.dataset.paneVariant}`),
    thumbnails: thumbnails.length,
    thumbnailKeys: thumbnails.map((node) => node.dataset.thumbnailKey),
    frameLabels: frameLabels.length,
    animatedFrameLabels,
    images: images.length,
    decodedImages: images.length,
    mobileMinAxis: mobileThumbnails.length === 0
      ? 0
      : Math.min(...mobileThumbnails.map((node) => {
        const bounds = node.getBoundingClientRect();
        return Math.max(bounds.width, bounds.height);
      })),
    provenance: provenance.map((node) => ({
      assetId: node.dataset.assetId,
      sourceReference: node.dataset.sourceReference,
      generator: node.dataset.generator,
      filter: node.dataset.filter,
    })),
  };
}

const expectedDomAudit = (assets, inventory) => ({
  cards: inventory.assetCount,
  cardIds: assets.map((asset) => asset.id),
  panes: inventory.pngCount,
  paneKeys: assets.flatMap((asset) => VARIANTS.map((variant) => `${asset.id}:${variant}`)),
  thumbnails: inventory.variantThumbnailCount,
  thumbnailKeys: assets.flatMap((asset) => VARIANTS.flatMap(
    (variant) => Array.from(
      { length: asset.frames },
      (_, index) => `${asset.id}:${variant}:${index}`,
    ),
  )),
  frameLabels: inventory.animatedThumbnailCount,
  animatedFrameLabels: Object.fromEntries(
    assets.filter((asset) => asset.frames > 1).map((asset) => {
      const labels = Array.from({ length: asset.frames }, (_, index) => frameLabel(index));
      return [asset.id, { master: labels, mobile: labels }];
    }),
  ),
  images: inventory.variantThumbnailCount,
  decodedImages: inventory.variantThumbnailCount,
  provenance: assets.map((asset) => ({ assetId: asset.id, ...getPreviewProvenance(asset) })),
});

const assertDomAudit = (audit, assets, inventory) => {
  const expected = expectedDomAudit(assets, inventory);
  const comparable = { ...audit };
  delete comparable.mobileMinAxis;
  if (JSON.stringify(comparable) !== JSON.stringify(expected) || audit.mobileMinAxis < 128) {
    throw new Error(`Contact sheet DOM inventory mismatch: ${JSON.stringify(audit)}`);
  }
};

const readCards = async (assets, previewRoot, readFileApi) => Promise.all(
  assets.map(async (asset) => {
    const variantEntries = await Promise.all(VARIANTS.map(async (variant) => {
      const bytes = await readFileApi(path.join(previewRoot, variant, asset.relativePath));
      return [variant, {
        dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
      }];
    }));
    return {
      asset,
      provenance: getPreviewProvenance(asset),
      variants: Object.fromEntries(variantEntries),
    };
  }),
);

const closeBrowserResources = async ({ browser, page, primaryError }) => {
  let cleanupError;
  if (page) {
    try {
      await page.close();
    } catch (error) {
      cleanupError = error;
    }
  }
  if (browser) {
    try {
      await browser.close();
    } catch (error) {
      cleanupError ??= error;
    }
  }
  if (primaryError) throw primaryError;
  if (cleanupError) throw cleanupError;
};

export async function buildRedesignPreviewSheet({
  assets = PREVIEW_ASSETS,
  dependencies = {},
  outputPath = path.join(PREVIEW_ROOT, OUTPUT_FILE_NAME),
  previewRoot = PREVIEW_ROOT,
} = {}) {
  const {
    chromiumApi,
    mkdirApi,
    readFileApi,
    validatePreviewApi,
  } = { ...defaultDependencies, ...dependencies };
  assertCanonicalAssets(assets);
  const inventory = derivePreviewInventory(assets);
  const validatedFiles = await validatePreviewApi({ assets, previewRoot, chromiumApi });
  if (validatedFiles !== inventory.pngCount) {
    throw new Error(
      `Full preview validation incomplete: expected ${inventory.pngCount} PNG files, received ${validatedFiles}`,
    );
  }
  const cards = await readCards(assets, previewRoot, readFileApi);
  const html = renderPreviewSheetHtml(cards, inventory);
  await mkdirApi(path.dirname(outputPath), { recursive: true });

  let browser;
  let page;
  let primaryError;
  let domAudit;
  try {
    browser = await chromiumApi.launch({ headless: true });
    page = await browser.newPage({
      viewport: { width: SHEET_WIDTH, height: 1000 },
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: 'load' });
    domAudit = await page.evaluate(auditPreviewSheetDom);
    assertDomAudit(domAudit, assets, inventory);
    await page.screenshot({ path: outputPath, fullPage: true });
  } catch (error) {
    primaryError = error;
  }
  await closeBrowserResources({ browser, page, primaryError });
  return { domAudit, inventory, outputPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildRedesignPreviewSheet();
  console.log(`WROTE ${path.basename(result.outputPath)}`);
}
