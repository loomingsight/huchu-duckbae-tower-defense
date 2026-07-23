# Nightmare Mode Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in the approved single-agent mode. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 6개 스테이지와 기록을 보존하면서 신규 적·맵·점수·3D 렌더를 갖춘 나이트메어 6스테이지를 추가한다.

**Architecture:** `normal-1`부터 `nightmare-6`까지의 안정적인 `StageKey`를 공통 stage catalog의 키로 사용하고, 시뮬레이션·렌더러·저장·HUD가 같은 정의를 조회한다. 플레이 가능한 데이터·특성 로직을 폴백 그래픽으로 먼저 완성한 뒤, 2D 도안과 Blender 렌더를 각각 승인받아 최종 manifest에 연결한다.

**Tech Stack:** TypeScript 5.8, Vite 7, Vitest 3, HTML Canvas 2D, CSS Material-style tokens, Blender Python/MCP, Node.js 22

## Global Constraints

- 실행은 사용자가 지정한 단일 에이전트 인라인 방식으로 진행한다.
- 설계 원본은 `docs/superpowers/specs/2026-07-23-nightmare-mode-expansion-design.md`다.
- 기존 노멀 6스테이지 밸런스와 v3 기록을 보존한다.
- 나이트메어 공통값은 시작 `280G`, 창고 내구도 `12`, 골드 배율 `0.85`, 점수 배율 `1.5`다.
- 기존 타워 4종의 가격·사거리·피해·공격 주기와 업그레이드 없는 규칙을 바꾸지 않는다.
- 모든 맵은 20×10, 좌측 시작→우측 보물, 재방문 없는 1칸 너비 직각 단일 경로다.
- 신규 적과 보물은 이동 방향과 무관하게 정면을 본다.
- 승인 전 후보 에셋을 `spriteManifest.ts`에 연결하지 않는다.
- 2D 도안 승인 전 Blender 모델링을 시작하지 않고, Blender 검수 보드 승인 전 게임 에셋 통합을 시작하지 않는다.
- 신규 최종 이미지 총량은 8MB 이하를 목표로 한다.
- E2E와 `npm run test:e2e`는 실행하지 않는다.
- 검증은 Vitest, 타입 검사, `npm run check`, 에셋 검사, 모바일·데스크톱 수동 스크린샷으로 닫는다.
- Vite base `/huchu-duckbae-tower-defense/`와 Pages artifact `pages/` 계약을 유지한다.
- 배포는 별도 사용자 확인 뒤 `main`에 푸시하며 GitHub Actions 성공과 공개 URL·번들 HTTP 200 전에는 성공으로 보고하지 않는다.

---

## File Structure

### 새 파일

- `src/game/stages/stageIdentity.ts`: `GameMode`, `StageNumber`, `StageKey` 생성·정규화
- `src/game/waves/nightmareWaves.ts`: 공통 웨이브 표와 스테이지별 결정적 수량 생성
- `src/game/enemies/enemyTraits.ts`: 피해 방패, 분열, 둔화 저항, 오라와 보스 2페이즈
- `tests/game/nightmareTraits.test.ts`: 신규 적 특성 계약
- `tests/game/nightmareBalance.test.ts`: 난이도 압박도와 대표 전략 회귀
- `assets/concepts/nightmare-v1/`: 승인 전 2D 후보
- `docs/assets/nightmare-concepts-v1.md`: 2D 승인 인벤토리
- `tools/blender/nightmare_assets.py`: 승인된 도안을 3D 모델·동작·맵 키트로 생성
- `tools/assets/nightmareAssetContract.mjs`: 최종 파일명·프레임·크기 계약
- `tools/assets/validateNightmareAssets.mjs`: 투명도·크기·용량 검증
- `tools/assets/buildNightmareApprovalSheet.mjs`: Blender 검수 보드 생성
- `tests/assets/nightmareAssetContract.test.ts`: 에셋 manifest 계약
- `docs/assets/nightmare-3d-v1.md`: Blender 승인 인벤토리

### 기존 파일

- `src/game/stages/stageCatalog.ts`: 노멀·나이트메어 12개 정의 조립
- `src/game/waves/stage1Waves.ts`: wave group에 `variant` 허용
- `src/game/enemies/enemyCatalog.ts`: 신규 적 정의와 trait metadata
- `src/game/simulation/createGame.ts`: `stageKey`, 적 runtime state, visual event
- `src/game/simulation/updateWaves.ts`: variant spawn과 보스·방패 등장 이벤트
- `src/game/simulation/updateEnemies.ts`: 보상·분열·누출·범용 보스 처리
- `src/game/simulation/updateGame.ts`: 특성 업데이트 순서
- `src/game/combat/updateProjectiles.ts`: 공용 피해 함수로 방패 처리
- `src/game/combat/updateSlow.ts`: 둔화 저항 처리
- `src/game/combat/targeting.ts`, `src/game/simulation/placeTower.ts`: `StageKey` 조회
- `src/app/preferences.ts`: v4 저장·v3 이전·모드별 해금과 기록
- `src/app/hud.ts`: 모드 탭, 3×2 카드, 별·배지·결과 상세
- `src/app/GameApp.ts`: 선택·기록·렌더 이벤트 통합
- `src/styles.css`: 노멀·나이트메어 탭과 다크 카드
- `src/game/scoring.ts`: 노멀 호환 점수와 나이트메어 전투 점수
- `src/game/render/effects.ts`: trait event buffer와 runtime effect
- `src/game/render/drawEntities.ts`: 신규 정면 동작·HP·오버레이 anchor
- `src/game/render/drawEffects.ts`: 특성 VFX·나이트메어 시작·리치 왕 연출
- `src/game/render/drawMap.ts`: 테마 팔레트와 승인된 3D 타일
- `src/game/render/canvasRenderer.ts`: stage theme·reduced-motion 전달
- `src/game/render/spriteManifest.ts`, `src/game/render/assetLoader.ts`: 승인 에셋 등록
- `tests/game/renderTestUtils.ts`: 신규 asset fixture
- `package.json`: 나이트메어 에셋 검증 명령

---

### Task 1: StageKey, 나이트메어 카탈로그와 결정적 웨이브

**Files:**
- Create: `src/game/stages/stageIdentity.ts`
- Create: `src/game/waves/nightmareWaves.ts`
- Modify: `src/game/stages/stageCatalog.ts:1-131`
- Modify: `src/game/waves/stage1Waves.ts:1-38`
- Modify: `src/game/enemies/enemyCatalog.ts:1-18`
- Modify: `src/game/render/spriteManifest.ts:1-72`
- Modify: `src/game/render/assetLoader.ts:1-141`
- Modify: `src/app/GameApp.ts:31-61`
- Modify: `tests/game/renderTestUtils.ts:1-80`
- Test: `tests/game/stages.test.ts`
- Test: `tests/game/waves.test.ts`
- Test: `tests/game/enemies.test.ts`
- Test: `tests/game/assetLoader.test.ts`
- Test: `tests/game/spriteManifest.test.ts`

**Interfaces:**
- Produces: `GameMode`, `StageNumber`, `StageKey`, `DEFAULT_STAGE_KEY`
- Produces: `stageKey(mode, number)`, `normalizeStageKey(value)`, `stageRef(value)`
- Produces: `NORMAL_STAGE_KEYS`, `NIGHTMARE_STAGE_KEYS`, `ALL_STAGE_KEYS`
- Produces: `getStageDefinition(value): StageDefinition`
- Produces: `createNightmareWaves(stageNumber): readonly Wave[]`
- Preserves: 숫자 `1..6` 입력은 `normal-1..normal-6`을 조회하는 호환 경계

- [ ] **Step 1: StageKey와 12개 스테이지 계약의 실패 테스트 작성**

```ts
import {
  ALL_STAGE_KEYS,
  getStageDefinition,
  NIGHTMARE_STAGE_KEYS,
} from '../../src/game/stages/stageCatalog';
import {
  normalizeStageKey,
  stageRef,
} from '../../src/game/stages/stageIdentity';

it('normalizes stable mode-stage keys without treating nightmare as stage seven', () => {
  expect(ALL_STAGE_KEYS).toHaveLength(12);
  expect(NIGHTMARE_STAGE_KEYS).toEqual([
    'nightmare-1', 'nightmare-2', 'nightmare-3',
    'nightmare-4', 'nightmare-5', 'nightmare-6',
  ]);
  expect(normalizeStageKey(6)).toBe('normal-6');
  expect(normalizeStageKey('nightmare-6')).toBe('nightmare-6');
  expect(normalizeStageKey('nightmare-7')).toBe('normal-1');
  expect(stageRef('nightmare-4')).toEqual({
    key: 'nightmare-4',
    mode: 'nightmare',
    number: 4,
  });
});

it('defines the six approved nightmare maps and economy', () => {
  const expected = [
    ['달빛 늪', 30, 62, 1.00, 1.00, 1.00, 1.00, 18_500, 23_000],
    ['썩은 숲', 27, 56, 1.10, 1.02, 0.97, 1.04, 19_000, 23_500],
    ['잿빛 폐허', 25, 52, 1.21, 1.04, 0.94, 1.08, 19_500, 24_000],
    ['핏빛 협곡', 26, 54, 1.33, 1.06, 0.91, 1.12, 20_500, 25_000],
    ['흑요석 광산', 24, 50, 1.47, 1.08, 0.88, 1.16, 20_500, 25_000],
    ['심연의 성문', 23, 48, 1.62, 1.10, 0.85, 1.20, 21_500, 26_500],
  ] as const;

  for (const [index, row] of expected.entries()) {
    const stage = getStageDefinition(`nightmare-${index + 1}`);
    expect([
      stage.name,
      stage.map.pathCells.length - 1,
      stage.map.buildableCells([]).length,
      stage.hpMultiplier,
      stage.speedMultiplier,
      stage.spawnIntervalMultiplier,
      stage.countMultiplier,
      stage.twoStarScore,
      stage.threeStarScore,
    ]).toEqual(row);
    expect(stage.startingGold).toBe(280);
    expect(stage.baseHp).toBe(12);
    expect(stage.rewardMultiplier).toBe(0.85);
    expect(stage.scoreMultiplier).toBe(1.5);
  }
});
```

- [ ] **Step 2: 새 테스트가 현재 타입·export 부재로 실패하는지 확인**

