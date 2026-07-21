# AGENTS.md

## 기본 협업 규칙

- 모든 응답은 가급적 한국어로 작성한다.
- 모호해서 결과가 크게 달라질 수 있는 사항은 사용자에게 확인한다.
- 기존 사용자 변경사항을 임의로 되돌리지 않는다.

## GitHub Pages 배포

- 원격 저장소: `https://github.com/loomingsight/huchu-duckbae.git`
- 배포 브랜치: `main`
- 공개 게임 URL: `https://loomingsight.github.io/huchu-duckbae/tower-defense/`
- Vite base는 반드시 `/huchu-duckbae/tower-defense/`를 유지한다.
- 배포 워크플로는 `.github/workflows/deploy-pages.yml`에서 관리한다.
- GitHub Pages의 배포 소스는 `GitHub Actions`로 설정되어 있다.
- `main`에 푸시하면 테스트와 프로덕션 빌드 후 자동 배포한다.
- Pages artifact는 빌드 결과를 `pages/tower-defense/` 아래에 배치해야 한다. 저장소 루트에 바로 배치하면 목표 하위 URL과 맞지 않는다.

## 배포 전후 검증

- 배포 전 `npm run check`를 실행해 전체 테스트와 프로덕션 빌드를 확인한다.
- 빌드된 `dist/index.html`의 JS와 CSS 경로가 `/huchu-duckbae/tower-defense/`로 시작하는지 확인한다.
- 배포 후 GitHub Actions 실행 결과가 `success`인지 확인한다.
- 공개 게임 URL과 주요 JS 번들이 HTTP 200을 반환하는지 확인한다.
- 배포가 완료되기 전에는 사용자에게 성공했다고 보고하지 않는다.

## GitHub 인증과 토큰

- 개인 GitHub 토큰 환경변수 이름은 `LOOMINGSIGHT_GITHUB_TOKEN`을 사용한다.
- 토큰 값은 저장소, 문서, 로그 또는 커밋에 기록하지 않는다.
- 로컬 GitHub CLI는 가능한 경우 macOS 키체인의 `loomingsight` 로그인을 사용한다.
- 세션에 잘못된 전역 `GITHUB_TOKEN`이 주입돼 인증을 방해하면 해당 변수만 제외하고 키체인 인증을 사용한다.
- `LOOMINGSIGHT_GITHUB_TOKEN`으로 GitHub CLI를 실행해야 할 때는 프로세스 범위에서 `GH_TOKEN="$LOOMINGSIGHT_GITHUB_TOKEN"`으로 전달한다.
- GitHub Actions Pages 배포는 워크플로 내장 토큰을 사용하므로 개인 토큰 Secret을 추가하지 않는다.
