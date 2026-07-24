# 노멀 스테이지 환경 연출 및 모드별 BGM 설계

- 작성일: 2026-07-24
- 대상 저장소: `huchu-defense-v2`
- 상태: 대화 설계 승인 완료, 문서 검토 후 구현
- 배포 대상: `main` → GitHub Pages

## 1. 배경

나이트메어 6개 스테이지는 테마별 팔레트와 움직이는 환경 파티클을 사용하지만,
노멀 6개 스테이지는 하나의 녹색 팔레트만 공유하고 환경 효과를 그리지 않는다.
그 결과 노멀 맵의 경로는 달라도 스테이지별 시각적 개성이 약하다.

현재 오디오는 `SoundEngine`이 Web Audio oscillator로 짧은 효과음만 합성한다.
전투 중 반복 재생되는 음악은 없으므로 장시간 플레이의 분위기와 보스 출현의
긴장감이 시각 효과에 비해 약하다.

## 2. 확정된 사용자 결정

| 항목 | 결정 |
| --- | --- |
| 노멀 맵 연출 | 스테이지별 파티클 + 빛·색감 |
| 음악 스타일 | 아기자기한 판타지 어드벤처 + 전자음 |
| 음악 제작 | 외부 파일 없는 Web Audio 실시간 연주 |
| 곡 수 | 노멀 전투, 나이트메어 전투, 노멀 보스, 나이트메어 보스 총 4곡 |
| 보스 전환 | 전투곡에서 보스곡으로 1초 크로스페이드 |
| 음량 조작 | 현재 스피커 버튼으로 BGM과 효과음을 함께 음소거 |
| 일시정지 | BGM 음량을 30%로 낮추고 재개 시 복원 |
| 검증 | 단위 테스트·타입 검사·프로덕션 빌드·모바일 브라우저 스모크 |
| 제외 | 전체 E2E와 기존 추적 QA 스크린샷 갱신 |

## 3. 목표

1. 노멀 6개 스테이지에 서로 구분되는 자연 환경 효과와 색감을 제공한다.
2. 길, 타워, 적, 설치 가이드의 가독성을 유지한다.
3. 게임 모드와 보스 상태에 맞는 네 곡을 외부 음원 없이 반복 재생한다.
4. 기존 음소거 설정, 브라우저 자동 재생 제한과 앱 수명주기를 지킨다.
5. 장시간 플레이와 스테이지 재시작에서도 렌더 객체와 오디오 노드가 누적되지
   않게 한다.

## 4. 비목표

- 게임 밸런스, 웨이브, 점수와 타워·적 수치는 변경하지 않는다.
- 신규 PNG, Blender 원본, MP3, OGG, WAV 파일을 만들지 않는다.
- 스테이지별 BGM 12곡이나 스테이지 선택 화면 전용 음악을 추가하지 않는다.
- BGM과 효과음의 개별 음소거 버튼 또는 음량 슬라이더를 추가하지 않는다.
- 기존 사용자 소유 `docs/qa/*.png`를 변경하지 않는다.
- 브라우저에서 실시간 3D나 외부 음악 라이브러리를 사용하지 않는다.

## 5. 노멀 스테이지 시각 콘셉트

| 스테이지 | 테마 ID | 팔레트·조명 | 환경 효과 |
| --- | --- | --- | --- |
| S1 초록 들판 | `sunnyField` | 밝은 초록과 따뜻한 황금빛 | 황금 꽃가루, 부드러운 햇살 |
| S2 굽이 개울 | `windingStream` | 청록이 섞인 초록과 차가운 반사광 | 푸른 물빛 반사, 얇은 물안개 |
| S3 바람 언덕 | `windyHill` | 연한 황록과 높은 명도 | 가로로 흐르는 잎, 느린 구름 그림자 |
| S4 오크 협곡 | `orcCanyon` | 올리브 초록과 적갈색 측면 음영 | 적갈색 흙먼지 |
| S5 골렘 채석장 | `golemQuarry` | 회녹색과 낮은 채도 | 회색 돌가루, 짧은 광물 반짝임 |
| S6 미노타우르스 관문 | `minotaurGate` | 깊은 초록과 금빛 강조 | 황금 불씨, 느린 빛줄기 |