Run: `npx vitest run tests/game/stages.test.ts tests/game/waves.test.ts tests/game/enemies.test.ts`

Expected: FAIL with missing `stageIdentity`, `NIGHTMARE_STAGE_KEYS`, `createNightmareWaves` or new enemy types.

- [ ] **Step 3: 독립적인 StageKey 타입과 정규화 구현**

```ts
// src/game/stages/stageIdentity.ts
export const GAME_MODES = ['normal', 'nightmare'] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const STAGE_NUMBERS = [1, 2, 3, 4, 5, 6] as const;
export type StageNumber = (typeof STAGE_NUMBERS)[number];
export type StageKey = `${GameMode}-${StageNumber}`;

export const DEFAULT_STAGE_KEY: StageKey = 'normal-1';

export const NIGHTMARE_THEME_IDS = [
  'moonlitSwamp',
  'rottenForest',
  'ashenRuins',
  'bloodRavine',
  'obsidianMine',
  'abyssGate',
] as const;
export const STAGE_THEME_IDS = ['normal', ...NIGHTMARE_THEME_IDS] as const;
export type StageThemeId = (typeof STAGE_THEME_IDS)[number];

export function stageKey(mode: GameMode, number: StageNumber): StageKey {
  return `${mode}-${number}`;
}

export function normalizeStageNumber(value: unknown): StageNumber {
  return typeof value === 'number'
    && Number.isInteger(value)
    && (STAGE_NUMBERS as readonly number[]).includes(value)
    ? value as StageNumber
    : 1;
}

export function normalizeStageKey(value: unknown): StageKey {
  if (typeof value === 'number') return stageKey('normal', normalizeStageNumber(value));
  if (typeof value !== 'string') return DEFAULT_STAGE_KEY;
  const match = /^(normal|nightmare)-([1-6])$/.exec(value);
  return match === null
    ? DEFAULT_STAGE_KEY
    : stageKey(match[1] as GameMode, Number(match[2]) as StageNumber);
}

export function stageRef(value: unknown): Readonly<{
  key: StageKey;
  mode: GameMode;
  number: StageNumber;
}> {
  const key = normalizeStageKey(value);
  const [mode, number] = key.split('-');
  return { key, mode: mode as GameMode, number: Number(number) as StageNumber };
}
```

- [ ] **Step 4: 신규 적 타입과 웨이브 variant 계약 추가**

```ts
export const NORMAL_ENEMY_TYPES = ['slime', 'fairy', 'orc', 'golem', 'minotaur'] as const;
export const NIGHTMARE_ENEMY_TYPES = [
  'shadowSlime',
  'vampireBat',
  'skeletonKnight',
  'obsidianGolem',
  'lichKing',
] as const;
export const ENEMY_TYPES = [...NORMAL_ENEMY_TYPES, ...NIGHTMARE_ENEMY_TYPES] as const;
export type EnemyType = (typeof ENEMY_TYPES)[number];
export type EnemyVariant = 'standard' | 'elite' | 'split-child';

export type EnemyDefinition = Readonly<{
  hp: number;
  speed: number;
  reward: number;
  leak: number;
  combatScore: number;
  boss: boolean;
  trait: 'none' | 'split' | 'slow-resistant' | 'shield' | 'armored' | 'speed-aura';
}>;
```

신규 catalog 값은 설계서 그대로 넣는다. 그림자 슬라임 catalog reward는 본체 `4`, combatScore는 `15`로 두고 자식 override는 Task 4에서 적용한다.

```ts
slime:           { hp: 50.4, speed: 1.15,  reward: 8,   leak: 1, combatScore: 25, boss: false, trait: 'none' },
fairy:           { hp: 38.4, speed: 2.28,  reward: 10,  leak: 1, combatScore: 25, boss: false, trait: 'none' },
orc:             { hp: 132,  speed: 1.035, reward: 15,  leak: 2, combatScore: 25, boss: false, trait: 'none' },
golem:           { hp: 384,  speed: 0.52,  reward: 28,  leak: 3, combatScore: 25, boss: false, trait: 'none' },
minotaur:        { hp: 2160, speed: 0.48,  reward: 150, leak: 8, combatScore: 25, boss: true,  trait: 'none' },
shadowSlime:    { hp: 90,   speed: 1.10, reward: 4,   leak: 1,  combatScore: 15, boss: false, trait: 'split' },
vampireBat:     { hp: 64,   speed: 2.55, reward: 10,  leak: 1,  combatScore: 25, boss: false, trait: 'slow-resistant' },
skeletonKnight: { hp: 200,  speed: 0.92, reward: 15,  leak: 2,  combatScore: 40, boss: false, trait: 'shield' },
obsidianGolem:  { hp: 620,  speed: 0.44, reward: 28,  leak: 3,  combatScore: 75, boss: false, trait: 'armored' },
lichKing:       { hp: 3500, speed: 0.46, reward: 150, leak: 10, combatScore: 0,  boss: true,  trait: 'speed-aura' },
```

`WaveGroup`에 `variant?: EnemyVariant`를 추가하고 `isValidWaveGroup`은 variant가 없거나 세 값 중 하나일 때만 통과시킨다.

- [ ] **Step 5: 결정적 나이트메어 웨이브 생성**

```ts
// src/game/waves/nightmareWaves.ts
import type { EnemyType, EnemyVariant } from '../enemies/enemyCatalog';
import type { StageNumber } from '../stages/stageIdentity';
import type { Wave, WaveGroup } from './stage1Waves';

const TYPES = ['shadowSlime', 'vampireBat', 'skeletonKnight', 'obsidianGolem'] as const;
const BASE_COUNTS = [
  [10, 0, 0, 0], [8, 6, 0, 0], [6, 8, 3, 0], [8, 4, 6, 0],
  [0, 8, 6, 0], [6, 6, 8, 2], [10, 8, 6, 3], [6, 8, 9, 4],
  [8, 6, 10, 5], [6, 8, 10, 5],
] as const;
const COUNT_MULTIPLIERS = [1, 1.04, 1.08, 1.12, 1.16, 1.20] as const;
const TYPE_WEIGHTS = [
  [1, 1, 1, 1],
  [0.90, 1.25, 1, 0.90],
  [0.85, 0.90, 1.30, 1],
  [1.30, 1.05, 1, 0.90],
  [0.80, 0.85, 1, 1.35],
  [1.05, 1.05, 1.10, 1.15],
] as const;
const ELITES: readonly EnemyType[] = [
  'skeletonKnight', 'vampireBat', 'skeletonKnight',
  'shadowSlime', 'obsidianGolem', 'obsidianGolem',
];
const INTERVALS = [
  [0.60, 0.46, 0.70, 1.05],
  [0.54, 0.42, 0.64, 0.98],
  [0.49, 0.39, 0.58, 0.90],
  [0.44, 0.36, 0.52, 0.84],
  [0.39, 0.33, 0.46, 0.76],
] as const;

export function createNightmareWaves(stageNumber: StageNumber): readonly Wave[] {
  const stageIndex = stageNumber - 1;
  return BASE_COUNTS.map((counts, waveIndex) => {
    const groups: WaveGroup[] = counts.flatMap((baseCount, typeIndex) => {
      if (baseCount === 0) return [];
      return [{
        type: TYPES[typeIndex],
        count: Math.round(
          baseCount * COUNT_MULTIPLIERS[stageIndex] * TYPE_WEIGHTS[stageIndex][typeIndex],
        ),
        spawnInterval: INTERVALS[Math.floor(waveIndex / 2)][typeIndex],
      }];
    });
    if (waveIndex === 4) {
      groups.push({ type: ELITES[stageIndex], count: 1, spawnInterval: 0, variant: 'elite' });
    }
    if (waveIndex === 9) {
      groups.push({ type: 'lichKing', count: 1, spawnInterval: 0 });
    }
    return { groups };
  });
}
```

- [ ] **Step 6: 12개 stage definition 조립**

`StageDefinition`에 `key`, `mode`, `number`, `themeId`, 경제·점수·수량 필드를 추가한다. 기존 노멀 6개에는 `themeId: 'normal'`, `startingGold: 320`, `baseHp: 20`, `rewardMultiplier: 1`, `scoreMultiplier: 1`, `countMultiplier: 1`, `twoStarScore: 7000`, `threeStarScore: 10000`을 넣는다. 기존 `id` assertion은 `key`와 `number` assertion으로 교체한다.

나이트메어 waypoint는 다음 배열을 그대로 사용한다.

```ts
[
  [[0, 7], [4, 7], [4, 2], [10, 2], [10, 6], [15, 6], [15, 4], [19, 4]],
  [[0, 2], [6, 2], [6, 7], [12, 7], [12, 4], [19, 4]],
  [[0, 8], [5, 8], [5, 4], [14, 4], [14, 2], [19, 2]],
  [[0, 3], [7, 3], [7, 7], [13, 7], [13, 4], [19, 4]],
  [[0, 6], [5, 6], [5, 3], [15, 3], [15, 5], [19, 5]],
  [[0, 4], [8, 4], [8, 6], [13, 6], [13, 4], [19, 4]],
].map((route) => route.map(([col, row]) => ({ col, row })));
```

`getStageDefinition`은 `normalizeStageKey(value)`로 `Map<StageKey, StageDefinition>`을 조회한다. `STAGE_IDS`, `StageId`, `normalizeStageId`는 기존 테스트와 v3 migration 전용 호환 export로 유지한다.

- [ ] **Step 7: 승인 전 신규 적 asset slot은 null fallback으로 유지**

`ENEMY_SPRITES`는 노멀 타입만 갖는 `Partial<Record<EnemyType, Readonly<Record<SpriteDirection, string>>>>`로 바꾸고, `loadGameAssets()` 결과에는 다음 방향 슬롯을 추가한다.

```ts
const EMPTY_DIRECTIONS: DirectionalSprites = { ne: null, se: null, sw: null, nw: null };

enemies: {
  slime,
  fairy,
  orc,
  golem,
  minotaur,
  shadowSlime: EMPTY_DIRECTIONS,
  vampireBat: EMPTY_DIRECTIONS,
  skeletonKnight: EMPTY_DIRECTIONS,
  obsidianGolem: EMPTY_DIRECTIONS,
  lichKing: EMPTY_DIRECTIONS,
},
```

`GameApp.ts`의 `EMPTY_ASSETS`와 `tests/game/renderTestUtils.ts`에도 같은 null 또는 tagged fixture 슬롯을 추가한다. 이 단계에서는 신규 URL을 만들지 않는다.

