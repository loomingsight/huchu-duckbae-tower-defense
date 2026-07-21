# Backlog Visual Polish Batch Design

## Goal

현재 백로그의 8개 항목을 하나의 구현 배치로 처리한다. 타워 선택과 배치 안내를 명확하게 만들고, 모바일 화면에서 몬스터·타워·투사체를 더 선명하고 안정적인 비율로 렌더링하며, 후추 워터볼과 덕배 파이어볼을 새 3D VFX로 교체한다.

## Scope

이번 배치에는 다음 항목만 포함한다.

1. 골드가 비용보다 적은 타워 버튼의 실제 클릭 차단
2. 타워 선택 중 공간적으로 배치 가능한 타일의 파란색 가이드
3. 몬스터와 타워의 256px 런타임 원본 사용
4. 모든 타워의 한 타일 이내 표시 크기
5. 오크 발 위치를 타일 중앙 쪽으로 하향 정렬
6. 몬스터 상하 진동 주기를 현재보다 2배 느리게 변경
7. 후추 워터볼 3D VFX 재생성과 화면 표시 크기 2배
8. 덕배 파이어볼 3D VFX 재생성과 화면 표시 크기 1.5배

게임 수치, 웨이브, 몬스터 이동 속도, 타워 공격 주기, 몬스터 걷기 프레임 속도, 요정 날갯짓 프레임 속도, 맵 구조와 투영은 변경하지 않는다. 사용자의 2026-07-21 후속 요청에 따라 VFX 미리보기 승인과 최종 검증이 끝나면 GitHub Pages 배포까지 이번 배치에 포함한다.

## Batch Rationale

항목을 다음 세 묶음으로 구현한다.

- HUD와 배치 가이드: 타워 선택 상태와 맵 오버레이가 같은 게임 스냅샷을 사용한다.
- 런타임 렌더링: 해상도, 타워 크기, 진동 주기, 오크 접지를 같은 렌더러 테스트에서 검증할 수 있다.
- Blender VFX: 워터볼과 파이어볼을 같은 VFX 그룹 렌더 한 번으로 생성하고 같은 에셋 검증을 공유한다.

이 구성을 사용하면 Blender 렌더, 에셋 계약 검증, 전체 테스트, 모바일 QA를 각각 한 번만 수행한다.

## Interaction Design

### Unaffordable tower buttons

게임이 플레이 중이고 가로 화면이어도 `gold < tower.cost`이면 해당 HTML 버튼의 `disabled` 속성을 `true`로 설정한다. 비용과 골드가 정확히 같으면 활성 상태다. 기존 선택이 있는 상태에서 골드가 부족해져도 선택은 유지한다. 이후 처치 보상으로 골드가 비용 이상이 되면 다음 HUD 렌더에서 버튼이 자동으로 다시 활성화된다.

기존의 `tower-card--unaffordable` 표현도 같은 단일 affordability 판정을 사용한다. 이벤트 핸들러에 별도 중복 조건은 추가하지 않고 네이티브 비활성 버튼 의미와 동작을 사용한다.

### Placement guide

타워를 선택한 동안 플레이 상태이고 가로 화면이면 `STAGE_1.isBuildableCell`이 `true`인 모든 셀을 파란색 반투명 폴리곤으로 표시한다. 길, 맵 외부, 길과 인접하지 않은 셀, 이미 타워가 있는 셀은 제외한다. 골드 부족 여부는 공간 가이드 계산에 포함하지 않는다. 선택을 취소하거나 게임이 일시정지·종료되거나 세로 화면이 되면 가이드를 숨긴다.

선택한 개별 셀과 사거리 표현은 기존 청록색·빨간색 규칙을 유지하고 파란색 가이드 위에 렌더링한다.

## Runtime Asset Resolution

런타임은 다음 256px 원본을 직접 사용한다.

- 정적 몬스터: `assets/renders/enemies-v1/<type>/<type>-se-v1.png`
- 타워: `assets/renders/redesign-preview-v1/master/towers/*.png`
- 오크·요정 모션: `assets/renders/redesign-preview-v1/master/motion/*.png`
- 모든 투사체와 타격 VFX: `assets/renders/redesign-preview-v1/master/vfx/*.png`

정적 몬스터는 카메라 정면 고정 정책을 유지하며 각 방향 슬롯이 같은 `se` 원본을 참조한다. 실제 빌드에는 슬라임·골렘·미노타우르스 정면 원본만 추가되어 불필요한 4방향 고해상도 중복을 피한다. 예상 런타임 PNG 총량 증가는 약 396KB에서 약 1.4MB로 제한한다.

맵 에셋은 화면상 확대 요구가 없으므로 기존 128px 모바일 원본을 유지한다. 이미지 스무딩도 기존 설정을 유지한다.

## Entity Rendering

### Tower footprint

타워 목적지 프레임 크기 배율을 `tileWidth * 2.6`에서 `tileWidth * 2.0`으로 변경한다. 기존 256px 원본의 불투명 바운딩 박스를 기준으로 가장 넓은 슬로우 타워도 약 `0.89`타일 폭이며 나머지 타워는 그보다 작다. 타워별 접지 anchor는 현재 값을 유지하여 크기만 줄고 발 위치는 타일 전면에 계속 닿는다. 배치 미리보기와 설치 완료 타워에 같은 배율을 사용한다.

### Enemy bobbing

모션 프레임 phase와 상하 진동 phase를 분리한다.

- 걷기·날갯짓 프레임: 현재 FPS 유지
- 상하 bounce와 슬라임 squash: 현재 phase 속도의 `0.5`
- 경로 progress와 적의 시뮬레이션 속도: 변경 없음

