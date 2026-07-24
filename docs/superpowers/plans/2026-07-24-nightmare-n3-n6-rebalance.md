# Nightmare N3-N6 Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 후속 사용자 결정으로 화살-only 1별 목표와 초기 시작 골드안은
> [`2026-07-24-nightmare-counter-shield.md`](2026-07-24-nightmare-counter-shield.md)의
> 봉인 방패·화살-only 패배 계약과 `360/380/480/480G`로 대체됐다.

**Goal:** 나이트메어 N3~N6의 난도 증가 폭을 완화하고 시작 골드를 단계적으로 늘려, 실제 게임 로직을 사용하는 혼합 타워 시뮬레이션으로 N2~N6의 2별 이상 클리어 가능성을 회귀 검증한다.

**Architecture:** 기존 `NIGHTMARE_DIFFICULTY` 데이터에 스테이지별 시작 골드를 선언한다. N2는 승인 고정 배치를 유지하고 N3~N6은 경로 커버리지 상위 화살 세 개 뒤 슬로우를 배치하며, 봉인 방패 규칙은 후속 계획에서 구현한다.

**Tech Stack:** TypeScript 5.8, Vitest 3.2, Vite 7, HTML Canvas, GitHub Actions Pages

## Global Constraints

- N1·N2의 난도 배율은 변경하지 않는다.
- N3~N6 배율은 설계서의 승인 값과 정확히 일치해야 한다.
- N1·N2 시작 골드는 280G를 유지하고 N3~N6은 360/380/480/480G로 변경한다.
- 몬스터·타워 개별 수치, 웨이브 구성, 창고 HP 12, 보상 배율 0.85와 별점 기준은 변경하지 않는다.
- 그림자 슬라임 `1 → 2` 분열, 자식 HP 17%, 초반 kill value와 흑요석 골렘 기본 속도 0.52를 유지한다.
- 전체 E2E는 실행하지 않는다.
- Vite base `/huchu-duckbae-tower-defense/`를 유지한다.
- 배포 브랜치는 `main`, 공개 URL은 `https://loomingsight.github.io/huchu-duckbae-tower-defense/`이다.

---

### Task 1: N3~N6 난도 계약과 혼합 타워 클리어 회귀 테스트

**Files:**
- Modify: `tests/game/stages.test.ts:163-194`
- Modify: `tests/game/nightmareBalance.test.ts:1-84`
- Modify: `src/game/stages/stageCatalog.ts:193-242`
- Modify: `docs/backlog.md:60-65`

**Interfaces:**
- Consumes: `getStageDefinition(value): StageDefinition`, `createGame(stageKey): GameState`, `placeTower(state, type, cell): PlaceTowerResult`, `updateGame(state, deltaSeconds): void`, `calculateGameScore(game, outcome, elapsedSeconds): GameScore`
- Produces: N3~N6 승인 배율·시작 골드와 `nightmare-2`~`nightmare-6` 혼합 타워 2별 이상 회귀 계약

- [ ] **Step 1: 승인된 스테이지 배율을 기대하도록 기존 테스트를 변경한다**

`tests/game/stages.test.ts`의 나이트메어 기대 표를 다음 값으로 바꾼다.

```ts
const expected = [
  ['달빛 늪', 30, 62, 1.00, 1.00, 1.00, 1.00, 280, 18_500, 23_000],
  ['썩은 숲', 27, 56, 1.04, 1.00, 1.00, 1.00, 280, 18_500, 23_000],
  ['잿빛 폐허', 25, 52, 1.07, 1.01, 1.00, 1.00, 360, 19_000, 23_500],
  ['핏빛 협곡', 26, 54, 1.13, 1.02, 0.98, 1.02, 380, 19_500, 24_000],
  ['흑요석 광산', 24, 50, 1.21, 1.03, 0.96, 1.05, 480, 19_500, 24_000],
  ['심연의 성문', 23, 48, 1.30, 1.05, 0.94, 1.08, 480, 20_500, 25_000],
] as const;
```

