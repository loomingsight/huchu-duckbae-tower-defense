import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { PREVIEW_ASSETS, PREVIEW_ROOT } from './redesignPreviewContract.mjs';

const groupFlag = process.argv.indexOf('--group');
const requestedGroup = groupFlag === -1 ? null : process.argv[groupFlag + 1];
const assets = PREVIEW_ASSETS.filter(
  (asset) => requestedGroup === null || asset.group === requestedGroup,
);

if (assets.length === 0) {
  throw new Error(`Unknown or empty preview group: ${requestedGroup}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  let files = 0;
  for (const asset of assets) {
    for (const variant of ['master', 'mobile']) {
      const frameSize = variant === 'master'
        ? asset.masterFrameSize
        : asset.mobileFrameSize;
      const filePath = path.join(PREVIEW_ROOT, variant, asset.relativePath);
      await access(filePath);
      const bytes = await readFile(filePath);
      const result = await page.evaluate(async ({ dataUrl, expectedWidth, expectedHeight }) => {
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
          width: image.naturalWidth,
          height: image.naturalHeight,
          corners,
          dimensionsOk: image.naturalWidth === expectedWidth
            && image.naturalHeight === expectedHeight,
        };
      }, {
        dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
        expectedWidth: frameSize * asset.frames,
        expectedHeight: frameSize,
      });

      if (!result.dimensionsOk) {
        throw new Error(`${asset.id}/${variant} has ${result.width}x${result.height}`);
      }
      if (result.corners.some((alpha) => alpha !== 0)) {
        throw new Error(`${asset.id}/${variant} has opaque corner alpha ${result.corners}`);
      }
      files += 1;
    }
  }
  console.log(`VALIDATED ${assets.length} assets / ${files} PNG files`);
} finally {
  await page.close();
  await browser.close();
}
