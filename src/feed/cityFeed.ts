/** Script for the server-rendered /city/<slug> pages: flagging and "Show more". */
import { enableFlagging, FeedPost, postCard } from './shared';

const feed = document.getElementById('feed');
const more = document.getElementById('more') as HTMLButtonElement | null;

if (feed) {
  enableFlagging(feed);
  more?.addEventListener('click', async () => {
    more.disabled = true;
    try {
      const res = await fetch(`/api/feed?city=${feed.dataset.city}&before=${encodeURIComponent(more.dataset.before || '')}`);
      const data = (await res.json()) as { posts: FeedPost[]; nextBefore: string | null };
      data.posts.forEach(p => feed.append(postCard(p)));
      if (data.nextBefore) more.dataset.before = data.nextBefore;
      else more.hidden = true;
    } catch {
      // leave the button so the visitor can try again
    } finally {
      more.disabled = false;
    }
  });
}
