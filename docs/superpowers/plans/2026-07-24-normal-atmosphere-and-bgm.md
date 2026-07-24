# 노멀 스테이지 환경 연출 및 모드별 BGM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 노멀 6개 스테이지를 각기 다른 자연 환경 효과로 구분하고, 게임 모드와 보스 상태에 맞는 4종 Web Audio BGM을 외부 에셋 없이 재생한다.

**Architecture:** 스테이지 카탈로그가 12개 테마 ID를 소유하고 Canvas 렌더러가 정적 팔레트·환경 프로필을 조회해 결정론적으로 그린다. 음악은 브라우저와 무관한 4곡 데이터, AudioContext look-ahead 예약을 담당하는 `MusicSequencer`, 기존 효과음과 음악을 하나의 음소거 설정으로 감싸는 `SoundEngine`, 런타임 상태를 음악 상태로 변환하는 `GameApp`의 네 경계로 나눈다.

**Tech Stack:** TypeScript, Canvas 2D, Web Audio API, Vitest, Vite, GitHub Pages

## Global Constraints

- 승인된 단일 에이전트 방식으로 실행한다.
- 외부 이미지·음원·런타임 라이브러리를 추가하지 않는다.
- 기존 Vite base `/huchu-duckbae-tower-defense/`를 유지한다.
- 기존 나이트메어 팔레트와 환경 효과의 시각 계약을 유지한다.
- 게임 밸런스, 웨이브, 점수, 적·타워 수치는 변경하지 않는다.
- 현재 `preferences.muted` 하나로 효과음과 BGM을 함께 음소거한다.
- 사용자 입력 전에는 AudioContext를 만들거나 음악을 시작하지 않는다.
- 오디오 실패는 게임 흐름으로 전파하지 않는다.
- E2E와 사용자 소유 `docs/qa/*.png` 갱신은 제외한다.
- RED → GREEN → 관련 회귀 테스트 순서로 각 구현 단위를 닫는다.

---

### Task 1: 노멀 6종 테마 ID와 스테이지 매핑

**Files:**
- Modify: `src/game/stages/stageIdentity.ts`
- Modify: `src/game/stages/stageCatalog.ts`
- Test: `tests/game/stages.test.ts`

**Interfaces:**
- Produces: `NORMAL_THEME_IDS`
- Changes: `STAGE_THEME_IDS`, `StageThemeId`
- Consumes: `NormalStageSeed.themeId`

- [ ] **Step 1: 노멀 테마 매핑 실패 테스트 작성**

`tests/game/stages.test.ts`에 다음 계약을 추가한다.

```ts
expect(NORMAL_THEME_IDS).toEqual([
  'sunnyField',
  'windingStream',
  'windyHill',
  'orcCanyon',
  'golemQuarry',
  'minotaurGate',
]);
expect(
  NORMAL_STAGE_KEYS.map((key) => getStageDefinition(key).themeId),
).toEqual(NORMAL_THEME_IDS);
expect(new Set(STAGE_THEME_IDS).size).toBe(12);
```

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/game/stages.test.ts`

Expected: `NORMAL_THEME_IDS`가 없고 노멀 스테이지가 모두 `normal`이어서 실패한다.

- [ ] **Step 3: 최소 구현**

`stageIdentity.ts`에 승인된 순서의 `NORMAL_THEME_IDS`를 추가하고
`STAGE_THEME_IDS`를 노멀 6종과 기존 나이트메어 6종의 합집합으로 정의한다.
`NormalStageSeed`에 `themeId`를 추가하고 여섯 seed에 대응 테마를 지정한다.
스테이지 정의 생성부는 하드코딩된 `'normal'` 대신 seed 값을 사용한다.

- [ ] **Step 4: GREEN 확인**

Run: `npx vitest run tests/game/stages.test.ts`

Expected: 관련 스테이지 테스트 전부 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/game/stages/stageIdentity.ts src/game/stages/stageCatalog.ts tests/game/stages.test.ts
git commit -m "feat: identify normal stage themes"
```

---

### Task 2: 노멀 팔레트와 결정론적 환경 효과

**Files:**
- Modify: `src/game/render/drawMap.ts`
- Modify: `tests/game/renderTestUtils.ts`
- Modify: `tests/game/mapRendering.test.ts`

