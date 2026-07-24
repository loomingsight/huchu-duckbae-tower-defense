# Deferred balance and presentation decisions

## 2026-07-24 재검토 결과

아래 `Task 3~8` 표는 최초 단일 스테이지 MVP의 의사결정 기록이며 더 이상
그 자체를 실행 가능한 최신 설정으로 간주하지 않는다. 현재 기준은 다음 표와
각 변경 위치의 집중 테스트다.

| 영역 | 상태 | 현재 기준 | 최신 변경 위치 |
| --- | --- | --- | --- |
| 맵·시뮬레이션 | 적용 완료 | 20×10 격자와 60Hz 고정 스텝은 유지한다. 맵은 노멀 6개·나이트메어 6개의 직각 경로 데이터로 확장됐다. | `src/game/config.ts`, `src/game/stages/stageCatalog.ts`, `src/game/core/fixedStepLoop.ts` |
| 스테이지 경제·웨이브 | 적용 완료 / 후속 검증 | 시작 골드·창고 체력·HP·속도·수량·스폰 간격·보상·웨이브 HP 증가율·웨이브 대기 시간·목표 클리어 시간을 스테이지 정의에서 관리한다. 노멀은 320G/20HP, 나이트메어는 280G/12HP이며 목표 시간은 모두 5~7분이다. 최초 클리어 시간을 실제 플레이 결과로 저장하므로 누적 표본을 바탕으로 추가 조정한다. | `src/game/stages/stageCatalog.ts`, `src/game/waves/nightmareWaves.ts`, `src/game/simulation/updateWaves.ts`, `src/app/preferences.ts` |
| 적 수치 | 대체됨 | 최초 HP·속도·보상값은 이후 전역 난이도 조정과 나이트메어 전용 적군으로 대체됐다. 현재 카탈로그와 스테이지 배율을 함께 사용한다. | `src/game/enemies/enemyCatalog.ts`, `src/game/stages/stageCatalog.ts` |
| 타워 수치 | 일부 적용 / 일부 대체됨 | 슬로우·화살의 기본 역할은 유지한다. 덕배·후추 비용은 각각 420G·560G로 대체됐고 현재 카탈로그가 단일 기준이다. | `src/game/towers/towerCatalog.ts` |
| 적 스프라이트 제작 | 대체됨 | 5종×4방향 정적 출력 대신 항상 정면을 보는 모션 시트와 나이트메어 적 에셋을 사용한다. | `src/game/render/spriteManifest.ts`, `assets/renders/redesign-preview-v1/`, `assets/renders/nightmare-v1/` |
| 캔버스 구성 | 일부 적용 / 일부 대체됨 | DPR 상한은 유지한다. 고정 16:9 레터박스 대신 모바일 가로 화면을 최대한 사용하는 원근 투영 레이아웃을 적용한다. | `src/game/render/layout.ts`, `src/game/render/projection.ts`, `src/game/render/canvasRenderer.ts` |
| 조작·환경설정 | 적용 완료 | 1×/2× 속도, 최소 44px 터치 목표, 4개 타워, 8px 탭 판정은 유지한다. 환경설정은 v5이며 스테이지별 최초·최단 클리어 시간을 분리 저장한다. | `src/app/GameApp.ts`, `src/app/hud.ts`, `src/app/input.ts`, `src/app/preferences.ts` |
| 몬스터 특성 안내 | 적용 완료 | 특성 안내는 나이트메어 1에서만 최대 3초 노출하고 나이트메어 2~6에서는 생략한다. | `src/app/traitNotice.ts`, `src/app/GameApp.ts` |

`후속 검증`은 기능 미구현을 뜻하지 않는다. 최초 클리어 시간 수집과 5~7분
목표 표시는 구현됐으며, 실제 플레이 표본이 쌓일 때 스테이지별 수치를 다시
조정하기 위한 운영 항목이다.

## 최초 MVP 결정 기록

## Task 3 — map and simulation timing

| Default | Rationale | Change location |
| --- | --- | --- |
| Map: 20 columns × 10 rows | Fits a landscape phone canvas while leaving room for four tower roles. | `src/game/map/stage1.ts` |
| Route waypoints: (0,2) → (5,2) → (5,7) → (12,7) → (12,3) → (19,3) | Creates the approved orthogonal, readable Stage 1 route. | `src/game/map/stage1.ts` |
| Simulation: 60 updates/sec (dt = 1/60 sec) | Stable deterministic combat cadence on common mobile refresh rates. | `src/game/core/fixedStepLoop.ts` |
| Maximum accepted frame delta: 0.25 sec | Prevents a suspended browser frame from causing a large catch-up simulation jump. | `src/game/core/fixedStepLoop.ts` |

## Task 4 — enemies, economy, and waves

