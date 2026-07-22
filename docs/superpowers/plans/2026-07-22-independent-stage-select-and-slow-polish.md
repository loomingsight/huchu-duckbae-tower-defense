# Independent Stage Select and Slow Tower Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 기존 상태와 저장 데이터를 재사용해 독립형 스테이지 선택 화면을 제공하고 슬로우 타워의 동심원·표시 크기를 실제 게임 설정에 맞춘다.

**Architecture:** `ready`·`victory`·`defeat` 상태의 기존 오버레이를 불투명한 선택 화면으로 승격하고, preferences v3의 `stageRecords`를 카드 뷰 모델에 전달한다. 게임 런타임과 저장 스키마는 변경하지 않는다. 슬로우 타워의 반지름과 크기는 렌더러의 순수 함수로 노출해 카탈로그 값과 정확히 연결한다.

**Tech Stack:** TypeScript 5.8, HTML Canvas 2D, Vite 7, Vitest 3, CSS, GitHub Pages

## Global Constraints

- 단일 에이전트로 순차 구현한다.
- 신규 이미지, 라우트, 런타임 상태, 저장 스키마, 외부 의존성을 추가하지 않는다.
- Vite base `/huchu-duckbae-tower-defense/`를 유지한다.
- 기존 사용자 변경사항을 되돌리지 않는다.
- 사용자 승인에 따라 Playwright 및 기타 E2E를 실행하지 않는다.
- 단위 테스트·타입 검사·프로덕션 빌드로 검증한다.

---

### Task 1: 스테이지 카드 뷰 모델

**Files:**
- Modify: `tests/app/hud.test.ts`
- Modify: `src/app/hud.ts`

- [ ] **Step 1: 잠금·도전 가능·클리어 카드 계약의 실패 테스트 작성**

`tests/app/hud.test.ts`에 다음 계약을 추가한다.

```ts
const records = {
  1: { bestScore: 8400, bestClearSeconds: 95 },
  2: { bestScore: 2200, bestClearSeconds: null },
};

expect(createStageSelectView(2, 2, records)).toMatchObject([
  {
    id: 1,
    name: '초록 들판',
    status: 'cleared',
    recordText: '최고 8,400점 · 최단 1:35',
  },
  {
    id: 2,
    status: 'available',
    selected: true,
    recordText: '최고 2,200점 · 미클리어',
  },
  {
    id: 3,
    status: 'locked',
    locked: true,
    recordText: '잠김',
  },
]);
```

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/app/hud.test.ts`

Expected: `createStageSelectView` export가 없어 suite가 실패한다.

- [ ] **Step 3: 최소 뷰 모델 구현**

`src/app/hud.ts`에 다음 책임을 추가한다.

- `formatStageClearTime(seconds)`: 유효한 초를 `m:ss`로 포맷
- `createStageSelectView(selected, highest, records)`: `STAGE_IDS`와 `getStageDefinition`을 사용해 카드 6개 생성
- `bestClearSeconds !== null`이면 `cleared`
- 해금됐지만 클리어하지 않았으면 `available`
- 잠긴 스테이지는 `locked`
- 기록이 없으면 `기록 없음`

기존 `createStagePickerView`는 필요한 호환 테스트가 있다면 새 뷰 모델을 축약해 반환하도록 유지한다.

- [ ] **Step 4: GREEN 확인**

Run: `npx vitest run tests/app/hud.test.ts`

Expected: PASS

---

### Task 2: 독립형 선택 화면 렌더링과 게임 연결

**Files:**
- Modify: `tests/app/hud.test.ts`
- Modify: `tests/scaffold.test.ts`
- Modify: `src/app/hud.ts`
- Modify: `src/app/GameApp.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: 화면 구조·레이아웃 실패 테스트 작성**

다음 계약을 테스트한다.

