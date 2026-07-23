import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import {
  NIGHTMARE_ASSETS,
  NIGHTMARE_THEME_IDS,
} from './nightmareAssetContract.mjs';

const VARIANTS = Object.freeze(['master', 'mobile']);
export const MAX_MOBILE_BYTES = 8 * 1024 * 1024;

function assertCanonicalManifest(assets) {
  const ids = assets.map(({ id }) => id);
  const paths = assets.map(({ relativePath }) => relativePath);
  const counts = Object.fromEntries(
    ['motion', 'vfx', 'map'].map((group) => [
      group,
      assets.filter((asset) => asset.group === group).length,
    ]),
  );
  if (assets.length !== 67 || counts.motion !== 5 || counts.vfx !== 8 || counts.map !== 54) {
    throw new Error(`Invalid nightmare asset counts: ${JSON.stringify(counts)}`);
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error('Duplicate nightmare asset id');
  }
  if (new Set(paths).size !== paths.length) {
    throw new Error('Duplicate nightmare asset relativePath');
  }
  for (const theme of NIGHTMARE_THEME_IDS) {
    if (assets.filter((asset) => asset.group === 'map' && asset.theme === theme).length !== 9) {
      throw new Error(`Theme ${theme} must define exactly nine map assets`);
    }
  }
}

function assetFiles(assets, rootOverride) {
  return assets.flatMap((asset) => VARIANTS.map((variant) => ({
    asset,
    variant,
    frameSize: variant === 'master'
      ? asset.masterFrameSize
      : asset.mobileFrameSize,
    filePath: path.join(
      rootOverride ?? asset.root,
      variant,
      asset.relativePath,
    ),
  })));
}

export async function validateNightmareAssets({
  assets = NIGHTMARE_ASSETS,
  root,
  chromiumApi = chromium,
} = {}) {
  assertCanonicalManifest(assets);
  const files = assetFiles(assets, root);
  await Promise.all(files.map(({ filePath }) => access(filePath)));
  const bytesByPath = new Map(await Promise.all(files.map(async ({ filePath }) => (
    [filePath, await readFile(filePath)]
  ))));
  const mobileBytes = files
    .filter(({ variant }) => variant === 'mobile')
    .reduce((total, { filePath }) => total + bytesByPath.get(filePath).byteLength, 0);
  if (mobileBytes > MAX_MOBILE_BYTES) {
    throw new Error(
      `Nightmare mobile assets exceed ${MAX_MOBILE_BYTES} bytes: ${mobileBytes}`,
    );
  }

  let browser;
  let page;
  try {
    browser = await chromiumApi.launch({ headless: true });
    page = await browser.newPage();
    for (const { asset, filePath, frameSize, variant } of files) {
      const bytes = bytesByPath.get(filePath);
      const result = await page.evaluate(async ({
        dataUrl,
        expectedHeight,
        expectedWidth,
      }) => {
        const image = new Image();
        image.src = dataUrl;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (context === null) throw new Error('2D canvas unavailable');
        context.drawImage(image, 0, 0);
        const corners = [
          [0, 0],
          [canvas.width - 1, 0],
          [0, canvas.height - 1],
          [canvas.width - 1, canvas.height - 1],
        ].map(([x, y]) => context.getImageData(x, y, 1, 1).data[3]);
        return {
          corners,
          height: image.naturalHeight,
          width: image.naturalWidth,
          dimensionsOk: image.naturalWidth === expectedWidth
            && image.naturalHeight === expectedHeight,
        };
      }, {
        dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
        expectedWidth: frameSize * asset.frames,
        expectedHeight: frameSize,
      });
      if (!result.dimensionsOk) {
        throw new Error(
          `${asset.id}/${variant} has ${result.width}x${result.height}`,
        );
      }
      if (result.corners.some((alpha) => alpha !== 0)) {
        throw new Error(
          `${asset.id}/${variant} has opaque corner alpha ${result.corners}`,
        );
      }
    }
  } finally {
    try {
      await page?.close();
    } finally {
      await browser?.close();
    }
  }

  return Object.freeze({
    assetCount: assets.length,
    fileCount: files.length,
    mobileBytes,
    maxMobileBytes: MAX_MOBILE_BYTES,
  });
}

async function main() {
  const result = await validateNightmareAssets();
  console.log(
    `VALIDATED ${result.assetCount} nightmare assets / ${result.fileCount} PNG files`
    + ` / ${result.mobileBytes} mobile bytes (limit ${result.maxMobileBytes})`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
