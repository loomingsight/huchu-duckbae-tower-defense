import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { computeCanvasLayout } from '../src/game/render/layout';
import { projectWorldPoint } from '../src/game/render/projection';

type TowerCell = Readonly<{ col: number; row: number }>;

type ClockSnapshot = {
  phase: 'ready' | 'playing' | 'paused' | 'victory' | 'defeat';
  elapsedSeconds: number;
  waveIndex: number;
  enemyCount: number;
  maxEnemyProgress: number;
  damagedEnemyCount: number;
  baseHp: number;
  gold: number;
  towerCells: TowerCell[];
  pendingFrames: number;
  totalFrameRequests: number;
};

async function advance(page: Page, milliseconds: number): Promise<ClockSnapshot> {
  return page.evaluate((duration) => {
    const clock = (window as typeof window & {
      __HUCHU_DEV_CLOCK__?: {
        advance(milliseconds: number): void;
        snapshot(): ClockSnapshot;
      };
    }).__HUCHU_DEV_CLOCK__;
    if (clock === undefined) throw new Error('DEV debug clock is unavailable');
    clock.advance(duration);
    return clock.snapshot();
  }, milliseconds);
}

async function clockSnapshot(page: Page): Promise<ClockSnapshot> {
  return advance(page, 0);
}

async function startGame(page: Page): Promise<void> {
  await page.goto('/?debug-clock=1');
  await page.getByRole('button', { name: '게임 시작' }).click();
  await advance(page, 0);
}

async function placeTower(page: Page, name: string, col: number, row: number): Promise<void> {
  const type = name === '슬로우 타워'
    ? 'slow'
    : name === '화살 타워' ? 'arrow' : name === '덕배' ? 'deokbae' : 'huchu';
  const towerButton = page.locator(`[data-tower="${type}"]`);
  if (await towerButton.getAttribute('aria-pressed') !== 'true') await towerButton.click();
  const position = await canvasPositionForCell(page, col, row);
  await page.locator('canvas').click({ position });
  await expect(page.getByRole('button', { name: `${name} 배치 확정` })).toBeVisible();
  const beforeConfirm = await clockSnapshot(page);
  expect(beforeConfirm.towerCells).not.toContainEqual({ col, row });
  await page.getByRole('button', { name: `${name} 배치 확정` }).click();
  expect((await clockSnapshot(page)).towerCells).toContainEqual({ col, row });
}

async function canvasPositionForCell(
  page: Page,
  col: number,
  row: number,
): Promise<{ x: number; y: number }> {
  const box = await page.locator('canvas').boundingBox();
  if (box === null) throw new Error('Canvas has no layout box');
  const layout = computeCanvasLayout({ width: box.width, height: box.height, dpr: 1 });
  return projectWorldPoint(layout, { x: col + 0.5, y: row + 0.5 });
}

function screenshotPath(testInfo: TestInfo, filename: string): string {
  return process.env.UPDATE_QA_SCREENSHOTS === '1'
    ? `docs/qa/${filename}`
    : testInfo.outputPath(filename);
}

function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('844x390 touch flow builds, controls time, and progresses deterministically', async ({ page }, testInfo) => {
  const consoleErrors = captureConsoleErrors(page);
  await startGame(page);
  const initial = await clockSnapshot(page);

  const arrowButton = page.locator('[data-tower="arrow"]');
  await arrowButton.click();
  await page.locator('canvas').click({ position: await canvasPositionForCell(page, 2, 1) });
  await expect(page.getByRole('button', { name: '화살 타워 배치 취소' })).toBeVisible();
  await page.getByRole('button', { name: '화살 타워 배치 취소' }).click();
  expect((await clockSnapshot(page)).towerCells).toEqual([]);
  await placeTower(page, '화살 타워', 2, 1);
  await expect(page.locator('[data-hud="gold"]')).toHaveText('350');

  const beforeOneTimes = await clockSnapshot(page);
  const afterOneTimes = await advance(page, 250);
  const oneTimesElapsed = afterOneTimes.elapsedSeconds - beforeOneTimes.elapsedSeconds;
  await page.getByRole('button', { name: '게임 속도 1×, 변경' }).click();
  await expect(page.getByRole('button', { name: '게임 속도 2×, 변경' })).toBeVisible();
  const beforeTwoTimes = await clockSnapshot(page);
  const afterTwoTimes = await advance(page, 250);
  const twoTimesElapsed = afterTwoTimes.elapsedSeconds - beforeTwoTimes.elapsedSeconds;
  expect(oneTimesElapsed).toBeCloseTo(0.25, 10);
  expect(twoTimesElapsed).toBeCloseTo(0.5, 10);
  expect(twoTimesElapsed / oneTimesElapsed).toBeCloseTo(2, 10);
  await page.getByRole('button', { name: '게임 일시정지' }).click();
  const paused = await clockSnapshot(page);
  const stillPaused = await advance(page, 2_000);
  expect(stillPaused.elapsedSeconds).toBe(paused.elapsedSeconds);
  await page.getByRole('button', { name: '게임 계속하기' }).click();

  const beforeProgress = await clockSnapshot(page);
  const progressed = await advance(page, 6_000);
  expect(progressed.elapsedSeconds).toBeGreaterThan(initial.elapsedSeconds);
  expect(
    progressed.waveIndex > beforeProgress.waveIndex
    || progressed.maxEnemyProgress > beforeProgress.maxEnemyProgress
    || progressed.damagedEnemyCount > beforeProgress.damagedEnemyCount,
  ).toBe(true);
  await page.screenshot({ path: screenshotPath(testInfo, 'landscape-844x390.png') });
  expect(consoleErrors).toEqual([]);
});

