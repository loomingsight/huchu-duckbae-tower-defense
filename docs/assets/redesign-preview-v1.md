# 후추 디펜스 3D 리뉴얼 대표 시안 v1

## 상태

이 문서는 `redesign-preview-v1`의 사용자 승인 handoff다. 현재 상태는 **사용자 승인 대기**이며, 승인 전에는 전체 asset batch, 게임 연결, projection 변경, Material 3 UI, scoring 또는 다른 post-approval 구현을 시작하지 않는다.

## 출력

- Blender 원본: `assets/blender/td-redesign-preview-v1.blend`
- Contact sheet: `assets/renders/redesign-preview-v1/redesign-preview-contact-sheet.png`
- Master: `assets/renders/redesign-preview-v1/master/`
- Mobile: `assets/renders/redesign-preview-v1/mobile/`
- Generator: `tools/blender/redesign_preview.py`
- Approval-board builder: `tools/assets/buildRedesignPreviewSheet.mjs`

Contact sheet는 844 CSS px, DPR 1, 한 줄당 카드 1개로 생성한다. 현재 PNG는 `844×10267`이며 SHA-256은 `00e778fc6e93291703469a5071dfcc61489c22f5ad20189a19e64162f77f7be2`다.

## 승인 인벤토리

| 구분 | Asset | PNG | 논리 프레임 | Master·mobile thumbnail |
|---|---:|---:|---:|---:|
| 정적 map | 9 | 18 | 9 | 18 |
| 정적 tower | 4 | 8 | 4 | 8 |
| 애니메이션 motion | 2 | 4 | 14 | 28 |
| 애니메이션 VFX | 6 | 12 | 36 | 72 |
| 합계 | 21 | 42 | 63 | 126 |

- 정적: 13 asset / 13 logical frame / master·mobile 26 thumbnail
- 애니메이션: 8 asset / 50 logical frame / master·mobile 100 numbered thumbnail
- 애니메이션 구성: Orc 6, Fairy 8, 방향 화살 8, Fireball 4, Waterball 4, Arrow impact 4, Fire burst 8, Aqua burst 8
- Task 6 초기 addendum의 animated 수치는 manifest 합산과 맞지 않는 오기다. 이 승인 보드는 `PREVIEW_ASSETS`에서 산출한 정확한 `50 logical frames / 100 numbered thumbnails`를 사용한다.

## 카드 증거 구조

모든 21개 카드는 `sourceReference | master | mobile` 3열을 유지한다.

- sourceReference 열: 원본 경로, 실제 generator, 객체 선택 또는 절차 생성 filter, id/group/frame metadata
- master 열: 실제 256px source cell을 정적은 256 CSS px, 애니메이션은 프레임별 128 CSS px로 표시
- mobile 열: 실제 128px cell을 모든 경우 최소 128 CSS px로 표시
- 애니메이션: master/mobile 각각 2열의 128×128 crop grid, `F01…Fn` 순서 라벨
- 정적: 실제 master/mobile PNG를 나란히 표시
- 모든 thumbnail: 투명 배경을 판별할 수 있는 checkerboard 위에 표시

## 출처와 생성 근거

`sourceReference`는 생성 결과인 `td-redesign-preview-v1.blend`가 아니라 원본 입력 경로를 뜻한다.

| 그룹 | sourceReference | generator/filter 기준 |
|---|---|---|
| map | `tools/blender/redesign_preview.py` | 절차형 tile/road/chest builder와 current-only collection |
| slow tower | `assets/blender/slow-tower-v1.blend` | `slow_predicate` exact allow-list |
| arrow tower | `assets/blender/arrow-tower-v1.blend` | `arrow_predicate` exact allow-list |
| 덕배·후추 | `assets/blender/character-assets-v2.blend` | 캐릭터 hierarchy에서 `DOG_VFX_WORDS` 제외 |
| motion | `assets/blender/enemies-voxel-v1.blend` | Orc/Fairy hierarchy와 required-object gate |
| VFX | `tools/blender/redesign_preview.py` | 절차형 arrow/projectile/impact builder와 current-only collection |

모든 mobile PNG는 Blender `image.scale`로 master에서 128px로 축소한 결과다. Builder 내부 provenance manifest는 21개 `relativePath`와 exact equality gate를 가진다.

## 자동 검증

- [x] 21개 asset / master·mobile 42개 PNG 존재
- [x] 63 logical frame / 126 variant thumbnail 산출
- [x] animated 8개 / 50 logical frame / `F01…Fn` 100개 표시
- [x] static 13개 / master·mobile 26개 표시
- [x] master frame 256×256, mobile frame 128×128
- [x] 모든 PNG 네 모서리 alpha 0
- [x] 21 card ID가 manifest 순서와 일치하고 중복 없음
- [x] 42 pane key와 126 thumbnail key가 manifest-derived exact order와 일치
- [x] animated asset별 master/mobile frame label parity와 순서 일치
- [x] 21 provenance record가 asset별 source/generator/filter와 일치
- [x] 모든 image decode 완료 후에만 DOM audit와 screenshot 실행
- [x] validation 실패 또는 정확히 42가 아닌 반환 시 PNG read/HTML/Chromium 전에 fail closed
- [x] page/browser cleanup 실패가 원래 builder 오류를 가리지 않음

실제 최종 명령 결과:

```text
npx vitest run tests/assets/redesignPreviewContract.test.ts
Test Files  1 passed (1)
Tests       16 passed (16)

npm run assets:preview:validate
VALIDATED 21 assets / 42 PNG files

npm run check
Test Files  23 passed (23)
Tests       135 passed (135)
vite build  success

git diff --check
exit 0, no output
```

## 사용자 확인 항목

다음 중 하나라도 보이면 해당 카드 이름을 지정해 반려한다.

- [ ] 맵과 캐릭터의 카메라·조명이 통일돼 보이는가
- [ ] 각 asset 주변에 불투명한 사각 배경이 없는가
- [ ] 길에 불필요한 pattern 또는 texture marking이 없는가
- [ ] 직선 길과 네 방향 corner 형태가 명확하게 구분되는가
- [ ] 타워가 한 grass tile footprint 안에 읽히는가
- [ ] 후추·덕배 캐릭터에 fire/water orb가 포함되지 않았는가
- [ ] Orc의 보행 자세가 프레임 사이에서 교대하는가
- [ ] Fairy의 날개 위치 변화가 프레임 사이에서 읽히는가
- [ ] Arrow가 E, SE, S, SW, W, NW, N, NE 여덟 방향을 모두 보여 주는가
- [ ] Fire/Aqua burst가 평면 Canvas 원이 아니라 입체적인 확산 효과로 읽히는가
- [ ] Master와 mobile의 silhouette·alpha·frame order가 서로 대응하는가

## 승인 게이트

사용자는 contact sheet 전체를 승인하거나 수정이 필요한 card id를 지정한다. 이 승인이 내려오기 전에는 후속 구현을 자동으로 계속하지 않는다.

위 contact sheet를 직접 확인한 뒤 **전체 승인** 또는 **수정이 필요한 card id**를 알려 주세요.
