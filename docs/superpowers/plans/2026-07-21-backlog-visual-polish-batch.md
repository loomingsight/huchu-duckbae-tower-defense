# Backlog Visual Polish Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 백로그 8개를 구현해 타워 선택·배치 안내를 명확하게 하고, 256px 런타임 에셋과 조정된 애니메이션·3D 투사체 VFX를 GitHub Pages에 배포한다.

**Architecture:** HUD affordability는 순수 판정 함수 하나를 DOM의 `disabled`와 스타일에 공유한다. 맵 배치 가이드는 `STAGE_1.buildableCells()`가 현재 점유 셀을 제외한 목록을 만들고 `GameApp → CanvasRenderer → drawMap`으로 전달한다. 런타임 렌더러는 맵만 128px을 유지하고 엔티티·모션·VFX는 256px master를 사용하며, Blender MCP가 dirty UI 장면을 저장하지 않고 별도 background Blender child로 VFX 그룹만 원자적으로 재생성한다.

**Tech Stack:** TypeScript 5.8, Canvas 2D, Vitest 3, Playwright, Vite 7, Blender Python (`bpy`), GitHub Actions Pages

## Global Constraints

- 골드·공격력·사거리·웨이브·적 이동 속도·공격 주기는 변경하지 않는다.
- 맵 20×10 구조, 경로, 투영, 걷기 FPS 8, 날갯짓 FPS 12는 유지한다.
- 새 런타임 의존성을 추가하지 않는다.
- 열린 `/Users/jadon/Documents/huchu-defense-v2/assets/blender/enemies-voxel-v1.blend` dirty 장면은 저장하거나 교체하지 않는다.
- VFX는 `/Applications/Blender.app/Contents/MacOS/Blender` background child와 `/private/tmp/huchu-defense-v2-3d-preview`에서만 생성한다.
- 새 워터볼·파이어볼 master sprite sheet를 사용자에게 보여 승인받은 뒤에만 `main` 배포를 진행한다.
- Vite base `/huchu-duckbae-tower-defense/`와 공개 URL `https://loomingsight.github.io/huchu-duckbae-tower-defense/`를 유지한다.

---

### Task 1: 골드 부족 타워 버튼 차단

**Files:**
- Modify: `tests/app/hud.test.ts`
- Modify: `src/app/hud.ts`

**Interfaces:**
- Consumes: `HudViewInput`, `TOWER_CARDS`
- Produces: `towerCardAvailability(input, cost): { disabled: boolean; unaffordable: boolean }`

- [ ] **Step 1: 비용 경계와 비플레이 상태를 고정하는 실패 테스트 작성**

```ts
expect(towerCardAvailability({ gold: 99, phase: 'playing', portraitBlocked: false }, 100))
  .toEqual({ disabled: true, unaffordable: true });
expect(towerCardAvailability({ gold: 100, phase: 'playing', portraitBlocked: false }, 100))
  .toEqual({ disabled: false, unaffordable: false });
expect(towerCardAvailability({ gold: 100, phase: 'paused', portraitBlocked: false }, 100).disabled)
  .toBe(true);
```

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/app/hud.test.ts`

Expected: `towerCardAvailability`가 없어서 새 테스트만 실패한다.

- [ ] **Step 3: 단일 affordability 판정 구현 및 DOM 연결**

```ts
export function towerCardAvailability(
  input: Pick<HudViewInput, 'gold' | 'phase' | 'portraitBlocked'>,
  cost: number,
) {
  const unaffordable = !Number.isFinite(input.gold) || input.gold < cost;
  return {
    unaffordable,
    disabled: input.portraitBlocked || input.phase !== 'playing' || unaffordable,
  } as const;
}
```

`renderHud()`의 각 카드에서 이 값을 한 번 계산해 `button.disabled`와 `tower-card--unaffordable`에 모두 사용한다. 선택 상태는 골드가 줄어도 유지한다.

- [ ] **Step 4: GREEN 확인**

Run: `npx vitest run tests/app/hud.test.ts`

Expected: HUD 테스트 전부 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/app/hud.ts tests/app/hud.test.ts
git commit -m "fix: disable unaffordable tower controls"
```

### Task 2: 파란색 배치 가능 셀 가이드

**Files:**
- Modify: `tests/game/stage1.test.ts`
- Modify: `tests/game/mapRendering.test.ts`
- Modify: `tests/game/renderer.test.ts`
- Modify: `src/game/map/stage1.ts`
- Modify: `src/game/render/drawMap.ts`
- Modify: `src/game/render/canvasRenderer.ts`
- Modify: `src/app/GameApp.ts`

**Interfaces:**
- Produces: `STAGE_1.buildableCells(occupiedCells): Cell[]`
- Produces: `RenderOptions.placementGuideCells?: readonly Cell[]`
- Consumes: `GameSnapshot.towers[].cell`, 선택 타워, phase, portrait 상태

