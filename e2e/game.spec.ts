import { expect, test, type Page, type TestInfo } from '@playwright/test';

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
  const towerButton = page.getByRole('button', { name: new RegExp(name) });
  if (await towerButton.getAttribute('aria-pressed') !== 'true') await towerButton.click();
  const box = await page.locator('canvas').boundingBox();
  if (box === null) throw new Error('Canvas has no layout box');
  const gameWidth = Math.min(box.width, box.height * 16 / 9);
  const gameHeight = gameWidth * 9 / 16;
  const offsetX = (box.width - gameWidth) / 2;
  const offsetY = (box.height - gameHeight) / 2;
  const cellSize = Math.min(gameWidth / 20, gameHeight / 10);
  const mapWidth = cellSize * 20;
  const mapHeight = cellSize * 10;
  const mapOffsetX = offsetX + (gameWidth - mapWidth) / 2;
  const mapOffsetY = offsetY + (gameHeight - mapHeight) / 2;
  await page.locator('canvas').click({
    position: {
      x: mapOffsetX + (col + 0.5) * cellSize,
      y: mapOffsetY + (row + 0.5) * cellSize,
    },
  });
  expect((await clockSnapshot(page)).towerCells).toContainEqual({ col, row });
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

  await placeTower(page, '화살 타워', 2, 5);
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
  await placeTower(page, '후추 타워', 8, 5);
  await placeTower(page, '화살 타워', 3, 4);
  const reinforcements = [
    [7, 6], [9, 6], [11, 5], [13, 5], [15, 5], [6, 1], [15, 1], [18, 5],
  ] as const;
  let nextReinforcement = 0;

  for (let index = 0; index < 36; index += 1) {
    const state = await advance(page, 10_000);
    if (state.phase !== 'playing') break;
    let availableGold = state.gold;
    while (availableGold >= 300 && nextReinforcement < reinforcements.length) {
      const [col, row] = reinforcements[nextReinforcement];
      await placeTower(page, '후추 타워', col, row);
      availableGold -= 300;
      nextReinforcement += 1;
    }
  }

  await expect(page.getByRole('heading', { name: '간식 창고를 지켰어요!' })).toBeVisible();
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
    await expect(page.getByRole('heading', { name: '간식 창고가 비었어요' })).toBeVisible();
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
