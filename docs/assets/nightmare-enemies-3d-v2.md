# 나이트메어 적 3D 자산 v2

상태: **구현·자체 검수 완료, 사용자 최종 시각 승인 대기**

## 정교화 기준

- 승인된 2D 기준 도안:
  `assets/concepts/nightmare-v1/nightmare-enemy-lineup-v3.png`
- 모바일 기준 도안:
  `assets/concepts/nightmare-v1/nightmare-enemy-lineup-mobile-v3.png`
- 스타일: 각진 복셀·로우폴리 실루엣을 유지하면서 얼굴, 장비, 표면 무늬,
  재질을 여러 겹으로 분리
- 대상: 그림자 슬라임, 흡혈 박쥐, 해골 기사, 흑요석 골렘, 리치 왕
- 기존 나이트메어 VFX와 맵 키트는 v1을 유지
- 생성기: `tools/blender/nightmare_assets.py`
- owner tag: `nightmare-v2`
- Blender scene: `NightmareAssets_v2`
- 기존 Blender 원본은 실행 전후 SHA-256이 같은지 확인하고,
  v2 collection만 별도 파일로 저장

## 모델 상세 계약

`tools/assets/nightmareEnemyDetailContract.mjs`가 모델별 최소 부품 수와
필수 의미 역할을 고정한다.

| 적 | 실제 부품 수 | 최소 부품 수 | 주요 상세 역할 |
|---|---:|---:|---|
| 그림자 슬라임 | 22 | 18 | 몸체 껍질, 상판, 내부 코어, 눈, 입, 부유 큐브 |
| 흡혈 박쥐 | 37 | 32 | 머리, 귀 안팎, 날개 골격·막, 눈, 주둥이, 송곳니, 발톱 |
| 해골 기사 | 62 | 45 | 두개골, 안와, 이빨, 갈비뼈, 팔다리, 방패 테두리·보석, 검 |
| 흑요석 골렘 | 43 | 32 | 머리·몸통·어깨 판, 주먹, 발, 눈, 코어, 용암 균열 |
| 리치 왕 | 61 | 50 | 두개골, 안와, 이빨, 왕관 첨탑·보석, 후드, 견갑, 로브, 손·손가락, 영혼불 |

Blender collection에는 다음 메타데이터를 기록한다.

- `nightmare_detail_version = 2`
- `nightmare_detail_roles`
- `nightmare_part_count`

## 산출물

- Blender 원본:
  `assets/blender/nightmare-enemies-v2.blend`
- master 동작 시트:
  `assets/renders/nightmare-v2/master/motion/`
- mobile 동작 시트:
  `assets/renders/nightmare-v2/mobile/motion/`
- 적 전용 desktop 비교 보드:
  `assets/renders/nightmare-v2/nightmare-enemy-approval-sheet.png`
- 적 전용 mobile 비교 보드:
  `assets/renders/nightmare-v2/nightmare-enemy-approval-mobile.png`
- 전체 혼합 루트 검수 보드:
  `assets/renders/nightmare-v2/nightmare-approval-sheet.png`
  및 `nightmare-approval-mobile.png`

프레임 계약:

| 동작 시트 | 프레임 | master 셀 | mobile 셀 |
|---|---:|---:|---:|
| 그림자 슬라임 bounce | 6 | 256×256 | 128×128 |
| 흡혈 박쥐 fly | 8 | 256×256 | 128×128 |
| 해골 기사 walk | 6 | 256×256 | 128×128 |
| 흑요석 골렘 walk | 6 | 256×256 | 128×128 |
| 리치 왕 float | 8 | 256×256 | 128×128 |

## 런타임 연결

- `src/game/render/spriteManifest.ts`가 나이트메어 적 5종을 v2 master
  동작 시트로 연결한다.
- `src/game/render/assetLoader.ts`가 노멀 2종과 나이트메어 5종을 함께
  로드한다.
- `src/game/render/drawEntities.ts`는 나이트메어 동작 시트 자체의 부유·보행
  변화를 사용하며 Canvas의 중복 상하 진동을 적용하지 않는다.
- 이미지 로드 실패 시 기존 정면형 Canvas fallback을 유지한다.

## 검증

```text
VALIDATED 67 nightmare assets / 134 PNG files / 1281888 mobile bytes (limit 8388608)
```

검사 범위:

- v2 동작 5종과 v1 VFX 8종·맵 54종의 혼합 루트
- canonical id와 relative path 중복
- 모든 master/mobile 파일 및 정확한 시트 크기
- 네 모서리 alpha 0
- mobile runtime 후보 총량 8MB 이하

Blender MCP 생성 단계에서는 각 v2 collection의 `nightmare_part_count`와
`nightmare_detail_roles`를 읽어 위 표의 최소 부품 수 및 필수 의미 역할을
별도로 확인했다.

E2E는 사용자 승인에 따라 실행하지 않는다. 단위 테스트, 타입 검사,
프로덕션 빌드와 로컬 브라우저 스모크 검증으로 마무리한다.

사용자 최종 시각 승인: 대기
