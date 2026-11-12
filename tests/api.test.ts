import { beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, LAGOS, LONDON, client, createTestDb, newKey, post } from './helpers';
import { handle, LIMITS } from '../server/app';
import { nicknameSkeleton, textProblem } from '../server/validate';

let db: Awaited<ReturnType<typeof createTestDb>>;
let api: ReturnType<typeof client>;

/** Makes a device look older than a day so first-day limits and half-weight flags don't apply. */
const age = (days = 3) => db.raw.query(`update devices set created_at = now() - interval '${days} days'`);

beforeEach(async () => {
  db = await createTestDb();
  api = client(db);
});

describe('configuration', () => {
  it('answers 503 instead of crashing when no database is connected', async () => {
    const res = await handle(new Request('https://example.test/api/feed'), null, {});
    expect(res.status).toBe(503);
    const page = await handle(new Request('https://example.test/city/lagos-ng'), null, {});
    expect(page.status).toBe(503);
  });

  it('understands the rewritten path Vercel sends', async () => {
    const res = await handle(new Request('https://example.test/api?__path=health'), db, {});
    expect(res.status).toBe(200);
  });
});

describe('posting', () => {
  it('stores a text post and shows it in the feed without any identifying data', async () => {
    const key = newKey();
    const created = await api('POST', '/api/posts', { key, body: post() });
    expect(created.status).toBe(201);
    expect(created.data.post).toMatchObject({ said: 'COFFE AND TREA', meant: 'Coffee and Tea', city: 'Lagos', country: 'NG', readByApp: true, name: null });

    const feed = await api('GET', `/api/feed?city=${LAGOS}`);
    expect(feed.data.posts).toHaveLength(1);
    expect(JSON.stringify(feed.data)).not.toContain(key);
    expect(Object.keys(feed.data.posts[0]).sort()).toEqual(
      ['category', 'city', 'cityId', 'citySlug', 'country', 'createdAt', 'id', 'meant', 'name', 'readByApp', 'said'].sort()
    );
    expect((await api('GET', `/api/feed?city=${LONDON}`)).data.posts).toHaveLength(0);
  });

  it('never stores the raw key or IP address', async () => {
    const key = newKey();
    await api('POST', '/api/posts', { key, body: post(), ip: '198.51.100.77' });
    const dump = JSON.stringify([
      (await db.raw.query('select * from devices')).rows,
      (await db.raw.query('select * from posts')).rows,
      (await db.raw.query('select * from events')).rows,
    ]);
    expect(dump).not.toContain(key);
    expect(dump).not.toContain('198.51.100.77');
  });

  it('requires a key, the 13+ confirmation, a real city and different wording', async () => {
    expect((await api('POST', '/api/posts', { body: post() })).status).toBe(401);
    const key = newKey();
    expect((await api('POST', '/api/posts', { key, body: post({ age13: false }) })).status).toBe(400);
    expect((await api('POST', '/api/posts', { key, body: post({ cityId: 1 }) })).data.error).toBe('unknown_city');
    expect((await api('POST', '/api/posts', { key, body: post({ meant: 'coffe and trea' }) })).status).toBe(400);
  });

  it('keeps personal details out of posts', async () => {
    const key = newKey();
    for (const said of ['Call 0803 123 4567 now', 'mail me at joe@example.com', 'visit www.example.com today']) {
      const res = await api('POST', '/api/posts', { key, body: post({ said }) });
      expect(res.status, said).toBe(400);
    }
    expect(textProblem('Soap of the Day')).toBeNull();
    expect(textProblem('rude word here', ['rude word'])).not.toBeNull();
  });

  it('limits new devices to 3 posts on their first day', async () => {
    const key = newKey();
    for (let i = 0; i < LIMITS.postsFirstDay; i++) {
      expect((await api('POST', '/api/posts', { key, body: post({ said: `Typo number ${i}` }) })).status).toBe(201);
    }
    const blocked = await api('POST', '/api/posts', { key, body: post({ said: 'One more typo' }) });
    expect(blocked.status).toBe(429);
  });

  it('limits established devices to 3 posts per 10 minutes and 10 per day', async () => {
    const key = newKey();
    await api('GET', '/api/me', { key });
    await age();
    for (let i = 0; i < 3; i++) expect((await api('POST', '/api/posts', { key, body: post({ said: `Burst ${i}` }) })).status).toBe(201);
    expect((await api('POST', '/api/posts', { key, body: post({ said: 'Burst too many' }) })).status).toBe(429);
    await db.raw.query(`update events set at = now() - interval '1 hour'`);
    for (let i = 0; i < 3; i++) await api('POST', '/api/posts', { key, body: post({ said: `Second ${i}` }) });
    await db.raw.query(`update events set at = now() - interval '2 hours'`);
    for (let i = 0; i < 3; i++) await api('POST', '/api/posts', { key, body: post({ said: `Third ${i}` }) });
    await db.raw.query(`update events set at = now() - interval '3 hours'`);
    expect((await api('POST', '/api/posts', { key, body: post({ said: 'Tenth post' }) })).status).toBe(201);
    await db.raw.query(`update events set at = now() - interval '4 hours'`);
    const eleventh = await api('POST', '/api/posts', { key, body: post({ said: 'Eleventh post' }) });
    expect(eleventh.status).toBe(429);
    expect((await api('GET', '/api/me', { key })).data.postsLeftToday).toBe(0);
  });

  it('limits one network to 30 posts a day across many devices', async () => {
    for (let i = 0; i < LIMITS.postsPerNetworkPerDay; i++) {
      const res = await api('POST', '/api/posts', { key: newKey(), body: post({ said: `Network typo ${i}` }), ip: '198.51.100.9' });
      expect(res.status).toBe(201);
    }
    expect((await api('POST', '/api/posts', { key: newKey(), body: post({ said: 'Over the limit' }), ip: '198.51.100.9' })).status).toBe(429);
    expect((await api('POST', '/api/posts', { key: newKey(), body: post({ said: 'Other network' }), ip: '198.51.100.10' })).status).toBe(201);
  });

  it('rejects the same typo twice and lets you delete only your own post', async () => {
    const key = newKey();
    const created = await api('POST', '/api/posts', { key, body: post() });
    expect((await api('POST', '/api/posts', { key, body: post({ said: 'coffe and trea' }) })).status).toBe(409);
    expect((await api('DELETE', `/api/posts/${created.data.post.id}`, { key: newKey() })).status).toBe(404);
    expect((await api('DELETE', `/api/posts/${created.data.post.id}`, { key })).status).toBe(200);
    expect((await api('GET', '/api/feed')).data.posts).toHaveLength(0);
    expect((await db.raw.query('select * from posts')).rows).toHaveLength(0);
  });

  it('pages through the feed', async () => {
    for (let i = 0; i < LIMITS.feedPageSize + 3; i++) {
      await api('POST', '/api/posts', { key: newKey(), body: post({ said: `Paged typo ${i}` }), ip: `10.0.${i}.1` });
      await db.raw.query(`update posts set created_at = now() - interval '${100 - i} minutes' where said = 'Paged typo ${i}'`);
    }
    const first = await api('GET', '/api/feed');
    expect(first.data.posts).toHaveLength(LIMITS.feedPageSize);
    const second = await api('GET', `/api/feed?before=${encodeURIComponent(first.data.nextBefore)}`);
    expect(second.data.posts).toHaveLength(3);
    expect(second.data.nextBefore).toBeNull();
  });
});