**Interfaces:**
- Produces: `NORMAL_PALETTES`
- Produces: `ATMOSPHERE_PROFILES`
- Preserves: `NIGHTMARE_PALETTES`
- Consumes: `drawStageAtmosphere(ctx, layout, themeId, timeSeconds, reducedMotion)`

- [ ] **Step 1: 팔레트·프로필·결정론 실패 테스트 작성**

`tests/game/mapRendering.test.ts`에 다음 계약을 추가한다.

- 노멀 6개 테마 모두 팔레트와 환경 프로필을 가진다.
- 같은 테마와 같은 시간은 동일한 draw call 시퀀스를 만든다.
- 유효하지 않은 시간은 0초와 같은 결과를 만든다.
- 일반 모션은 환경 요소가 최대 12개, reduced motion은 최대 6개다.
- `sunnyField`, `windingStream`, `windyHill`, `orcCanyon`,
  `golemQuarry`, `minotaurGate`의 대표 색 또는 도형 호출이 서로 구분된다.
- 환경 효과의 호출은 설치 가이드·선택 사정거리 호출보다 먼저 발생한다.
- 기존 나이트메어 프로필은 12개/6개 상한과 `abyssGate` vignette를 유지한다.

필요한 기록 지원을 위해 `tests/game/renderTestUtils.ts`의 fake canvas에
`createLinearGradient`를 추가한다.

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/game/mapRendering.test.ts`

Expected: 노멀 팔레트·프로필 export가 없고 환경 효과가 그려지지 않아 실패한다.

- [ ] **Step 3: 정적 팔레트·프로필 구현**

`drawMap.ts`에 아래 데이터 경계를 만든다.

```ts
type AtmosphereKind = 'pollen' | 'glint' | 'leaf' | 'dust' | 'sparkle' | 'ember';

type AtmosphereProfile = Readonly<{
  kind: AtmosphereKind;
  colors: readonly string[];
  count: number;
  speed: number;
  driftX: number;
  driftY: number;
  minSize: number;
  maxSize: number;
  overlay: 'sunwash' | 'mist' | 'cloud' | 'shade' | 'mineral' | 'lightSweep' | 'vignette' | null;
}>;
```

`NORMAL_PALETTES`와 `ATMOSPHERE_PROFILES`는 모든 12개 `StageThemeId`를
빠짐없이 다루는 `Readonly<Record<...>>`로 정의한다. 기존 나이트메어 색과
파티클 결과는 유지한다.

- [ ] **Step 4: 결정론적 렌더링 구현**

파티클 좌표는 인덱스, 테마별 상수 seed, 정규화된 시간만으로 계산한다.
`Math.random()`과 프레임별 객체 생성은 사용하지 않는다.

- 일반 모션: `Math.min(profile.count, 12)`
- reduced motion: `Math.min(profile.count, 6)`, 속도 20%
- 불투명도: 0.05~0.11
- draw order: 셀 → 환경 → 배치 가이드 → 보물 → 선택/사정거리

잎은 작은 다각형, glint와 sparkle은 짧은 선, 나머지는 원과 그라데이션으로
그린다. 유효하지 않은 시간은 0으로 정규화한다.

- [ ] **Step 5: GREEN과 회귀 확인**

Run: `npx vitest run tests/game/mapRendering.test.ts tests/game/stages.test.ts`

Expected: 새 노멀 계약과 기존 나이트메어 렌더 테스트 전부 통과.

- [ ] **Step 6: 커밋**

```bash
git add src/game/render/drawMap.ts tests/game/renderTestUtils.ts tests/game/mapRendering.test.ts
git commit -m "feat: render normal stage atmosphere"
```

---

### Task 3: 네 곡의 순수 음악 데이터와 선택 규칙

**Files:**
- Create: `src/game/audio/musicTracks.ts`
- Create: `tests/game/musicTracks.test.ts`

**Interfaces:**
- Produces: `MusicTrackId`
- Produces: `MusicTrack`, `MusicLayer`, `MusicEvent`
- Produces: `MUSIC_TRACK_IDS`, `MUSIC_TRACKS`
- Produces: `validateMusicTrack(track)`
- Produces: `musicTrackIdFor(mode, bossActive)`

- [ ] **Step 1: 음악 데이터 실패 테스트 작성**

다음 계약을 검증한다.

```ts
expect(MUSIC_TRACK_IDS).toEqual([
  'normalBattle',
  'nightmareBattle',
  'normalBoss',
  'nightmareBoss',
]);
expect(musicTrackIdFor('normal', false)).toBe('normalBattle');
expect(musicTrackIdFor('normal', true)).toBe('normalBoss');
expect(musicTrackIdFor('nightmare', false)).toBe('nightmareBattle');
expect(musicTrackIdFor('nightmare', true)).toBe('nightmareBoss');
```

각 곡은 승인된 BPM, 4박자, 16마디, 하나 이상의 레이어를 갖고
`validateMusicTrack`을 통과해야 한다. 모든 이벤트는 곡 beat 범위 안에 있고
길이·gain·주파수 값이 유효하며 한 시점 동시 발음은 12개 이하이어야 한다.
범위를 벗어난 이벤트와 지원하지 않는 파형을 가진 fixture는 거부한다.

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/game/musicTracks.test.ts`

