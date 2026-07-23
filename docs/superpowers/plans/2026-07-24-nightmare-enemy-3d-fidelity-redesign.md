# Nightmare Enemy 3D Fidelity Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 2D v3와 같은 캐릭터로 인식되는 정교한 나이트메어 적 5종을 Blender MCP로 제작하고 HTML Canvas 런타임에 연결한다.

**Architecture:** 기존 procedural Blender 파이프라인을 의미 기반 세부 부품 계약으로 확장한다. 거절된 v1 결과는 보존하고 적 motion만 v2 root에 생성하며, 기존 v1 VFX·map과 혼합 검증한다. 런타임은 적 타입별 정면 motion sheet를 로드하고 로딩 실패 시 기존 Canvas fallback만 사용한다.

**Tech Stack:** Blender Python API, Blender MCP, HTML Canvas 2D, TypeScript, Vite, Vitest, Node.js asset validators

## Global Constraints

- 기준 도안은 `assets/concepts/nightmare-v1/nightmare-enemy-lineup-v3.png`이다.
- 스타일은 각진 voxel/low-poly를 유지하면서 얼굴·장비·문양·재질을 다층 구조로 세분화한다.
- 범위는 적 5종에 한정하고 VFX와 map 외형은 변경하지 않는다.
- 모든 적은 이동 방향과 무관하게 정면을 유지한다.
- 기존 `nightmare-v1` 렌더와 blend는 덮어쓰거나 삭제하지 않는다.
- 신규 적 렌더는 `assets/renders/nightmare-v2/{master,mobile}/motion/`에 둔다.
- 신규 Blender 파일은 `assets/blender/nightmare-enemies-v2.blend`이다.
- master frame은 256×256, mobile frame은 128×128이다.
- E2E와 `npm run test:e2e`는 실행하지 않는다.
- 원격 push와 GitHub Pages 배포는 별도 사용자 요청 전에는 수행하지 않는다.

---

## File Structure

### 신규 파일

- `tools/assets/nightmareEnemyDetailContract.mjs`: 캐릭터별 필수 세부 역할과 최소 부품 수
- `docs/assets/nightmare-enemies-3d-v2.md`: 정교화 인벤토리와 검수 결과
- `assets/blender/nightmare-enemies-v2.blend`: 정교화된 적 Blender 원본
- `assets/renders/nightmare-v2/`: v2 motion sheet와 승인 보드

### 수정 파일

- `tools/blender/nightmare_assets.py`: v2 output, 세부 primitive helper와 적 5종 모델
- `tools/assets/nightmareAssetContract.mjs`: motion v2 / VFX·map v1 혼합 root
- `tools/assets/validateNightmareAssets.mjs`: asset별 root와 세부 계약 검증
- `tools/assets/buildNightmareApprovalSheet.mjs`: v2 적 승인 보드와 혼합 root 읽기
- `tests/assets/nightmareAssetContract.test.ts`: v2 세부·경로·프레임 계약
- `src/game/render/spriteManifest.ts`: 신규 motion sheet URL과 타입
- `src/game/render/assetLoader.ts`: 신규 motion 이미지 로딩
- `src/game/render/drawEntities.ts`: 신규 적 motion sheet 렌더와 anchor
- `tests/game/assetLoader.test.ts`: 신규 적 로딩 격리
- `tests/game/renderTestUtils.ts`: 신규 motion fixture
- `tests/game/renderer.test.ts`: 신규 적 프레임과 fallback 회귀

---

### Task 1: v2 에셋·세부 부품 계약

**Files:**
- Create: `tools/assets/nightmareEnemyDetailContract.mjs`
- Modify: `tools/assets/nightmareAssetContract.mjs`
- Modify: `tests/assets/nightmareAssetContract.test.ts`

**Interfaces:**
- Produces: `NIGHTMARE_V1_ROOT`, `NIGHTMARE_V2_ROOT`
- Produces: asset descriptor `root: string`
- Produces: `NIGHTMARE_ENEMY_DETAIL_CONTRACT`
- Preserves: 5 motion, 8 VFX, 54 map assets and existing frame counts