- [ ] **Step 8: 관련 테스트와 전체 빌드 확인**

Run: `npx vitest run tests/game/stages.test.ts tests/game/waves.test.ts tests/game/enemies.test.ts tests/game/assetLoader.test.ts tests/game/spriteManifest.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: TypeScript와 Vite production build PASS.

- [ ] **Step 9: Task 1 커밋**

```bash
git add src/game/stages src/game/waves src/game/enemies/enemyCatalog.ts \
  src/game/render/spriteManifest.ts src/game/render/assetLoader.ts \
  src/app/GameApp.ts tests/game
git commit -m "feat: add nightmare stage catalog"
```

---

### Task 2: preferences v4 이전과 모드별 기록

**Files:**
- Modify: `src/app/preferences.ts:1-194`
- Modify: `src/app/GameApp.ts:226-466`
- Test: `tests/app/preferences.test.ts`

**Interfaces:**
- Consumes: `StageKey`, `StageNumber`, `normalizeStageKey`, `stageRef`
- Produces: `GamePreferences`, `StageRecord`, `defaultPreferences`, `stageRecordFor`, `isStageUnlocked`
- Produces: `recordOutcome(storage, result, current): Readonly<{ preferences: GamePreferences; newBestScore: boolean; unlockedStageKey: StageKey | null; newBadge: boolean }>`
- Preserves: v3, v2, v1 fallback read order

- [ ] **Step 1: v3→v4와 승패 기록 실패 테스트 작성**

```ts
it('migrates v3 normal records without unlocking nightmare from stage five', () => {
  const storage = storageWith({
    'huchu-defense.preferences.v3': JSON.stringify({
      muted: true,
      totalAttempts: 9,
      totalVictories: 5,
      highestUnlockedStage: 6,
      stageRecords: {
        1: { bestScore: 8200, bestClearSeconds: 95 },
        6: { bestScore: 4000, bestClearSeconds: null },
      },
    }),
  });
  const preferences = loadPreferences(storage);
  expect(preferences.highestUnlockedByMode).toEqual({ normal: 6, nightmare: 0 });
  expect(stageRecordFor(preferences, 'normal-1')).toEqual({
    bestScore: 8200,
    bestClearScore: 8200,
    bestClearSeconds: 95,
    bestStars: 2,
    bossDefeated: true,
  });
});

it('unlocks nightmare one only after a normal six victory', () => {
  const result = recordOutcome(storageWith({}), {
    stageKey: 'normal-6',
    score: 11_000,
    stars: 3,
    bossDefeated: true,
    victory: true,
    elapsedSeconds: 120,
  }, {
    ...defaultPreferences(),
    highestUnlockedByMode: { normal: 6, nightmare: 0 },
  });
  expect(result.preferences.highestUnlockedByMode.nightmare).toBe(1);
  expect(result.unlockedStageKey).toBe('nightmare-1');
});

it('records defeat score but not clear fields or stars', () => {
  const result = recordOutcome(storageWith({}), {
    stageKey: 'nightmare-1',
    score: 17_000,
    stars: 0,
    bossDefeated: false,
    victory: false,
    elapsedSeconds: 300,
  }, {
    ...defaultPreferences(),
    highestUnlockedByMode: { normal: 6, nightmare: 1 },
  });
  expect(stageRecordFor(result.preferences, 'nightmare-1')).toEqual({
    bestScore: 17_000,
    bestClearScore: 0,
    bestClearSeconds: null,
    bestStars: 0,
    bossDefeated: false,
  });
});
```

- [ ] **Step 2: 현재 v3 shape 때문에 테스트가 실패하는지 확인**

Run: `npx vitest run tests/app/preferences.test.ts`

Expected: FAIL with missing v4 fields or `stageKey`.

- [ ] **Step 3: v4 기본값·정규화·v3 이전 구현**

```ts
export type StarRating = 0 | 1 | 2 | 3;
export type StageRecord = Readonly<{
  bestScore: number;
  bestClearScore: number;
  bestClearSeconds: number | null;
  bestStars: StarRating;
  bossDefeated: boolean;
}>;

export type GamePreferences = Readonly<{
  muted: boolean;
  totalAttempts: number;
  totalVictories: number;
  highestUnlockedByMode: Readonly<{
    normal: StageNumber;
    nightmare: 0 | StageNumber;
  }>;
  stageRecords: Partial<Record<StageKey, StageRecord>>;
  badges: readonly 'abyss-guardian'[];
}>;

const PREFERENCES_KEY = 'huchu-defense.preferences.v4';
const V3_PREFERENCES_KEY = 'huchu-defense.preferences.v3';

export function defaultPreferences(): GamePreferences {
  return {
    muted: false,
    totalAttempts: 0,
    totalVictories: 0,
    highestUnlockedByMode: { normal: 1, nightmare: 0 },
    stageRecords: {},
    badges: [],
  };
}
```

v3 clear record의 별은 `bestScore >= 10000 ? 3 : bestScore >= 7000 ? 2 : 1`로 파생한다. `stageRecords['normal-6'].bestClearSeconds !== null`인 경우에만 nightmare 최고 해금을 1로 둔다. v4 JSON이 손상되면 안전한 기본값으로 돌아가고, 쓰기 실패 시 메모리 결과는 계속 반환한다.

- [ ] **Step 4: 모드별 해금·배지와 멱등 기록 구현**

```ts
export function isStageUnlocked(
  preferences: GamePreferences,
  value: unknown,
): boolean {
  const { mode, number } = stageRef(value);
  return number <= preferences.highestUnlockedByMode[mode];
}

export function stageRecordFor(
  preferences: GamePreferences,
  value: unknown,
): StageRecord {
  return preferences.stageRecords[normalizeStageKey(value)] ?? {
    bestScore: 0,
    bestClearScore: 0,
    bestClearSeconds: null,
    bestStars: 0,
    bossDefeated: false,
  };
}
```

`recordOutcome`은 승리 시 같은 mode의 다음 번호를 해금한다. `normal-6` 승리만 `nightmare-1`을 열고, `nightmare-6` 승리만 중복 없는 `abyss-guardian` 배지를 추가한다.

- [ ] **Step 5: 기존 GameApp을 v4 저장 shape에 맞추되 선택 UI는 노멀로 유지**

`selectedStageId`는 이 Task 동안 숫자를 유지한다. 기존 호출을 다음처럼 v4 helper로 연결한다.

```ts
let selectedStageId = preferences.highestUnlockedByMode.normal;

const normalRecords = Object.fromEntries(
  STAGE_IDS.map((id) => [id, stageRecordFor(preferences, `normal-${id}`)]),
);

recordOutcome(storage, {
  stageKey: `normal-${game.stageId}`,
  score: score.total,
  stars: score.stars,
  bossDefeated: game.stats.bossDefeated,
  victory: outcome === 'victory',
  elapsedSeconds,
}, preferences);
```

- [ ] **Step 6: preference 테스트와 build 확인**

Run: `npx vitest run tests/app/preferences.test.ts tests/app/hud.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: Task 2 커밋**

```bash
git add src/app/preferences.ts src/app/GameApp.ts tests/app/preferences.test.ts tests/app/hud.test.ts
git commit -m "feat: migrate progression records to v4"
```

---

### Task 3: 런타임 StageKey와 노멀·나이트메어 선택 화면

**Files:**
- Modify: `src/game/simulation/createGame.ts:1-111`
- Modify: `src/game/combat/targeting.ts:1-49`
- Modify: `src/game/simulation/placeTower.ts:1-47`
- Modify: `src/game/simulation/updateWaves.ts:1-103`
- Modify: `src/game/simulation/updateEnemies.ts:1-37`
- Modify: `src/game/simulation/updateGame.ts:1-38`
- Modify: `src/game/combat/updateSlow.ts:1-27`
- Modify: `src/game/combat/updateTowers.ts:1-38`
- Modify: `src/game/combat/updateProjectiles.ts:1-64`
- Modify: `src/game/render/canvasRenderer.ts:1-137`
- Modify: `src/game/render/drawEntities.ts:1-321`
- Modify: `src/game/render/drawEffects.ts:1-322`
- Modify: `src/app/hud.ts:1-568`
- Modify: `src/app/GameApp.ts:1-659`
- Modify: `src/styles.css:340-660`
- Test: `tests/game/stageSimulation.test.ts`
- Test: `tests/game/placement.test.ts`
- Test: `tests/app/hud.test.ts`
- Test: `tests/game/renderer.test.ts`
- Test: `tests/app/gameRuntime.test.ts`

**Interfaces:**
- Consumes: stage catalog and preferences v4
- Produces: `GameState.stageKey: StageKey`
- Produces: `createGame(stageKey?: unknown): GameState`
- Produces: `createStageSelectView(mode, selectedStageKey, preferences)`
- Produces: HUD elements `modeTabs`, `stageButtons: Record<StageKey, HTMLButtonElement>`

- [ ] **Step 1: 런타임 경제와 선택 탭 실패 테스트 작성**

```ts
it('starts nightmare with its own economy and stable key', () => {
  const state = createGame('nightmare-3');
  expect(state.stageKey).toBe('nightmare-3');
  expect(state.gold).toBe(280);
  expect(state.baseHp).toBe(12);
});

it('shows only the active mode six-card set and separate records', () => {
  const view = createStageSelectView(
    'nightmare',
    'nightmare-1',
    {
      ...defaultPreferences(),
      highestUnlockedByMode: { normal: 6, nightmare: 1 },
      stageRecords: {
        'normal-1': clearedRecord(9000),
        'nightmare-1': clearedRecord(23000, 3),
      },
    },
  );
  expect(view).toHaveLength(6);
  expect(view[0]).toMatchObject({
    key: 'nightmare-1',
    name: '달빛 늪',
    selected: true,
    locked: false,
  });
  expect(view[0].recordText).toContain('★★★');
});
```

- [ ] **Step 2: 현재 숫자 stage runtime으로 테스트가 실패하는지 확인**

Run: `npx vitest run tests/game/stageSimulation.test.ts tests/app/hud.test.ts`

Expected: FAIL with missing `stageKey`, mode argument or tab elements.

- [ ] **Step 3: GameState와 모든 stage lookup을 StageKey로 전환**