Expected: 음악 모듈이 없어 실패한다.

- [ ] **Step 3: 데이터 타입과 검증기 최소 구현**

```ts
type MusicTrack = Readonly<{
  bpm: number;
  beatsPerBar: 4;
  bars: 16;
  scale: readonly number[];
  layers: readonly MusicLayer[];
}>;
```

음정 이벤트는 beat, durationBeats, degree, octave, accent를 사용하고
타악기 이벤트는 beat, durationBeats, percussion preset과 accent를 사용한다.
검증기는 BPM, 마디 수, 이벤트 범위, 양수 길이, 지원 파형, gain, scale
degree와 최대 동시 발음 12개를 검사한다.

- [ ] **Step 4: 승인된 네 곡 데이터 구현**

- `normalBattle`: 96 BPM, D 장조
- `nightmareBattle`: 88 BPM, D 단조
- `normalBoss`: 124 BPM, B 단조
- `nightmareBoss`: 132 BPM, D 화성단음계

각 곡은 16마디 동안 반복 가능한 플럭·벨·베이스·패드·전자 타악기 레이어를
정적 배열로 정의한다. 테스트와 런타임이 같은 데이터를 사용한다.

- [ ] **Step 5: GREEN 확인**

Run: `npx vitest run tests/game/musicTracks.test.ts`

Expected: 네 곡 데이터와 잘못된 fixture 검증 테스트 전부 통과.

- [ ] **Step 6: 커밋**

```bash
git add src/game/audio/musicTracks.ts tests/game/musicTracks.test.ts
git commit -m "feat: define procedural battle music"
```

---

### Task 4: Web Audio look-ahead sequencer

**Files:**
- Create: `src/game/audio/MusicSequencer.ts`
- Create: `tests/game/musicSequencer.test.ts`
- Modify: `src/game/audio/SoundEngine.ts`
- Modify: `tests/game/effects.test.ts`

**Interfaces:**
- Extends: `AudioParamLike.linearRampToValueAtTime(value, endTime)`
- Produces: `MusicSequencer`
- Produces: `setTrack(trackId, crossfadeSeconds)`
- Produces: `setDucked(ducked)`
- Produces: `setMuted(muted)`
- Produces: `tick()`
- Produces: `destroy()`

- [ ] **Step 1: fake AudioContext와 sequencer 실패 테스트 작성**

fake gain parameter에 `linearRampToValueAtTime`을 추가하고 다음을 검증한다.

