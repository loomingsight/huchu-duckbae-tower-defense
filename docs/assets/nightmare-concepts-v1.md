# 나이트메어 적 2D 도안 v3

상태: **사용자 승인 대기**

## 검수 파일

- 현재 원본 라인업: `assets/concepts/nightmare-v1/nightmare-enemy-lineup-v3.png` (1692×929)
- 현재 모바일 검수본: `assets/concepts/nightmare-v1/nightmare-enemy-lineup-mobile-v3.png` (844×463)
- 보존된 이전안: `assets/concepts/nightmare-v1/nightmare-enemy-lineup-v1.png`, `nightmare-enemy-lineup-v2.png`

## 생성 방식

- 도구: Codex 내장 `image_gen`
- 용도: Blender 모델링 전 정면 실루엣·비율 승인
- 초기 생성 입력 이미지: 없음
- v2 편집 대상: `nightmare-enemy-lineup-v1.png`
- v3 편집 대상: `nightmare-enemy-lineup-v2.png`

## v3 수정 사항

- 하단 3번 해골 기사의 청보라색 반투명 가상 방패는 그대로 보존했다.
- 하단 4번은 그림자 슬라임 부모가 좌우의 작은 자식 둘로 갈라지는 보라색 분열 포즈로 교체했다.
- 하단 5번은 흡혈 박쥐의 날개가 보라색으로 섬광하며 청색 얼음 고리가 두 조각으로 끊어지는 둔화 저항 포즈로 교체했다.
- 둔화 저항에서 회복으로 오해할 수 있는 의료 십자, 녹색 발광, 회복 반짝임을 제거했다.
- 둔화 저항에는 방패를 쓰지 않아 해골 기사의 방패 발동과 즉시 구분된다.

최종 교정 프롬프트:

```text
Use case: precise-object-edit
Asset type: final 2D character-design lineup sheet for later Blender modeling.
Input image: the provided v2 lineup is the edit target.

Change only bottom inset groups 4 and 5, counting inset groups from left to right.
Group 4 currently shows a single slime with cyan speed lines and plus signs. Replace it with
a clear shadow-slime split key pose: one deep-purple parent blob separating into two smaller
purple child blobs moving left and right, with a short purple split burst and no cyan marks.
Group 5 currently shows a skeleton knight with cyan plus signs. Replace that entire group with the same front-facing
Vampire Bat from the top row demonstrating slow resistance: its broad dark-plum wings flash
purple for an instant while one cyan-blue frost ring around its body is visibly broken into
two separated arc pieces. The effect must communicate partial resistance to slowing, not
healing. Remove every plus sign, medical cross, shield shape, recovery sparkle, and green glow
from groups 4 and 5. Keep the bat's face and wing silhouette readable at 128px.

Preserve exactly everything else: all five top-row characters, order, designs, proportions,
colors, poses, spacing, front-facing full bodies, neutral light-gray review background, and
bottom groups 1, 2, 3, and 6. Bottom group 3 must retain the single semi-transparent
blue-violet spectral shield in front of the skeleton. Do not add or remove any group or
character. No text, labels, captions, boxes, borders, floor, cast shadows, projectile balls,
logos, or watermark. Make no changes outside bottom groups 4 and 5.
```

## 생성 프롬프트

```text
Use case: stylized-concept
Asset type: 2D character-design lineup and approved visual reference for later Blender modeling in a cute mobile tower-defense game.

Create one clean 2D character-design lineup sheet for a cute mobile tower-defense game.
Show exactly five original front-facing voxel-inspired low-poly characters on a neutral light gray review background, evenly spaced, full body, no environment, no text:
1) Shadow Slime: small translucent deep-purple cube-like slime, cyan eyes, compact silhouette.
2) Vampire Bat: tiny dark plum bat, large expressive face, broad readable wings.
3) Skeleton Knight: cute narrow skeleton, round dark shield held front-left, short sword, shield must not hide the face.
4) Obsidian Golem: heavy black-purple block body with restrained orange cracks, large but fits one tile.
5) Lich King: floating small-bodied boss with a large expressive skull face, purple crown, short robe, no legs touching the ground.
Use chibi proportions with emphasized faces but keep heads and bodies balanced.
All silhouettes must remain readable at 128px. No Minecraft textures, logos, weapons from existing franchises, projectile balls, drop shadows, frames, labels, boxes, or individual halos.
Use one flat neutral light-gray review-sheet background behind the entire lineup.
Include a small inset row beneath them showing: small split slime, elite red-rune variant, shield opening key pose, slime split key pose, slow-resist flash key pose, lich aura key pose.

Composition constraints: exactly five main characters in a single evenly spaced top lineup, each facing straight toward the viewer, all fully visible and separated; one clearly subordinate small inset pose row beneath. No extra main characters. No written words, letters, numbers, captions, UI, watermark, border, shadow, or floor plane.
```

## 도안 검수

| 대상 | 색·실루엣 | 정면/비율 | 128px 판독성 | 상태 |
|---|---|---|---|---|
| 그림자 슬라임 | 진보라 큐브형 몸체, 청록 눈 | 정면, 가장 작은 체급 | 눈과 외곽선 분리됨 | 통과 |
| 흡혈 박쥐 | 짙은 자두색, 넓은 날개 | 정면, 얼굴 강조 | 날개·귀·얼굴 분리됨 | 통과 |
| 해골 기사 | 밝은 뼈, 어두운 원형 방패 | 정면, 방패가 얼굴을 가리지 않음 | 방패·검·얼굴 분리됨 | 통과 |
| 흑요석 골렘 | 검보라 블록, 절제된 주황 균열 | 정면, 1타일 대형 체급 | 어깨·주먹·균열 분리됨 | 통과 |
| 리치 왕 | 큰 해골 얼굴, 보라 왕관·짧은 로브 | 정면 부유형, 다리가 바닥에 닿지 않음 | 왕관·얼굴·로브 분리됨 | 통과 |

## 공통 체크리스트

- [x] 메인 캐릭터가 정확히 5종이다.
- [x] 5종 모두 정면을 본다.
- [x] 전신이 프레임 안에 있고 서로 겹치지 않는다.
- [x] 해골 기사의 방패가 얼굴을 가리지 않는다.
- [x] 캐릭터별 배경·프레임·라벨·워터마크가 없다.
- [x] 투사체가 캐릭터 몸에 포함되지 않는다.
- [x] 모바일 검수본에서도 주요 실루엣과 얼굴이 구분된다.
- [x] 하단 3번 방패 발동은 정면의 반투명 청보라색 가상 방패 하나로 표현된다.
- [x] 하단 4번 분열은 그림자 슬라임 부모와 좌우 자식 둘, 보라색 분열 섬광으로 표현된다.
- [x] 하단 5번 둔화 저항은 흡혈 박쥐의 보라색 날개 섬광과 두 조각으로 끊어진 청색 얼음 고리로 표현된다.
- [x] 방패 발동·슬라임 분열·둔화 저항 효과가 서로 구분된다.
- [x] 둔화 저항 포즈에 회복 표식이나 방패가 없다.

사용자 승인 완료: 2026-07-24
