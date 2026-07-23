import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import {
  NIGHTMARE_ASSETS,
  NIGHTMARE_ROOT,
} from './nightmareAssetContract.mjs';
import { validateNightmareAssets } from './validateNightmareAssets.mjs';

const DEFAULT_OUTPUT = path.join(NIGHTMARE_ROOT, 'nightmare-approval-sheet.png');
const DEFAULT_MOBILE_OUTPUT = path.join(
  NIGHTMARE_ROOT,
  'nightmare-approval-mobile.png',
);
const DEFAULT_ENEMY_OUTPUT = path.join(
  NIGHTMARE_ROOT,
  'nightmare-enemy-approval-sheet.png',
);
const DEFAULT_ENEMY_MOBILE_OUTPUT = path.join(
  NIGHTMARE_ROOT,
  'nightmare-enemy-approval-mobile.png',
);
const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const APPROVED_CONCEPT_PATH = path.join(
  REPOSITORY_ROOT,
  'assets/concepts/nightmare-v1/nightmare-enemy-lineup-v3.png',
);

const escapeHtml = (value) => String(value).replace(
  /[&<>"']/g,
  (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character],
);

function assetCard({ asset, masterUrl, mobileUrl }) {
  return `
    <article class="asset-card" data-group="${escapeHtml(asset.group)}">
      <header>
        <strong>${escapeHtml(asset.id)}</strong>
        <span>${asset.frames}f · ${escapeHtml(asset.relativePath)}</span>
      </header>
      <div class="variants">
        <figure>
          <figcaption>MASTER</figcaption>
          <div class="checker"><img src="${masterUrl}" alt="${escapeHtml(asset.id)} master"></div>
        </figure>
        <figure>
          <figcaption>MOBILE</figcaption>
          <div class="checker"><img src="${mobileUrl}" alt="${escapeHtml(asset.id)} mobile"></div>
        </figure>
      </div>
    </article>`;
}

function renderGroup(title, cards, className = '') {
  return `
    <section class="group ${className}">
      <h2>${escapeHtml(title)}</h2>
      <div class="cards">${cards.map(assetCard).join('')}</div>
    </section>`;
}

export function renderNightmareApprovalHtml(
  cards,
  validation,
  {
    conceptUrl,
    motionOnly = false,
  } = {},
) {
  const motion = cards.filter(({ asset }) => asset.group === 'motion');
  const vfx = cards.filter(({ asset }) => asset.group === 'vfx');
  const maps = cards.filter(({ asset }) => asset.group === 'map');
  const mapThemes = [...new Set(maps.map(({ asset }) => asset.theme))];
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; min-width: 100%; }
    body { padding: 20px; color: #f5efff; background: #161325; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    h1, h2, p, figure { margin: 0; }
    .hero { padding: 22px; border: 1px solid #684a91; border-radius: 18px; background: linear-gradient(135deg,#251d3e,#48255f); }
    .hero h1 { font-size: 30px; }
    .hero p { margin-top: 7px; color: #d6c9e7; font-size: 13px; }
    .metrics { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
    .metrics span { padding: 5px 9px; border-radius: 999px; color: #dff7ff; background: #112c3e; font-size: 12px; font-weight: 750; }
    .group { margin-top: 22px; }
    .group h2 { margin: 0 0 9px 4px; color: #d7b8ff; font-size: 17px; letter-spacing: .09em; }
    .cards { display: grid; grid-template-columns: 1fr; gap: 10px; }
    .asset-card { min-width: 0; padding: 11px; border: 1px solid #3f3656; border-radius: 14px; background: #211d30; }
    .asset-card header { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
    .asset-card header strong { font-size: 14px; }
    .asset-card header span { overflow-wrap: anywhere; color: #a99abf; font-size: 10px; text-align: right; }
    .variants { display: grid; grid-template-columns: 2fr 1fr; gap: 8px; }
    figure { min-width: 0; }
    figcaption { margin-bottom: 4px; color: #86daf5; font-size: 9px; font-weight: 800; }
    .checker { display: grid; min-height: 100px; place-items: center; overflow: hidden; border-radius: 8px; background-color: #e8e8eb; background-image: linear-gradient(45deg,#c9c9d0 25%,transparent 25%),linear-gradient(-45deg,#c9c9d0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#c9c9d0 75%),linear-gradient(-45deg,transparent 75%,#c9c9d0 75%); background-size: 16px 16px; background-position: 0 0,0 8px,8px -8px,-8px 0; }
    .checker img { display: block; width: 100%; max-height: 180px; object-fit: contain; }
    .map-group .cards { grid-template-columns: repeat(3, 1fr); }
    .map-group .asset-card header { display: block; min-height: 32px; }
    .map-group .asset-card header span { display: block; margin-top: 2px; text-align: left; }
    .map-group .variants { grid-template-columns: 1fr 1fr; }
    .map-group .checker { min-height: 86px; }
    .concept { margin-top: 18px; padding: 12px; border: 1px solid #3f3656; border-radius: 14px; background: #211d30; }
    .concept h2 { margin: 0 0 8px; color: #d7b8ff; font-size: 17px; letter-spacing: .09em; }
    .concept img { display: block; width: 100%; border-radius: 9px; }
    @media (max-width: 900px) {
      body { padding: 12px; }
      .hero h1 { font-size: 24px; }
      .map-group .cards { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .asset-card { padding: 8px; }
      .checker img { max-height: 140px; }
    }
  </style>
</head>
<body>
  <header class="hero">
    <h1>후추덕배 타워 디펜스 · Nightmare 3D 승인 보드</h1>
    <p>승인된 2D v3 기반 · 정면 적 동작, 특성 VFX, 6개 다크 테마 맵 키트</p>
    <div class="metrics">
      <span>${validation.assetCount} assets</span>
      <span>${validation.fileCount} PNG</span>
      <span>${validation.mobileBytes.toLocaleString('en-US')} / ${validation.maxMobileBytes.toLocaleString('en-US')} mobile bytes</span>
    </div>
  </header>
  ${conceptUrl === undefined ? '' : `
  <section class="concept">
    <h2>APPROVED 2D V3 REFERENCE</h2>
    <img src="${conceptUrl}" alt="승인된 나이트메어 적 2D v3 도안">
  </section>`}
  ${renderGroup('ENEMY MOTION', motion)}
  ${motionOnly ? '' : renderGroup('TRAIT VFX', vfx)}
  ${motionOnly ? '' : mapThemes.map((theme) => renderGroup(
    `MAP · ${theme}`,
    maps.filter(({ asset }) => asset.theme === theme),
    'map-group',
  )).join('')}
</body>
</html>`;
}

export function renderNightmareEnemyApprovalHtml(
  cards,
  validation,
  conceptUrl,
) {
  return renderNightmareApprovalHtml(
    cards.filter(({ asset }) => asset.group === 'motion'),
    validation,
    { conceptUrl, motionOnly: true },
  );
}

export async function buildNightmareApprovalSheet({
  outputPath = DEFAULT_OUTPUT,
  mobileOutputPath = DEFAULT_MOBILE_OUTPUT,
  enemyOutputPath = DEFAULT_ENEMY_OUTPUT,
  enemyMobileOutputPath = DEFAULT_ENEMY_MOBILE_OUTPUT,
  root,
  chromiumApi = chromium,
} = {}) {
  const validation = await validateNightmareAssets({ root, chromiumApi });
  const cards = await Promise.all(NIGHTMARE_ASSETS.map(async (asset) => {
    const assetRoot = root ?? asset.root;
    const [master, mobile] = await Promise.all([
      readFile(path.join(assetRoot, 'master', asset.relativePath)),
      readFile(path.join(assetRoot, 'mobile', asset.relativePath)),
    ]);
    return {
      asset,
      masterUrl: `data:image/png;base64,${master.toString('base64')}`,
      mobileUrl: `data:image/png;base64,${mobile.toString('base64')}`,
    };
  }));
  const html = renderNightmareApprovalHtml(cards, validation);
  const concept = await readFile(APPROVED_CONCEPT_PATH);
  const enemyHtml = renderNightmareEnemyApprovalHtml(
    cards,
    validation,
    `data:image/png;base64,${concept.toString('base64')}`,
  );
  await Promise.all([
    mkdir(path.dirname(outputPath), { recursive: true }),
    mkdir(path.dirname(mobileOutputPath), { recursive: true }),
    mkdir(path.dirname(enemyOutputPath), { recursive: true }),
    mkdir(path.dirname(enemyMobileOutputPath), { recursive: true }),
  ]);

  let browser;
  let page;
  try {
    browser = await chromiumApi.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1200, height: 720 } });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(async () => {
      await Promise.all(Array.from(document.images).map(async (image) => {
        if (!image.complete || image.naturalWidth === 0) await image.decode();
      }));
    });
    await page.screenshot({ path: outputPath, fullPage: true });
    await page.setViewportSize({ width: 844, height: 720 });
    await page.screenshot({ path: mobileOutputPath, fullPage: true });
    await page.setViewportSize({ width: 1200, height: 720 });
    await page.setContent(enemyHtml, { waitUntil: 'load' });
    await page.evaluate(async () => {
      await Promise.all(Array.from(document.images).map(async (image) => {
        if (!image.complete || image.naturalWidth === 0) await image.decode();
      }));
    });
    await page.screenshot({ path: enemyOutputPath, fullPage: true });
    await page.setViewportSize({ width: 844, height: 720 });
    await page.screenshot({ path: enemyMobileOutputPath, fullPage: true });
  } finally {
    try {
      await page?.close();
    } finally {
      await browser?.close();
    }
  }
  return Object.freeze({
    ...validation,
    outputPath,
    mobileOutputPath,
    enemyOutputPath,
    enemyMobileOutputPath,
  });
}

async function main() {
  const result = await buildNightmareApprovalSheet();
  console.log(`CREATED ${result.outputPath}`);
  console.log(`CREATED ${result.mobileOutputPath}`);
  console.log(`CREATED ${result.enemyOutputPath}`);
  console.log(`CREATED ${result.enemyMobileOutputPath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