- [ ] **Step 1: 배치 셀 목록과 파란 폴리곤 실패 테스트 작성**

```ts
const occupied = [{ col: 1, row: 1 }];
const expected = Array.from({ length: STAGE_1.height }, (_, row) =>
  Array.from({ length: STAGE_1.width }, (_, col) => ({ col, row })),
).flat().filter((cell) => STAGE_1.isBuildableCell(cell, occupied));
expect(STAGE_1.buildableCells(occupied)).toEqual(expected);
```

`drawMap()`과 `createCanvasRenderer().render()`에는 두 guide cell을 전달하고 `rgba(54, 145, 255, 0.28)` fill 호출이 두 번 발생하는지 검증한다.

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/game/stage1.test.ts tests/game/mapRendering.test.ts tests/game/renderer.test.ts`

Expected: 새 API와 파란 fill이 없어 실패.

- [ ] **Step 3: buildable cell 집계 구현**

```ts
function buildableCells(occupiedCells: readonly Cell[]): Cell[] {
  const cells: Cell[] = [];
  for (let row = 0; row < GRID_HEIGHT; row += 1) {
    for (let col = 0; col < GRID_WIDTH; col += 1) {
      const cell = { col, row };
      if (isBuildableCell(cell, occupiedCells)) cells.push(cell);
    }
  }
  return cells;
}
```

`STAGE_1`에 노출한다.

- [ ] **Step 4: 렌더 파이프라인 연결**

`MapSelection`에 `buildableCells?: readonly Cell[]`를 추가하고 기본 그리드 위, 선택 셀·사거리 아래 레이어에서 각 셀을 파란 projected polygon으로 채운다. `GameApp.render()`는 `selectedTower !== null && phase === 'playing' && !portraitBlocked`일 때만 현재 타워 셀을 점유 목록으로 전달한다.

- [ ] **Step 5: GREEN 확인**

Run: `npx vitest run tests/game/stage1.test.ts tests/game/mapRendering.test.ts tests/game/renderer.test.ts`

Expected: focused suites 전부 통과.

- [ ] **Step 6: 커밋**

```bash
git add src/app/GameApp.ts src/game/map/stage1.ts src/game/render/canvasRenderer.ts src/game/render/drawMap.ts tests/game/stage1.test.ts tests/game/mapRendering.test.ts tests/game/renderer.test.ts
git commit -m "feat: guide valid tower placement cells"
```

### Task 3: 256px 런타임 에셋 계약

**Files:**
- Modify: `tests/game/spriteManifest.test.ts`
- Modify: `tests/game/assetLoader.test.ts`
- Modify: `tests/game/renderTestUtils.ts`
- Modify: `src/game/render/spriteManifest.ts`
- Modify: `src/game/render/drawEntities.ts`
- Modify: `src/game/render/drawEffects.ts`

**Interfaces:**
- Produces: `SPRITE_FRAME_SIZES = { map: 128, enemy: 256, tower: 256, motion: 256, vfx: 256 }`
- Preserves: `GameAssets` shape and loader failure fallback behavior

- [ ] **Step 1: master URL과 frame-size 실패 테스트 작성**

`spriteManifest.test.ts`에서 모든 enemy 방향이 해당 타입의 `/enemies-v1/<type>/<type>-se-v1.png` 하나를 가리키고, tower/motion/vfx URL이 `/master/`를 포함하며, frame size 계약이 각각 256인지 검증한다. map은 `/mobile/map/`과 128을 유지한다.

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/game/spriteManifest.test.ts tests/game/assetLoader.test.ts tests/game/renderer.test.ts`

Expected: 현재 mobile/96px URL과 128px crop 때문에 실패.

- [ ] **Step 3: manifest를 master 원본으로 교체**

```ts
export const SPRITE_FRAME_SIZES = {
  map: 128,
  enemy: 256,
  tower: 256,
  motion: 256,
  vfx: 256,
} as const;
```

정적 enemy 4방향 슬롯은 같은 `se` master URL을 공유하고, tower·motion·vfx는 `redesign-preview-v1/master`를 참조한다. map URL은 변경하지 않는다.

- [ ] **Step 4: crop 계약과 테스트 이미지 크기 갱신**

`drawEntities.ts`와 `drawEffects.ts`에서 하드코딩된 96/128 crop을 `SPRITE_FRAME_SIZES`로 교체한다. `createTestAssets()`는 map만 128px, 다른 단일 frame은 256px, animated strip은 `256 * frames` 폭으로 만든다. loader 실패 fixture는 새 master URL을 사용한다.

- [ ] **Step 5: GREEN 확인**

Run: `npx vitest run tests/game/spriteManifest.test.ts tests/game/assetLoader.test.ts tests/game/renderer.test.ts`