- [ ] **Step 2: N2~N6 스테이지별 혼합 타워 빌드 순서와 클리어 테스트를 작성한다**

`tests/game/nightmareBalance.test.ts`에 `StageNumber`를 가져오고 기존 N2
전용 헬퍼를 스테이지별 승인 배치로 교체한다. N2의 기존 시작 순서를
유지하고 N3~N6은 화살 세 개를 먼저 배치한 뒤 슬로우 타워를 배치한다.

```ts
import type { StageNumber } from '../../src/game/stages/stageIdentity';

type NightmareStageKey = `nightmare-${StageNumber}`;

const MIXED_OPENINGS = {
  'nightmare-2': [
    { type: 'arrow', col: 5, row: 3 },
    { type: 'arrow', col: 9, row: 6 },
    { type: 'slow', col: 8, row: 6 },
    { type: 'arrow', col: 13, row: 5 },
    { type: 'arrow', col: 3, row: 3 },
    { type: 'arrow', col: 7, row: 5 },
    { type: 'arrow', col: 11, row: 5 },
    { type: 'arrow', col: 15, row: 5 },
    { type: 'arrow', col: 5, row: 1 },
    { type: 'arrow', col: 13, row: 7 },
    { type: 'arrow', col: 17, row: 5 },
  ],
  'nightmare-3': [
    { type: 'arrow', col: 4, row: 7 },
    { type: 'arrow', col: 9, row: 5 },
    { type: 'arrow', col: 13, row: 3 },
    { type: 'slow', col: 8, row: 5 },
    { type: 'arrow', col: 3, row: 7 },
    { type: 'arrow', col: 6, row: 5 },
    { type: 'arrow', col: 11, row: 5 },
    { type: 'arrow', col: 15, row: 3 },
    { type: 'arrow', col: 4, row: 9 },
    { type: 'arrow', col: 13, row: 1 },
    { type: 'arrow', col: 17, row: 3 },
  ],
  'nightmare-4': [
    { type: 'arrow', col: 6, row: 4 },
    { type: 'arrow', col: 10, row: 6 },
    { type: 'arrow', col: 14, row: 5 },
    { type: 'slow', col: 9, row: 6 },
    { type: 'arrow', col: 3, row: 4 },
    { type: 'arrow', col: 8, row: 6 },
    { type: 'arrow', col: 12, row: 6 },
    { type: 'arrow', col: 16, row: 5 },
    { type: 'arrow', col: 6, row: 2 },
    { type: 'arrow', col: 14, row: 7 },
    { type: 'arrow', col: 18, row: 5 },
  ],
  'nightmare-5': [
    { type: 'arrow', col: 4, row: 5 },
    { type: 'arrow', col: 9, row: 4 },
    { type: 'arrow', col: 14, row: 4 },
    { type: 'slow', col: 8, row: 4 },
    { type: 'arrow', col: 3, row: 5 },
    { type: 'arrow', col: 6, row: 4 },
    { type: 'arrow', col: 11, row: 4 },
    { type: 'arrow', col: 16, row: 4 },
    { type: 'arrow', col: 4, row: 7 },
    { type: 'arrow', col: 14, row: 2 },
    { type: 'arrow', col: 18, row: 4 },
  ],
  'nightmare-6': [
    { type: 'arrow', col: 7, row: 5 },
    { type: 'arrow', col: 10, row: 5 },
    { type: 'arrow', col: 14, row: 5 },
    { type: 'slow', col: 9, row: 5 },
    { type: 'arrow', col: 4, row: 5 },
    { type: 'arrow', col: 8, row: 3 },
    { type: 'arrow', col: 12, row: 5 },
    { type: 'arrow', col: 16, row: 5 },
    { type: 'arrow', col: 7, row: 3 },
    { type: 'arrow', col: 14, row: 3 },
    { type: 'arrow', col: 18, row: 5 },
  ],
} as const satisfies Readonly<
  Record<Exclude<NightmareStageKey, 'nightmare-1'>, readonly Build[]>
>;

type TestedNightmareStageKey = keyof typeof MIXED_OPENINGS;

function cellKey({ col, row }: Readonly<{ col: number; row: number }>): string {
  return `${col}:${row}`;
}

function pathCoverage(stageKey: TestedNightmareStageKey, build: Build): number {
  const stage = getStageDefinition(stageKey);
  const center = cellCenter(build);
  const range = TOWER_CATALOG[build.type].range;
  return stage.map.pathCells.filter((pathCell) => {
    const pathCenter = cellCenter(pathCell);
    return Math.hypot(pathCenter.x - center.x, pathCenter.y - center.y) <= range;
  }).length;
}

function rankedBuilds(
  stageKey: TestedNightmareStageKey,
  type: TowerType,
  occupied: ReadonlySet<string>,
): readonly Build[] {
  return getStageDefinition(stageKey).map.buildableCells([])
    .filter((cell) => !occupied.has(cellKey(cell)))
    .map(({ col, row }) => ({ type, col, row }))
    .sort((left, right) => (
      pathCoverage(stageKey, right) - pathCoverage(stageKey, left)
      || left.col - right.col
      || left.row - right.row
    ));
}

function mixedBuildOrder(stageKey: TestedNightmareStageKey): readonly Build[] {
  const opening = MIXED_OPENINGS[stageKey];
  const occupied = new Set(opening.map(cellKey));
  return [
    ...opening,
    ...rankedBuilds(stageKey, 'arrow', occupied),
  ];
}
```