- [ ] **Step 1: v2 root와 필수 세부 역할 실패 테스트 작성**

```ts
import {
  NIGHTMARE_ASSETS,
  NIGHTMARE_V1_ROOT,
  NIGHTMARE_V2_ROOT,
} from '../../tools/assets/nightmareAssetContract.mjs';
import {
  NIGHTMARE_ENEMY_DETAIL_CONTRACT,
} from '../../tools/assets/nightmareEnemyDetailContract.mjs';

it('routes only refined motion sheets through nightmare v2', () => {
  expect(NIGHTMARE_ASSETS.filter(({ group }) => group === 'motion')
    .every(({ root }) => root === NIGHTMARE_V2_ROOT)).toBe(true);
  expect(NIGHTMARE_ASSETS.filter(({ group }) => group !== 'motion')
    .every(({ root }) => root === NIGHTMARE_V1_ROOT)).toBe(true);
});

it('defines readable semantic detail for every refined enemy', () => {
  expect(Object.keys(NIGHTMARE_ENEMY_DETAIL_CONTRACT)).toEqual([
    'shadow-slime-bounce',
    'vampire-bat-fly',
    'skeleton-knight-walk',
    'obsidian-golem-walk',
    'lich-king-float',
  ]);
  for (const contract of Object.values(NIGHTMARE_ENEMY_DETAIL_CONTRACT)) {
    expect(contract.minimumParts).toBeGreaterThanOrEqual(18);
    expect(contract.requiredRoles.length).toBeGreaterThanOrEqual(6);
  }
});
```

- [ ] **Step 2: 새 모듈과 v2 root가 없어 RED가 되는지 확인**

Run: `npx vitest run tests/assets/nightmareAssetContract.test.ts`

Expected: FAIL with missing `nightmareEnemyDetailContract.mjs`, `NIGHTMARE_V1_ROOT` or `NIGHTMARE_V2_ROOT`.

- [ ] **Step 3: 세부 부품 계약 구현**

```js
export const NIGHTMARE_ENEMY_DETAIL_CONTRACT = Object.freeze({
  'shadow-slime-bounce': Object.freeze({
    minimumParts: 18,
    requiredRoles: Object.freeze([
      'body-shell', 'top-plate', 'inner-core', 'eye', 'mouth', 'floating-cube',
    ]),
  }),
  'vampire-bat-fly': Object.freeze({
    minimumParts: 32,
    requiredRoles: Object.freeze([
      'head', 'outer-ear', 'inner-ear', 'wing-frame', 'wing-membrane',
      'eye', 'muzzle', 'fang', 'claw',
    ]),
  }),
  'skeleton-knight-walk': Object.freeze({
    minimumParts: 45,
    requiredRoles: Object.freeze([
      'skull', 'eye-socket', 'tooth', 'rib', 'limb', 'shield-rim',
      'shield-gem', 'sword-blade', 'sword-hilt',
    ]),
  }),
  'obsidian-golem-walk': Object.freeze({
    minimumParts: 32,
    requiredRoles: Object.freeze([
      'head-plate', 'torso-plate', 'shoulder-plate', 'fist', 'foot',
      'eye', 'core', 'lava-crack',
    ]),
  }),
  'lich-king-float': Object.freeze({
    minimumParts: 50,
    requiredRoles: Object.freeze([
      'skull', 'eye-socket', 'tooth', 'crown-spire', 'crown-gem',
      'hood', 'pauldron', 'robe-strip', 'hand', 'finger', 'soul-flame',
    ]),
  }),
});
```

- [ ] **Step 4: asset별 root를 가진 혼합 manifest 구현**

`NIGHTMARE_V1_ROOT`는 `assets/renders/nightmare-v1`, `NIGHTMARE_V2_ROOT`는 `assets/renders/nightmare-v2`를 가리킨다. `asset()`은 `root`를 필수 인자로 받고 motion에는 v2, VFX와 map에는 v1을 전달한다.

