/**
 * Front page behaviour (kept tiny; the page works without it).
 *  - Installed app (home-screen launch) skips the front page and opens the app.
 *  - Returning visitors see "Open your museum" instead of "Start hunting".
 *  - Registers the service worker so the app is ready offline after visiting this page.
 */

const standalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

if (standalone) {
  window.location.replace('/app/');
}

try {
  if (localStorage.getItem('typo_hunter_onboarded')) {
    document.querySelectorAll<HTMLAnchorElement>('[data-primary-cta]').forEach(a => {
      a.textContent = 'Open your museum';
    });
  }
} catch {
  // storage unavailable (private mode); keep the default text
}

const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
