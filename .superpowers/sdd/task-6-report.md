# Task 6 보고서: Blender voxel enemies and sprite manifest

작성일: 2026-07-20

## 결과

- 신규 Blender 원본: `assets/blender/enemies-voxel-v1.blend`
- 5종 × 4방향 256 RGBA: 20개
- 5종 × 4방향 96 RGBA: 20개
- Vite-safe static manifest: `src/game/render/spriteManifest.ts`
- 자산 명세: `docs/assets/enemies-v1.md`
- TDD 테스트: `tests/game/spriteManifest.test.ts`
- QA contact sheet 2개: full `1024 × 1280`, mobile `384 × 480`

## TDD 증거

테스트를 production manifest보다 먼저 작성했다.

RED 명령:

```text
npm test -- tests/game/spriteManifest.test.ts
```

RED 결과는 exit code `1`이었고, 의도한 미구현 원인으로 실패했다.

```text
FAIL tests/game/spriteManifest.test.ts
Error: Cannot find module '../../src/game/render/spriteManifest'
Test Files 1 failed (1)
```

그 뒤 `ENEMY_SPRITES[type][direction]`을 20개의 literal `new URL(..., import.meta.url).href`로 구현했다. 동적 문자열 조립을 쓰지 않아 Vite가 각 asset을 정적으로 분석할 수 있다.

GREEN 명령:

```text
npm test -- tests/game/spriteManifest.test.ts
```

GREEN 결과:

```text
Test Files 1 passed (1)
Tests 1 passed (1)
```

## Blender MCP 제작 증거

작업 시작 시 현재 Blender 파일은 `assets/blender/slow-tower-v1.blend`였다. 먼저 `bpy.ops.wm.save_as_mainfile`로 `assets/blender/enemies-voxel-v1.blend`에 분리한 뒤에만 새 파일의 active scene/data를 지웠다. 따라서 tower `.blend`는 덮어쓰지 않았다.

실제 제작과 저장, 256 렌더, 96 downsample, contact sheet 생성은 모두 Blender MCP의 `execute_blender_code`를 통해 Blender 안에서 수행했다. 인터넷 모델, Sketchfab, Polyhaven, 생성형 3D 모델, 외부 텍스처는 사용하지 않았다.

Blender 5.2 호환 과정에서 아래 설정 오류를 정확히 확인했다.

1. `enum "BLENDER_EEVEE_NEXT" not found in ('BLENDER_EEVEE', 'BLENDER_WORKBENCH', 'CYCLES')`
   - 원인: Blender 5.2에서 지원되는 Eevee 식별자가 `BLENDER_EEVEE`
   - 조치: `BLENDER_EEVEE` 사용
2. `enum "AgX - Medium High Contrast" not found in (...)`
   - 원인: Blender 5.2의 look enum은 `Medium High Contrast`
   - 조치: 지원 enum을 그대로 사용
3. `'NoneType' object has no attribute 'inputs'`
   - 원인: 한국어 UI에서 Principled BSDF node 이름이 `프린시플드 BSDF`로 현지화됨
   - 조치: node 이름 대신 안정적인 `n.type == 'BSDF_PRINCIPLED'`로 조회

## Root와 hierarchy 검증

Blender 내부에서 각 collection의 mesh bounding box와 object transform을 직접 검사했다. 최종 결과는 `all_ok: true`였다.

| Root | 치수 `(X, Y, Z)` BU | Mesh | Root transform | Body/VFX parent | Min Z | 1/16 dimensions |
| --- | --- | ---: | --- | --- | ---: | --- |
| `Enemy_Slime_Root` | `(1.9375, 1.0, 1.1875)` | 13 | location/rotation `0`, scale `1` | OK | `0` | OK |
| `Enemy_Fairy_Root` | `(1.875, 0.875, 1.8125)` | 25 | location/rotation `0`, scale `1` | OK | `0` | OK |
| `Enemy_Orc_Root` | `(2.375, 1.25, 2.1875)` | 29 | location/rotation `0`, scale `1` | OK | `0` | OK |
| `Enemy_Golem_Root` | `(3.125, 1.1875, 2.875)` | 33 | location/rotation `0`, scale `1` | OK | `0` | OK |
| `Enemy_Minotaur_Root` | `(3.0, 1.25, 3.75)` | 39 | location/rotation `0`, scale `1` | OK | `0` | OK |