```ts
export type GameState = {
  stageKey: StageKey;
  elapsedSeconds: number;
  gold: number;
  baseHp: number;
  outcome: Outcome;
  enemies: GameEnemy[];
  nextEnemyId: number;
  towers: GameTower[];
  nextTowerId: number;
  projectiles: GameProjectile[];
  nextProjectileId: number;
  hitEvents: GameHitEvent[];
  wave: WaveState;
  bossSpawnedAtSeconds: number | null;
  stats: {
    defeatedEnemies: number;
    leakedEnemies: number;
    completedWaves: number;
    bossDefeated: boolean;
  };
};

export function createGame(value: unknown = DEFAULT_STAGE_KEY): GameState {
  const stage = getStageDefinition(value);
  return {
    stageKey: stage.key,
    elapsedSeconds: 0,
    gold: stage.startingGold,
    baseHp: stage.baseHp,
    outcome: 'playing',
    enemies: [],
    nextEnemyId: 1,
    towers: [],
    nextTowerId: 1,
    projectiles: [],
    nextProjectileId: 1,
    hitEvents: [],
    wave: {
      index: 0,
      groupIndex: 0,
      spawnedInGroup: 0,
      spawnCooldown: 0,
      delayRemaining: 0,
      delayActive: false,
      allSpawned: false,
    },
    bossSpawnedAtSeconds: null,
    stats: {
      defeatedEnemies: 0,
      leakedEnemies: 0,
      completedWaves: 0,
      bossDefeated: false,
    },
  };
}
```

`state.stageId`, snapshot `stageId`, 함수 인자 `stageId`를 `stageKey`로 일괄 변경한다. `enemyPosition`, `selectTarget`, renderer snapshot과 HUD input도 동일한 `StageKey`를 받는다. 숫자 호환은 `getStageDefinition` 경계에만 남긴다.

- [ ] **Step 4: 모드 탭과 12개 카드 DOM 구현**

```html
<div class="stage-mode-tabs" role="tablist" aria-label="난이도 선택">
  <button class="game-control stage-mode-tab" data-mode="normal"
    role="tab" aria-selected="true">노멀</button>
  <button class="game-control stage-mode-tab" data-mode="nightmare"
    role="tab" aria-selected="false">나이트메어</button>
</div>
<div class="stage-picker" data-stage-picker aria-label="스테이지 선택">
  ${ALL_STAGE_KEYS.map((key) => {
    const stage = getStageDefinition(key);
    return `<button class="game-control stage-picker__button"
      data-stage-key="${key}" data-mode="${stage.mode}" data-stage-status="locked"
      type="button" aria-label="${stage.mode} 스테이지 ${stage.number} ${stage.name} 잠김"
      aria-pressed="false" hidden>
      <span class="stage-picker__number">STAGE ${stage.number}</span>
      <strong class="stage-picker__name">${stage.name}</strong>
      <span class="stage-picker__status">잠김</span>
      <small class="stage-picker__record">잠김</small>
    </button>`;
  }).join('')}
</div>
```

`HudElements`에 다음을 추가한다.

```ts
modeTabs: Readonly<Record<GameMode, HTMLButtonElement>>;
stageButtons: Readonly<Record<StageKey, HTMLButtonElement>>;
badge: HTMLElement;
```

`createStageSelectView`는 `StageSelectItem.key`, `mode`, `number`, `bestStars`를 반환한다. 잠긴 나이트메어 탭은 보이지만 `normal-6` 미클리어 상태에서 `aria-disabled="true"`와 안내 문구를 제공한다.

- [ ] **Step 5: GameApp 선택·다음 스테이지 이동 구현**

```ts
let selectedStageKey: StageKey = preferences.highestUnlockedByMode.nightmare > 0
  ? `nightmare-${preferences.highestUnlockedByMode.nightmare}`
  : `normal-${preferences.highestUnlockedByMode.normal}`;
let activeMode: GameMode = stageRef(selectedStageKey).mode;
```

모드 탭은 ready/victory/defeat에서만 바꾼다. 나이트메어가 잠긴 상태에서 누르면 선택은 유지하고 `노멀 6을 클리어하면 열려요.`를 표시한다. 카드 클릭은 `isStageUnlocked`을 다시 검사한다. 승리 후 `recordOutcome.unlockedStageKey`가 있으면 그 키를 선택하고 선택 화면으로 돌아온다.

- [ ] **Step 6: 탭·카드 CSS 구현**

```css
.stage-mode-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 10px;
}
.stage-mode-tab[aria-selected="true"] {
  border-color: var(--md-sys-color-primary);
  background: #245f5c;
}
.stage-mode-tab[data-mode="nightmare"][aria-selected="true"] {
  border-color: #c997ff;
  background: #3a2352;
}
.stage-picker__button[hidden] { display: none; }
.stage-picker__button[data-mode="nightmare"] {
  background: #261c35;
}
```

844×390에서 탭과 3×2 카드가 panel 안에 스크롤 없이 들어가도록 landscape media query의 카드 높이와 간격을 유지한다.

- [ ] **Step 7: StageKey 관련 테스트와 전체 build 확인**

Run: `npx vitest run tests/game/stageSimulation.test.ts tests/game/placement.test.ts tests/app/hud.test.ts tests/game/renderer.test.ts tests/app/gameRuntime.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS and no `stageId` reference except legacy migration/tests.

Run: `rg -n "stageId|StageId" src`

Expected: only explicitly documented v3/number compatibility paths.

- [ ] **Step 8: Task 3 커밋**

```bash
git add src/app src/game tests/app tests/game src/styles.css
git commit -m "feat: add normal and nightmare stage selection"
```

---

### Task 4: 신규 적 특성·엘리트·리치 왕 2페이즈

**Files:**
- Create: `src/game/enemies/enemyTraits.ts`
- Create: `tests/game/nightmareTraits.test.ts`
- Modify: `src/game/simulation/createGame.ts`
- Modify: `src/game/simulation/updateWaves.ts`
- Modify: `src/game/simulation/updateEnemies.ts`
- Modify: `src/game/simulation/updateGame.ts`
- Modify: `src/game/combat/updateProjectiles.ts`
- Modify: `src/game/combat/updateSlow.ts`
- Modify: `tests/game/combat.test.ts`
- Modify: `tests/game/enemies.test.ts`
- Modify: `tests/game/outcome.test.ts`

**Interfaces:**
- Produces: `EnemyTraitVisualEvent`
- Produces: `applyEnemyDamage(state, enemy, damage)`
- Produces: `updateEnemyTraits(state, dt)`
- Produces: `spawnEnemy(state, type, waveIndex, variant?)`
- Produces: `GameState.stats.combatScore`

- [ ] **Step 1: 방패·분열·저항·오라·2페이즈 실패 테스트 작성**

```ts
it('blocks exactly three damage events before the skeleton takes damage', () => {
  const state = createGame('nightmare-1');
  spawnEnemy(state, 'skeletonKnight', 0);
  const enemy = state.enemies[0];
  for (let hit = 0; hit < 3; hit += 1) applyEnemyDamage(state, enemy, 72);
  expect(enemy.hp).toBe(enemy.maxHp);
  expect(enemy.shieldHitsRemaining).toBe(0);
  applyEnemyDamage(state, enemy, 72);
  expect(enemy.hp).toBe(enemy.maxHp - 72);
  expect(state.traitEvents.map(({ kind }) => kind)).toEqual([
    'shield-open', 'shield-block', 'shield-block', 'shield-break', 'damage',
  ]);
});

it('splits a killed parent once and preserves family reward and score', () => {
  const state = createGame('nightmare-1');
  spawnEnemy(state, 'shadowSlime', 0);
  state.enemies[0].progress = 4;
  state.enemies[0].hp = 0;
  updateEnemies(state, 0);
  expect(state.enemies).toHaveLength(2);
  expect(state.enemies.every(({ variant }) => variant === 'split-child')).toBe(true);
  expect(state.enemies.every(({ maxHp }) => maxHp === 90 * 0.35)).toBe(true);
  expect(state.gold).toBe(283);
  expect(state.stats.combatScore).toBe(15);
});

it('reduces the slow strength by half for vampire bats', () => {
  const state = createGame('nightmare-1');
  placeTower(state, 'slow', { col: 0, row: 6 });
  spawnEnemy(state, 'vampireBat', 0);
  updateSlow(state);
  expect(state.enemies[0].slowMultiplier).toBeCloseTo(0.81);
});

it('applies a non-stacking lich aura and enters phase two once on nightmare six', () => {
  const state = createGame('nightmare-6');
  spawnEnemy(state, 'lichKing', 9);
  spawnEnemy(state, 'obsidianGolem', 9);
  const lich = state.enemies[0];
  lich.auraCooldownRemaining = 0;
  updateEnemyTraits(state, 0.1);
  expect(state.enemies[1].auraMultiplier).toBe(1.2);
  lich.hp = lich.maxHp * 0.49;
  updateEnemyTraits(state, 0.1);
  updateEnemyTraits(state, 0.1);
  expect(lich.lichPhase).toBe(2);
  expect(state.traitEvents.filter(({ kind }) => kind === 'lich-phase-two')).toHaveLength(1);
});
```

- [ ] **Step 2: 특성 함수 부재로 테스트가 실패하는지 확인**

Run: `npx vitest run tests/game/nightmareTraits.test.ts`

Expected: FAIL with missing module or fields.

- [ ] **Step 3: 적 runtime state와 visual event 추가**

```ts
export type EnemyTraitVisualEvent = Readonly<{
  kind:
    | 'shield-open' | 'shield-block' | 'shield-break'
    | 'damage' | 'split' | 'slow-resist'
    | 'armor-crack' | 'lich-aura' | 'lich-phase-two';
  enemyId: number;
  position: Readonly<Vec2>;
  radius?: number;
}>;

