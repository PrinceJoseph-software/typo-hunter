/** Server-rendered "Typos in <city>" pages, so search engines and people without the app can read them. */
import type { City } from './cities';

export interface PublicPost {
  id: string;
  said: string;
  meant: string;
  category: string;
  cityId: number;
  city: string;
  country: string;
  citySlug: string;
  readByApp: boolean;
  name: string | null;
  createdAt: string;
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const STYLE = `
:root{color-scheme:light}
body{margin:0;background:#f4ebdd;color:#282722;font:17px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:720px;margin:0 auto;padding:20px 16px 64px}
a{color:#a9472b}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px}
.brand{font-weight:800;color:#282722;text-decoration:none;font-size:1.1rem}
.btn{display:inline-block;background:#e8b92d;color:#282722;border:2px solid #282722;border-radius:12px;padding:8px 14px;font-weight:700;text-decoration:none;box-shadow:3px 3px 0 #282722;cursor:pointer;font:inherit;font-weight:700}
h1{font-size:clamp(1.8rem,6vw,2.6rem);line-height:1.1;margin:0 0 6px}
.sub{color:#5b574e;margin:0 0 24px}
.post{background:#fffdf9;border:2px solid #282722;border-radius:16px;box-shadow:4px 4px 0 #282722;padding:16px;margin:0 0 16px}
.said{font-family:ui-monospace,"Courier New",monospace;font-weight:700;font-size:1.2rem;margin:0;overflow-wrap:anywhere}
.meant{font-family:ui-monospace,"Courier New",monospace;font-weight:700;color:#5f7058;margin:4px 0 10px;overflow-wrap:anywhere}
.label{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:#5b574e;font-weight:700}
.meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:.85rem;color:#5b574e}
.chip{border:2px solid #282722;border-radius:8px;padding:0 8px;font-weight:700;color:#282722;background:#fffdf9}
.read{background:#e3ecdf;color:#2d4a27}
.flag{margin-left:auto;background:none;border:0;color:#a9472b;text-decoration:underline;cursor:pointer;font:inherit;font-size:.85rem;padding:4px}
.empty{background:#fffdf9;border:2px dashed #282722;border-radius:16px;padding:24px;text-align:center}
.note{font-size:.85rem;color:#5b574e;margin-top:28px}
[hidden]{display:none}
.msg{font-size:.85rem;font-weight:700;margin:8px 0 0}
`;

const page = (title: string, description: string, canonical: string, body: string, status = 200, index = true) =>
  new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ''}
<meta name="robots" content="${index ? 'index, follow' : 'noindex'}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="/og-image.png">
<meta name="theme-color" content="#282722">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>${STYLE}</style>
</head>
<body>
<main>
<div class="top"><a class="brand" href="/">Typo Hunter</a><a class="btn" href="/app/">Open the app</a></div>
${body}
</main>
<script type="module" src="/city-feed.js"></script>
</body>
</html>`,
    {
      status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': status === 200 ? 'public, s-maxage=60, stale-while-revalidate=300' : 'no-store',
      },
    }
  );

export function renderPost(p: PublicPost): string {
  const date = new Date(p.createdAt).toISOString().slice(0, 10);
  return `<article class="post" data-post="${escapeHtml(p.id)}">
<div class="label">What it said</div>
<p class="said">${escapeHtml(p.said)}</p>
<div class="label">What they meant</div>
<p class="meant">${escapeHtml(p.meant)}</p>
<div class="meta">
<span class="chip">${escapeHtml(p.category)}</span>
${p.readByApp ? '<span class="chip read" title="The app read this wording from a photo on the poster\'s phone">✓ Read by app</span>' : ''}
<span>${p.name ? `by ${escapeHtml(p.name)} · ` : ''}<time datetime="${escapeHtml(p.createdAt)}">${date}</time></span>
<button class="flag" type="button" data-flag="${escapeHtml(p.id)}">Flag</button>
</div>
</article>`;
}

export function renderCityPage(city: City, posts: PublicPost[], hasMore: boolean, origin: string): Response {
  const place = `${city.name}, ${city.country}`;
  const list = posts.length
    ? posts.map(renderPost).join('\n')
    : `<div class="empty"><p><strong>No typos shared from ${escapeHtml(city.name)} yet.</strong></p><p>Spotted one? Be the first to add it.</p><a class="btn" href="/app/">Start hunting</a></div>`;
  return page(
    `Typos spotted in ${place} · Typo Hunter`,
    `Funny typos, misspelt signs and menu mistakes people have spotted in ${place}. Text only, shared by Typo Hunter users.`,
    `${origin}/city/${city.slug}`,
    `<h1>Typos spotted in ${escapeHtml(city.name)}</h1>
<p class="sub">${escapeHtml(place)} · shared by people using Typo Hunter. Only the words are shared, never photos or exact locations.</p>
<div id="feed" data-city="${city.id}">${list}</div>
<p><button class="btn" id="more" type="button"${hasMore ? '' : ' hidden'} data-before="${posts.length ? escapeHtml(posts[posts.length - 1].createdAt) : ''}">Show more</button></p>
<p class="note">See something that shouldn't be here? Use <strong>Flag</strong>. Posts flagged by several people are hidden until they're reviewed.</p>`
  );
}

export function renderNotFoundPage(message: string, status: number): Response {
  return page('Typo Hunter', message, '', `<h1>${escapeHtml(message)}</h1><p><a class="btn" href="/">Back to Typo Hunter</a></p>`, status, false);
}