모든 root는 Z-up, local `+Y` forward이며 Body와 VFX root가 분리되어 있다. 렌더 후 다섯 root의 yaw는 모두 `0`으로 복원했다.

초기 구조 검증에서 Fairy custom prism bevel이 evaluated dimension을 grid 밖으로 줄이고, 3개 타입의 바닥 조각이 `-0.03125 BU`까지 내려가는 것을 발견했다. 원인 object를 좁혀 다음처럼 수정하고 영향을 받은 4종 32개 파일을 Blender에서 재렌더했다.

- Fairy pointed ears와 4개 diamond wings: custom mesh bevel만 제거해 exact grid dimensions 복원
- `Orc_Club_End`: Z center `0.0625`, height `0.125`
- `Golem_Foot_L`: Z center `0.125`, height `0.25`
- `Minotaur_Hoof_L/R`: Z center `0.125`, height `0.25`

역할별 object 검증:

- Fairy wing count: `4`
- Golem amber crack shard count: `5`
- Minotaur weapon count: `0`
- Orc short-club object count: `3`

## 공통 렌더 검증

- 카메라: `EnemyV1_Ortho_Camera`
- 타입: `ORTHO`
- 위치: `(6.5, -8.5, 6.25)`
- target: `(0, 0, 1.75)`
- ortho scale: `5.25`
- lights: `EnemyV1_Key`, `EnemyV1_Fill`, `EnemyV1_Rim`
- root-only yaw: `ne=315°`, `se=225°`, `sw=135°`, `nw=45°`
- film: transparent
- Blender image 검사: full 20개와 mobile 20개 모두 RGBA 4-channel, 투명 pixel과 불투명 pixel이 함께 존재

파일 수 검증:

```text
find assets/renders/enemies-v1/mobile -name '*-96-v1.png' | wc -l
20

find assets/renders/enemies-v1 ... -name '*-v1.png' | wc -l
20
```

## 시각 검수

Blender에서 아래 두 contact sheet를 생성한 뒤 원본 크기로 직접 확인했다.

- `assets/renders/enemies-v1/contact-sheets/enemies-v1-full-contact-sheet.png`
- `assets/renders/enemies-v1/contact-sheets/enemies-v1-mobile-contact-sheet.png`

행은 `slime/fairy/orc/golem/minotaur`, 열은 `ne/se/sw/nw` 순서다.

- Slime: 낮고 계단형인 acid-lime silhouette, 비복제형 보라 눈/미소 확인
- Fairy: 작은 pointed-ear humanoid, coral diamond wing 정확히 4개 확인
- Orc: olive square silhouette, ivory tusk 2개와 몸보다 짧은 club 확인
- Golem: 좌우 비대칭 blue-gray mass, front에만 sparse amber crack, 연속 visor/circuit 없음 확인
- Minotaur: broad dark reddish-brown mass, 큰 stepped ivory horns, giant weapon 없음 확인
- 네 방향에서 silhouette 겹침이나 crop 없음
- 모바일에서 5종 식별 가능. 동일 카메라와 의도된 체급 차이 때문에 slime/fairy 화면 점유가 golem/minotaur보다 작다는 경미한 주의사항이 있다

## 최종 자동 검증

Focused:

```text
npm test -- tests/game/spriteManifest.test.ts
Test Files 1 passed (1)
Tests 1 passed (1)
```

Full:

```text
npm test
Test Files 12 passed (12)
Tests 65 passed (65)
```

Build:

```text
npm run build
tsc -b && vite build
✓ built in 44ms
```

## 셀프리뷰

- 승인된 v2 lineup의 역할, 색, 금지 요소를 다시 대조함
- tower `.blend` 경로가 변경되지 않았고 신규 enemy `.blend`만 stage 대상임을 확인함
- 5 root의 transform/hierarchy/foot-contact/grid rule을 Blender에서 재검증함
- 20 full + 20 mobile path와 naming을 정렬해 확인함
- manifest type key와 direction key가 enemy catalog 및 파일명과 일치함을 확인함
- contact sheet full/mobile을 모두 시각 확인함
- `.blend1` 자동 백업은 stage하지 않고 `/tmp/huchu-defense-task6-enemies-voxel-v1.blend1`로 이동함
- 기존 untracked `.playwright-cli/`, `.superpowers/`의 다른 파일, `output/`은 변경 또는 stage하지 않음

