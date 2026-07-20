# Enemy Voxel V1 자산

승인 원본은 `assets/concepts/enemies/enemy-lineup-2d-v2.png`다. 모든 모델은 외부 모델이나 텍스처 없이 Blender MCP에서 procedural block geometry와 단색 Principled BSDF 재료로 제작했다.

## Blender 원본

- 파일: `assets/blender/enemies-voxel-v1.blend`
- 씬: `EnemyVoxelV1`
- 좌표계: Z-up, local `+Y` forward
- 그리드: `1/16 BU` (`0.0625 BU`)
- 각 enemy root: 위치 `(0, 0, 0)`, 회전 `(0, 0, 0)`, 스케일 `(1, 1, 1)`
- 발 접점: 각 모델 mesh bounds의 최소 Z가 `0 BU`
- 계층: 각 `Enemy_<Type>_Root` 아래에 별도 `Enemy_<Type>_Body`, `Enemy_<Type>_VFX` root가 있다

| 타입 | Root | 전체 치수 `(X, Y, Z)` BU | Mesh 수 | 구분 요소 |
| --- | --- | --- | ---: | --- |
| slime | `Enemy_Slime_Root` | `(1.9375, 1.0, 1.1875)` | 13 | 낮은 acid-lime stepped blob |
| fairy | `Enemy_Fairy_Root` | `(1.875, 0.875, 1.8125)` | 25 | pointed ears, coral diamond wing 정확히 4개 |
| orc | `Enemy_Orc_Root` | `(2.375, 1.25, 2.1875)` | 29 | olive square body, tusk 2개, 짧은 club |
| golem | `Enemy_Golem_Root` | `(3.125, 1.1875, 2.875)` | 33 | 비대칭 blue-gray blocks, amber crack shard 5개, 분리된 두 눈 |
| minotaur | `Enemy_Minotaur_Root` | `(3.0, 1.25, 3.75)` | 39 | 넓은 dark reddish-brown body, large ivory horn 2개, weapon 없음 |

Golem에는 visor나 circuit pattern을 사용하지 않았고, Minotaur에는 giant weapon을 두지 않았다.

## 공통 렌더 리그

- 카메라: `EnemyV1_Ortho_Camera`
- 타입: orthographic
- 위치: `(6.5, -8.5, 6.25)`
- target: `(0, 0, 1.75)`
- orthographic scale: `5.25`
- 조명: `EnemyV1_Key` area light `850 W`, `EnemyV1_Fill` area light `520 W`, `EnemyV1_Rim` area light `700 W`
- 엔진: Blender 5.2 Eevee (`BLENDER_EEVEE`)
- 출력: PNG RGBA, transparent film, 원본 `256 × 256`, 모바일 `96 × 96`

카메라와 조명은 고정하고 enemy root의 Z yaw만 아래처럼 바꿨다.

| 방향 | Root Z yaw |
| --- | ---: |
| `ne` | `315°` |
| `se` | `225°` |
| `sw` | `135°` |
| `nw` | `45°` |

local `+Y` forward를 positive Z yaw로 회전했을 때 world forward는 `(-sin(yaw), cos(yaw))`다. 따라서 위 mapping은 각각 `NE=(+X,+Y)`, `SE=(+X,-Y)`, `SW=(-X,-Y)`, `NW=(-X,+Y)`를 만든다. 각 방향을 렌더한 뒤 root yaw를 `0°`로 복원해 `.blend`를 저장했다.

## 출력 경로

- 256 원본: `assets/renders/enemies-v1/<type>/<type>-{ne,se,sw,nw}-v1.png`
- 96 모바일: `assets/renders/enemies-v1/mobile/<type>/<type>-{ne,se,sw,nw}-96-v1.png`
- 전체 QA 시트: `assets/renders/enemies-v1/contact-sheets/enemies-v1-full-contact-sheet.png`
- 모바일 QA 시트: `assets/renders/enemies-v1/contact-sheets/enemies-v1-mobile-contact-sheet.png`

QA 시트 행 순서는 `slime`, `fairy`, `orc`, `golem`, `minotaur`, 열 순서는 `ne`, `se`, `sw`, `nw`다. 모바일 파일 20개는 `src/game/render/spriteManifest.ts`의 `ENEMY_SPRITES[type][direction]`에 정적으로 연결된다.
