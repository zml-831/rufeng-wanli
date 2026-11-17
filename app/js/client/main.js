import { App } from './app.js';

const root = document.getElementById('app');
const app = new App(root);
window.__RUFENG__ = app;
app.start();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 离线能力不影响在线对局 */
    });
  });
}

window.addEventListener('error', (event) => {
  if (event?.message?.includes('ResizeObserver')) return;
  // 不把错误细节暴露给用户；控制台保留给维护者。
  console.error('[rufeng]', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[rufeng] unhandled rejection', event.reason);
});