- 화면 클래스 `.stage-select-screen` 존재
- 배경이 전장을 비치지 않는 불투명 색상
- 카드 영역은 `repeat(3, minmax(0, 1fr))`
- 스테이지 카드 최소 높이 44px 이상
- 렌더된 버튼은 이름, 상태, 기록 문구를 포함
- 잠긴 버튼은 `disabled` 및 잠김 접근성 이름 유지

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/app/hud.test.ts tests/scaffold.test.ts`

Expected: 새 화면 클래스와 3×2 카드 계약이 없어 실패한다.

- [ ] **Step 3: 선택 화면 마크업과 렌더링 구현**

`src/app/hud.ts`에서 기존 overlay data selector와 포커스 관리 계약은 유지하면서 다음을 적용한다.

- 최상위 오버레이를 `.stage-select-screen`으로 변경
- 6개 숫자 버튼을 이름·상태·기록을 담은 카드 버튼으로 렌더
- 준비 상태에는 결과 패널을 숨김
- 승리·패배 상태에는 기존 결과 패널 유지
- 준비·승리·패배 상태에서만 선택 화면 표시

`src/app/GameApp.ts`는 `renderStagePicker`에 `preferences.stageRecords`를 전달한다. 기존 `createGame(selectedStageId)`, 승리 시 다음 스테이지 자동 선택, 결과 기록 흐름은 그대로 사용한다.

- [ ] **Step 4: 모바일 가로 CSS 구현**

`src/styles.css`에 다음을 적용한다.

- 선택 화면은 viewport와 canvas를 완전히 덮는 불투명 Material 계열 배경
- 패널은 작은 화면에서 세로 스크롤 허용
- 카드 그리드 3열×2행
- 선택·클리어·잠김을 색상과 텍스트로 동시에 구분
- 44px 터치 영역, 긴 한글 이름 줄바꿈, safe-area 여백 유지

- [ ] **Step 5: GREEN 확인**

Run: `npx vitest run tests/app/hud.test.ts tests/scaffold.test.ts tests/app/GameApp.test.ts`

Expected: PASS

---

### Task 3: 슬로우 타워 동심원과 표시 크기

**Files:**
- Modify: `tests/game/renderer.test.ts`
- Modify: `src/game/render/drawEffects.ts`
- Modify: `src/game/render/drawEntities.ts`

- [ ] **Step 1: 렌더 값 실패 테스트 작성**

`tests/game/renderer.test.ts`에 다음 순수 계약을 추가한다.

```ts
expect(slowPulseRadius(0)).toBe(0.35);
expect(slowPulseRadius(1)).toBe(TOWER_CATALOG.slow.range);
expect(towerSizeFactor('slow')).toBe(1.8);
expect(towerSizeFactor('arrow')).toBe(2);
expect(towerSizeFactor('deokbae')).toBe(2);
expect(towerSizeFactor('huchu')).toBe(2);
```

- [ ] **Step 2: RED 확인**

Run: `npx vitest run tests/game/renderer.test.ts`

Expected: 두 순수 함수 export가 없어 실패한다.

- [ ] **Step 3: 실제 카탈로그 기반 반지름 구현**

`src/game/render/drawEffects.ts`에 `slowPulseRadius(progress)`를 추가한다.

```ts
const start = 0.35;
const normalized = Math.max(0, Math.min(1, progress));
return start + (TOWER_CATALOG.slow.range - start) * normalized;
```

`drawSlowPulses`의 `projectWorldRing` 호출은 이 함수를 사용한다. 기존 3초 생성 간격과 0.6초 지속 시간은 변경하지 않는다.

- [ ] **Step 4: 타워 종류별 표시 크기 구현**

`src/game/render/drawEntities.ts`에 `towerSizeFactor(type)`을 추가해 슬로우는 `1.8`, 나머지는 `2.0`을 반환하게 한다. 타워 이미지 크기 계산에 이 값을 사용하고 바닥 앵커는 유지한다.

- [ ] **Step 5: GREEN 확인**

Run: `npx vitest run tests/game/renderer.test.ts tests/game/effects.test.ts`

Expected: PASS

---

### Task 4: 백로그와 전체 검증

**Files:**
- Modify: `docs/backlog.md`

- [ ] **Step 1: 남은 항목 완료 처리**

독립 스테이지 선택 화면 4개와 슬로우 타워 표현 2개 항목을 실제 검증 완료 후 `[x]`로 변경하고 설계 문서 링크를 추가한다.

- [ ] **Step 2: 전체 단위 테스트·타입·빌드 검증**

Run: `npm run check`

Expected: 모든 Vitest suite, TypeScript 검사, Vite production build PASS

- [ ] **Step 3: 배포 경로 검증**

Run: `rg -n '/huchu-duckbae-tower-defense/' dist/index.html`

Expected: JS와 CSS 경로가 모두 `/huchu-duckbae-tower-defense/`로 시작한다.

Run: `git diff --check`

Expected: 출력 없음

E2E는 실행하지 않는다.

---

### Task 5: 커밋·푸시·GitHub Pages 확인

**Files:**
- Commit all verified task-owned changes

- [ ] **Step 1: 변경 범위 검토 후 커밋**

`git status --short`, `git diff --stat`, `git diff`로 사용자 변경사항을 포함한 현재 범위를 확인한 뒤 논리적 커밋을 만든다.

- [ ] **Step 2: main 푸시**

Run: `env -u GITHUB_TOKEN git push origin main`

Expected: remote `main`이 정확한 로컬 HEAD로 갱신된다.

- [ ] **Step 3: GitHub Actions 확인**

정확한 푸시 SHA의 `.github/workflows/deploy-pages.yml` 실행이 `success`가 될 때까지 확인한다.

- [ ] **Step 4: 공개 배포 확인**

- `https://loomingsight.github.io/huchu-duckbae-tower-defense/` HTTP 200
- 공개 `index.html`이 현재 빌드의 JS 번들을 참조
- 해당 JS 번들 HTTP 200

배포 완료 전에는 성공으로 보고하지 않는다.

