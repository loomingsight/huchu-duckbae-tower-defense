# 후추덕배 타워 디펜스

모바일 가로 화면을 우선한 20×10 HTML Canvas 타워 디펜스 게임입니다.
노멀 6개와 나이트메어 6개, 총 12개 스테이지에서 네 종류의 타워로
각 10개 웨이브를 막고 간식 창고를 지킵니다.

바로 플레이: [GitHub Pages](https://loomingsight.github.io/huchu-duckbae-tower-defense/)

## 주요 기능

- 모든 맵은 격자에 맞춘 직각 단일 경로이며, 원근 투영으로 모바일 화면을 넓게 사용합니다.
- 노멀 스테이지를 순서대로 클리어하면 나이트메어가 열리고, 이후 스테이지도 순차 해금됩니다.
- Blender에서 제작한 캐릭터·타워·맵 렌더를 Canvas 스프라이트와 모션 시트로 사용합니다.
- 화살, 파이어볼, 워터볼과 폭발, 슬로우 동심원, 방패, 보스 출현 효과를 제공합니다.
- 타워 선택 시 설치 가능한 타일과 사정거리를 표시하고, `배치` 또는 `취소`로 확정합니다.
- 설치한 타워를 선택하면 이름과 핵심 능력치, 맵 위 사정거리를 확인할 수 있습니다.
- 결과 화면에서 점수, 별, 최초·최단 클리어 시간, 보스 처리 여부와 누적 기록을 확인할 수 있습니다.
- 스테이지 해금·기록과 설정은 브라우저 `localStorage`에 저장됩니다.

## 스테이지

| 모드 | 구성 | 특징 |
| --- | --- | --- |
| 노멀 | 초록 들판 → 굽이 개울 → 바람 언덕 → 오크 협곡 → 골렘 채석장 → 미노타우르스 관문 | 슬라임, 빠른 요정, 오크, 골렘과 미노타우르스 보스 |
| 나이트메어 | 달빛 늪 → 썩은 숲 → 잿빛 폐허 → 핏빛 협곡 → 흑요석 광산 → 심연의 성문 | 분열 슬라임, 둔화 저항 박쥐, 방패 해골, 흑요석 골렘과 리치왕 보스 |

나이트메어 1에서는 분열과 둔화 저항 특성을 처음 만났을 때 짧은 안내를
표시합니다. 나이트메어 2부터는 전투를 방해하지 않도록 같은 안내를 생략합니다.

## 타워

| 타워 | 비용 | 역할 |
| --- | ---: | --- |
| 슬로우 타워 | 80G | 주변 적을 지속적으로 느리게 하는 지원 타워 |
| 화살 타워 | 100G | 빠른 단일 대상 공격 |
| 덕배 | 420G | 빠르고 비교적 약한 범위 피해 파이어볼 |
| 후추 | 560G | 느리지만 강한 범위 피해 워터볼 |

타워는 길이 아닌 빈 타일 중 길과 인접한 칸에만 한 개씩 설치할 수 있습니다.
골드가 부족한 타워 버튼은 비활성화되지만, 이미 선택한 타워는 골드가 부족해져도
다시 눌러 선택을 취소할 수 있습니다.

## 설치와 실행

Node.js 20.19 이상 또는 22.12 이상과 npm이 필요합니다.

```bash
npm install
npm run dev
```

개발 서버가 출력한
`/huchu-duckbae-tower-defense/` 경로를 브라우저에서 열고 가로 방향으로
사용합니다. 세로 화면에서는 회전 안내가 표시되고 시뮬레이션이 멈춥니다.

## 조작법

1. 시작 화면에서 해금된 스테이지를 고르고 `게임 시작`을 누릅니다.
2. 슬로우 타워, 화살 타워, 덕배, 후추 중 하나를 선택합니다.
3. 파란색으로 표시된 설치 가능 타일을 누르고 사정거리를 확인합니다.
4. `배치`로 확정하거나 `취소`로 되돌립니다.
5. 타워를 선택하지 않은 상태에서 설치된 타워를 누르면 정보를 확인합니다.
6. 상단의 `정지`/`계속`, `1×`/`2×`, 소리 버튼으로 전투를 조절합니다.
7. 타워 패널의 화살표 버튼으로 패널을 화면 위·아래로 옮길 수 있습니다.

## 기록과 해금

저장 키는 `huchu-defense.preferences.v5`이며 서버나 계정 없이 현재 브라우저에만
저장됩니다. v1~v4 기록은 실행 시 호환 형식으로 읽습니다.

- 모드별 최고 해금 스테이지
- 스테이지별 최고 점수와 별
- 최초 클리어 시간과 최단 클리어 시간
- 보스 처리 여부
- 전체 도전·승리 횟수
- 타워 패널 위치와 음소거 설정
- 나이트메어 6 클리어 배지

노멀 6을 클리어하면 나이트메어 1이 열리고, 나이트메어도 1부터 6까지 순서대로
해금됩니다. 클라우드 동기화와 온라인 순위표는 현재 제공하지 않습니다.

## 테스트와 빌드

일반 변경의 기본 검증 명령은 다음과 같습니다.

```bash
npm run check
```

`npm run check`는 전체 Vitest 단위 테스트를 실행한 뒤 TypeScript 검사와 Vite
프로덕션 빌드를 수행합니다.

| 명령 | 용도 |
| --- | --- |
| `npm run test` | 전체 단위 테스트 |
| `npm run test:watch` | 개발 중 단위 테스트 감시 |
| `npm run build` | TypeScript 검사와 프로덕션 빌드 |
| `npm run test:e2e` | 844×390 터치 환경 Playwright E2E |
| `npm run assets:preview:validate` | 노멀·타워·VFX 에셋 계약 검증 |
| `npm run assets:nightmare:validate` | 나이트메어 에셋 계약 검증 |

Playwright 브라우저가 없는 환경에서는 `npx playwright install chromium`을 먼저
실행합니다. 일반 E2E의 스크린샷과 trace는 gitignored `test-results/`에
저장됩니다. 추적 중인 초기 MVP QA 캡처를 의도적으로 갱신할 때만 다음 명령을
사용합니다.

```bash
UPDATE_QA_SCREENSHOTS=1 npm run test:e2e
```

초기 MVP 검증 기록은
[`docs/qa/mvp-verification.md`](docs/qa/mvp-verification.md)에서 확인할 수
있습니다.

## 배포

`main` 브랜치에 푸시하면
[`deploy-pages.yml`](.github/workflows/deploy-pages.yml)이 다음 순서로 자동
배포합니다.

1. Node.js 22에서 `npm ci`
2. `npm run check`
3. `dist/`를 Pages artifact의 루트인 `pages/`에 복사
4. GitHub Pages 프로덕션 배포

Vite base는 `/huchu-duckbae-tower-defense/`이며
[`vite.config.ts`](vite.config.ts)에서 관리합니다.

## 코드 구조와 밸런스 위치

| 위치 | 역할 |
| --- | --- |
| `src/app/GameApp.ts` | 앱 수명주기, 입력, HUD, 스테이지 전환 |
| `src/app/preferences.ts` | localStorage v5 기록과 이전 버전 마이그레이션 |
| `src/game/stages/stageCatalog.ts` | 12개 맵, 경제, 난이도 배율, 목표 시간과 점수 기준 |
| `src/game/waves/` | 노멀·나이트메어 10웨이브 구성 |
| `src/game/enemies/enemyCatalog.ts` | 적 HP, 속도, 보상, 누수 피해와 특성 |
| `src/game/towers/towerCatalog.ts` | 타워 가격, 사거리, 공격력, 공격 주기와 범위 피해 |
| `src/game/scoring.ts` | 웨이브·전투·체력·보스·시간·난이도 점수 |
| `src/game/simulation/` | 고정 스텝 기반 전투와 배치 시뮬레이션 |
| `src/game/render/` | 원근 투영 Canvas 렌더링, 애니메이션과 VFX |

현재 밸런스 기준과 최초 MVP 결정의 대체 여부는
[`docs/decisions/deferred-decisions.md`](docs/decisions/deferred-decisions.md),
완료 항목은 [`docs/backlog.md`](docs/backlog.md)에 기록합니다. 수치를 변경할
때는 런타임 설정, 집중 단위 테스트와 결정 문서를 함께 갱신합니다.

## 에셋과 Blender 소스

후추와 덕배는 사용자가 제공한 반려견 사진을 디자인 참고 자료로 사용했습니다.
게임은 Blender 렌더 결과를 2D Canvas 스프라이트로 사용하며, 브라우저에서
실시간 3D 엔진을 실행하지 않습니다.

주요 Blender 원본:

- 캐릭터: `assets/blender/character-assets-v2.blend`
- 노멀 적군: `assets/blender/enemies-voxel-v1.blend`
- 나이트메어 적군: `assets/blender/nightmare-enemies-v2.blend`
- 나이트메어 맵 키트: `assets/blender/nightmare-map-kit-v1.blend`
- 타워·맵·VFX 통합 프리뷰: `assets/blender/td-redesign-preview-v1.blend`

런타임 렌더는 `assets/renders/enemies-v1/`,
`assets/renders/redesign-preview-v1/`, `assets/renders/nightmare-v2/`에
보존합니다. 외부 오디오 파일 대신 Web Audio oscillator로 짧은 효과음을
합성합니다.

## 개발 전용 deterministic clock

개발 서버에서만 `?debug-clock=1`로 `window.__HUCHU_DEV_CLOCK__`을 활성화할 수
있습니다. 테스트는 실제 animation callback 시간을 전진시키고 읽기 전용
snapshot으로 경과 시간, 웨이브, 적 진행도, 타워 위치, 기지 HP와 골드를
검증합니다. `import.meta.env.DEV` 분기이므로 프로덕션 번들에는 포함되지
않습니다.