export type GameEnemy = {
  id: number;
  type: EnemyType;
  variant: EnemyVariant;
  hp: number;
  maxHp: number;
  progress: number;
  baseSpeed: number;
  slowMultiplier: number;
  auraMultiplier: number;
  auraRemaining: number;
  reward: number;
  leak: number;
  combatScore: number;
  boss: boolean;
  splitGeneration: 0 | 1;
  shieldHitsRemaining: number;
  lastSlowResistEffectAtSeconds: number | null;
  armorStage: 0 | 1 | 2;
  auraCooldownRemaining: number;
  lichPhase: 1 | 2;
  rewarded: boolean;
  lastHitAtSeconds: number | null;
};
```

`GameState`에는 `traitEvents: EnemyTraitVisualEvent[]`와 `stats.combatScore`를 추가한다. `updateGame` 시작 시 hit event와 trait event를 모두 비운다.

- [ ] **Step 4: variant를 포함한 spawn 구현**

엘리트는 HP 1.8, 속도 1.05, 보상 1.5, combatScore +100을 적용한다. stage reward multiplier는 spawn 시 한 번만 적용한다.

```ts
const hpMultiplier = variant === 'elite' ? 1.8 : 1;
const speedMultiplier = variant === 'elite' ? 1.05 : 1;
const rewardMultiplier = variant === 'elite' ? 1.5 : 1;
const scaledHp = definition.hp
  * stage.hpMultiplier
  * (1 + waveIndex * 0.08)
  * hpMultiplier;
```

해골은 `shieldHitsRemaining: 3`, 리치 왕은 `auraCooldownRemaining: 7`, 다른 적은 0으로 시작한다. 해골을 생성할 때 `shield-open`을 정확히 한 번 발행해 특성 개방 애니메이션을 시작한다. boss spawn 시간은 타입명 비교 대신 `definition.boss`로 기록한다.

- [ ] **Step 5: 공용 피해와 둔화 저항 구현**

`applyEnemyDamage`는 죽은 적과 0 이하 피해를 무시한다. 방패가 남았으면 HP를 바꾸지 않고 횟수를 감소시킨다. 2회 이하에서는 `shield-block`, 0이 되는 타격에서는 `shield-break`를 발행한다. 방패가 없으면 HP와 `lastHitAtSeconds`를 갱신하고 `damage`를 발행한다.

`updateProjectiles`의 private `applyDamage`를 제거하고 모든 직접·스플래시 피해를 이 함수로 보낸다.

`updateSlow`은 매 tick `slowMultiplier = 1`로 초기화한다. 뱀파이어 박쥐에는 다음 공식을 적용한다.

```ts
const requested = definition.multiplier ?? 1;
const resistance = enemy.type === 'vampireBat' ? 0.5 : 0;
const effective = 1 - (1 - requested) * (1 - resistance);
enemy.slowMultiplier = Math.min(enemy.slowMultiplier, effective);
```

`slow-resist` 이벤트는 마지막 표시 후 0.8초가 지났을 때만 발행한다.

- [ ] **Step 6: 분열·보상·armor·오라 구현**

`updateEnemies`는 제거 배열과 child spawn 배열을 분리한다. 그림자 슬라임 본체가 죽으면 reward 3G와 15점을 지급하고 다음 child spec 두 개를 같은 progress에 만든다.

```ts
{
  variant: 'split-child',
  splitGeneration: 1,
  maxHp: parent.maxHp * 0.35,
  hp: parent.maxHp * 0.35,
  baseSpeed: parent.baseSpeed * 1.25,
  reward: 2,
  combatScore: 5,
  leak: 1,
}
```

자식은 분열하지 않는다. 골렘은 HP 비율 0.60, 0.30을 처음 통과할 때 `armor-crack`을 발행한다.

`updateEnemyTraits`는 aura 남은 시간을 줄이고 0이면 multiplier를 1로 되돌린다. 살아 있는 리치 왕 cooldown이 0이면 자신을 제외한 거리 2.7 이내 적에게 3초, 1.2배를 적용한다. `nightmare-6` 리치 왕이 50% 아래로 내려가면 한 번만 phase 2가 되어 cooldown 4.5초, buff 3.5초·1.3배, leak 12를 사용한다.

- [ ] **Step 7: update 순서와 범용 boss 처리**

```ts
updateSlow(state);
updateTowers(state, safeDt);
updateProjectiles(state, safeDt);
updateEnemyTraits(state, safeDt);
updateEnemies(state, safeDt);
updateWaves(state, clearedCompletedWave ? 0 : safeDt);
```

죽은 리치 왕은 오라를 발동하지 않는다. `updateEnemies`는 `enemy.boss`로 `bossDefeated`를 기록한다. 이동량은 `baseSpeed × stage.speedMultiplier × slowMultiplier × auraMultiplier × dt`다.

- [ ] **Step 8: 특성·기존 전투 회귀 테스트**

Run: `npx vitest run tests/game/nightmareTraits.test.ts tests/game/combat.test.ts tests/game/enemies.test.ts tests/game/outcome.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 9: Task 4 커밋**

```bash
git add src/game/enemies src/game/simulation src/game/combat tests/game
git commit -m "feat: add nightmare enemy traits"
```

---

### Task 5: 나이트메어 점수·별·결과 기록

**Files:**
- Modify: `src/game/scoring.ts:1-42`
- Modify: `src/app/preferences.ts`
- Modify: `src/app/hud.ts:450-498`
- Modify: `src/app/GameApp.ts:341-466`
- Test: `tests/game/scoring.test.ts`
- Test: `tests/app/preferences.test.ts`
- Test: `tests/app/hud.test.ts`

**Interfaces:**
- Consumes: `GameState.stats.combatScore`, stage score thresholds
- Produces: `StarRating = 0 | 1 | 2 | 3`
- Produces: `GameScore.breakdown.combatScore`, `difficultyBonus`
- Preserves: 노멀 총점 숫자

- [ ] **Step 1: 노멀 호환·나이트메어 배율·패배 0별 테스트 작성**

```ts
it('keeps the approved normal victory total', () => {
  const game = createGame('normal-1');
  game.stats.completedWaves = 10;
  game.stats.defeatedEnemies = 70;
  game.stats.bossDefeated = true;
  game.baseHp = 20;
  expect(calculateGameScore(game, 'victory', 100).total).toBe(12_750);
});

it('uses threat score and the 1.5 nightmare multiplier', () => {
  const game = createGame('nightmare-1');
  game.stats.completedWaves = 10;
  game.stats.combatScore = 7_095;
  game.stats.bossDefeated = true;
  game.baseHp = 8;
  const score = calculateGameScore(game, 'victory', 360);
  expect(score.breakdown).toEqual({
    waveScore: 5000,
    combatScore: 7095,
    hpScore: 800,
    bossScore: 1500,
    timeBonus: 1200,
    difficultyBonus: 7797,
  });
  expect(score.total).toBe(23_392);
  expect(score.stars).toBe(3);
});

it('awards zero stars and no time bonus on defeat', () => {
  const game = createGame('nightmare-1');
  game.stats.completedWaves = 6;
  game.stats.combatScore = 3000;
  game.baseHp = 0;
  const score = calculateGameScore(game, 'defeat', 200);
  expect(score.stars).toBe(0);
  expect(score.breakdown.timeBonus).toBe(0);
});
```

- [ ] **Step 2: 현재 단순 kill score로 실패하는지 확인**

Run: `npx vitest run tests/game/scoring.test.ts`

Expected: FAIL on combat score, multiplier, or 0-star contract.

- [ ] **Step 3: mode별 계산 구현**

```ts
const combatScore = stage.mode === 'nightmare'
  ? Math.max(0, Math.floor(game.stats.combatScore))
  : Math.max(0, Math.floor(game.stats.defeatedEnemies)) * 25;
const subtotal = waveScore + combatScore + hpScore + bossScore + timeBonus;
const total = Math.floor(subtotal * stage.scoreMultiplier);
const difficultyBonus = total - subtotal;
const stars: StarRating = outcome !== 'victory'
  ? 0
  : total >= stage.threeStarScore ? 3
    : total >= stage.twoStarScore ? 2 : 1;
```

`nextStarScore`는 패배 또는 1별이면 `twoStarScore`, 2별이면 `threeStarScore`, 3별이면 null이다.

- [ ] **Step 4: 결과와 기록 UI 확장**

`ResultPanelView`에 `modeLabel`, `stageName`, `combatScore`, `difficultyBonus`, `newBadge`, `stars: StarRating`을 추가한다. 나이트메어에서는 `나이트메어 보너스 ×1.5`와 실제 bonus 숫자를 표시한다. 패배 0별은 `☆☆☆`로 렌더한다.

`GameApp.onOutcome`은 score의 stars와 boss flag를 `recordOutcome`에 전달하고, 결과 패널은 저장 완료 후의 해당 `StageKey` record를 읽는다.

- [ ] **Step 5: 점수·저장·HUD 테스트**

Run: `npx vitest run tests/game/scoring.test.ts tests/app/preferences.test.ts tests/app/hud.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Task 5 커밋**

```bash
git add src/game/scoring.ts src/app/preferences.ts src/app/hud.ts src/app/GameApp.ts \
  tests/game/scoring.test.ts tests/app/preferences.test.ts tests/app/hud.test.ts
git commit -m "feat: score nightmare runs separately"
```

---

### Task 6: 폴백 다크 맵과 특성 애니메이션 파이프라인

**Files:**
- Modify: `src/game/render/effects.ts:1-151`
- Modify: `src/game/render/drawEffects.ts:1-322`
- Modify: `src/game/render/drawEntities.ts:1-321`
- Modify: `src/game/render/drawMap.ts:1-202`
- Modify: `src/game/render/canvasRenderer.ts:1-137`
- Modify: `src/app/GameApp.ts:283-339`
- Modify: `src/styles.css:658-660`
- Test: `tests/game/effects.test.ts`
- Test: `tests/game/renderer.test.ts`
- Test: `tests/game/mapRendering.test.ts`

**Interfaces:**
- Consumes: `GameState.traitEvents`, `StageDefinition.themeId`
- Produces: trait `RuntimeEffect` variants
- Produces: `FrameEventBuffer` preserving hit and trait events across fixed steps
- Produces: primitive fallback visuals; final PNG integration is Task 9

- [ ] **Step 1: trait event buffer와 테마 렌더 실패 테스트 작성**

```ts
it('buffers trait events across fixed steps and clears them after render', () => {
  const buffer = createFrameEventBuffer();
  buffer.recordStep({
    hitEvents: [],
    traitEvents: [{
      kind: 'shield-break',
      enemyId: 1,
      position: { x: 2.5, y: 3.5 },
    }],
    shot: false,
    leak: false,
  });
  expect(buffer.peek().traitEvents.map(({ kind }) => kind)).toEqual(['shield-break']);
  buffer.clear();
  expect(buffer.peek().traitEvents).toEqual([]);
});