모든 환경 효과는 맵 셀을 그린 뒤, 설치 가능 타일·선택 타일·사정거리보다 먼저
그린다. 파티클의 기본 불투명도는 0.05~0.11 범위이며 길과 타워 실루엣을
가리지 않는다.

### 5.1 테마 데이터

`src/game/stages/stageIdentity.ts`에 `NORMAL_THEME_IDS`를 추가하고
`StageThemeId`를 노멀 6종과 나이트메어 6종의 합집합으로 정의한다.
`src/game/stages/stageCatalog.ts`의 노멀 스테이지 seed는 각자의 `themeId`를
갖는다.

`src/game/render/drawMap.ts`는 다음 두 데이터 집합을 단일 기준으로 사용한다.

- `STAGE_PALETTES`: 지면, 교차 지면, 길, 배경, 보드 측면 색상
- `ATMOSPHERE_PROFILES`: 파티클 종류, 색상, 개수, 이동 방향, 속도, 크기,
  선택적 그라데이션

기존 나이트메어 팔레트와 환경 효과도 같은 조회 구조를 사용하되 시각적 결과는
변경하지 않는다.

### 5.2 렌더링 규칙

- 파티클 위치는 인덱스 기반 고정 시드로 계산하며 `Math.random()`을 사용하지
  않는다.
- 일반 모션은 스테이지당 최대 12개의 환경 요소를 그린다.
- `prefers-reduced-motion`에서는 최대 6개로 줄이고 이동 속도를 기본의 20%로
  낮춘다.
- 파티클은 원, 짧은 선, 작은 잎 다각형과 그라데이션만 사용한다.
- 프레임마다 배열이나 이미지 객체를 생성하지 않고 정적 프로필을 재사용한다.
- 유효하지 않은 시간은 0초로 정규화한다.

## 6. BGM 콘셉트

| 곡 ID | BPM / 조성 | 길이 | 레이어 | 역할 |
| --- | --- | --- | --- | --- |
| `normalBattle` | 96 BPM / D 장조 | 16마디, 약 40초 | 플럭, 벨, 삼각파 베이스, 가벼운 전자 타악기 | 밝고 꾸준한 판타지 행진 |
| `nightmareBattle` | 88 BPM / D 단조 | 16마디, 약 44초 | 어두운 벨, 저음 펄스, 얇은 패드, 희박한 타악기 | 불안하지만 과도하게 무겁지 않은 전투 |
| `normalBoss` | 124 BPM / B 단조 | 16마디, 약 31초 | 빠른 플럭 아르페지오, 베이스, 강한 전자 타악기 | 노멀 테마의 긴장감 있는 변주 |
| `nightmareBoss` | 132 BPM / D 화성단음계 | 16마디, 약 29초 | 낮은 펄스, 불협 벨, 촘촘한 아르페지오와 타악기 | 최종 위협과 속도감 강조 |

파형은 현재 Web Audio 환경에서 지원하는 `sine`, `triangle`, `square`,
`sawtooth`만 사용한다. 타악기는 짧은 pitch sweep oscillator로 합성하므로
AudioBuffer나 외부 음원 파일이 필요하지 않다.

## 7. 오디오 구조

### 7.1 파일 경계

- `src/game/audio/musicTracks.ts`
  - 네 곡의 BPM, 마디, 음계와 레이어 패턴을 순수 데이터로 정의한다.
  - 브라우저 API에 의존하지 않는다.
- `src/game/audio/MusicSequencer.ts`
  - AudioContext 시간 기준의 look-ahead 예약, 반복, 크로스페이드와 정리를
    담당한다.
  - 게임 규칙이나 DOM을 알지 못한다.
