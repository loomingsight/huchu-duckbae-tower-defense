# Mobile HUD and Enemy Balance Design

## Goal

모바일 가로 화면에서 상단과 하단 HUD가 맵을 가리는 면적을 줄이고, 모든 몬스터의 생존력과 요정·오크의 이동 압박을 높여 현재 스테이지 1의 난이도를 상향한다.

## Scope

이번 배치는 백로그의 미완료 항목 5개를 처리한다.

1. 모바일 상단 통계 3개를 왼쪽 세로 열로 배치
2. 모바일 상단 조작 버튼 3개를 오른쪽 세로 열로 배치
3. 모바일 하단 타워 트레이와 타워 버튼의 전체 크기를 약 20% 축소
4. 모든 몬스터의 기본 체력을 현재보다 20% 증가
5. 빠른 요정의 이동 속도를 20%, 녹색 오크의 이동 속도를 15% 증가

타워 성능·가격, 몬스터 보상·누출 피해, 웨이브 구성, 맵·투영·에셋, 적 애니메이션 FPS는 변경하지 않는다. 새 런타임 의존성과 에셋도 추가하지 않는다.

## Selected Approach

기존 HUD DOM 구조를 유지하고 모바일 가로 화면 전용 CSS만 추가하는 방식을 선택한다. 기존 `.game-hud`가 통계 그룹과 조작 그룹을 이미 좌우로 분리하므로 각 그룹의 `flex-direction`만 세로로 바꾸면 중앙 시야를 확보할 수 있다. DOM 재구성이나 Canvas UI는 수정 범위, 접근성, 터치 처리 리스크가 더 크므로 사용하지 않는다.

몬스터 난이도는 별도 전역 배율 계층을 만들지 않고 `ENEMY_CATALOG`의 승인된 기본 수치를 직접 변경한다. 카탈로그가 현재 전투 정책의 단일 소스이므로 수치가 눈에 보이고, 스폰 단계에서 중복 적용될 가능성도 없다.

## Mobile HUD Layout

### Responsive boundary

모바일 가로 HUD 변경은 다음 조건에서만 적용한다.

```css
@media (orientation: landscape) and (max-width: 1024px) and (max-height: 430px)
```

세로 화면은 기존 orientation prompt가 게임을 차단하며, 데스크톱과 큰 태블릿의 기본 가로 HUD는 유지한다.

### Top rails

- `.game-hud`의 기존 `justify-content: space-between` 구조를 유지한다.
- `.game-hud__stats`는 화면 왼쪽에서 세로 열이 된다.
- `.game-hud__controls`는 화면 오른쪽에서 세로 열이 된다.
- 두 그룹은 `flex-direction: column`, `min-height: 0`, `gap: 3px`, `padding: 3px`을 사용한다.
- 조작 버튼은 최소 `44×44px` 터치 영역을 유지한다.
- 통계 항목은 현재 숫자·아이콘·접근성 label을 그대로 유지한다.
- 중앙 상단에는 HUD 배경이나 버튼이 없도록 기존 투명 header를 유지한다.

### Bottom tower tray

모바일 가로 화면의 타워 트레이는 현재 최대 폭과 최소 높이를 약 80%로 줄인다.

| 속성 | 현재 | 변경 |
|---|---:|---:|
| 최대 폭 | 620px | 496px |
| 화면 비례 폭 | 가용 폭 100% | 가용 폭 약 80% |
| 최소 높이 | 62px | 50px |
| gap | 5px | 4px |
| padding | 5px | 4px |

네 개 타워는 한 줄 4열을 유지한다. 각 `.tower-card`는 전역 최소 터치 높이 `44px`을 지키며 아이콘, 이름, 가격과 선택·비활성 스타일은 유지한다. 트레이 높이가 12px 줄어드는 만큼 배치 action의 bottom offset은 `72px → 60px`, placement status는 `132px → 120px`으로 옮겨 기존 6px·12px 간격을 보존한다.

## Enemy Balance

`ENEMY_CATALOG`의 새 기본 수치는 다음과 같다.

| 몬스터 | 현재 HP | 변경 HP | 현재 속도 | 변경 속도 |
|---|---:|---:|---:|---:|
| 슬라임 | 42 | 50.4 | 1.15 | 1.15 |
| 빠른 요정 | 32 | 38.4 | 1.9 | 2.28 |
| 녹색 오크 | 110 | 132 | 0.9 | 1.035 |
| 스톤 골렘 | 320 | 384 | 0.52 | 0.52 |
| 미노타우르스 | 1800 | 2160 | 0.48 | 0.48 |

체력은 소수 값을 허용하는 현재 게임 모델을 그대로 사용한다. `spawnEnemy()`의 웨이브 배율 `1 + waveIndex × 0.08`은 변경된 기본 체력에 적용된다. 이동 거리 계산, 슬로우 배율, 보상 지급은 기존 로직을 유지한다.

## Testing

이번 변경은 사용자 지시에 따라 E2E를 실행하지 않는다.

단위 테스트와 빌드 검증은 다음 계약을 고정한다.

1. `ENEMY_CATALOG`의 5종 HP가 `50.4/38.4/132/384/2160`인지 확인
2. 요정 속도 `2.28`, 오크 속도 `1.035` 확인
3. 웨이브 5 골렘이 새 기본 HP `384 × 1.4`로 생성되는지 확인
4. 기존 보상 총액 `2,562G`가 바뀌지 않았는지 확인
5. CSS source contract에서 모바일 가로 media query, 좌우 세로 열, 트레이 `496px/80%/50px`, 최소 `44px` 터치 영역과 새 placement offset 확인
6. 전체 `npm run check`로 모든 Vitest suite, TypeScript와 production Vite build 검증

CSS의 실제 브라우저 배치 검증은 E2E 제외 결정에 따라 이번 자동 검증에서 생략하며, 배포 후 사용자 플레이 피드백으로 보완한다.

## Backlog and Deployment

단위 테스트와 production build가 통과한 후 `docs/backlog.md`의 미완료 5개 항목을 완료 처리한다. `main`에 커밋·푸시한 뒤 GitHub Actions Pages run이 `success`인지 확인하고, 공개 게임 URL과 새 JS/CSS 번들이 HTTP 200인지 검증한다. Vite base `/huchu-duckbae-tower-defense/`는 유지한다.

## Acceptance Criteria

- 모바일 가로 화면에서 통계는 왼쪽 세로 열, 조작은 오른쪽 세로 열로 표시된다.
- 중앙 상단 맵 시야가 상단 HUD에 가려지지 않는다.
- 하단 타워 트레이 최대 폭과 높이가 약 20% 줄고 모든 타워 버튼은 최소 44px 터치 영역을 유지한다.
- 모든 몬스터 기본 체력이 정확히 20% 증가한다.
- 요정 속도가 정확히 20%, 오크 속도가 정확히 15% 증가한다.
- 몬스터 보상, 웨이브, 타워 정책은 변하지 않는다.
- 단위 테스트, TypeScript 검사, production build와 배포 후 공개 리소스 검증이 통과한다.
- E2E는 실행하지 않는다.