it('uses a dark palette for nightmare without changing normal map colors', () => {
  const normalCalls = renderStage('normal-1');
  const nightmareCalls = renderStage('nightmare-1');
  expect(normalCalls.some(({ fillStyle }) => fillStyle === '#4f8c65')).toBe(true);
  expect(nightmareCalls.some(({ fillStyle }) => fillStyle === '#18243a')).toBe(true);
});
```

- [ ] **Step 2: 현재 buffer와 hardcoded palette로 실패하는지 확인**

Run: `npx vitest run tests/game/effects.test.ts tests/game/mapRendering.test.ts`

Expected: FAIL.

- [ ] **Step 3: trait event를 RuntimeEffect로 변환**

`RuntimeEffect`에 다음 kind를 추가한다.

```ts
'shield-open' | 'shield-block' | 'shield-break'
| 'split-burst' | 'slow-resist' | 'armor-crack'
| 'lich-aura' | 'lich-phase-two'
```

duration은 차례로 0.35, 0.12, 0.24, 0.40, 0.28, 0.35, 0.40, 0.80초를 사용한다. `effectsForTraits(events)`가 position, radius를 복사하고 잘못된 좌표를 제외한다.

`FrameEventBuffer.recordStep`은 trait events도 deep-copy하고 `GameApp`은 `effectsForTraits(frame.traitEvents)`를 기존 effect list에 합친다.

- [ ] **Step 4: 승인 전 primitive fallback 효과 구현**

- 방패: 정면 적 중심의 반투명 청보라 타원, open은 scale-up, block은 flash, break는 6개 조각
- 분열: 좌우로 벌어지는 두 개의 보라색 방울
- 둔화 저항: 보라색 wing flash와 끊어진 청색 ring
- armor crack: 주황색 짧은 선 3개
- lich aura: `projectWorldRing`으로 실제 2.7칸 반경
- phase two: game area 비네트와 중앙 충격파

primitive 효과는 PNG가 null일 때만 사용하며 전투 판정을 포함하지 않는다.

- [ ] **Step 5: 신규 적 폴백 정면 실루엣과 generic boss HP**

`ENEMY_SIZES`, `ENEMY_COLORS`, fallback label에 신규 5종을 추가한다. `drawEnemyHp`는 `enemy.boss`로 판단하고 리치 왕도 항상 보라색 HP를 표시한다. 자식은 부모 sprite를 70% 크기로, 엘리트는 110% 크기로 그린다.

- [ ] **Step 6: stage theme palette와 시작·보스 연출**

`drawMap`은 `StageDefinition` 또는 `StageTheme`을 받아 다음 ground/land/road 팔레트를 선택한다.

```ts
const NIGHTMARE_PALETTES = {
  moonlitSwamp:   { ground: '#0f1728', land: '#18243a', alternate: '#1d3040', road: '#485064' },
  rottenForest:   { ground: '#111914', land: '#243326', alternate: '#2b3b2a', road: '#51534b' },
  ashenRuins:     { ground: '#171719', land: '#343438', alternate: '#3b3b40', road: '#625f62' },
  bloodRavine:    { ground: '#211012', land: '#482326', alternate: '#54282d', road: '#6a4a49' },
  obsidianMine:   { ground: '#100f15', land: '#28242e', alternate: '#302936', road: '#554b58' },
  abyssGate:      { ground: '#0c0714', land: '#241530', alternate: '#2d193d', road: '#4a3a58' },
} as const;
```

나이트메어 시작 0.6초 동안 `NIGHTMARE · 스테이지명`을 표시하되 입력을 막지 않는다. `bossSpawnedAtSeconds` 연출 문구는 리치 왕에서 `리치 왕이 나타났어요!`로 바꾼다. reduced motion이면 비네트 alpha와 파편 수를 50% 줄인다.

`drawStageAtmosphere`는 stage theme과 `timeSeconds`만으로 재현 가능한 장식 layer를 그린다. 달빛 늪은 청록 안개, 썩은 숲은 보라 포자, 잿빛 폐허는 재, 핏빛 협곡은 붉은 안개, 흑요석 광산은 주황 불씨, 심연의 성문은 검보라 비네트를 사용한다. 움직이는 입자는 화면당 최대 12개, reduced motion에서는 최대 6개로 제한하고 길·배치 가이드보다 낮은 alpha로 그린다.

- [ ] **Step 7: 폴백 렌더 테스트와 build 확인**

Run: `npx vitest run tests/game/effects.test.ts tests/game/renderer.test.ts tests/game/mapRendering.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS with no missing candidate image imports.

- [ ] **Step 8: Task 6 커밋**

```bash
git add src/game/render src/app/GameApp.ts src/styles.css tests/game
git commit -m "feat: render nightmare themes and trait cues"
```

---

### Task 7: 2D 신규 적 도안 생성과 승인 게이트

**Files:**
- Create: `assets/concepts/nightmare-v1/nightmare-enemy-lineup-v1.png`
- Create: `assets/concepts/nightmare-v1/nightmare-enemy-lineup-mobile-v1.png`
- Create: `docs/assets/nightmare-concepts-v1.md`

**Interfaces:**
- Consumes: 승인된 enemy proportions and colors from the design spec
- Produces: Blender 입력으로 사용할 승인된 정면 라인업
- Gate: 사용자 승인 없이는 Task 8을 시작하지 않는다.

- [ ] **Step 1: imagegen으로 정면 라인업 생성**

Use the `imagegen` skill and `image_gen.imagegen` with no unrelated reference image. Exact prompt:

```text
Create one clean 2D character-design lineup sheet for a cute mobile tower-defense game.
Show exactly five original front-facing voxel-inspired low-poly characters on a neutral
light gray review background, evenly spaced, full body, no environment, no text:
1) Shadow Slime: small translucent deep-purple cube-like slime, cyan eyes, compact silhouette.
2) Vampire Bat: tiny dark plum bat, large expressive face, broad readable wings.
3) Skeleton Knight: cute narrow skeleton, round dark shield held front-left, short sword,
   shield must not hide the face.
4) Obsidian Golem: heavy black-purple block body with restrained orange cracks,
   large but fits one tile.
5) Lich King: floating small-bodied boss with a large expressive skull face, purple crown,
   short robe, no legs touching the ground.
Use chibi proportions with emphasized faces but keep heads and bodies balanced.
All silhouettes must remain readable at 128px. No Minecraft textures, logos, weapons from
existing franchises, projectile balls, drop shadows, frames, labels, boxes, or individual halos.
Use one flat neutral light-gray review-sheet background behind the entire lineup.
Include a small inset row beneath them showing: small split slime, elite red-rune variant,
shield opening key pose, slime split key pose, slow-resist flash key pose, lich aura key pose.
```

`imagegen` 결과의 `output_hint`가 가리키는 실제 로컬 파일을 원본으로 사용해 정확한 target path에 복사한다. 출력 경로를 추측하거나 새 이름을 임의로 만들지 않는다.

- [ ] **Step 2: 원본을 직접 확인하고 모바일 검수본 생성**

Use `view_image` on the generated file. Reject it before user review if the count is not exactly five, a character is not front-facing, the shield hides the face, a background is baked into a character, or silhouettes collapse at small size.

Create a mobile-width review copy with maximum dimension 844px while preserving aspect ratio and the original:

```bash
sips -Z 844 assets/concepts/nightmare-v1/nightmare-enemy-lineup-v1.png \
  --out assets/concepts/nightmare-v1/nightmare-enemy-lineup-mobile-v1.png
```

- [ ] **Step 3: 승인 문서 작성**

`docs/assets/nightmare-concepts-v1.md`에 두 파일 경로, 생성 prompt, 적별 색·실루엣·128px 판독성 체크리스트와 상태 `사용자 승인 대기`를 기록한다.

- [ ] **Step 4: 사용자에게 두 이미지를 보여 주고 중단**

Provide the full lineup and mobile review crop. Ask for `전체 승인` 또는 수정할 캐릭터 이름. Do not call Blender tools and do not change runtime asset manifests in the same turn.

- [ ] **Step 5: 승인된 2D 도안만 커밋**

After explicit approval, run `date +%F`, write that exact returned date after `사용자 승인 완료:` in the document, and run:

```bash
git add assets/concepts/nightmare-v1 docs/assets/nightmare-concepts-v1.md
git commit -m "art: approve nightmare enemy concepts"
```

---

### Task 8: Blender MCP 모델·동작·맵 키트와 승인 게이트

**Files:**
- Create: `tools/blender/nightmare_assets.py`
- Create: `tools/assets/nightmareAssetContract.mjs`
- Create: `tools/assets/validateNightmareAssets.mjs`
- Create: `tools/assets/buildNightmareApprovalSheet.mjs`
- Create: `tests/assets/nightmareAssetContract.test.ts`
- Create: `docs/assets/nightmare-3d-v1.md`
- Create: `assets/blender/nightmare-enemies-v1.blend`
- Create: `assets/blender/nightmare-map-kit-v1.blend`
- Create: `assets/renders/nightmare-v1/master/**`
- Create: `assets/renders/nightmare-v1/mobile/**`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 7 approved concept image
- Produces: validated transparent sprite sheets and themed map tiles
- Gate: 사용자 승인 없이는 Task 9 manifest integration을 시작하지 않는다.

- [ ] **Step 1: asset contract 실패 테스트 작성**

```ts
it('defines exact nightmare motion and vfx frame contracts', () => {
  expect(NIGHTMARE_ASSETS.filter(({ group }) => group === 'motion')
    .map(({ id, frames }) => [id, frames])).toEqual([
      ['shadow-slime-bounce', 6],
      ['vampire-bat-fly', 8],
      ['skeleton-knight-walk', 6],
      ['obsidian-golem-walk', 6],
      ['lich-king-float', 8],
    ]);
  expect(NIGHTMARE_ASSETS.filter(({ group }) => group === 'vfx')
    .map(({ id, frames }) => [id, frames])).toEqual([
      ['shield-open', 6], ['shield-block', 4], ['shield-break', 6],
      ['split-burst', 6], ['slow-resist', 4], ['lich-aura', 8],
      ['lich-phase-two', 8], ['elite-rune', 4],
    ]);
});

it('defines nine map pieces for each of six themes', () => {
  const maps = NIGHTMARE_ASSETS.filter(({ group }) => group === 'map');
  expect(maps).toHaveLength(54);
  for (const theme of NIGHTMARE_THEME_IDS) {
    expect(maps.filter((asset) => asset.theme === theme)).toHaveLength(9);
  }
});
```