- `src/game/audio/SoundEngine.ts`
  - 기존 효과음 API를 유지하는 facade다.
  - 공유 AudioContext와 BGM gain bus를 소유하며 음악 상태를 sequencer에
    전달한다.
- `src/app/GameApp.ts`
  - 모드, phase, 일시정지, 세로 화면 차단과 보스 출현 상태만 계산해
    `SoundEngine`에 전달한다.

### 7.2 음악 데이터 계약

음악은 다음 개념을 갖는 읽기 전용 데이터다.

```ts
type MusicTrackId =
  | 'normalBattle'
  | 'nightmareBattle'
  | 'normalBoss'
  | 'nightmareBoss';

type MusicTrack = Readonly<{
  bpm: number;
  beatsPerBar: 4;
  bars: 16;
  scale: readonly number[];
  layers: readonly MusicLayer[];
}>;

type MusicLayer = Readonly<{
  instrument: 'pluck' | 'bell' | 'bass' | 'pad' | 'percussion';
  waveform: OscillatorType;
  gain: number;
  events: readonly MusicEvent[];
}>;
```

`MusicEvent`는 전체 곡 안의 beat 위치, 길이, 음계 degree, octave와 선택적
강세를 갖는다. 타악기 이벤트에는 음계 degree 대신 pitch sweep preset을
사용한다.

검증기는 BPM, 마디 수, 이벤트 범위, 양수 길이, 지원 파형, 레이어 gain과
동시 발음 상한을 확인한다. 잘못된 곡은 재생하지 않고 무음으로 유지한다.

### 7.3 예약과 자원 관리

- `AudioParamLike` 계약에 `linearRampToValueAtTime`을 추가해 fade와
  크로스페이드를 테스트 가능한 방식으로 표현한다.
- `MusicSequencer`는 AudioContext 현재 시간에서 0.35초 앞까지만 예약한다.
- `GameApp`의 animation frame에서 음악 상태 동기화와 예약 tick을 호출한다.
- 한 시점에 울리는 oscillator는 최대 12개다.
- 예약 노드는 oscillator, gain과 종료 시간을 함께 기록한다. 매 tick에서 종료
  시간이 지난 참조를 제거하고 전환·음소거·destroy 시 남은 oscillator를
  명시적으로 `stop()`한다.
- 곡 전환 시 기존·새 음악 bus를 1초 동안 교차시킨 뒤 기존 bus와 노드를
  정리한다.
- 동일한 track ID를 반복 전달해도 재시작하거나 중복 예약하지 않는다.
- 앱 `destroy()`는 활성·예약 노드와 AudioContext를 모두 종료한다.

## 8. 재생 상태 흐름

1. 스테이지 선택 화면은 음악 상태를 `stopped`로 유지한다.
2. 사용자가 `게임 시작`을 누르면 기존 `unlock()` 경로에서 AudioContext를
   활성화한다.
3. 노멀은 `normalBattle`, 나이트메어는 `nightmareBattle`을 0.25초
   fade-in으로 시작한다.
4. `bossSpawnedAtSeconds`가 처음 설정되면 현재 모드의 보스곡으로 1초
   크로스페이드한다.
5. 같은 보스 출현 값을 여러 프레임에서 받아도 전환은 한 번만 수행한다.
6. 일시정지 또는 세로 화면 차단 중에는 music bus를 30%로 낮춘다.
7. 재개하면 0.2초 동안 원래 음량으로 복원한다.
8. 음소거 시 활성 음악을 짧게 fade-out하고 추가 예약을 멈춘다. 음소거 해제
   시 현재 곡을 처음부터 0.25초 fade-in한다.
9. 승리·패배 시 음악을 정지한 뒤 기존 `victory` 또는 `defeat` 효과음을
   재생한다.
10. 다시 시작하거나 다른 스테이지를 시작하면 이전 음악 상태와 예약을 완전히
    초기화한다.

## 9. 음량과 브라우저 제약

