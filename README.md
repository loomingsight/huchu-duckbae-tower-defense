# 후추 디펜스 v2

가로 화면 모바일 브라우저를 위한 20×10 Canvas 타워 디펜스 MVP입니다. 네 종류의 타워로 10개 웨이브를 막고 간식 창고를 지키는 단일 스테이지를 제공합니다.

배포된 게임은 [GitHub Pages](https://loomingsight.github.io/huchu-duckbae/tower-defense/)에서 실행할 수 있습니다.

## 설치와 실행

Node.js 20.19 이상(또는 22.12 이상)과 npm이 필요합니다.

```bash
npm install
npm run dev
```

개발 서버가 출력한 로컬 URL을 모바일 크기의 브라우저에서 열고 가로 방향으로 사용합니다.

## 빌드와 테스트

```bash
npm run build
npm run test
npm run test:e2e
```

`npm run test:e2e`는 로컬 Vite 서버와 Chromium을 자동으로 시작합니다. Playwright 브라우저가 없는 환경에서는 먼저 `npx playwright install chromium`을 실행합니다. QA 범위와 최신 캡처는 [`docs/qa/mvp-verification.md`](docs/qa/mvp-verification.md)에 기록합니다.

일반 E2E 실행의 스크린샷과 trace는 gitignored `test-results/`에 저장됩니다. 추적 중인 `docs/qa/*.png`를 명시적으로 갱신할 때만 다음 명령을 사용합니다.

```bash
UPDATE_QA_SCREENSHOTS=1 npm run test:e2e
```

## 배포

`main` 브랜치에 변경사항을 푸시하면 GitHub Actions가 테스트와 빌드를 실행한 뒤 `/tower-defense/` 하위 경로에 자동 배포합니다.

## 조작법

- 시작 화면의 `게임 시작`을 누릅니다
- 하단의 느림 장판, 화살, 덕배, 후추 타워 중 하나를 고릅니다
- 길이 아닌 빈 그리드 칸을 탭해 선택한 타워를 설치합니다
- 상단 `1×`/`2×` 버튼으로 전투 속도를 바꿉니다
- `정지`/`계속` 버튼으로 simulation을 멈추거나 재개합니다
- 스피커 버튼으로 합성 효과음을 끄거나 켭니다
- 세로 화면에서는 회전 안내가 표시되고 simulation이 진행되지 않습니다

## 밸런스 위치

MVP 기본 밸런스의 canonical ledger는 [`docs/decisions/deferred-decisions.md`](docs/decisions/deferred-decisions.md)입니다. 실제 런타임 값은 다음 파일에서 관리합니다.

- 시작 골드와 기지 HP: `src/game/simulation/createGame.ts`
- 적 HP·속도·보상·누수 피해: `src/game/enemies/enemyCatalog.ts`
- 타워 가격·사거리·공격력·공격 주기: `src/game/towers/towerCatalog.ts`
- 10개 웨이브 구성: `src/game/waves/stage1Waves.ts`
- fixed step과 최대 frame delta: `src/game/config.ts`

수치를 바꿀 때는 runtime 파일, focused unit test, decision ledger를 함께 갱신합니다.

## 에셋과 소스

후추와 덕배의 원본 사진은 사용자가 직접 제공한 반려견 사진이며, 저장소의 2D/3D 캐릭터 에셋은 그 사진을 디자인 참고 자료로 사용했습니다. 외부 오디오 파일은 사용하지 않고 Web Audio oscillator로 런타임에 짧은 효과음을 합성합니다.

Blender 원본은 다음 경로에 보존합니다.

- 캐릭터: `assets/blender/character-assets-v2.blend`
- 화살 타워: `assets/blender/arrow-tower-v1.blend`
- 감속 타워: `assets/blender/slow-tower-v1.blend`
- 타워 라인업: `assets/blender/tower-lineup-v1.blend`
- 적 5종: `assets/blender/enemies-voxel-v1.blend`

## 개발 전용 deterministic clock

Playwright는 개발 서버의 `?debug-clock=1`에서만 `window.__HUCHU_DEV_CLOCK__`을 사용합니다. 이 훅은 임의 상태를 쓰지 않고 실제 animation callback의 시간만 전진시키며, phase·경과 시간·웨이브·적 수·최대 path 진행도·피해를 입은 적 수·기지 HP·골드·pending frame 수를 읽습니다. `import.meta.env.DEV` 분기이므로 production build에는 포함되지 않습니다.

## 연기한 결정

최종 수치 튜닝, 최종 아트 polish, 고급 오디오 믹싱은 MVP 이후 실제 플레이테스트에서 결정합니다. 현재 실행 가능한 기본값과 변경 위치는 [`docs/decisions/deferred-decisions.md`](docs/decisions/deferred-decisions.md)에 정리되어 있습니다.
