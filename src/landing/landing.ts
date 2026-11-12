/**
 * Front page behaviour (kept tiny; the page works without it).
 *  - Installed app (home-screen launch) skips the front page and opens the app.
 *  - Returning visitors see "Open your museum" instead of "Start hunting".
 *  - Registers the service worker so the app is ready offline after visiting this page.
 */
import { el, enableFlagging, FeedPost, postCard } from '../feed/shared';

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

// Public typo feed: shown when the server is connected and there are posts; otherwise the
// "be the first" message stays. The page works the same without it.
async function loadFeed() {
  const cityList = document.getElementById('city-list');
  const recent = document.getElementById('recent');
  const empty = document.getElementById('feed-empty');
  if (!cityList || !recent || !empty) return;
  try {
    const [feedRes, citiesRes] = await Promise.all([fetch('/api/feed'), fetch('/api/cities/top')]);
    if (!feedRes.ok || !citiesRes.ok) return;
    const feed = (await feedRes.json()) as { posts: FeedPost[] };
    const top = (await citiesRes.json()) as { cities: Array<{ name: string; country: string; slug: string; posts: number }> };
    if (feed.posts.length === 0) return;
    for (const c of top.cities) {
      const link = el('a');
      link.href = `/city/${c.slug}`;
      link.append(`${c.name}, ${c.country} `, el('span', undefined, `· ${c.posts}`));
      cityList.append(link);
    }
    feed.posts.slice(0, 6).forEach(p => recent.append(postCard(p, { showCity: true })));
    enableFlagging(recent);
    cityList.hidden = false;
    recent.hidden = false;
    empty.hidden = true;
  } catch {
    // offline or server not connected: keep the default message
  }
}
void loadFeed();

const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