각 테마의 9개 map id는 `ground`, `road-horizontal`, `road-vertical`, 네 corner, `boundary-stone`, `snack-chest`다.

- [ ] **Step 2: asset contract 테스트 실패 확인**

Run: `npx vitest run tests/assets/nightmareAssetContract.test.ts`

Expected: FAIL with missing contract module.

- [ ] **Step 3: manifest·validator·package 명령 구현**

`NIGHTMARE_ASSETS`의 master frame은 256, mobile frame은 128이다. 정적 map은 한 프레임이고 motion/VFX width는 `frameSize × frames`, height는 `frameSize`다.

`validateNightmareAssets.mjs`는 다음을 모두 검사한다.

- 모든 master/mobile 파일 존재
- 정확한 width/height
- 네 모서리 alpha 0
- 중복 id·relativePath 없음
- 전체 mobile runtime 후보 합계 8MB 이하
- 정확히 motion 5, VFX 8, map 54

`package.json`에 다음을 추가한다.

```json
"assets:nightmare:validate": "node tools/assets/validateNightmareAssets.mjs",
"assets:nightmare:sheet": "node tools/assets/buildNightmareApprovalSheet.mjs"
```

- [ ] **Step 4: Blender generator의 exact geometry 계약 구현**

`tools/blender/nightmare_assets.py`는 기존 `redesign_preview.py`의 camera, transparent Film, AgX, source-hash 보호와 별도 collection 패턴을 재사용한다.

캐릭터 primitive 구성:

| 캐릭터 | 주요 primitive |
|---|---|
| 그림자 슬라임 | beveled cube body `(0.72,0.50,0.44)`, eye spheres, 작은 top wobble cube |
| 흡혈 박쥐 | beveled cube head, 작은 body, 좌우 각 3개 triangular wing segment |
| 해골 기사 | skull cube, jaw cube, 5개 rib bar, 원형 beveled shield, 짧은 sword |
| 흑요석 골렘 | 큰 torso cube, 작은 head, 분리된 forearm·shin cubes, emissive crack strips |
| 리치 왕 | skull cube, 3-point crown, 짧은 robe frustum, 두 손, 아래쪽 purple mist cubes |

공통 material base colors:

```py
COLORS = {
    "shadow": (0.18, 0.08, 0.30, 1.0),
    "shadow_glow": (0.18, 0.78, 0.90, 1.0),
    "bat": (0.20, 0.10, 0.24, 1.0),
    "bone": (0.78, 0.76, 0.65, 1.0),
    "shield": (0.16, 0.14, 0.22, 1.0),
    "obsidian": (0.08, 0.07, 0.11, 1.0),
    "lava": (1.0, 0.28, 0.04, 1.0),
    "lich": (0.28, 0.08, 0.42, 1.0),
    "elite": (0.82, 0.08, 0.12, 1.0),
}
```

모든 root는 카메라를 향한 동일 yaw를 사용한다. motion은 object transform/armature keyframe을 sampling해 한 행 sprite sheet로 합친다. map geometry는 무늬 없는 beveled tile과 road shape를 공유하고 material palette만 6개 theme으로 바꾼다.

Public entrypoints are named `reset_nightmare_scene`, `build_enemy_models`, `build_trait_vfx`, `build_map_kit`, `render_master_and_mobile`, `save_blend_files`, and `build_all`. Their orchestration is:

```py
def build_all() -> None:
    reset_nightmare_scene()
    build_enemy_models()
    build_trait_vfx()
    build_map_kit()
    render_master_and_mobile()
    save_blend_files()
```

각 함수는 owner tag `nightmare-v1`이 없는 object와 protected source blend를 수정하지 않는다.

- [ ] **Step 5: Blender MCP를 작은 단계로 실행**

First call `mcp__blender.get_scene_info` with the original user request. Then call `mcp__blender.execute_blender_code` separately for setup, enemies, VFX, maps, render/save:

```py
from pathlib import Path
script_path = Path("/Users/jadon/Documents/huchu-defense-v2/tools/blender/nightmare_assets.py")
scope = {"__name__": "nightmare_assets_mcp"}
exec(compile(script_path.read_text(), str(script_path), "exec"), scope)
scope["reset_nightmare_scene"]()
```

Subsequent calls:

```py
scope["build_enemy_models"]()
scope["build_trait_vfx"]()
scope["build_map_kit"]()
scope["render_master_and_mobile"]()
scope["save_blend_files"]()
```

If Blender MCP calls do not share Python locals, repeat the first three `Path/scope/exec` lines in each call before invoking exactly one public function. Use `mcp__blender.get_viewport_screenshot(max_size=1200)` after enemy build and map build.

- [ ] **Step 6: asset 검사와 승인 보드 생성**

Run: `npx vitest run tests/assets/nightmareAssetContract.test.ts`

Expected: PASS.

Run: `npm run assets:nightmare:validate`

Expected: output starts with `VALIDATED 67 nightmare assets / 134 PNG files` and reports at most `8388608` mobile bytes.

Run: `npm run assets:nightmare:sheet`

Expected: creates `assets/renders/nightmare-v1/nightmare-approval-sheet.png`.

- [ ] **Step 7: 승인 문서와 이미지 확인**

`docs/assets/nightmare-3d-v1.md`에 asset 수, logical frame 수, blend paths, approval sheet path, validator 결과와 다음 체크를 기록한다.

- 모든 캐릭터 정면
- 방패가 얼굴을 가리지 않음
- 바닥 anchor가 일치
- 동작 프레임이 실제로 변화
- 길에 무늬 없음
- 여섯 테마가 구분되지만 경로 가독성 유지
- 배경 alpha 없음

Use `view_image` on the approval sheet and mobile crop.

- [ ] **Step 8: 사용자에게 Blender 검수 보드를 보여 주고 중단**

Ask for `전체 승인` 또는 수정할 asset id. Do not edit `spriteManifest.ts`, `assetLoader.ts`, `drawMap.ts` asset URLs in the same turn.

- [ ] **Step 9: 승인된 Blender batch 커밋**

After explicit approval, update the document status and run:

```bash
git add tools/blender/nightmare_assets.py tools/assets tests/assets \
  assets/blender/nightmare-enemies-v1.blend assets/blender/nightmare-map-kit-v1.blend \
  assets/renders/nightmare-v1 docs/assets/nightmare-3d-v1.md package.json
git commit -m "art: approve nightmare 3d asset batch"
```

---

### Task 9: 승인된 3D 렌더 런타임 통합

**Files:**
- Modify: `src/game/render/spriteManifest.ts`
- Modify: `src/game/render/assetLoader.ts`
- Modify: `src/game/render/drawEntities.ts`
- Modify: `src/game/render/drawEffects.ts`
- Modify: `src/game/render/drawMap.ts`
- Modify: `src/game/render/canvasRenderer.ts`
- Modify: `tests/game/renderTestUtils.ts`
- Modify: `tests/game/spriteManifest.test.ts`
- Modify: `tests/game/assetLoader.test.ts`
- Modify: `tests/game/renderer.test.ts`
- Modify: `tests/game/mapRendering.test.ts`

**Interfaces:**
- Consumes: only Task 8 approved files
- Produces: motion sprite metadata for all nightmare enemies
- Produces: themed map sprite set keyed by `StageThemeId`
- Produces: trait VFX sprite metadata keyed by runtime effect kind

- [ ] **Step 1: manifest와 타일 방향 실패 테스트 작성**

```ts
it('maps every nightmare enemy to an approved front-facing motion sheet', () => {
  expect(Object.fromEntries(Object.entries(NIGHTMARE_MOTION_SPRITES).map(
    ([type, value]) => [type, [value.frames, value.frameSize]],
  ))).toEqual({
    shadowSlime: [6, 128],
    vampireBat: [8, 128],
    skeletonKnight: [6, 128],
    obsidianGolem: [6, 128],
    lichKing: [8, 128],
  });
});

it('chooses the correct road sprite from orthogonal neighbors', () => {
  const stage = getStageDefinition('nightmare-1');
  expect(roadSpriteKey(stage.map, { col: 1, row: 7 })).toBe('roadHorizontal');
  expect(roadSpriteKey(stage.map, { col: 4, row: 7 })).toBe('roadWestNorth');
  expect(roadSpriteKey(stage.map, { col: 4, row: 6 })).toBe('roadVertical');
});
```

- [ ] **Step 2: 승인 에셋 미등록 상태에서 실패 확인**

Run: `npx vitest run tests/game/spriteManifest.test.ts tests/game/mapRendering.test.ts`

Expected: FAIL with missing approved manifest exports.

- [ ] **Step 3: motion·VFX·theme manifest 등록**

```ts
export type SpriteAnimation = Readonly<{
  url: string;
  frames: number;
  fps: number;
  frameSize: 128 | 256;
}>;

const nightmareUrl = (relativePath: string): string => new URL(
  `../../../assets/renders/nightmare-v1/mobile/${relativePath}`,
  import.meta.url,
).href;
const animation = (
  relativePath: string,
  frames: number,
  fps: number,
  frameSize: 128,
): SpriteAnimation => ({
  url: nightmareUrl(relativePath),
  frames,
  fps,
  frameSize,
});

export const NIGHTMARE_MOTION_SPRITES = {
  shadowSlime: animation('motion/shadow-slime-bounce.png', 6, 7, 128),
  vampireBat: animation('motion/vampire-bat-fly.png', 8, 10, 128),
  skeletonKnight: animation('motion/skeleton-knight-walk.png', 6, 7, 128),
  obsidianGolem: animation('motion/obsidian-golem-walk.png', 6, 5, 128),
  lichKing: animation('motion/lich-king-float.png', 8, 7, 128),
} as const;
```

VFX 8종도 `{url, frames, fps, frameSize: 128}`로 등록한다. theme map URL은 `nightmareUrl(\`map/${theme}/${piece}.png\`)`로 만든다.

- [ ] **Step 4: asset loader를 metadata 기반으로 확장**

`GameAssets.motion`은 `Partial<Record<EnemyType, LoadedSprite>>`, `GameAssets.traitVfx`는 8개 kind record, `GameAssets.nightmareMaps`는 6개 theme record를 갖는다. `loadGameAssets()`는 normal asset 실패와 nightmare asset 실패를 서로 독립적으로 null 처리한다.

