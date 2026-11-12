/** Small helpers shared by the public pages (front page feed, city pages). No framework. */

export interface FeedPost {
  id: string;
  said: string;
  meant: string;
  category: string;
  city: string;
  country: string;
  citySlug: string;
  readByApp: boolean;
  name: string | null;
  createdAt: string;
}

const KEY_STORAGE = 'typo_hunter_public_key';

/** Same anonymous key the app uses (same site, same storage), created on first use. */
export function publicKey(): string {
  let key = localStorage.getItem(KEY_STORAGE);
  if (!key || !/^[0-9a-f]{64}$/.test(key)) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    key = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(KEY_STORAGE, key);
  }
  return key;
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Builds a post card with DOM methods (textContent only, so post text can never run as HTML). */
export function postCard(p: FeedPost, opts: { showCity?: boolean } = {}): HTMLElement {
  const card = el('article', 'post');
  card.dataset.post = p.id;
  card.append(el('div', 'label', 'What it said'), el('p', 'said', p.said), el('div', 'label', 'What they meant'), el('p', 'meant', p.meant));
  const meta = el('div', 'meta');
  meta.append(el('span', 'chip', p.category));
  if (p.readByApp) {
    const read = el('span', 'chip read', '✓ Read by app');
    read.title = "The app read this wording from a photo on the poster's phone";
    meta.append(read);
  }
  const by = el('span');
  if (opts.showCity && p.citySlug) {
    const link = el('a', undefined, `${p.city}, ${p.country}`);
    link.href = `/city/${p.citySlug}`;
    by.append(link, ' · ');
  }
  const time = el('time', undefined, p.createdAt.slice(0, 10));
  time.dateTime = p.createdAt;
  by.append(p.name ? `by ${p.name} · ` : '', time);
  const flag = el('button', 'flag', 'Flag');
  flag.type = 'button';
  flag.dataset.flag = p.id;
  meta.append(by, flag);
  card.append(meta);
  return card;
}

const REASONS: Array<[string, string]> = [
  ['offensive', 'Offensive or hateful'],
  ['personal_info', "Shows someone's personal details"],
  ['spam', 'Spam or advertising'],
  ['not_a_typo', 'Not a typo'],
];

/** Handles every "Flag" button inside `root`: asks for a reason, then reports the post. */
export function enableFlagging(root: HTMLElement): void {
  root.addEventListener('click', async event => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('[data-flag]');
    const reasonButton = target.closest<HTMLButtonElement>('[data-reason]');
    if (button) {
      const card = button.closest<HTMLElement>('.post');
      if (!card || card.querySelector('.flag-menu')) return;
      const menu = el('div', 'flag-menu');
      menu.setAttribute('role', 'group');
      menu.setAttribute('aria-label', 'Why are you flagging this?');
      menu.append(el('p', 'msg', 'Why are you flagging this?'));
      for (const [value, label] of REASONS) {
        const b = el('button', 'chip', label);
        b.type = 'button';
        b.dataset.reason = value;
        b.style.cursor = 'pointer';
        b.style.margin = '4px 6px 0 0';
        menu.append(b);
      }
      card.append(menu);
      menu.querySelector('button')?.focus();
      return;
    }
    if (reasonButton) {
      const card = reasonButton.closest<HTMLElement>('.post');
      const menu = reasonButton.closest('.flag-menu');
      if (!card || !menu) return;
      const note = el('p', 'msg');
      note.setAttribute('role', 'status');
      try {
        const res = await fetch(`/api/posts/${card.dataset.post}/flag`, {
          method: 'POST',
          headers: { authorization: `Bearer ${publicKey()}`, 'content-type': 'application/json' },
          body: JSON.stringify({ reason: reasonButton.dataset.reason }),
        });
        const data = await res.json().catch(() => ({}));
        note.textContent = res.ok ? 'Thanks. Flagged for review.' : data.message || 'Could not flag this post.';
      } catch {
        note.textContent = 'You seem to be offline. Try again later.';
      }
      menu.replaceWith(note);
      card.querySelector<HTMLButtonElement>('[data-flag]')?.remove();
    }
  });
}