## Review 수정: direction handedness와 manifest 계약

후속 review에서 local `+Y` forward와 positive Z yaw에 대한 direction handedness 오류가 확인됐다. Blender의 회전 규칙에서 local forward의 world XY는 `(-sin(yaw), cos(yaw))`이므로 기존 mapping은 각 파일명의 좌우 방향을 반대로 연결하고 있었다.

수정 mapping과 검증된 world-forward vector:

| 방향 | Root Z yaw | World forward XY |
| --- | ---: | --- |
| `ne` | `315°` | `(0.707107, 0.707107)` |
| `se` | `225°` | `(0.707107, -0.707107)` |
| `sw` | `135°` | `(-0.707107, -0.707107)` |
| `nw` | `45°` | `(-0.707107, 0.707107)` |

문서만 바꾸지 않고 Blender MCP에서 변경되지 않은 모델, 카메라, 조명으로 5종 × 4방향의 256 RGBA와 96 RGBA 파일 40개를 기존 정확한 파일명에 모두 재렌더했다. 두 contact sheet도 수정 픽셀로 Blender에서 다시 만들었다. 모든 root에는 `render_yaw_mapping=ne=315,se=225,sw=135,nw=45` metadata를 기록했고 저장 전 yaw를 `0`으로 복원했다.

강화된 manifest test는 모든 type/direction의 exact suffix와 20개 URL uniqueness를 검사한다. 현재 구현이 이미 정확한 URL을 가리키고 있었으므로 mutation 방식으로 `slime.ne`를 잠시 `slime.se`에 중복 연결해 RED를 증명한 뒤 즉시 원복했다.

Mutation RED:

```text
npm test -- tests/game/spriteManifest.test.ts
Test Files 1 failed (1)
Tests 2 failed (2)
expected .../mobile/slime/slime-se-96-v1.png to match .../mobile/slime/slime-ne-96-v1.png
expected 19 to be 20
```

원복 후 GREEN:

```text
npm test -- tests/game/spriteManifest.test.ts
Test Files 1 passed (1)
Tests 2 passed (2)
```

후속 full/build:

```text
npm test
Test Files 12 passed (12)
Tests 66 passed (66)

npm run build
tsc -b && vite build
✓ built in 79ms
```

Blender 후속 검증 결과:

- corrected yaw mapping과 4개 world-forward quadrant: OK
- 5개 root yaw `0`, location `0`, scale `1`: OK
- Body/VFX parent 관계: OK
- full 20개 + mobile 20개, RGBA alpha: OK
- alpha crop: 모든 방향에서 canvas edge에 닿지 않음
- 최소 alpha margin: full `10 px`, mobile `3 px`
- 이전 commit의 반대방향 파일과 decoded RGBA swap 비교 40건: mismatch `0`, maximum pixel difference `0.0`; 새 `ne←기존 nw`, `se←기존 sw`, `sw←기존 se`, `nw←기존 ne`로 픽셀을 실제 재배치했고 모델 디자인은 변하지 않음
- 공통 camera `EnemyV1_Ortho_Camera`, location `(6.5, -8.5, 6.25)`, ortho scale `5.25`: 유지
- 공통 lights `EnemyV1_Key`, `EnemyV1_Fill`, `EnemyV1_Rim`: 유지
- review 재저장 때 생긴 `.blend1` 자동 백업은 stage하지 않고 `/tmp/huchu-defense-task6-handedness-fix.blend1`로 이동

수정 contact sheet를 full/mobile 원본 크기로 다시 확인했다. 열 순서 `ne/se/sw/nw`가 각 enemy에서 side/front/opposite-side/back으로 일관되게 순환하고, Fairy wings, Orc club, Golem front cracks, Minotaur face/horns의 좌우·정면·후면 단서가 두 해상도에서 서로 맞는다. alpha 경계 손실과 crop은 보이지 않았다.