Expected: focused suites 전부 통과.

- [ ] **Step 6: 커밋**

```bash
git add src/game/render/spriteManifest.ts src/game/render/drawEntities.ts src/game/render/drawEffects.ts tests/game/spriteManifest.test.ts tests/game/assetLoader.test.ts tests/game/renderTestUtils.ts tests/game/renderer.test.ts
git commit -m "feat: use high resolution runtime sprites"
```

### Task 4: 타워 크기·몬스터 bob·오크 접지 보정

**Files:**
- Modify: `tests/game/renderer.test.ts`
- Modify: `src/game/render/drawEntities.ts`

**Interfaces:**
- Preserves: walking/flying frame selection using `motion.fps`
- Changes: tower destination scale `2.6 → 2.0`, bob/squash phase speed `× 0.5`, orc ground anchor `0.60`

- [ ] **Step 1: 정확한 목적지 크기·phase·anchor 실패 테스트 작성**

타워 `drawImage` destination width가 `layout.tileWidth * 2.0 * visualScaleAt(...)`인지 검증한다. 시간 차이에 따른 오크 source frame은 기존 FPS대로 바뀌지만 translate Y는 `Math.sin((time * fps * 0.5 + id * 0.37) * 2π)`를 쓰는지 검증한다. 오크 sprite destination Y는 `-size * 0.60`, 다른 적은 `-size * 0.76`인지 검증한다.

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/game/renderer.test.ts`

Expected: 기존 2.6 배율, 단일 phase, 0.76 anchor 때문에 실패.

- [ ] **Step 3: 렌더링 보정 구현**

```ts
const framePhase = timeSeconds * (motion?.fps ?? 7) + enemy.id * 0.37;
const bobPhase = timeSeconds * (motion?.fps ?? 7) * 0.5 + enemy.id * 0.37;
const frame = motion === null ? 0 : Math.floor(framePhase) % motion.frames;
const wave = Math.sin(bobPhase * Math.PI * 2);
```

타워 size factor는 `2.0`, bounce와 slime squash는 `wave`, 오크 `groundAnchorY`만 `0.60`으로 전달한다.

- [ ] **Step 4: GREEN 확인**

Run: `npx vitest run tests/game/renderer.test.ts`

Expected: renderer suite 전부 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/game/render/drawEntities.ts tests/game/renderer.test.ts
git commit -m "fix: refine entity scale and motion"
```

### Task 5: Blender 워터볼·파이어볼과 런타임 확대

**Files:**
- Modify: `tests/assets/redesignPreviewContract.test.ts`
- Modify: `tests/game/renderer.test.ts`
- Modify: `tools/blender/redesign_preview.py`
- Modify: `src/game/render/drawEffects.ts`
- Regenerate: `assets/renders/redesign-preview-v1/master/vfx/fireball-flight.png`
- Regenerate: `assets/renders/redesign-preview-v1/master/vfx/waterball-flight.png`
- Regenerate: `assets/renders/redesign-preview-v1/mobile/vfx/fireball-flight.png`
- Regenerate: `assets/renders/redesign-preview-v1/mobile/vfx/waterball-flight.png`
- Regenerate: `assets/blender/td-redesign-preview-v1.blend`

**Interfaces:**
- Preserves: 4-frame loop, transparent corners, atomic VFX group publish
- Changes: waterball destination factor `1.7 → 3.4`, fireball `1.55 → 2.325`

- [ ] **Step 1: VFX geometry trace와 목적지 배율 실패 테스트 작성**