describe('nicknames', () => {
  it('folds look-alike names together', () => {
    expect(nicknameSkeleton('PrinceJoe')).toBe(nicknameSkeleton('Pr1nce_J0e'));
    expect(nicknameSkeleton('wave')).toBe(nicknameSkeleton('vvave'));
    expect(nicknameSkeleton('PrinceJoe')).not.toBe(nicknameSkeleton('PrinceJon'));
  });

  it('gives a name to one person and blocks impersonation', async () => {
    const owner = newKey();
    const copycat = newKey();
    expect((await api('PUT', '/api/me/nickname', { key: owner, body: { nickname: 'PrinceJoe' } })).status).toBe(200);
    for (const fake of ['PrinceJoe', 'princejoe', 'Pr1nce_J0e', 'Prince_Joe', 'PRINCEJOE']) {
      const res = await api('PUT', '/api/me/nickname', { key: copycat, body: { nickname: fake } });
      expect(res.status, fake).toBe(409);
    }
    expect((await api('PUT', '/api/me/nickname', { key: copycat, body: { nickname: 'PrinceJon' } })).status).toBe(200);
  });

  it('rejects reserved and malformed names', async () => {
    const key = newKey();
    for (const bad of ['Admin', 'adm1n', 'TypoHunter_Official', 'Hunter', 'ab', '9lives', 'has space', 'x'.repeat(21), 'Mod']) {
      expect((await api('PUT', '/api/me/nickname', { key, body: { nickname: bad } })).status, bad).toBe(400);
    }
  });

  it('shows the nickname only when the poster asks, and allows one change every 30 days', async () => {
    const key = newKey();
    await api('PUT', '/api/me/nickname', { key, body: { nickname: 'SignSpotter' } });
    const anon = await api('POST', '/api/posts', { key, body: post({ said: 'Anon typo' }) });
    expect(anon.data.post.name).toBeNull();
    const named = await api('POST', '/api/posts', { key, body: post({ said: 'Named typo', showName: true }) });
    expect(named.data.post.name).toBe('SignSpotter');

    expect((await api('PUT', '/api/me/nickname', { key, body: { nickname: 'OtherName' } })).status).toBe(429);
    await db.raw.query(`update devices set nickname_changed_at = now() - interval '31 days'`);
    expect((await api('PUT', '/api/me/nickname', { key, body: { nickname: 'OtherName' } })).status).toBe(200);
    // The old name stays reserved for its first owner.
    expect((await api('PUT', '/api/me/nickname', { key: newKey(), body: { nickname: 'SignSpotter' } })).status).toBe(409);
    expect((await api('GET', '/api/me', { key })).data.yourNicknames).toEqual(['SignSpotter', 'OtherName']);
  });
});