- 음악 master gain은 효과음을 가리지 않도록 보수적인 값으로 시작한다.
- 각 레이어 gain 합은 clipping을 피하도록 제한한다.
- 현재 `preferences.muted` 하나가 효과음과 음악에 함께 적용된다.
- 브라우저 자동 재생 정책상 사용자 입력 전에는 AudioContext를 만들거나
  재생하지 않는다.
- AudioContext 생성, resume, oscillator 생성이나 parameter 예약이 실패하면
  해당 호출만 무시하고 게임을 계속한다.
- 오디오 미지원 환경에서도 UI 상태와 시뮬레이션은 동일하게 동작한다.

## 10. 테스트 전략

### 10.1 맵 렌더링

- 노멀 6개 스테이지가 서로 다른 테마 ID를 갖는지 검증한다.
- 각 테마가 팔레트와 환경 프로필을 갖는지 검증한다.
- 같은 stage/time 입력이 같은 draw call을 만드는지 검증한다.
- 일반 모션은 최대 12개, reduced motion은 최대 6개인지 검증한다.
- 길, 배치 가능 타일, 선택·사정거리 레이어가 환경 효과보다 위에 그려지는지
  검증한다.
- 기존 나이트메어 팔레트와 파티클 수 계약이 유지되는지 검증한다.

### 10.2 음악 데이터와 sequencer

- 네 track ID가 모두 유효한 16마디 데이터를 갖는지 검증한다.
- 음표가 곡 범위를 벗어나지 않고 동시 발음이 12개 이하인지 검증한다.
- 노멀·나이트메어 모드가 올바른 전투곡을 선택하는지 검증한다.
- 보스 출현이 정확히 한 번의 1초 크로스페이드를 만드는지 검증한다.
- pause·portrait 상태가 30% gain, 재개가 원래 gain을 만드는지 검증한다.
- mute·unmute, victory·defeat, restart, stage switch와 destroy가 예약 노드를
  정리하는지 fake AudioContext로 검증한다.
- AudioContext의 부분 구현과 예외가 게임 흐름으로 전파되지 않는지 검증한다.

### 10.3 통합 검증

- `npm run check`
- `dist/index.html`의 JS/CSS 경로가
  `/huchu-duckbae-tower-defense/`로 시작하는지 확인
- 844×390 모바일 가로 브라우저에서 노멀 6개 테마의 가독성 확인
- 노멀·나이트메어 게임 시작과 보스 전환 상태의 브라우저 스모크 확인
- 전체 E2E와 `docs/qa/*.png` 갱신은 수행하지 않음

## 11. 배포

1. 구현 커밋을 `main`에 반영한다.
2. `npm run check`와 Vite base 경로를 다시 확인한다.
3. `main`을 원격 저장소에 푸시한다.
4. `Deploy to GitHub Pages` Actions가 `success`인지 확인한다.
5. 공개 게임 URL과 배포된 JS/CSS 번들이 HTTP 200인지 확인한다.

## 12. 완료 기준

- 노멀 6개 스테이지가 승인된 여섯 시각 콘셉트로 명확히 구분된다.
- 환경 효과가 길, 적, 타워와 설치·사정거리 UI를 가리지 않는다.
- 네 BGM이 모드와 보스 상태에 맞춰 반복 재생된다.
- 보스 전환은 한 번만 발생하며 약 1초 동안 끊김 없이 교차한다.
- 현재 스피커 버튼이 효과음과 BGM에 함께 적용된다.
- 일시정지, 세로 화면, 결과 화면, 재시작과 앱 종료에서 음악 상태가 정확하다.
- 장시간 반복 후에도 활성 oscillator 상한과 정리 계약을 지킨다.
- 외부 이미지·오디오 파일과 신규 UI 없이 구현된다.
- 전체 단위 테스트, 타입 검사와 프로덕션 빌드가 통과한다.
- GitHub Pages 배포와 공개 리소스 응답이 검증된다.
