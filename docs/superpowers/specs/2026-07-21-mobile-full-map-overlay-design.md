# Mobile Full-Map Overlay Design

## Goal

가로형 모바일 브라우저에서 게임 맵을 사용 가능한 화면 전체에 가깝게 확대하고, 게임 정보와 조작 버튼은 맵 위의 반투명 오버레이로 배치한다. 홈 화면에서 실행할 때는 일반 브라우저의 URL 표시줄 없이 앱처럼 플레이할 수 있도록 standalone 웹 앱 설정을 추가한다.

## Scope

이번 변경은 다음 항목을 포함한다.

1. 캔버스가 안전 영역을 포함한 가로형 모바일 뷰포트를 전부 사용
2. 골드·체력·웨이브 HUD를 좌측 상단 오버레이로 이동
3. 일시정지·속도·음소거를 우측 상단 오버레이로 이동
4. 네 개 타워 버튼을 하단 중앙 오버레이로 이동
5. 배치 상태 및 확인·취소 UI를 타워 버튼 바로 위에 배치
6. 맵 투영 여백을 최소화하여 844×390 기준 화면의 약 98%까지 확장
7. Web App Manifest와 iOS standalone 메타데이터 추가

맵의 20×10 격자, 길, 웨이브, 전투 수치, 투영 원근 비율, 세로 화면 차단 정책은 변경하지 않는다. 오프라인 캐시와 서비스 워커는 배포 후 에셋 갱신 지연을 만들 수 있으므로 이번 범위에서 제외한다.

## Layout Design

### Full-viewport stage

`.game-shell`은 더 이상 `header / stage / tray` 세 행을 사용하지 않는다. `.game-stage`를 안전 영역 안의 전체 화면에 `position: absolute; inset: 0`으로 배치하고 캔버스가 그 영역 전체를 사용한다. 기존 HUD와 타워 트레이는 DOM 순서와 접근성 이름을 유지하면서 stage 위의 독립적인 고정 오버레이가 된다.

맵 계산은 전체 stage 크기를 받는다. 투영 제한은 가로 99%, 세로 98%를 상한으로 사용한다. 844×390 뷰포트에서 맵은 안전 영역을 제외한 캔버스 안에 완전히 들어가며 기존보다 세로 제한이 크게 완화된다.

### HUD overlays

- 상태 칩: 좌측 상단, 가로 한 줄
- 조작 버튼: 우측 상단, 가로 한 줄
- 타워 트레이: 하단 중앙, 네 열 한 줄
- 배치 상태: 타워 트레이 위 중앙
- 배치 확인·취소: 타워 트레이 위 중앙, 상태 문구보다 높은 z-index

오버레이는 어두운 반투명 배경, 얇은 테두리, 그림자와 backdrop blur를 사용한다. 캔버스는 계속 전체 화면을 그리며 오버레이 아래에서도 보인다. 각 버튼은 최소 44px 터치 영역을 유지하고 safe-area inset만큼 가장자리에서 떨어진다.

HUD와 타워 트레이의 배경 요소만 포인터 이벤트를 받도록 하며 그 외 화면은 캔버스 입력에 열어 둔다. 게임 결과 및 세로 회전 안내 오버레이는 기존처럼 모든 HUD보다 위에 표시한다.

## Browser Chrome Strategy

일반 Safari·Chrome 탭에서 웹 페이지가 URL 표시줄을 임의로 영구 숨길 수는 없다. 브라우저 보안과 사용자 제어 정책을 따른다. 대신 설치된 웹 앱에서 주소창을 제외하는 표준 방식을 사용한다.

- `manifest.webmanifest`에 `display: standalone`, 게임 이름, 하위 경로 `start_url`과 `scope`, 테마 색상, 아이콘을 선언
- `index.html`에 manifest 링크와 `apple-mobile-web-app-capable=yes`, iOS 제목 및 상태바 메타데이터 추가
- 아이콘은 192×192, 512×512, 180×180 Apple touch icon을 저장소 에셋으로 제공
- GitHub Pages의 canonical base `/huchu-duckbae-tower-defense/`를 모든 경로에 유지

사용자는 iOS에서 공유 메뉴의 홈 화면 추가, 지원 브라우저에서 앱 설치 후 홈 화면 아이콘으로 실행해야 URL 표시줄 없는 standalone 모드를 사용할 수 있다. 일반 탭에서는 브라우저가 스크롤에 따라 UI를 축소할 수 있지만 게임 코드가 이를 강제하지 않는다.

참고 문서:

- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display
- https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html

## Files and Boundaries

- `src/styles.css`: 전체 화면 stage와 반투명 HUD/트레이 오버레이
- `src/game/render/layout.ts`: 맵 사용 비율 상향
- `index.html`: manifest 및 iOS standalone 메타데이터
- `manifest.webmanifest`: 설치형 웹 앱 이름, 범위, 표시 모드, 색상, 아이콘
- `assets/icons/`: 앱 설치 아이콘
- `tests/game/layout.test.ts`: 844×390 최대 맵 비율과 경계 검증
- `tests/app/hud.test.ts`: 전체 화면 오버레이 DOM 계약 검증
- `tests/scaffold.test.ts`: manifest, base 경로, iOS 메타데이터 계약 검증
- `e2e/game.spec.ts`: 실제 844×390 레이아웃 크기와 오버레이 위치 검증

게임 상태 모델과 시뮬레이션 API는 변경하지 않는다.

## Testing Strategy

TDD 순서를 유지한다.

1. 844×390에서 맵 상한이 가로 99%, 세로 98%이고 뷰포트 경계를 넘지 않는 실패 테스트
2. HUD·타워 트레이가 전체 화면 stage와 형제 오버레이로 존재하는 실패 테스트
3. manifest 경로, standalone 표시 모드, 하위 경로 scope/start URL, iOS 메타데이터 실패 테스트
4. 최소 구현 후 focused Vitest 통과
5. `npm run check`로 전체 단위 테스트와 프로덕션 빌드 검증
6. `npm run test:e2e`로 844×390 터치 흐름, 오버레이 겹침, 콘솔 오류 검증
7. 모바일 스크린샷에서 맵 확대, HUD 가독성, 타워 버튼 터치 크기와 길 가림 여부를 시각 검토
8. 배포 후 manifest, index, JS/CSS 번들의 HTTP 200 검증

## Acceptance Criteria

- 844×390 가로 화면에서 stage와 canvas가 안전 영역 내 전체 화면을 사용한다.
- 맵이 기존 header/tray 높이에 의해 축소되지 않고 약 98%의 세로 공간을 사용할 수 있다.
- 상태·조작·타워·배치 UI가 맵 위에 반투명 오버레이로 표시된다.
- 모든 조작 버튼은 최소 44×44px이고 상단 상태/조작 그룹과 하단 타워 트레이가 서로 겹치지 않는다.
- 게임 결과와 세로 회전 안내는 오버레이 HUD보다 위에 표시된다.
- manifest와 iOS 메타데이터가 빌드 결과에 포함되고 GitHub Pages 하위 경로를 유지한다.
- 설치 후 standalone 실행에서는 URL 표시줄 없는 앱 형태를 요청한다.
- 일반 브라우저 탭에서 URL 표시줄을 강제로 숨긴다고 안내하거나 보장하지 않는다.