- [ ] **Step 5: GREEN 확인**

Run: `npx vitest run tests/assets/nightmareAssetContract.test.ts`

Expected: PASS.

---

### Task 2: 적 5종 Blender v2 모델

**Files:**
- Modify: `tools/blender/nightmare_assets.py`
- Modify: `tests/assets/nightmareAssetContract.test.ts`
- Create: `assets/blender/nightmare-enemies-v2.blend`

**Interfaces:**
- Consumes: `NIGHTMARE_ENEMY_DETAIL_CONTRACT`과 같은 asset ID·role 이름
- Produces: owner `nightmare-v2`
- Produces: collection metadata `nightmare_detail_version = 2`
- Produces: collection metadata `nightmare_detail_roles`와 `nightmare_part_count`
- Preserves: source blend SHA-256 보호와 factory reset 금지

- [ ] **Step 1: 생성기의 v2 보호·metadata 실패 테스트 작성**

```ts
const source = readFileSync('tools/blender/nightmare_assets.py', 'utf8');
expect(source).toContain('OWNER = "nightmare-v2"');
expect(source).toContain('OUTPUT = REPO / "assets/renders/nightmare-v2"');
expect(source).toContain('nightmare_detail_version');
expect(source).toContain('nightmare_detail_roles');
expect(source).toContain('nightmare_part_count');
for (const role of [
  'body-shell', 'wing-membrane', 'shield-rim',
  'lava-crack', 'crown-spire', 'soul-flame',
]) expect(source).toContain(`"${role}"`);
expect(source).not.toContain('read_factory_settings');
```

- [ ] **Step 2: v1 상수와 metadata 부재로 RED가 되는지 확인**

Run: `npx vitest run tests/assets/nightmareAssetContract.test.ts`

Expected: FAIL with `nightmare-v2` or semantic role missing.

- [ ] **Step 3: v2 output과 공용 세부 helper 구현**

`_role()`은 동일 role의 여러 부품을 허용한다. `_finish_detail_contract(asset_id)`는 active collection의 모든 object에서 `nightmare_role`을 모아 collection metadata를 기록하고, Python의 캐릭터별 필수 role·최소 부품 수와 대조해 부족하면 렌더 전에 `AssertionError`를 낸다.

공용 helper는 다음 책임만 갖는다.

```py
def _finish_detail_contract(asset_id: str) -> None:
    objects = [obj for obj in _ACTIVE_COLLECTION.objects if obj.type != "EMPTY"]
    roles = sorted({
        str(obj.get("nightmare_role"))
        for obj in objects
        if isinstance(obj.get("nightmare_role"), str)
    })
    contract = ENEMY_DETAIL_CONTRACT[asset_id]
    missing = sorted(set(contract["required_roles"]) - set(roles))
    if len(objects) < contract["minimum_parts"] or missing:
        raise AssertionError(
            f"{asset_id} detail contract failed: parts={len(objects)}, missing={missing}"
        )
    _ACTIVE_COLLECTION["nightmare_detail_version"] = 2
    _ACTIVE_COLLECTION["nightmare_detail_roles"] = json.dumps(roles)
    _ACTIVE_COLLECTION["nightmare_part_count"] = len(objects)
```

- [ ] **Step 4: 그림자 슬라임과 흡혈 박쥐 재모델링**

그림자 슬라임에는 겹친 body shell, top plate, inner core, 양쪽 눈, 입, 볼 하이라이트와 최소 네 floating cube를 만든다. 흡혈 박쥐에는 outer/inner ear, 얼굴판, 주둥이, 코, 눈, 두 송곳니, 발톱과 방향당 최소 세 wing membrane·wing frame을 만든다. 각 builder 마지막에 `_finish_detail_contract(asset_id)`를 호출한다.

- [ ] **Step 5: 해골 기사 재모델링**

