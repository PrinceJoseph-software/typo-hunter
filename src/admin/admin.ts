/** Owner-only review page for posts hidden by flags. The secret is checked by the server on every request. */
import { el } from '../feed/shared';

interface HiddenPost {
  id: string;
  said: string;
  meant: string;
  category: string;
  city: string;
  country: string;
  name: string | null;
  createdAt: string;
  reasons: Record<string, number>;
}

const SECRET_KEY = 'typo_hunter_admin_secret';
const login = document.getElementById('login') as HTMLFormElement;
const secretInput = document.getElementById('secret') as HTMLInputElement;
const status = document.getElementById('status') as HTMLElement;
const queue = document.getElementById('queue') as HTMLElement;
const list = document.getElementById('list') as HTMLElement;
const totals = document.getElementById('totals') as HTMLElement;

const REASON_LABELS: Record<string, string> = {
  offensive: 'offensive',
  personal_info: 'personal details',
  spam: 'spam',
  not_a_typo: 'not a typo',
};

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: { 'x-admin-secret': sessionStorage.getItem(SECRET_KEY) || '', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

function render(posts: HiddenPost[]) {
  list.replaceChildren();
  if (posts.length === 0) {
    list.append(el('p', undefined, 'Nothing to review. All clear.'));
    return;
  }
  for (const p of posts) {
    const card = el('article', 'post');
    const why = Object.entries(p.reasons).map(([r, n]) => `${n} × ${REASON_LABELS[r] || r}`).join(', ');
    card.append(
      el('div', 'label', 'What it said'),
      el('p', 'said', p.said),
      el('div', 'label', 'What they meant'),
      el('p', 'meant', p.meant),
      el('p', 'hint', `${p.category} · ${p.city}, ${p.country} · ${p.name ? `by ${p.name}` : 'anonymous'} · ${p.createdAt.slice(0, 10)}`),
      el('p', undefined, `Flagged: ${why || 'no reasons recorded'}`)
    );
    const actions = el('div', 'actions');
    const restore = el('button', 'btn btn-light', 'Restore (it\'s fine)');
    const remove = el('button', 'btn danger', 'Remove (counts against the poster)');
    restore.type = remove.type = 'button';
    const act = (action: 'restore' | 'remove') => async () => {
      restore.disabled = remove.disabled = true;
      try {
        await api('POST', `/posts/${p.id}`, { action });
        card.remove();
        status.textContent = action === 'restore' ? 'Restored.' : 'Removed.';
      } catch (err) {
        status.textContent = (err as Error).message;
        restore.disabled = remove.disabled = false;
      }
    };
    restore.addEventListener('click', act('restore'));
    remove.addEventListener('click', act('remove'));
    actions.append(restore, remove);
    card.append(actions);
    list.append(card);
  }
}

async function load() {
  status.textContent = 'Loading…';
  try {
    const data = (await api('GET', '/queue')) as { hidden: HiddenPost[]; totals: { visible: number; removed: number } };
    login.hidden = true;
    queue.hidden = false;
    totals.textContent = `${data.hidden.length} waiting for review · ${data.totals.visible} public posts · ${data.totals.removed} removed`;
    render(data.hidden);
    status.textContent = '';
  } catch (err) {
    sessionStorage.removeItem(SECRET_KEY);
    login.hidden = false;
    queue.hidden = true;
    status.textContent = (err as Error).message;
  }
}

login.addEventListener('submit', e => {
  e.preventDefault();
  sessionStorage.setItem(SECRET_KEY, secretInput.value);
  secretInput.value = '';
  void load();
});
document.getElementById('refresh')?.addEventListener('click', () => void load());
document.getElementById('logout')?.addEventListener('click', () => {
  sessionStorage.removeItem(SECRET_KEY);
  queue.hidden = true;
  login.hidden = false;
  status.textContent = 'Locked.';
});

if (sessionStorage.getItem(SECRET_KEY)) void load();