몬스터별 ID 오프셋은 유지하여 모든 몬스터가 같은 순간에 움직이지 않도록 한다.

### Orc grounding

오크 모션 시트의 실제 알파 바운딩 박스 발끝은 프레임 높이의 약 `0.59~0.61` 지점이다. 오크에만 `0.60` ground anchor를 적용하고 다른 몬스터는 기존 `0.76`을 유지한다. 이렇게 하면 오크의 발이 투영된 타일 중심 부근으로 내려오고 요정의 비행 높이는 유지된다.

## Blender VFX

### Waterball

4프레임 루프를 유지한다. 어두운 청색 수구 코어, 밝은 회전 물결, 뒤로 이어지는 물줄기와 분리되는 물방울을 조합한다. 각 프레임은 같은 투영 중심과 전체 바운딩 범위를 유지하면서 물결·물방울 위치만 변화한다. 투명 배경과 256px master/128px mobile 출력 계약을 유지한다.

런타임 목적지 크기는 기존 `visualUnit * 1.7`에서 `visualUnit * 3.4`로 변경하여 정확히 2배 확대한다.

### Fireball

4프레임 루프를 유지한다. 적황색 고온 코어, 노란 내부 불꽃, 뒤로 휘는 불꽃 혀와 작은 불씨를 조합해 이글거리는 실루엣을 만든다. 각 프레임은 같은 투영 중심과 전체 바운딩 범위를 유지하면서 불꽃 혀와 불씨가 순환한다. 투명 배경과 256px master/128px mobile 출력 계약을 유지한다.

런타임 목적지 크기는 기존 `visualUnit * 1.55`에서 `visualUnit * 2.325`로 변경하여 정확히 1.5배 확대한다.

### Blender safety

현재 열려 있는 `enemies-voxel-v1.blend`는 dirty 상태이므로 저장하거나 장면을 교체하지 않는다. Blender MCP에서는 `bpy.app.binary_path`로 별도 background Blender child를 실행한다. child는 격리 worktree `/private/tmp/huchu-defense-v2-3d-preview`에서 preflight, source hash 보존, VFX 그룹 렌더, asset validation, atomic publish, lifecycle 검사를 수행한다.

새 워터볼·파이어볼 master/mobile 시트와 VFX 미리보기 이미지를 사용자에게 한 번 보여주고 승인받은 뒤 런타임 통합 검증을 완료한다.

## Architecture Changes

- `hud.ts`: affordability 판정을 하나의 순수 함수로 만들고 버튼 비활성·스타일에 공유
- `stage1.ts`: `buildableCells(occupiedCells)` 순수 함수로 현재 점유 셀을 제외한 배치 가능 셀 목록 생성
- `canvasRenderer.ts`와 `drawMap.ts`: placement guide 셀 목록 전달 및 파란 폴리곤 렌더
- `spriteManifest.ts`: 사용 원본과 frame size를 명시하는 256px runtime 계약
- `drawEntities.ts`: 256px crop, 타워 `2.0` 배율, 분리된 bob phase, 오크 `0.60` anchor
- `drawEffects.ts`: 256px crop과 워터볼·파이어볼 목적지 배율 변경
- `redesign_preview.py`: 워터볼·파이어볼 procedural geometry와 trace 계약 강화
- `docs/backlog.md`: 검증이 끝난 항목만 완료 표시

새 런타임 의존성은 추가하지 않는다.

## Testing Strategy

### RED tests before implementation

- 골드가 비용보다 1 적으면 disabled, 같으면 enabled
- 배치 가능 셀 목록이 길·비인접·점유 셀을 제외
- 파란 가이드가 셀별 투영 폴리곤으로 렌더되고 선택 해제 시 없음
- 타워 목적지 배율이 `2.0`이고 256px crop을 사용
- 정적 몬스터·모션·VFX가 256px crop을 사용
- bounce phase가 기존 대비 절반 속도이고 frame phase는 기존 FPS 유지
- 오크만 `0.60` anchor 사용
- 워터볼 `3.4`, 파이어볼 `2.325` 목적지 배율
- Blender source에 새로운 물결/불꽃 구성과 VFX loop trace 계약이 존재

각 focused test는 구현 전 기대한 이유로 실패하는 것을 확인한다.

### Final validation

1. focused Vitest suites
2. Blender VFX self-test와 background render
3. `npm run assets:preview:validate -- --group vfx`
4. VFX preview 사용자 승인
5. `npm run check`
6. `npm run test:e2e`
7. 844×390 QA screenshot 갱신과 시각 검토
8. 브라우저 콘솔 오류 확인

## Acceptance Criteria

- 골드 부족 타워 버튼은 실제 `disabled`이며 선택 상태를 임의로 지우지 않는다.
- 타워 선택 직후 현재 설치 가능한 셀만 파란색으로 보인다.
- 몬스터·타워·모션·VFX crop 원본은 256px이다.
- 네 타워의 불투명 폭이 한 타일을 넘지 않는다.
- 몬스터 이동 속도와 걷기·날갯짓은 유지되고 상하 진동만 2배 느리다.
- 오크 발이 타일 중앙 부근에 정렬된다.
- 워터볼은 새 역동적 물 형상이며 기존 표시 크기의 2배다.
- 파이어볼은 새 이글거리는 불꽃 형상이며 기존 표시 크기의 1.5배다.
- 모든 자동 검증과 모바일 브라우저 검증이 통과한 항목만 백로그에서 완료된다.
