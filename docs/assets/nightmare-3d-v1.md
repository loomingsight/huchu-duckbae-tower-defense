# 나이트메어 3D 자산 v1

상태: **적 모델은 v2로 대체, 특성 VFX·맵 키트는 런타임 후보로 유지**

이 문서의 적 5종은 정교함이 부족하다는 피드백에 따라
`docs/assets/nightmare-enemies-3d-v2.md`의 모델로 교체했다. 아래 인벤토리와
검증 기록은 v1 산출물을 보존하기 위한 기록이며, 특성 VFX 8종과 맵 키트
54종은 계속 사용한다.

## 생성 기준

- 입력 도안: `assets/concepts/nightmare-v1/nightmare-enemy-lineup-v3.png`
- 생성기: `tools/blender/nightmare_assets.py`
- owner tag: `nightmare-v1`
- Blender 실행: MCP 단계 실행
  - `reset_nightmare_scene`
  - `build_enemy_models`
  - `build_trait_vfx`
  - `build_map_kit`
  - `render_master_and_mobile`
  - `save_blend_files`
- 기존 Blender 원본 5개는 실행 전후 SHA-256 비교로 변경되지 않았음을 확인했다.
- 현재 열린 원본 파일을 저장하지 않고 생성 collection만 별도 `.blend`로 export했다.

## 인벤토리

| 그룹 | 자산 수 | 논리 프레임 |
|---|---:|---:|
| 적 정면 동작 | 5 | 34 |
| 특성 VFX | 8 | 46 |
| 테마 맵 키트 | 54 | 54 |
| 합계 | 67 | 134 |

- master PNG: 67개, 프레임 셀 256×256
- mobile PNG: 67개, 프레임 셀 128×128
- 전체 PNG: 134개
- master runtime 후보: 3,723,639 bytes
- mobile runtime 후보: 1,160,670 bytes
- master + mobile: 4,884,309 bytes
- mobile 상한: 8,388,608 bytes

## Blender 파일

- 적·특성 VFX:
  `assets/blender/nightmare-enemies-v1.blend`
- 여섯 테마 맵 키트:
  `assets/blender/nightmare-map-kit-v1.blend`

## 검수 이미지

- desktop 전체 승인 보드:
  `assets/renders/nightmare-v1/nightmare-approval-sheet.png` (1200×7901)
- mobile 전체 승인 보드:
  `assets/renders/nightmare-v1/nightmare-approval-mobile.png` (844×6634)
- 런타임 후보 루트:
  `assets/renders/nightmare-v1/{master,mobile}/`

## Validator 결과

```text
VALIDATED 67 nightmare assets / 134 PNG files / 1160670 mobile bytes (limit 8388608)
```

검사 항목:

- canonical id와 relative path 중복 없음
- motion 5종, VFX 8종, map 54종
- 여섯 테마마다 정확히 9개 맵 조각
- 모든 master/mobile 파일 존재
- 정적·동작 시트의 정확한 width와 height
- 모든 PNG 네 모서리 alpha 0
- mobile runtime 후보 총량 8MB 이하

## 자체 검수

- [x] 적 5종이 모두 이동 방향과 무관한 정면 실루엣이다.
- [x] 해골 기사의 실물 방패가 얼굴을 가리지 않는다.
- [x] 해골 기사 발동 VFX는 앞쪽의 반투명 가상 방패 하나다.
- [x] 흡혈 박쥐 둔화 저항은 보라색 날개와 두 조각의 청색 얼음 고리다.
- [x] 둔화 저항에 회복 표식이나 방패가 없다.
- [x] 지상형 적의 바닥 anchor가 일치하고 박쥐·리치 왕만 의도적으로 부유한다.
- [x] 모든 동작 시트에서 프레임 간 위치·날개·보행·부유 변화가 확인된다.
- [x] 길에는 무늬가 없고 직선·직각 코너가 구분된다.
- [x] 여섯 테마가 서로 구분되면서 길과 지면의 명도 차이가 유지된다.
- [x] 보물상자는 정면에서 잠금장치와 간식이 보인다.
- [x] 배경이 투명하고 네 모서리에 불투명 픽셀이 없다.

사용자 승인 완료: 적 모델 미승인·교체, VFX·맵 키트 승인 대기