기존 단일 N2 테스트를 다음 테이블 테스트로 교체한다.

```ts
it.each([
  'nightmare-2',
  'nightmare-3',
  'nightmare-4',
  'nightmare-5',
  'nightmare-6',
] satisfies readonly TestedNightmareStageKey[])(
  'clears %s with a slow-and-arrow opening',
  (stageKey) => {
    const state = createGame(stageKey);
    const buildOrder = mixedBuildOrder(stageKey);
    let nextBuild = 0;

    for (
      let step = 0;
      step < 60 * 480 && state.outcome === 'playing';
      step += 1
    ) {
      while (
        nextBuild < buildOrder.length
        && state.gold >= TOWER_CATALOG[buildOrder[nextBuild].type].cost
      ) {
        const build = buildOrder[nextBuild];
        expect(placeTower(state, build.type, build)).toEqual({ ok: true });
        nextBuild += 1;
      }
      updateGame(state, 1 / 60);
    }

    const score = calculateGameScore(state, state.outcome, state.elapsedSeconds);
    expect(state.outcome).toBe('victory');
    expect(score.stars).toBeGreaterThanOrEqual(2);
    expect(state.towers.some(({ type }) => type === 'slow')).toBe(true);
  },
);
```

- [ ] **Step 3: 집중 테스트를 실행해 RED를 확인한다**

Run:

```bash
npx vitest run tests/game/stages.test.ts tests/game/nightmareBalance.test.ts
```

Expected: `defines the six approved nightmare maps and economy`가 N3의 기존
`1.10/1.02/0.98/1.02/280G`와 승인 값
`1.07/1.01/1.00/1.00/360G` 차이로 실패한다. N3~N6 클리어 테스트는
각각 4·3·4·2웨이브에서 패배해 RED를 재현한다.

- [ ] **Step 4: 승인된 N3~N6 배율과 시작 골드를 적용한다**

`src/game/stages/stageCatalog.ts`의 N3~N6 항목을 다음처럼 변경하고 N1과
N2 항목에는 각각 `startingGold: 280`을 추가한다.

