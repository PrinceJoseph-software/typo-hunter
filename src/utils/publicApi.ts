/**
 * Client for the public typo feed (/api on this site). Sharing is opt-in per find and
 * sends words only: what it said, what they meant, category, city, the "Read by app"
 * flag and, if chosen, the public nickname. Photos never leave the phone.
 */
import { dbService, Discovery, PublicPostState } from '../db/database';

const KEY_STORAGE = 'typo_hunter_public_key';
const CITY_STORAGE = 'typo_hunter_public_city';
const AGE_STORAGE = 'typo_hunter_public_age13';
const NICK_STORAGE = 'typo_hunter_public_nickname';

export interface SavedCity {
  id: number;
  name: string;
  country: string;
}

export interface ShareChoice {
  city: SavedCity | null;
  showName: boolean;
  age13: boolean;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** The phone's anonymous posting key: random, created on first use, stored only here. */
function getPublicKey(): string {
  let key = localStorage.getItem(KEY_STORAGE);
  if (!key || !/^[0-9a-f]{64}$/.test(key)) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    key = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(KEY_STORAGE, key);
  }
  return key;
}

async function call<T>(method: string, path: string, body?: unknown, withKey = true): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(withKey ? { authorization: `Bearer ${getPublicKey()}` } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'offline', 'You\'re offline.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'error', data.message || 'Something went wrong.');
  return data as T;
}

export const publicApi = {
  getSavedCity(): SavedCity | null {
    try {
      const c = JSON.parse(localStorage.getItem(CITY_STORAGE) || 'null');
      return c && Number.isInteger(c.id) ? c : null;
    } catch {
      return null;
    }
  },
  saveCity(city: SavedCity) {
    localStorage.setItem(CITY_STORAGE, JSON.stringify({ id: city.id, name: city.name, country: city.country }));
  },
  hasConfirmedAge: () => localStorage.getItem(AGE_STORAGE) === '1',
  confirmAge: () => localStorage.setItem(AGE_STORAGE, '1'),
  /** Last nickname the server confirmed for this phone (cached so it shows offline). */
  getCachedNickname: () => localStorage.getItem(NICK_STORAGE),

  async me(): Promise<{ nickname: string | null; yourNicknames: string[]; nicknameChangeAllowedAt: string | null; postsLeftToday: number; banned: boolean }> {
    const me = await call<{ nickname: string | null; yourNicknames: string[]; nicknameChangeAllowedAt: string | null; postsLeftToday: number; banned: boolean }>('GET', '/me');
    if (me.nickname) localStorage.setItem(NICK_STORAGE, me.nickname);
    else localStorage.removeItem(NICK_STORAGE);
    return me;
  },

  async setNickname(nickname: string): Promise<string> {
    const res = await call<{ nickname: string }>('PUT', '/me/nickname', { nickname });
    localStorage.setItem(NICK_STORAGE, res.nickname);
    return res.nickname;
  },

  flag: (postId: string, reason: string) => call<{ ok: boolean; alreadyFlagged?: boolean }>('POST', `/posts/${postId}/flag`, { reason }),

  /**
   * Shares a find's words publicly. If the phone is offline the post is queued on the
   * find and sent later by `flushQueue`. Returns the updated find.
   */
  async share(discovery: Discovery, choice: ShareChoice): Promise<Discovery> {
    if (!choice.city) throw new ApiError(400, 'no_city', 'Choose a city first.');
    if (!choice.age13) throw new ApiError(400, 'age', 'Confirm you are 13 or older to share publicly.');
    this.saveCity(choice.city);
    this.confirmAge();
    const state: PublicPostState = {
      status: 'queued',
      cityId: choice.city.id,
      cityName: `${choice.city.name}, ${choice.city.country}`,
      showName: choice.showName,
      at: new Date().toISOString(),
    };
    return this.send({ ...discovery, publicPost: state });
  },

  /** Tries to post a queued find. Network failures leave it queued; refusals mark it failed. */
  async send(discovery: Discovery): Promise<Discovery> {
    const state = discovery.publicPost;
    if (!state) return discovery;
    let next: PublicPostState;
    try {
      const res = await call<{ post: { id: string; citySlug: string } }>('POST', '/posts', {
        said: discovery.originalWording || '',
        meant: discovery.intendedWording || '',
        category: discovery.category,
        cityId: state.cityId,
        readByApp: discovery.readByApp === true,
        showName: state.showName,
        age13: true,
      });
      next = { ...state, status: 'posted', id: res.post.id, citySlug: res.post.citySlug, error: undefined };
    } catch (err) {
      const e = err as ApiError;
      const retryLater = e.status === 0 || e.status >= 500 || e.status === 429;
      next = { ...state, status: retryLater ? 'queued' : 'failed', error: e.status === 0 ? undefined : e.message };
    }
    return dbService.saveDiscovery({ ...discovery, publicPost: next });
  },

  /** Removes the public post (if it was sent) and clears the sharing state on the find. */
  async unshare(discovery: Discovery): Promise<Discovery> {
    const state = discovery.publicPost;
    if (state?.status === 'posted' && state.id) {
      try {
        await call('DELETE', `/posts/${state.id}`);
      } catch (err) {
        if ((err as ApiError).status !== 404) throw err;
      }
    }
    return dbService.saveDiscovery({ ...discovery, publicPost: undefined });
  },

  /** Sends any finds still waiting for a connection. Returns how many went out. */
  async flushQueue(discoveries: Discovery[]): Promise<number> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;
    let sent = 0;
    for (const d of discoveries.filter(x => x.publicPost?.status === 'queued')) {
      const updated = await this.send(d).catch(() => d);
      if (updated.publicPost?.status === 'posted') sent++;
      if (updated.publicPost?.status === 'queued') break; // still offline or rate-limited: stop for now
    }
    return sent;
  },
};