- 첫 track은 0.25초 fade-in하며 0.35초 look-ahead 안의 이벤트만 예약한다.
- 같은 track ID 재전달은 bus나 oscillator를 중복 생성하지 않는다.
- 전투곡 → 보스곡은 이전 gain 1→0, 새 gain 0→1의 1초 ramp를 한 번 만든다.
- pause/portrait duck은 master gain 30%, 복원은 원래 gain으로 0.2초 ramp한다.
- mute는 예약을 멈추고 활성 oscillator를 정리한다.
- unmute는 현재 곡을 처음부터 0.25초 fade-in한다.
- `tick()`은 종료된 노드 참조를 제거하고 활성 oscillator를 12개 이하로 유지한다.
- `setTrack(null)`과 `destroy()`는 남은 oscillator를 정리한다.
- 유효하지 않은 곡과 AudioContext 부분 구현 예외는 throw하지 않는다.

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/game/musicSequencer.test.ts tests/game/effects.test.ts`

Expected: `MusicSequencer`와 linear ramp 계약이 없어 실패한다.

- [ ] **Step 3: master bus와 track voice 구현**

`MusicSequencer` 생성 시 보수적 music master gain을 가진 bus 하나를 만든다.
각 track voice는 자체 crossfade gain과 반복 시작 시간, 예약 cursor, 활성
oscillator 목록을 가진다. voice bus는 master bus에, master bus는
`context.destination`에 연결한다.

- [ ] **Step 4: 예약·반복·정리 구현**

- 예약 창: `context.currentTime + 0.35`
- 현재 beat를 초로 변환해 해당 창 안의 이벤트만 생성
- note frequency: track scale과 octave를 MIDI 주파수로 변환
- 타악기: 짧은 pitch sweep oscillator
- 개별 note gain은 exponential release 사용
- 활성 oscillator: 최대 12개
- 반복 경계에서 cursor와 loop index만 갱신
- 끝난 노드 참조는 `tick()`에서 제거
- 전환·정지·음소거·destroy는 남은 oscillator에 best-effort `stop()` 호출

실패한 API 호출은 해당 이벤트만 건너뛰고 나머지 게임 상태에는 영향을 주지
않게 한다.

- [ ] **Step 5: GREEN과 기존 효과음 회귀 확인**

Run: `npx vitest run tests/game/musicSequencer.test.ts tests/game/effects.test.ts`

Expected: sequencer 및 기존 `SoundEngine` 효과음 테스트 전부 통과.

- [ ] **Step 6: 커밋**

```bash
git add src/game/audio/MusicSequencer.ts src/game/audio/SoundEngine.ts tests/game/musicSequencer.test.ts tests/game/effects.test.ts
git commit -m "feat: sequence procedural Web Audio music"
```

---

### Task 5: SoundEngine 음악 facade와 GameApp 상태 통합

**Files:**
- Modify: `src/game/audio/SoundEngine.ts`
- Modify: `src/app/GameApp.ts`
- Modify: `tests/game/effects.test.ts`
- Modify: `tests/scaffold.test.ts`

**Interfaces:**
- Produces:

```ts
type MusicPlaybackState = Readonly<{
  mode: GameMode;
  active: boolean;
  bossActive: boolean;
  ducked: boolean;
}>;
```

- Produces: `SoundEngine.syncMusic(state)`
- Preserves: `unlock()`, `setMuted()`, `play()`, `destroy()`

- [ ] **Step 1: facade 상태 전이 실패 테스트 작성**

다음을 fake AudioContext로 검증한다.

- unlock 전 `syncMusic`은 context를 만들지 않는다.
- unlock 후 노멀/나이트메어 playing은 대응 전투곡을 예약한다.
- `bossActive`가 true가 되는 첫 동기화만 1초 crossfade한다.
- paused 또는 portrait-blocked 상태는 ducked다.
- ready/victory/defeat는 music을 정지한다.
- mute가 SFX와 BGM 모두에 적용되고 unmute는 현재 곡을 복원한다.
- destroy는 sequencer를 먼저 정리하고 context를 닫는다.

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/game/effects.test.ts tests/scaffold.test.ts`

Expected: `syncMusic` API와 앱 호출이 없어 실패한다.

- [ ] **Step 3: SoundEngine facade 구현**

`SoundEngine`은 context가 만들어진 뒤 같은 context로 `MusicSequencer`를
한 번만 만든다. `syncMusic`은 현재 상태에서 곡 ID를 계산하고, 동일 상태는
중복 전환 없이 sequencer `tick()`만 호출한다. `setMuted`는 효과음 플래그와
sequencer mute를 함께 갱신한다.

- [ ] **Step 4: GameApp 상태 연결**

매 render frame에서 다음을 계산해 전달한다.

```ts
sound.syncMusic({
  mode: stage.mode,
  active: snapshot.phase === 'playing' || snapshot.phase === 'paused',
  bossActive: snapshot.game.bossSpawnedAtSeconds !== null,
  ducked: snapshot.phase === 'paused' || snapshot.portraitBlocked,
});
```

결과 화면에서는 음악 정지가 먼저 동기화된 뒤 기존 `victory`/`defeat` cue를
재생한다. 새 스테이지 시작과 재시작은 이전 예약을 유지하지 않는다.

