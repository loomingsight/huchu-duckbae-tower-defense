# MVP release verification

검증일: 2026-07-21 (Asia/Seoul)

## 자동 검증 결과

| 명령 | 결과 |
| --- | --- |
| `npm test -- tests/game/effects.test.ts` | PASS, 1 file / 6 tests |
| `npm run test` | PASS, 22 files / 108 tests |
| `npm run build` | PASS, TypeScript + Vite production build, 36 modules transformed |
| `npm run test:e2e` | PASS, Chromium 4 / 4 tests, 1 worker |

TDD RED는 `updateEffects`의 placeholder가 만료 효과를 남겨 `expected [...] to deeply equal []`로 실패하고, lazy audio placeholder가 `expected "spy" to be called once, but got 0 times`로 실패하는 것을 각각 확인했습니다. GREEN에서는 focused effects/audio 6개가 모두 통과했습니다.

## 브라우저 수락 범위

- 844×390: 게임 시작, 화살 타워 선택, buildable cell 배치, 골드 450→350 확인
- 844×390: 2× 전환, pause 중 debug clock 2초 전진에도 elapsed 고정, resume 뒤 enemy/wave/HP 진행 확인
- 844×390: 실제 UI 타워 구매와 실제 simulation 진행으로 victory overlay 확인, restart 뒤 gold 450 / HP 20 / wave 1 reset 확인
- 844×390: 무타워 defeat를 2회 반복하고 매 restart마다 pending animation frame이 정확히 1개임을 확인
- 390×844: 회전 안내 표시, debug clock 5초 전진에도 elapsed와 enemy count가 그대로임을 확인
- favicon: inline SVG data URL을 사용해 `/favicon.ico` 요청과 404를 제거
- 브라우저 `console.error`: 0건
- 브라우저 uncaught `pageerror`: 0건

`?debug-clock=1` 훅은 DEV build에서만 설치됩니다. 공개 동작은 `advance(milliseconds)`와 read-only `snapshot()`뿐이며 게임 상태를 직접 덮어쓰지 않습니다. production bundle은 `__HUCHU_DEV_CLOCK__` 문자열 부재를 별도로 확인합니다.

## 캡처

- [`landscape-844x390.png`](landscape-844x390.png): 화살 타워 설치, 2×, wave 진행
- [`victory-844x390.png`](victory-844x390.png): victory overlay
- [`defeat-844x390.png`](defeat-844x390.png): defeat overlay
- [`portrait-390x844.png`](portrait-390x844.png): portrait 회전 안내

## 연기한 결정

- 첫 클리어 목표 5–7분과 타워/적 수치의 최종 조정은 실제 기기 플레이테스트 뒤 확정
- 사용자 제공 후추·덕배 사진 기반 캐릭터와 Blender 렌더의 최종 아트 polish는 MVP 이후 진행
- Web Audio의 최종 음색, 믹싱, 햅틱 조합은 실제 모바일 기기 청취 뒤 조정

실행 가능한 현재 기본값과 정확한 변경 위치는 [`../decisions/deferred-decisions.md`](../decisions/deferred-decisions.md)를 기준으로 합니다.