| Default | Rationale | Change location |
| --- | --- | --- |
| Starting gold: 450 | Lets players explore early tower choices immediately. | `src/game/simulation/createGame.ts` |
| Base HP: 20 | Allows several readable leaks before defeat. | `src/game/simulation/createGame.ts` |
| Inter-wave delay: 5 sec | Gives mobile players time to choose and place a tower. | `src/game/simulation/updateWaves.ts` |
| Stage length: 10 waves | Defines the first-clear MVP scope. | `src/game/waves/stage1Waves.ts` |
| Target first-clear duration: 5–7 min | Initial pacing target for later playtests, not a correctness gate. | `src/game/waves/stage1Waves.ts` |
| Group HP multiplier: 1 + waveIndex × 0.08 | Makes each wave progressively sturdier without per-wave hand tuning. | `src/game/waves/stage1Waves.ts` |
| Slime: HP 42, speed 1.15, reward 10, leak 1 | Baseline slow, low-risk enemy. | `src/game/enemies/enemyCatalog.ts` |
| Fairy: HP 32, speed 1.9, reward 14, leak 1 | Fragile but fast enemy tests target priority. | `src/game/enemies/enemyCatalog.ts` |
| Orc: HP 110, speed 0.9, reward 20, leak 2 | Mid-tier durable enemy with meaningful leak pressure. | `src/game/enemies/enemyCatalog.ts` |
| Golem: HP 320, speed 0.52, reward 38, leak 3 | Slow damage sponge validates sustained fire. | `src/game/enemies/enemyCatalog.ts` |
| Minotaur: HP 1800, speed 0.48, reward 200, leak 8 | Wave-10 boss creates a clear final spike. | `src/game/enemies/enemyCatalog.ts` |

## Task 5 — tower and combat tuning

| Default | Rationale | Change location |
| --- | --- | --- |
| Slow: cost 80, range 2.4, multiplier 0.62 | Low-cost support tower with a noticeable but bounded aura. | `src/game/towers/towerCatalog.ts` |
| Arrow: cost 100, range 3.2, damage 18, cooldown 0.55 sec, projectile speed 8 | Affordable single-target baseline. | `src/game/towers/towerCatalog.ts` |
| Deokbae: cost 250, range 3.0, damage 14, cooldown 0.42 sec, projectile speed 6.5, splash 0.85 | Frequent short-radius splash trade-off. | `src/game/towers/towerCatalog.ts` |
| Huchu: cost 300, range 3.4, damage 72, cooldown 1.8 sec, projectile speed 5, splash 1.25 | Premium high-impact splash role. | `src/game/towers/towerCatalog.ts` |

## Task 6 — enemy sprite production

| Default | Rationale | Change location |
| --- | --- | --- |
| Model coordinate convention: foot contact (0,0,0), Z-up, +Y forward, scale 1 | Keeps render placement and directional mapping predictable. | `assets/blender/enemies-voxel-v1.blend` |
| Geometry increment: 1/16 BU | Preserves a consistent voxel-like silhouette. | `assets/blender/enemies-voxel-v1.blend` |
| Enemy set: 5 types | Covers the Stage 1 catalog without introducing unused art. | `src/game/render/spriteManifest.ts` |
| Camera yaws: 45°, 135°, 225°, 315° | Supplies the four diagonal directions used by the renderer. | `assets/blender/enemies-voxel-v1.blend` |
| Source render: 256 × 256 px; runtime sprite: 96 × 96 px | Retains source clarity while meeting mobile memory and layout needs. | `assets/renders/enemies-v1/` |
| Runtime output count: 20 sprites (5 types × 4 directions) | One mobile sprite is required for each enemy-direction pair. | `assets/renders/enemies-v1/mobile/` |

## Task 7 — responsive canvas rendering

| Default | Rationale | Change location |
| --- | --- | --- |
| Game area aspect ratio: 16:9 | Matches the landscape-first mobile game composition. | `src/game/render/layout.ts` |
| Portrait reference viewport: 390 × 844 px | Standard phone portrait check for the rotation prompt and letterboxing. | `src/game/render/layout.ts` |
| Landscape reference viewport: 844 × 390 px | Standard phone landscape check for centered play space. | `src/game/render/layout.ts` |
| Device pixel ratio cap: 2 | Avoids excessive canvas memory and fill-rate cost on dense mobile displays. | `src/game/render/layout.ts` |
| Approved tower sprite display source: 96 px | Maintains the supplied mobile asset contract. | `src/game/render/assetLoader.ts` |

## Task 8 — mobile controls and preferences

| Default | Rationale | Change location |
| --- | --- | --- |
| Combat speed choices: 1× and 2× | Provides a single readable speed-up without introducing more pacing modes. | `src/app/GameApp.ts` |
| Minimum control hit target: 44 × 44 CSS px | Meets touch accessibility expectations. | `src/app/hud.ts` and `src/styles.css` |
| Tower tray: 4 cards | Keeps all four tower roles available within a compact landscape layout. | `src/app/hud.ts` |
| Drag-cancel threshold: 8 CSS px | Separates intended taps from small finger movement. | `src/app/input.ts` |
| Default preferences: muted false; best clear time null | Keeps sound enabled initially and has no fabricated record. | `src/app/preferences.ts` |