Blender source test는 `FireInnerFlame`, `FireTongue`, `WaterStream`, `WaterCrest` 구성 이름과 loop terminal equality를 요구한다. renderer test는 projectile `drawImage` destination width가 각각 `visualUnit * 2.325`, `visualUnit * 3.4`인지 검증한다.

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/assets/redesignPreviewContract.test.ts tests/game/renderer.test.ts`

Expected: 새 geometry 이름과 배율이 없어 실패.

- [ ] **Step 3: procedural 3D VFX 구현**

`build_fireball()`은 적색 core, 황색 inner flame, 뒤로 휘는 5개 `FireTongue`, 순환 ember를 만든다. `build_waterball()`은 청색 core, 회전하는 `WaterCrest`, 뒤쪽 `WaterStream` 3개, 분리되는 drop을 만든다. 모든 object 위치는 `_fireball_state()`와 `_waterball_state()`의 `progress % 1.0`에만 의존하고 frame마다 기존 ownership cleanup을 통과해야 한다.

- [ ] **Step 4: 런타임 배율 구현 및 focused GREEN 확인**

`drawEffects.ts`의 fireball factor를 `2.325`, waterball factor를 `3.4`로 바꾸고 crop은 Task 3의 `SPRITE_FRAME_SIZES.vfx`를 사용한다.

Run: `npx vitest run tests/assets/redesignPreviewContract.test.ts tests/game/renderer.test.ts`

Expected: 두 focused suite 전부 통과.

- [ ] **Step 5: Blender MCP background child로 VFX 재생성**

MCP `execute_blender_code`에서 다음과 동등한 child를 실행한다.

```py
subprocess.run([
    bpy.app.binary_path, "--background", "--factory-startup",
    "--python", "/private/tmp/huchu-defense-v2-3d-preview/tools/blender/redesign_preview.py",
    "--", "--group", "vfx", "--run-id", "BacklogVFX20260721",
], cwd="/private/tmp/huchu-defense-v2-3d-preview", check=True, capture_output=True, text=True)
```

Expected child markers: `TD_PREVIEW_SELF_TEST_OK`, `TD_PREVIEW_RENDER_VALIDATION`, `TD_PREVIEW_LIFECYCLE_OK`, `TD_PREVIEW_OK BacklogVFX20260721`.

- [ ] **Step 6: 생성물 계약 검증**

Run: `npm run assets:preview:validate -- --group vfx`

Expected: `VALIDATED 6 assets / 12 PNG files`.

- [ ] **Step 7: 사용자 VFX 승인 게이트**

다음 두 파일을 절대 경로 이미지로 보여주고 워터볼·파이어볼 승인을 받는다.

- `/private/tmp/huchu-defense-v2-3d-preview/assets/renders/redesign-preview-v1/master/vfx/waterball-flight.png`
- `/private/tmp/huchu-defense-v2-3d-preview/assets/renders/redesign-preview-v1/master/vfx/fireball-flight.png`

- [ ] **Step 8: 승인 후 커밋**

```bash
git add tools/blender/redesign_preview.py src/game/render/drawEffects.ts tests/assets/redesignPreviewContract.test.ts tests/game/renderer.test.ts assets/renders/redesign-preview-v1/master/vfx assets/renders/redesign-preview-v1/mobile/vfx assets/blender/td-redesign-preview-v1.blend
git commit -m "feat: intensify elemental projectile effects"
```

### Task 6: 백로그 완료·통합 검증·main 배포

**Files:**
- Modify: `docs/backlog.md`
- Modify when visual evidence changes: `docs/qa/landscape-844x390.png`

**Interfaces:**
- Consumes: Tasks 1–5 완료 커밋과 사용자 VFX 승인
- Produces: 배포된 `main`, 성공한 Pages workflow, HTTP 200 public assets

- [ ] **Step 1: 백로그 8개를 완료 표시**

루트 작업 트리에만 있던 전체 백로그 문구를 복원하고, 자동·시각 검증을 통과한 항목만 `[x]`로 바꾼다.

- [ ] **Step 2: 전체 로컬 검증**

Run: `npm run check`

Expected: 모든 Vitest 파일 통과, TypeScript와 Vite production build exit 0.

Run: `npm run test:e2e`

Expected: Playwright 전부 통과. sandbox `listen EPERM`이면 동일 명령을 승인된 외부 실행으로 한 번 재시도한다.

Run: `git diff --check`

Expected: 출력 없음.

- [ ] **Step 3: 모바일 시각 검증**

844×390에서 타워 선택 전/후, 저골드 disabled 버튼, 한 타일 내 타워, 느린 bob, 오크 접지, 확대된 water/fire projectile를 확인하고 콘솔 error가 0인지 확인한다. 필요하면 `UPDATE_QA_SCREENSHOTS=1 npm run test:e2e`로 landscape 증거를 갱신한다.

- [ ] **Step 4: 문서와 계획 커밋**

```bash
git add docs/backlog.md docs/superpowers/specs/2026-07-21-backlog-visual-polish-batch-design.md docs/superpowers/plans/2026-07-21-backlog-visual-polish-batch.md
git commit -m "docs: close visual polish backlog"
```

- [ ] **Step 5: feature branch를 main에 병합하고 재검증**

격리 브랜치 테스트가 통과한 뒤 root `main`에서 `git merge codex/3d-preview-assets`를 수행한다. root의 기존 `docs/backlog.md` 미커밋 변경은 동일 내용이므로 병합 전에 patch로 보존하고, 병합 결과가 정확한지 대조한다. 병합 후 `npm run check`를 다시 실행한다.

- [ ] **Step 6: main 푸시와 Pages 확인**

Run: `env -u GITHUB_TOKEN git push origin main`

새 `Deploy to GitHub Pages` run이 `success`가 될 때까지 확인한다. 공개 index title이 `후추덕배 타워 디펜스`이고 `/huchu-duckbae-tower-defense/assets/` JS·CSS가 HTTP 200인지 확인한다.

Expected public URL: `https://loomingsight.github.io/huchu-duckbae-tower-defense/`.