```ts
{
  hpMultiplier: 1.07,
  speedMultiplier: 1.01,
  spawnIntervalMultiplier: 1,
  countMultiplier: 1,
  startingGold: 360,
  twoStarScore: 19_000,
  threeStarScore: 23_500,
},
{
  hpMultiplier: 1.13,
  speedMultiplier: 1.02,
  spawnIntervalMultiplier: 0.98,
  countMultiplier: 1.02,
  startingGold: 380,
  twoStarScore: 19_500,
  threeStarScore: 24_000,
},
{
  hpMultiplier: 1.21,
  speedMultiplier: 1.03,
  spawnIntervalMultiplier: 0.96,
  countMultiplier: 1.05,
  startingGold: 480,
  twoStarScore: 19_500,
  threeStarScore: 24_000,
},
{
  hpMultiplier: 1.30,
  speedMultiplier: 1.05,
  spawnIntervalMultiplier: 0.94,
  countMultiplier: 1.08,
  startingGold: 480,
  twoStarScore: 20_500,
  threeStarScore: 25_000,
},
```

나이트메어 스테이지 생성부의 고정값을 데이터 참조로 바꾼다.

```ts
startingGold: difficulty.startingGold,
```

- [ ] **Step 5: 집중 테스트를 실행해 GREEN을 확인한다**

Run:

```bash
npx vitest run tests/game/stages.test.ts tests/game/nightmareBalance.test.ts
```

Expected: 두 파일의 모든 테스트가 통과하고 N1~N6 시작 골드가 승인 값과
일치하며, N2~N6의 각 시뮬레이션 결과가 `victory`, 별점 `>= 2`, 슬로우
타워 배치 `true`다.

- [ ] **Step 6: 구현 완료 백로그를 갱신한다**

`docs/backlog.md`의 N3~N6 재조정 항목만 완료로 바꾼다. 배포 후 실제 플레이
항목은 아직 완료 처리하지 않는다.

```md
- [x] 반복 도전으로도 클리어하기 어렵다는 플레이 피드백을 기준으로 N3~N6의 난도 급등 구간과 초·중반 웨이브를 재측정하고, 단계별 상승감은 유지하면서 클리어 가능한 수준으로 재조정
```

- [ ] **Step 7: 구현 커밋을 만든다**

```bash
git add src/game/stages/stageCatalog.ts tests/game/stages.test.ts tests/game/nightmareBalance.test.ts docs/backlog.md
git diff --cached --check
git commit -m "balance: smooth N3-N6 nightmare curve"
```

Expected: 테스트, 승인 배율과 해당 백로그 완료 표시만 한 커밋에 포함된다.

---

### Task 2: 전체 검증과 첫 Pages 배포

**Files:**
- Verify: `dist/index.html`
- Verify: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: Task 1의 N3~N6 배율과 회귀 테스트
- Produces: 전체 테스트·타입 검사·프로덕션 빌드 증거와 첫 공개 배포

- [ ] **Step 1: 전체 검증을 실행한다**

Run:

```bash
npm run check
git diff --check
```

Expected: Vitest 전체 테스트 0 failures, `tsc -b`와 `vite build` exit 0,
`git diff --check` 출력 없음.

- [ ] **Step 2: Pages base 경로를 확인한다**

Run:

```bash
rg -o '(/huchu-duckbae-tower-defense/[^\" ]+\\.(js|css))' dist/index.html
```

Expected: JS와 CSS 경로가 모두
`/huchu-duckbae-tower-defense/`로 시작한다.

- [ ] **Step 3: `main`을 푸시한다**

```bash
env -u GITHUB_TOKEN git push origin main
```

Expected: `main`의 설계 커밋과 구현 커밋이
`https://github.com/loomingsight/huchu-duckbae-tower-defense.git`에
반영된다.

- [ ] **Step 4: GitHub Actions Pages 배포 성공을 확인한다**

```bash
env -u GITHUB_TOKEN gh run list \
  --workflow deploy-pages.yml \
  --branch main \
  --limit 1 \
  --json databaseId,headSha,status,conclusion,url
env -u GITHUB_TOKEN gh run watch "$(
  env -u GITHUB_TOKEN gh run list \
    --workflow deploy-pages.yml \
    --branch main \
    --limit 1 \
    --json databaseId \
    --jq '.[0].databaseId'
)" --exit-status
```