- [ ] **Step 5: 정면 motion과 trait sheet 렌더 연결**

`drawEnemyBody`는 nightmare type이면 `NIGHTMARE_MOTION_SPRITES[type]`을 사용하고 `frameSize`와 `fps`를 metadata에서 읽는다. 방향에 따라 sprite를 바꾸지 않는다. elite는 동일 sheet 위에 `elite-rune` overlay, split child는 0.7 scale을 적용한다.

`drawRuntimeEffect`는 해당 PNG가 있으면 frame progress로 sheet를 그리고 null이면 Task 6 primitive를 사용한다. 룬 radius와 실제 판정 radius는 동일한 projection을 사용한다.

- [ ] **Step 6: 승인된 3D tile 렌더 연결**

`roadSpriteKey(map, cell)`은 상하좌우 path neighbor를 검사해 horizontal, vertical 또는 네 corner를 반환한다. path start는 첫 실제 segment 방향, end는 마지막 segment 방향을 따른다.

`drawMap`은 polygon 색 underlay를 먼저 그리고 각 cell의 theme ground/road sprite를 depth 순서로 그린다. 길에는 grid pattern을 추가하지 않는다. 마지막 path cell에는 theme snack chest, 보드 전면 가장자리에는 매 두 칸마다 boundary stone을 그린다. 선택·배치·사거리 overlay는 sprite 위에 그려 판독성을 유지한다.

- [ ] **Step 7: manifest·loader·renderer 테스트와 asset 검사**

Run: `npx vitest run tests/game/spriteManifest.test.ts tests/game/assetLoader.test.ts tests/game/renderer.test.ts tests/game/mapRendering.test.ts`

Expected: PASS.

Run: `npm run assets:nightmare:validate`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 8: Task 9 커밋**

```bash
git add src/game/render tests/game
git commit -m "feat: integrate approved nightmare 3d assets"
```

---

### Task 10: 밸런스 회귀·전체 검증·수동 스크린샷

**Files:**
- Create: `tests/game/nightmareBalance.test.ts`
- Modify only if required by measured results: `src/game/stages/stageCatalog.ts`
- Modify only if required by measured results: `src/game/waves/nightmareWaves.ts`
- Modify: `docs/superpowers/specs/2026-07-23-nightmare-mode-expansion-design.md` only to record final values inside the approved ±10% range

**Interfaces:**
- Consumes: complete playable nightmare implementation
- Produces: deterministic pressure regression and visual evidence

- [ ] **Step 1: 경제·압박도 회귀 테스트 작성**

```ts
it('increases effective enemy hp pressure across nightmare stages', () => {
  const budgets = NIGHTMARE_STAGE_KEYS.map((key) => {
    const stage = getStageDefinition(key);
    return stage.waves.reduce((stageSum, wave, waveIndex) => (
      stageSum + wave.groups.reduce((waveSum, group) => (
        waveSum + ENEMY_CATALOG[group.type].hp
          * stage.hpMultiplier
          * (1 + waveIndex * 0.08)
          * group.count
          * (group.variant === 'elite' ? 1.8 : 1)
      ), 0)
    ), 0);
  });
  expect(budgets.slice(1).every((value, index) => value > budgets[index])).toBe(true);
});

it('keeps all configured adjustments inside the approved ten-percent envelope', () => {
  const approved = [
    [1.00, 1.00, 1.00, 1.00],
    [1.10, 1.02, 0.97, 1.04],
    [1.21, 1.04, 0.94, 1.08],
    [1.33, 1.06, 0.91, 1.12],
    [1.47, 1.08, 0.88, 1.16],
    [1.62, 1.10, 0.85, 1.20],
  ] as const;
  for (const [index, key] of NIGHTMARE_STAGE_KEYS.entries()) {
    const stage = getStageDefinition(key);
    const current = [
      stage.hpMultiplier,
      stage.speedMultiplier,
      stage.spawnIntervalMultiplier,
      stage.countMultiplier,
    ];
    expect(current.every((value, metric) => {
      const ratio = value / approved[index][metric];
      return ratio >= 0.9 && ratio <= 1.1;
    })).toBe(true);
  }
});
```

대표 전략 harness는 실제 `createGame`, `placeTower`, `updateGame`을 1/60초로 실행하고 다음 두 계약을 기록한다.

- 균형 배치 `arrow → slow → deokbae → arrow → huchu`가 나이트메어 1을 클리어
- 화살 타워만 구매하는 단일 전략은 나이트메어 3 이상에서 실패

각 타워는 목표 경로 index 25%, 50%, 75%에 대해 `buildableCells([])`와 해당 path cell 사이 Chebyshev 거리가 가장 작은 칸을 선택한다. 동률이면 row, 그다음 col 오름차순을 사용하고 이미 점유된 칸을 제외한다. 골드가 충분해지는 첫 tick에 다음 타워를 구매하고 최대 900초에서 중단한다.

- [ ] **Step 2: balance test 실행**

Run: `npx vitest run tests/game/nightmareBalance.test.ts`

Expected: PASS after values satisfy the two representative contracts.

- [ ] **Step 3: 허용 범위 안에서만 수치 보정**

실패 원인이 수량이면 `COUNT_MULTIPLIERS`, 전체 내구력이면 stage `hpMultiplier`, 과속이면 `speedMultiplier`, 밀집이면 `spawnIntervalMultiplier` 한 종류만 한 번에 변경한다. 승인된 적 구성 편향 `TYPE_WEIGHTS`는 바꾸지 않는다. 설계 기준 대비 0.90~1.10 밖으로 나가면 작업을 멈추고 사용자에게 재승인을 요청한다. 타워·280G·내구도 12는 변경하지 않는다.

- [ ] **Step 4: 전체 비-E2E 검증**

Run: `npm run assets:nightmare:validate`

Expected: PASS and reported mobile bytes at most `8388608`.

Run: `npm run check`

Expected: all Vitest files PASS and Vite build success.

Run: `git diff --check`

Expected: exit 0, no output.

Run: `rg -o '/huchu-duckbae-tower-defense/[^\" ]+\\.(js|css)' dist/index.html`

Expected: every emitted JS/CSS path starts with `/huchu-duckbae-tower-defense/`.

- [ ] **Step 5: 브라우저 수동 스모크와 스크린샷**

Use the in-app browser control skill, not `npm run test:e2e`. Start the preview server and manually inspect:

```bash
npm run dev -- --host 127.0.0.1
```

Capture to `/tmp`, not a user-owned repository snapshot:

- `/tmp/nightmare-stage-select-844x390.png`
- `/tmp/nightmare-shield-844x390.png`
- `/tmp/nightmare-split-844x390.png`
- `/tmp/nightmare-lich-844x390.png`
- `/tmp/nightmare-result-844x390.png`
- `/tmp/nightmare-desktop-1280x720.png`

Verify stage tabs, locked state, one full N1 run, shield, split, aura, N6 phase and result panel. Do not automate assertions.

- [ ] **Step 6: 사용자에게 스크린샷과 수치 결과 제시**

Report exact test counts, build result, asset bytes, representative strategy outcomes and six screenshots. Ask for final local gameplay approval before deployment.

- [ ] **Step 7: Task 10 커밋**

```bash
git add tests/game/nightmareBalance.test.ts src/game/stages/stageCatalog.ts \
  src/game/waves/nightmareWaves.ts \
  docs/superpowers/specs/2026-07-23-nightmare-mode-expansion-design.md
git commit -m "test: lock nightmare balance targets"
```

If only the new test changed, omit unchanged source/spec paths from `git add`.

---

### Task 11: 승인 후 GitHub Pages 배포

**Files:**
- Verify: `.github/workflows/deploy-pages.yml`
- Verify: `vite.config.ts`
- Verify: `dist/index.html`

**Interfaces:**
- Consumes: explicit final deployment approval and clean verified main
- Produces: successful GitHub Pages deployment

- [ ] **Step 1: 배포 직전 상태 확인**

```bash
git status --short --branch
git log -5 --oneline
git remote -v
npm run check
```

Expected: intended commits only, remote `https://github.com/loomingsight/huchu-duckbae-tower-defense.git`, check PASS.

- [ ] **Step 2: base와 artifact workflow 재확인**

```bash
rg -n "base: '/huchu-duckbae-tower-defense/'" vite.config.ts
rg -n "mkdir -p pages|cp -R dist/. pages/|upload-pages-artifact" .github/workflows/deploy-pages.yml
```

Expected: all required lines found.

- [ ] **Step 3: main push**

```bash
git push origin main
```

Expected: remote main advances to local HEAD.

- [ ] **Step 4: GitHub Actions 완료까지 확인**

```bash
run_id="$(env -u GITHUB_TOKEN gh run list --workflow deploy-pages.yml \
  --branch main --limit 1 --json databaseId --jq '.[0].databaseId')"
env -u GITHUB_TOKEN gh run watch "$run_id" --exit-status
```

Expected: `run_id` is the newest workflow run's numeric id and build/deploy conclude `success`.

- [ ] **Step 5: 공개 URL과 번들 HTTP 200 확인**

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  https://loomingsight.github.io/huchu-duckbae-tower-defense/
```

Expected: `200`.

Open deployed HTML, extract its exact main JS path, then request that exact URL:

```bash
bundle_path="$(curl -sS https://loomingsight.github.io/huchu-duckbae-tower-defense/ \
  | rg -o '/huchu-duckbae-tower-defense/assets/[^\" ]+\\.js' \
  | head -n 1)"
curl -sS -o /dev/null -w '%{http_code}\n' \
  "https://loomingsight.github.io${bundle_path}"
```

Expected: `bundle_path` is a concrete hashed path beginning with `/huchu-duckbae-tower-defense/assets/` and the bundle returns `200`.

- [ ] **Step 6: 배포 결과 보고**

Report commit SHA, GitHub Actions run URL, public URL, page HTTP status and bundle HTTP status. Do not report success before all are confirmed.

---

## Execution Handoff

사용자가 이미 단일 에이전트 방식을 선택했으므로 실행 옵션은 **Inline Execution**으로 고정한다. 실행 시 `superpowers:executing-plans`를 사용해 Task 1부터 순서대로 진행하고, Task 7과 Task 8의 사용자 승인 게이트에서 반드시 중단한다.