- [ ] **Step 5: GREEN과 앱 회귀 확인**

Run: `npx vitest run tests/game/effects.test.ts tests/scaffold.test.ts`

Expected: 음악 상태 전이와 기존 앱 구조 테스트 전부 통과.

- [ ] **Step 6: 커밋**

```bash
git add src/game/audio/SoundEngine.ts src/app/GameApp.ts tests/game/effects.test.ts tests/scaffold.test.ts
git commit -m "feat: sync game state with battle music"
```

---

### Task 6: 문서 최신화

**Files:**
- Modify: `README.md`
- Modify: `docs/backlog.md`

**Interfaces:**
- Consumes: 실제 구현된 테마 ID, BGM 곡 수, 음소거·덕킹 동작
- Produces: 현재 기능 설명과 완료된 백로그 상태

- [ ] **Step 1: README 기능 설명 갱신**

노멀 6종 환경 효과와 외부 음원 없는 Web Audio 4곡, 보스 1초 crossfade,
현재 스피커 버튼의 통합 음소거 동작을 실제 구현과 일치하게 기록한다.

- [ ] **Step 2: 백로그 완료 상태 반영**

해당 항목이 이미 있으면 완료 처리하고, 없으면 “노멀 스테이지 환경 연출 및
모드별·보스 BGM” 완료 항목을 추가한다. 미관련 백로그는 수정하지 않는다.

- [ ] **Step 3: 문서 검증과 커밋**

Run: `git diff --check`

Expected: 출력 없음.

```bash
git add README.md docs/backlog.md
git commit -m "docs: document atmosphere and battle music"
```

---

### Task 7: 전체 검증, 모바일 스모크와 배포

**Files:**
- Verify: `dist/index.html`
- Verify: `.github/workflows/deploy-pages.yml`
- Preserve: `docs/qa/*.png`

- [ ] **Step 1: 변경 범위 정적 점검**

Run: `git status --short`

Run: `git diff --check`

Run: `rg "Math\\.random|\\.mp3|\\.ogg|\\.wav" src/game/render/drawMap.ts src/game/audio`

Expected: 공백 오류가 없고 새 환경 효과에 `Math.random()`이 없으며 외부 음원
참조가 없다.

- [ ] **Step 2: 전체 검사**

Run: `npm run check`

Expected: 전체 Vitest, TypeScript 빌드와 Vite 프로덕션 빌드 통과.

- [ ] **Step 3: Pages base 확인**

Run: `rg -o '/huchu-duckbae-tower-defense/[^" ]+\\.(js|css)' dist/index.html`

Expected: JS와 CSS 경로 모두 `/huchu-duckbae-tower-defense/`로 시작한다.

- [ ] **Step 4: 모바일 브라우저 스모크**

844×390 가로 뷰포트에서 다음을 수동 자동화로 확인한다.

- 스테이지 선택과 노멀 게임 시작
- 노멀 테마의 낮은 불투명도 환경 효과와 맵/UI 가독성
- 스피커 버튼 음소거/해제
- 일시정지/재개
- 나이트메어 게임 시작
- 브라우저 콘솔 오류 없음

전체 E2E와 `docs/qa/*.png` 쓰기는 수행하지 않는다.

- [ ] **Step 5: main 반영 전 최종 검증**

격리 브랜치를 사용했다면 `main`에 fast-forward 병합한 뒤 `npm run check`와
Pages base 검사를 다시 실행한다. `git status --short`에서 의도하지 않은
추적 파일 변경이 없어야 한다.

- [ ] **Step 6: 푸시**

Run: `env -u GITHUB_TOKEN git push origin main`

Expected: 원격 `main`이 새 구현 커밋을 가리키고 Pages workflow가 시작된다.

- [ ] **Step 7: 배포 완료 확인**

GitHub Actions의 `Deploy to GitHub Pages` 실행 결론이 `success`가 될 때까지
확인한다. 공개 HTML이 새 JS/CSS 해시를 참조하고 아래 URL이 HTTP 200인지
확인한다.

- `https://loomingsight.github.io/huchu-duckbae-tower-defense/`
- 공개 HTML이 가리키는 새 JS 번들
- 공개 HTML이 가리키는 새 CSS 번들

배포 성공과 공개 리소스 응답을 모두 확인하기 전에는 완료로 보고하지 않는다.