Expected: 최신 실행의 `headSha`가 푸시한 구현 커밋이고 `conclusion`이
`success`다.

- [ ] **Step 5: 공개 HTML과 번들 응답을 확인한다**

```bash
public_html_file="$(mktemp)"
curl -fsS \
  https://loomingsight.github.io/huchu-duckbae-tower-defense/ \
  -o "$public_html_file"
rg -o '/huchu-duckbae-tower-defense/[^" ]+\.(js|css)' \
  "$public_html_file" |
while read -r asset_path; do
  curl -fsSI "https://loomingsight.github.io$asset_path"
done
```

Expected: HTML, JS와 CSS가 모두 HTTP 200이다.

---

### Task 3: 배포 후 실제 플레이 확인과 백로그 후속 기록

**Files:**
- Modify: `docs/backlog.md:60-65`

**Interfaces:**
- Consumes: Task 2에서 성공한 공개 배포
- Produces: 화살-only 봉인 방패 차단과 혼합 구성 2~3별 안정성의 실제 플레이 기록

- [ ] **Step 1: 공개 게임에서 화살-only 구성을 확인한다**

`https://loomingsight.github.io/huchu-duckbae-tower-defense/`에서 해금된
나이트메어 스테이지를 선택하고 화살 타워만 사용해 플레이한다.

Expected: 화살-only는 봉인 방패를 해제하지 못해 패배한다. 클리어될 경우
배치 좌표, 창고 잔여 HP와 별점을 기록하고 봉인 방패 회귀로 처리한다.

- [ ] **Step 2: 공개 게임에서 슬로우 혼합 구성을 확인한다**

N2는 화살 2개와 슬로우 1개를 배치한다. N3~N6은 화살 3개를 먼저 배치한
뒤 슬로우 타워를 추가하고 이후 화살 타워를 분산 배치한다.

Expected: 안정적으로 클리어하고 2별 이상을 획득한다. 실패할 경우 창고 잔여
HP와 도달 웨이브를 기록하고 Task 1의 승인 범위 안에서 원인을 다시 분석한다.

- [ ] **Step 3: 실제 플레이 백로그를 완료 처리한다**

두 플레이 목표가 확인된 경우 `docs/backlog.md`를 다음처럼 바꾼다.

```md
- [x] 배포 후 N3~N6에서 화살-only가 봉인 방패를 돌파하지 못하고 슬로우·고급 타워 혼합 구성은 2~3별로 안정적인지 실제 플레이로 확인
```

- [ ] **Step 4: 백로그 종료 커밋과 최종 검증을 실행한다**

```bash
git add docs/backlog.md
git diff --cached --check
git commit -m "docs: complete nightmare balance backlog"
npm run check
git status --short --branch
```

Expected: 백로그에 미완료 체크박스가 없고 전체 테스트와 빌드가 다시
통과하며 로컬 `main`이 원격보다 한 커밋 앞선 상태다.

- [ ] **Step 5: 최종 문서 커밋을 푸시하고 Pages를 다시 확인한다**

```bash
env -u GITHUB_TOKEN git push origin main
env -u GITHUB_TOKEN gh run list \
  --workflow deploy-pages.yml \
  --branch main \
  --limit 1 \
  --json databaseId,headSha,status,conclusion,url
env -u GITHUB_TOKEN gh run watch "$(
  env -u GITHUB_TOKEN gh run list \
    --workflow deploy-pages.yml \
    --branch main \
    --limit 1 \
    --json databaseId \
    --jq '.[0].databaseId'
)" --exit-status
```

Expected: 최신 실행이 최종 문서 커밋을 배포하고 `conclusion: success`를
반환한다. 공개 HTML과 해당 HTML이 참조하는 JS·CSS도 다시 HTTP 200을
반환한다.
