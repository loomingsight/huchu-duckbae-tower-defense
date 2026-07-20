import './styles.css';
import { mountGameApp } from './app/GameApp';

const app = document.querySelector<HTMLElement>('#app');

if (!app) {
  throw new Error('Missing #app root element');
}

void mountGameApp(app).catch(() => {
  app.innerHTML = `
    <main class="fatal-shell" role="alert">
      <h1>게임을 시작하지 못했어요</h1>
      <p>페이지를 새로고침해 다시 시도해 주세요.</p>
      <button class="game-control fatal-shell__button" type="button">새로고침</button>
    </main>
  `;
  app.querySelector<HTMLButtonElement>('.fatal-shell__button')?.addEventListener('click', () => {
    globalThis.location.reload();
  });
});
