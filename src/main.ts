import './styles.css';

const app = document.querySelector<HTMLElement>('#app');

if (!app) {
  throw new Error('Missing #app root element');
}

app.innerHTML = `
  <main class="loading-shell" aria-live="polite">
    <p class="loading-shell__eyebrow">후추 디펜스</p>
    <h1>간식 창고를 지키는 중</h1>
    <p>게임을 준비하고 있어요.</p>
    <button class="game-control loading-shell__button" type="button" disabled>불러오는 중</button>
  </main>
`;