test('victory overlay appears and restart resets the game', async ({ page }, testInfo) => {
  const consoleErrors = captureConsoleErrors(page);
  await startGame(page);
  await placeTower(page, '후추', 4, 3);
  await placeTower(page, '화살 타워', 2, 1);
  const reinforcements = [
    [6, 5], [8, 6], [11, 6], [13, 5], [15, 4], [18, 4], [11, 2], [4, 6],
  ] as const;
  let nextReinforcement = 0;

  for (let index = 0; index < 36; index += 1) {
    const state = await advance(page, 10_000);
    if (state.phase !== 'playing') break;
    let availableGold = state.gold;
    while (availableGold >= 300 && nextReinforcement < reinforcements.length) {
      const [col, row] = reinforcements[nextReinforcement];
      await placeTower(page, '후추', col, row);
      availableGold -= 300;
      nextReinforcement += 1;
    }
  }

  await expect(page.getByRole('heading', { name: '간식 창고를 지켜줘서 고마워요' })).toBeVisible();
  await expect(page.getByText('처치 완료', { exact: true })).toBeVisible();
  await page.screenshot({ path: screenshotPath(testInfo, 'victory-844x390.png') });
  await page.getByRole('button', { name: '다시 하기' }).click();
  const restarted = await clockSnapshot(page);
  expect(restarted).toMatchObject({
    phase: 'playing',
    elapsedSeconds: 0,
    waveIndex: 0,
    baseHp: 20,
    gold: 450,
    pendingFrames: 1,
  });
  expect(consoleErrors).toEqual([]);
});

test('defeat can repeat without multiplying the animation lifecycle', async ({ page }, testInfo) => {
  const consoleErrors = captureConsoleErrors(page);
  await startGame(page);

  for (let run = 0; run < 2; run += 1) {
    for (let index = 0; index < 24; index += 1) {
      const state = await advance(page, 10_000);
      if (state.phase === 'defeat') break;
    }
    await expect(page.getByRole('heading', { name: '간식 창고가 다 털려버렸어요' })).toBeVisible();
    if (run === 0) {
      await page.screenshot({ path: screenshotPath(testInfo, 'defeat-844x390.png') });
    }
    await page.getByRole('button', { name: '다시 도전' }).click();
    const restarted = await clockSnapshot(page);
    expect(restarted.pendingFrames).toBe(1);
    expect(restarted.elapsedSeconds).toBe(0);
  }

  expect((await clockSnapshot(page)).pendingFrames).toBe(1);
  expect(consoleErrors).toEqual([]);
});

test('390x844 portrait prompt blocks simulation progress', async ({ page }, testInfo) => {
  const consoleErrors = captureConsoleErrors(page);
  await startGame(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('dialog', { name: '가로 화면으로 돌려 주세요' })).toBeVisible();
  const before = await clockSnapshot(page);
  const after = await advance(page, 5_000);

  expect(after.elapsedSeconds).toBe(before.elapsedSeconds);
  expect(after.enemyCount).toBe(before.enemyCount);
  await page.screenshot({ path: screenshotPath(testInfo, 'portrait-390x844.png') });
  expect(consoleErrors).toEqual([]);
});