두개골을 이마·관자·광대·턱으로 나누고 검은 eye socket 위에 보라 eye를 겹친다. 앞니 여섯 개, 목 스카프, 척추, 갈비뼈, 관절과 발을 분리한다. 방패는 plate/rim/bolt/gem, 검은 blade/edge/guard/grip/pommel로 분리한다.

- [ ] **Step 6: 흑요석 골렘 재모델링**

머리와 몸통을 여러 rock plate로 겹치고 brow/jaw를 추가한다. 어깨, 위팔, 아래팔, 주먹, 허벅지와 발을 독립 부품으로 만든다. 꺾인 orange curve 또는 짧은 box chain으로 가슴·어깨·팔의 lava crack과 중앙 core를 만든다.

- [ ] **Step 7: 리치 왕 재모델링**

두개골 세부, 중앙 대형 첨탑과 좌우 첨탑, crown gem, hood/collar/pauldron, chest gem/belt, 최소 다섯 robe strip을 만든다. 각 손은 손바닥과 최소 세 finger로 구성하고 좌우 soul flame을 추가한다.

- [ ] **Step 8: 각 동작을 정면 유지 상태로 보정**

기존 프레임 수를 유지한다. 날개, 관절, 주먹, 로브와 손만 정면 평면 안에서 움직이고 root의 Z 이동은 모바일에서 한 타일을 벗어나지 않게 제한한다. 지상형 셋의 최저점은 동일 anchor를 사용한다.

- [ ] **Step 9: GREEN 확인**

Run: `npx vitest run tests/assets/nightmareAssetContract.test.ts`

Expected: PASS.

---

### Task 3: Blender MCP 렌더와 에셋 검증

**Files:**
- Modify: `tools/assets/validateNightmareAssets.mjs`
- Modify: `tools/assets/buildNightmareApprovalSheet.mjs`
- Create: `assets/renders/nightmare-v2/master/motion/*.png`
- Create: `assets/renders/nightmare-v2/mobile/motion/*.png`
- Create: `assets/renders/nightmare-v2/nightmare-enemy-approval-sheet.png`
- Create: `assets/renders/nightmare-v2/nightmare-enemy-approval-mobile.png`
- Create: `docs/assets/nightmare-enemies-3d-v2.md`

**Interfaces:**
- Consumes: asset descriptor `root`
- Produces: `validateNightmareAssets()` mixed-root result
- Produces: v2 적 5종 desktop/mobile 승인 보드

- [ ] **Step 1: validator가 asset별 root를 사용해야 하는 실패 테스트 작성**

테스트용 임시 root 두 개에 motion과 support 파일을 나눠 배치하고 `validateNightmareAssets({ assets, chromiumApi })`를 호출한다. 단일 전역 root로 찾으면 ENOENT가 나고 asset.root를 사용하면 통과하도록 구성한다.

- [ ] **Step 2: 기존 단일 root 구현에서 RED 확인**

Run: `npx vitest run tests/assets/nightmareAssetContract.test.ts`

Expected: FAIL with missing file under the wrong root.

- [ ] **Step 3: validator와 승인 보드를 asset별 root로 변경**

`assetFiles()`는 `path.join(asset.root, variant, asset.relativePath)`를 사용한다. 승인 보드도 각 카드의 master/mobile을 `asset.root`에서 읽는다. 결과 이미지는 `NIGHTMARE_V2_ROOT`에 저장하고 motion 카드만 담은 상단 비교 영역을 제공한다.

- [ ] **Step 4: Blender MCP로 v2 모델 생성**

Blender MCP의 Python 실행으로 다음 함수를 순서대로 호출한다.

```py
import importlib.util
from pathlib import Path
path = Path("/Users/jadon/Documents/huchu-defense-v2/.worktrees/nightmare-mode/tools/blender/nightmare_assets.py")
spec = importlib.util.spec_from_file_location("nightmare_assets_v2", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.reset_nightmare_scene()
module.build_enemy_models()
module.render_master_and_mobile()
module.save_blend_files()
```

Expected markers:

```text
NIGHTMARE_SCENE_READY
NIGHTMARE_ENEMIES_BUILT
NIGHTMARE_RENDER_COMPLETE
NIGHTMARE_BLEND_SAVED
```

- [ ] **Step 5: 에셋 validator와 승인 보드 생성**

Run: `npm run assets:nightmare:validate`

Expected: 67 assets, 134 PNG files, mobile bytes below 8,388,608.

Run: `npm run assets:nightmare:sheet`

Expected: v2 desktop/mobile approval board paths.

- [ ] **Step 6: 개별·모바일 수동 검수**

2D v3, v2 desktop 승인 보드와 v2 mobile 승인 보드를 확인한다. 다섯 적 모두 얼굴, 대표 장비, 발광 포인트가 읽히고 잘림·불투명 배경·바닥 공백이 없어야 한다. 문제가 있는 모델만 generator를 수정하고 Step 4~6을 반복한다.

- [ ] **Step 7: v2 인벤토리 문서 작성**

문서에는 source 2D, Blender 파일, 렌더 root, 프레임 수, part count/roles, validator 결과와 수동 검수 결과를 기록한다. 사용자 최종 시각 승인은 `미승인`으로 남긴다.

---

### Task 4: HTML Canvas 런타임 연결

**Files:**
- Modify: `src/game/render/spriteManifest.ts`
- Modify: `src/game/render/assetLoader.ts`
- Modify: `src/game/render/drawEntities.ts`
- Modify: `tests/game/assetLoader.test.ts`
- Modify: `tests/game/renderTestUtils.ts`
- Modify: `tests/game/renderer.test.ts`

**Interfaces:**
- Produces: `MOTION_ENEMY_TYPES`, `MotionEnemyType`
- Produces: `MOTION_SPRITES` entries for normal motion 2종 and nightmare motion 5종
- Produces: `GameAssets.motion: Readonly<Record<MotionEnemyType, LoadedSprite>>`
- Preserves: static normal enemy direction sprites and per-slot load failure fallback

- [ ] **Step 1: 신규 적 로딩과 motion frame 실패 테스트 작성**

```ts
expect(assets.motion.shadowSlime).toBeInstanceOf(MixedResultImage);
expect(assets.motion.vampireBat).toBeInstanceOf(MixedResultImage);
expect(assets.motion.skeletonKnight).toBeInstanceOf(MixedResultImage);
expect(assets.motion.obsidianGolem).toBeInstanceOf(MixedResultImage);
expect(assets.motion.lichKing).toBeInstanceOf(MixedResultImage);
```

렌더 테스트는 `timeSeconds: 1 / fps`에서 `motion-shadow-slime`의 source X가 256이고, `assets.motion.shadowSlime = null`일 때만 Canvas fallback 라벨 `암`이 그려지는지 확인한다.

- [ ] **Step 2: 신규 motion slot 부재로 RED 확인**

Run: `npx vitest run tests/game/assetLoader.test.ts tests/game/renderer.test.ts`

Expected: FAIL with missing nightmare motion property or fallback label still used.

- [ ] **Step 3: sprite manifest와 loader 확장**

```ts
export const MOTION_SPRITES = {
  orc: { url: ..., frames: 6, fps: 8 },
  fairy: { url: ..., frames: 8, fps: 12 },
  shadowSlime: {
    url: new URL('../../../assets/renders/nightmare-v2/master/motion/shadow-slime-bounce.png', import.meta.url).href,
    frames: 6,
    fps: 7,
  },
  vampireBat: { url: ..., frames: 8, fps: 10 },
  skeletonKnight: { url: ..., frames: 6, fps: 7 },
  obsidianGolem: { url: ..., frames: 6, fps: 5 },
  lichKing: { url: ..., frames: 8, fps: 6 },
} as const;

export type MotionEnemyType = keyof typeof MOTION_SPRITES;
export const MOTION_ENEMY_TYPES = Object.keys(MOTION_SPRITES) as MotionEnemyType[];
```