describe('flags and review', () => {
  const setup = async () => {
    const author = newKey();
    const created = await api('POST', '/api/posts', { key: author, body: post() });
    return { author, id: created.data.post.id as string };
  };
  const flagger = async (ip: string) => {
    const key = newKey();
    await api('GET', '/api/me', { key });
    return { key, ip };
  };

  it('hides a post after 3 flags from different established people', async () => {
    const { id } = await setup();
    const people = [await flagger('10.1.0.1'), await flagger('10.1.0.2'), await flagger('10.1.0.3')];
    await age();
    for (let i = 0; i < 2; i++) await api('POST', `/api/posts/${id}/flag`, { ...people[i], body: { reason: 'offensive' } });
    expect((await api('GET', '/api/feed')).data.posts).toHaveLength(1);
    await api('POST', `/api/posts/${id}/flag`, { ...people[2], body: { reason: 'spam' } });
    expect((await api('GET', '/api/feed')).data.posts).toHaveLength(0);
    expect((await api('GET', '/city/lagos-ng')).text).not.toContain('COFFE AND TREA');
  });

  it("doesn't let one person hide a post with repeat flags, new keys on one network, or brand-new devices", async () => {
    const { id, author } = await setup();
    const one = await flagger('10.2.0.1');
    await age();
    for (let i = 0; i < 5; i++) await api('POST', `/api/posts/${id}/flag`, { ...one, body: { reason: 'spam' } });
    for (let i = 0; i < 5; i++) await api('POST', `/api/posts/${id}/flag`, { key: newKey(), ip: '10.2.0.1', body: { reason: 'spam' } });
    // Brand-new devices on fresh networks count half: 3 of them add 1.5.
    for (let i = 0; i < 3; i++) await api('POST', `/api/posts/${id}/flag`, { key: newKey(), ip: `10.3.0.${i}`, body: { reason: 'spam' } });
    expect((await api('GET', '/api/feed')).data.posts).toHaveLength(1);
    expect((await api('POST', `/api/posts/${id}/flag`, { key: author, body: { reason: 'spam' } })).status).toBe(400);
    expect((await api('POST', `/api/posts/${id}/flag`, { key: newKey(), ip: '10.9.9.9', body: { reason: 'because' } })).status).toBe(400);
  });

  it('lets the admin restore or remove hidden posts, and bans after 3 removals', async () => {
    expect((await api('GET', '/api/admin/queue')).status).toBe(401);
    expect((await api('GET', '/api/admin/queue', { admin: 'wrong' })).status).toBe(401);

    const author = newKey();
    await api('GET', '/api/me', { key: author });
    const flaggers = [await flagger('10.4.0.1'), await flagger('10.4.0.2'), await flagger('10.4.0.3')];
    await age();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const created = await api('POST', '/api/posts', { key: author, body: post({ said: `Bad post ${i}` }) });
      ids.push(created.data.post.id);
      for (const f of flaggers) await api('POST', `/api/posts/${created.data.post.id}/flag`, { ...f, body: { reason: 'offensive' } });
    }
    const queue = await api('GET', '/api/admin/queue', { admin: ADMIN });
    expect(queue.data.hidden).toHaveLength(3);
    expect(queue.data.hidden[0].reasons).toEqual({ offensive: 3 });

    // Restore one: visible again, and more flags can't hide it.
    await api('POST', `/api/admin/posts/${ids[0]}`, { admin: ADMIN, body: { action: 'restore' } });
    const late = await flagger('10.4.0.9');
    await age();
    await api('POST', `/api/posts/${ids[0]}/flag`, { ...late, body: { reason: 'spam' } });
    expect((await api('GET', '/api/feed')).data.posts.map((p: any) => p.id)).toEqual([ids[0]]);

    // Remove the rest, plus the first: three strikes.
    for (const id of ids) await api('POST', `/api/admin/posts/${id}`, { admin: ADMIN, body: { action: 'remove' } });
    expect((await api('GET', '/api/me', { key: author })).data.banned).toBe(true);
    await db.raw.query(`delete from events`);
    expect((await api('POST', '/api/posts', { key: author, body: post({ said: 'After ban' }) })).status).toBe(403);
  });

  it('refuses admin routes when no admin secret is set', async () => {
    const open = client(db, {});
    expect((await open('GET', '/api/admin/queue', { admin: '' })).status).toBe(503);
  });
});

describe('city pages', () => {
  it('renders posts as escaped HTML and lists top cities', async () => {
    await api('POST', '/api/posts', { key: newKey(), body: post({ said: '<script>alert(1)</script> Burgur', meant: 'Burger' }) });
    await api('POST', '/api/posts', { key: newKey(), body: post({ said: 'Fish and Chps', meant: 'Fish and Chips', cityId: LONDON }), ip: '10.5.0.2' });
    const page = await api('GET', '/city/lagos-ng');
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(page.text).toContain('Typos spotted in Lagos');
    expect(page.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt; Burgur');
    expect(page.text).not.toContain('<script>alert(1)');
    expect(page.text).not.toContain('Fish and Chps');
    expect((await api('GET', '/city/atlantis-zz')).status).toBe(404);

    const top = await api('GET', '/api/cities/top');
    expect(top.data.cities.map((c: any) => c.slug).sort()).toEqual(['lagos-ng', 'london-gb']);
  });
});