`loadGameAssets()`는 다섯 URL을 추가로 로드하고 `motion` record에 반환한다. `enemies`의 나이트메어 방향 slot은 호환과 fallback을 위해 그대로 둔다.

- [ ] **Step 4: 신규 적 공용 motion 렌더 구현**

```ts
function motionFor(type: EnemyType) {
  return type in MOTION_SPRITES
    ? MOTION_SPRITES[type as MotionEnemyType]
    : null;
}
```

`drawEnemyBody()`는 `motionFor(enemy.type)`과 `assets.motion[enemy.type as MotionEnemyType]`를 사용한다. v2 sheet에 이미 바운스/부유가 있으므로 신규 5종에는 Canvas bounce를 중복 적용하지 않는다. 지상형 anchor는 그림자 슬라임·해골 기사·흑요석 골렘에 맞추고 박쥐·리치 왕은 sheet 내부 여백을 유지한다.

- [ ] **Step 5: GREEN 확인**

Run: `npx vitest run tests/game/assetLoader.test.ts tests/game/renderer.test.ts tests/game/spriteManifest.test.ts`

Expected: PASS.

---

### Task 5: 전체 검증과 로컬 커밋

**Files:**
- Modify: `docs/assets/nightmare-3d-v1.md`
- Modify: `docs/assets/nightmare-enemies-3d-v2.md`
- Modify: `docs/superpowers/plans/2026-07-24-nightmare-enemy-3d-fidelity-redesign.md`

**Interfaces:**
- Produces: 재현 가능한 검증 기록
- Preserves: 사용자 최종 시각 승인 상태 `미승인`

- [ ] **Step 1: 계획 요구사항 자체 검수**

Run: `rg -n 'TODO|TBD|implement later|사용자 승인 완료: 승인' docs/superpowers/plans/2026-07-24-nightmare-enemy-3d-fidelity-redesign.md docs/assets/nightmare-enemies-3d-v2.md`

Expected: no placeholder and no false approval.

- [ ] **Step 2: 에셋 계약 검증**

Run: `npm run assets:nightmare:validate`

Expected: 67 assets, 134 PNG files, mobile bytes below 8MB.

- [ ] **Step 3: 전체 단위 테스트**

Run: `npm test`

Expected: all Vitest tests PASS with zero failures.

- [ ] **Step 4: 프로덕션 빌드**

Run: `npm run build`

Expected: TypeScript build and Vite production build PASS.

- [ ] **Step 5: Vite base 확인**

Run: `rg -o '/huchu-duckbae-tower-defense/[^\" ]+\\.(js|css)' dist/index.html`

Expected: generated JS and CSS URLs start with `/huchu-duckbae-tower-defense/`.

- [ ] **Step 6: diff와 사용자 변경 보존 확인**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: only approved nightmare asset refinement and previously tracked candidate files.

- [ ] **Step 7: 논리 단위 커밋**

```bash
git add tools/assets tools/blender tests/assets package.json \
  assets/blender/nightmare-enemies-v1.blend \
  assets/blender/nightmare-map-kit-v1.blend \
  assets/blender/nightmare-enemies-v2.blend \
  assets/renders/nightmare-v1 assets/renders/nightmare-v2 \
  docs/assets/nightmare-3d-v1.md docs/assets/nightmare-enemies-3d-v2.md
git commit -m "art: refine nightmare enemy assets"

git add src/game/render tests/game \
  docs/superpowers/specs/2026-07-24-nightmare-enemy-3d-fidelity-redesign-design.md \
  docs/superpowers/plans/2026-07-24-nightmare-enemy-3d-fidelity-redesign.md
git commit -m "feat: render refined nightmare enemies"
```

- [ ] **Step 8: E2E 제외 기록**

완료 보고에 E2E를 사용자 승인에 따라 실행하지 않았음을 명시한다. 사용자에게 v2 desktop/mobile 승인 보드 경로를 제공하고 최종 시각 승인을 요청한다. 원격 push와 배포는 수행하지 않는다.

