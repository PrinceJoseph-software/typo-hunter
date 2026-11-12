/**
 * Public typo feed: one request handler for every /api/* route and the /city/<slug> pages.
 *
 * Privacy by construction: a post is text + a city. No photo, GPS position, account,
 * email or raw IP address is ever stored. People are told apart by the SHA-256 hash of a
 * random key their phone keeps; network limits use a salted hash that changes daily.
 */
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { Db, ensureSchema } from './db';
import { getCity, getCityBySlug } from './cities';
import { FLAG_REASONS, nicknameProblem, nicknameSkeleton, parsePost } from './validate';
import { renderCityPage, renderNotFoundPage } from './cityPage';

export interface Env {
  ADMIN_SECRET?: string;
  /** Comma-separated words that may not appear in posts or nicknames. */
  BLOCKED_WORDS?: string;
  RATE_SALT?: string;
}

export const LIMITS = {
  postsPer10Min: 3,
  postsPerDay: 10,
  postsFirstDay: 3,
  postsPerNetworkPerDay: 30,
  flagsPerDay: 20,
  flagWeightToHide: 3,
  strikesToBan: 3,
  nicknamesPerDevice: 3,
  nicknameChangeDays: 30,
  feedPageSize: 20,
};

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

const fail = (status: number, error: string, message: string, extra: Record<string, unknown> = {}) =>
  json({ error, message, ...extra }, status);

interface DeviceRow {
  key_hash: string;
  created_at: string;
  strikes: number;
  banned: boolean;
  nickname: string | null;
  nickname_changed_at: string | null;
}

interface PostRow {
  id: string;
  said: string;
  meant: string;
  category: string;
  city_id: number;
  read_by_app: boolean;
  show_name: string | null;
  created_at: string;
  status?: string;
  flag_weight?: number;
}

function publicPost(p: PostRow) {
  const city = getCity(Number(p.city_id));
  return {
    id: p.id,
    said: p.said,
    meant: p.meant,
    category: p.category,
    cityId: Number(p.city_id),
    city: city?.name ?? 'Unknown',
    country: city?.country ?? '',
    citySlug: city?.slug ?? '',
    readByApp: p.read_by_app === true,
    name: p.show_name,
    createdAt: new Date(p.created_at).toISOString(),
  };
}

/** The phone's random key arrives as a Bearer token; only its hash is ever stored. */
function deviceHash(request: Request): string | null {
  const m = /^Bearer ([0-9a-f]{64})$/i.exec(request.headers.get('authorization') || '');
  return m ? sha256(m[1].toLowerCase()) : null;
}

function networkHash(request: Request, env: Env): string {
  const ip = (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
  const day = new Date().toISOString().slice(0, 10);
  return sha256(`${env.RATE_SALT || env.ADMIN_SECRET || 'typo-hunter'}:${day}:${ip}`);
}

async function getDevice(db: Db, keyHash: string): Promise<DeviceRow> {
  await db.query('insert into devices (key_hash) values ($1) on conflict (key_hash) do nothing', [keyHash]);
  const [row] = await db.query<DeviceRow>('select * from devices where key_hash = $1', [keyHash]);
  return row;
}

async function countEvents(db: Db, kind: string, key: string, interval: string): Promise<number> {
  const [row] = await db.query<{ n: number | string }>(
    `select count(*) as n from events where kind = $1 and key = $2 and at > now() - interval '${interval}'`,
    [kind, key]
  );
  return Number(row?.n || 0);
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (text.length > 4000) return null;
    const body = JSON.parse(text || '{}');
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3600000;

function isAdmin(request: Request, env: Env): boolean | null {
  if (!env.ADMIN_SECRET || env.ADMIN_SECRET.length < 16) return null;
  const given = Buffer.from(sha256(request.headers.get('x-admin-secret') || ''));
  const expected = Buffer.from(sha256(env.ADMIN_SECRET));
  return timingSafeEqual(given, expected);
}

export async function handle(request: Request, db: Db | null, env: Env = {}): Promise<Response> {
  const url = new URL(request.url);
  // On Vercel every route is rewritten to one function; the original path arrives in `__path`.
  const rewritten = url.searchParams.get('__path');
  const raw = rewritten !== null ? rewritten : url.pathname.replace(/^\/api(\/|$)/, '/');
  const path = ('/' + raw).replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
  const isCityPage = path.startsWith('/city/') && (rewritten !== null || url.pathname.startsWith('/city/'));
  const method = request.method.toUpperCase();
  const blocked = (env.BLOCKED_WORDS || '').toLowerCase().split(',').map(w => w.trim()).filter(Boolean);

  if (!db) {
    if (isCityPage) return renderNotFoundPage('The typo map isn\'t switched on yet.', 503);
    return fail(503, 'not_configured', 'Public posts aren\'t switched on yet.');
  }

  try {
    await ensureSchema(db);

    // ---------- Pages ----------
    if (isCityPage && method === 'GET') {
      const city = getCityBySlug(decodeURIComponent(path.slice('/city/'.length)).toLowerCase());
      if (!city) return renderNotFoundPage('We don\'t know that city.', 404);
      const rows = await db.query<PostRow>(
        `select * from posts where status = 'visible' and city_id = $1 order by created_at desc limit $2`,
        [city.id, LIMITS.feedPageSize + 1]
      );
      return renderCityPage(city, rows.slice(0, LIMITS.feedPageSize).map(publicPost), rows.length > LIMITS.feedPageSize, url.origin);
    }

    // ---------- Public reads ----------
    if (path === '/health' && method === 'GET') return json({ ok: true });

    if (path === '/feed' && method === 'GET') {
      const params: unknown[] = [];
      let where = `status = 'visible'`;
      const cityParam = url.searchParams.get('city');
      if (cityParam) {
        const city = getCity(Number(cityParam)) || getCityBySlug(cityParam.toLowerCase());
        if (!city) return fail(404, 'unknown_city', 'We don\'t know that city.');
        params.push(city.id);
        where += ` and city_id = $${params.length}`;
      }
      const before = url.searchParams.get('before');
      if (before && !Number.isNaN(Date.parse(before))) {
        params.push(new Date(before).toISOString());
        where += ` and created_at < $${params.length}`;
      }
      params.push(LIMITS.feedPageSize + 1);
      const rows = await db.query<PostRow>(`select * from posts where ${where} order by created_at desc limit $${params.length}`, params);
      const posts = rows.slice(0, LIMITS.feedPageSize).map(publicPost);
      return json(
        { posts, nextBefore: rows.length > LIMITS.feedPageSize ? posts[posts.length - 1].createdAt : null },
        200,
        { 'cache-control': 'public, s-maxage=30, stale-while-revalidate=120' }
      );
    }

    if (path === '/cities/top' && method === 'GET') {
      const rows = await db.query<{ city_id: number; n: number | string }>(
        `select city_id, count(*) as n from posts where status = 'visible' group by city_id order by n desc, city_id limit 12`
      );
      const cities = rows
        .map(r => ({ city: getCity(Number(r.city_id)), posts: Number(r.n) }))
        .filter(r => r.city)
        .map(r => ({ id: r.city!.id, name: r.city!.name, country: r.city!.country, slug: r.city!.slug, posts: r.posts }));
      return json({ cities }, 200, { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' });
    }

    // ---------- Admin review ----------
    if (path.startsWith('/admin')) {
      const admin = isAdmin(request, env);
      if (admin === null) return fail(503, 'not_configured', 'Set ADMIN_SECRET (16+ characters) in the project settings.');
      if (!admin) return fail(401, 'unauthorized', 'Wrong admin secret.');

      if (path === '/admin/queue' && method === 'GET') {
        // Housekeeping: removed posts are deleted after 30 days, limit counters after 2 days.
        await db.query(`delete from posts where status = 'removed' and created_at < now() - interval '30 days'`);
        await db.query(`delete from events where at < now() - interval '2 days'`);
        const hidden = await db.query<PostRow>(`select * from posts where status = 'hidden' order by created_at desc limit 100`);
        const reasons = await db.query<{ post_id: string; reason: string; n: number | string }>(
          `select f.post_id, f.reason, count(*) as n from flags f join posts p on p.id = f.post_id where p.status = 'hidden' group by f.post_id, f.reason`
        );
        const [counts] = await db.query<{ visible: number | string; removed: number | string }>(
          `select count(*) filter (where status = 'visible') as visible, count(*) filter (where status = 'removed') as removed from posts`
        );
        return json({
          hidden: hidden.map(p => ({
            ...publicPost(p),
            reasons: Object.fromEntries(reasons.filter(r => r.post_id === p.id).map(r => [r.reason, Number(r.n)])),
          })),
          totals: { visible: Number(counts?.visible || 0), removed: Number(counts?.removed || 0) },
        });
      }

      const review = /^\/admin\/posts\/([^/]+)$/.exec(path);
      if (review && method === 'POST') {
        if (!isUuid(review[1])) return fail(404, 'not_found', 'Post not found.');
        const body = await readBody(request);
        const [post] = await db.query<PostRow & { key_hash: string }>('select * from posts where id = $1', [review[1]]);
        if (!post) return fail(404, 'not_found', 'Post not found.');
        if (body?.action === 'restore') {
          // A restored post was checked by a person, so further flags can't hide it again.
          await db.query(`update posts set status = 'visible', flag_weight = -1000 where id = $1`, [post.id]);
          return json({ ok: true, status: 'visible' });
        }
        if (body?.action === 'remove') {
          if (post.status !== 'removed') {
            await db.query(`update posts set status = 'removed' where id = $1`, [post.id]);
            await db.query(
              `update devices set strikes = strikes + 1, banned = (strikes + 1 >= $2) where key_hash = $1`,
              [post.key_hash, LIMITS.strikesToBan]
            );
          }
          return json({ ok: true, status: 'removed' });
        }
        return fail(400, 'bad_request', 'Action must be "restore" or "remove".');
      }
      return fail(404, 'not_found', 'Unknown admin route.');
    }

    // ---------- Everything below needs the phone's key ----------
    const keyHash = deviceHash(request);
    if (!keyHash) return fail(401, 'no_key', 'Missing device key.');
    const device = await getDevice(db, keyHash);

    if (path === '/me' && method === 'GET') {
      const today = await countEvents(db, 'post:dev', keyHash, '24 hours');
      const names = await db.query<{ display: string }>('select display from nicknames where key_hash = $1 order by created_at', [keyHash]);
      const canChangeAt =
        device.nickname && device.nickname_changed_at
          ? new Date(new Date(device.nickname_changed_at).getTime() + LIMITS.nicknameChangeDays * 86400000).toISOString()
          : null;
      return json({
        nickname: device.nickname,
        yourNicknames: names.map(n => n.display),
        nicknameChangeAllowedAt: canChangeAt && Date.parse(canChangeAt) > Date.now() ? canChangeAt : null,
        postsLeftToday: Math.max(0, LIMITS.postsPerDay - today),
        banned: device.banned,
      });
    }

    if (path === '/me/nickname' && method === 'PUT') {
      if (device.banned) return fail(403, 'banned', 'This device can no longer post.');
      const body = await readBody(request);
      const name = typeof body?.nickname === 'string' ? body.nickname.trim() : '';
      const problem = nicknameProblem(name, blocked);
      if (problem) return fail(400, 'invalid_nickname', problem);
      if (device.nickname === name) return json({ nickname: name });
      if (device.nickname && device.nickname_changed_at && hoursSince(device.nickname_changed_at) < LIMITS.nicknameChangeDays * 24) {
        return fail(429, 'nickname_change_limit', `You can change your nickname once every ${LIMITS.nicknameChangeDays} days.`);
      }
      const skeleton = nicknameSkeleton(name);
      const [existing] = await db.query<{ key_hash: string }>('select key_hash from nicknames where skeleton = $1', [skeleton]);
      if (existing && existing.key_hash !== keyHash) {
        return fail(409, 'nickname_taken', 'That name, or one that looks just like it, is already taken.');
      }
      if (!existing) {
        const [owned] = await db.query<{ n: number | string }>('select count(*) as n from nicknames where key_hash = $1', [keyHash]);
        if (Number(owned?.n || 0) >= LIMITS.nicknamesPerDevice) {
          return fail(409, 'nickname_limit', `You can hold up to ${LIMITS.nicknamesPerDevice} nicknames. Switch back to one of yours.`);
        }
        const inserted = await db.query(
          'insert into nicknames (skeleton, display, key_hash) values ($1, $2, $3) on conflict (skeleton) do nothing returning skeleton',
          [skeleton, name, keyHash]
        );
        if (inserted.length === 0) return fail(409, 'nickname_taken', 'That name was just taken.');
      } else {
        await db.query('update nicknames set display = $2 where skeleton = $1', [skeleton, name]);
      }
      await db.query('update devices set nickname = $2, nickname_changed_at = now() where key_hash = $1', [keyHash, name]);
      return json({ nickname: name });
    }

    if (path === '/posts' && method === 'POST') {
      if (device.banned) return fail(403, 'banned', 'This device can no longer post.');
      const body = await readBody(request);
      if (!body) return fail(400, 'bad_request', 'Could not read the post.');
      const { post, error } = parsePost(body, blocked);
      if (!post) return fail(400, 'invalid_post', error || 'Invalid post.');
      const city = getCity(post.cityId);
      if (!city) return fail(400, 'unknown_city', 'Choose a city from the list.');

      const net = networkHash(request, env);
      const firstDay = hoursSince(device.created_at) < 24;
      const today = await countEvents(db, 'post:dev', keyHash, '24 hours');
      if (firstDay && today >= LIMITS.postsFirstDay) {
        return fail(429, 'rate_limited', `New posters can share ${LIMITS.postsFirstDay} typos on their first day. Come back tomorrow for more.`);
      }
      if (today >= LIMITS.postsPerDay) return fail(429, 'rate_limited', `You can share ${LIMITS.postsPerDay} typos a day. Come back tomorrow.`);
      if ((await countEvents(db, 'post:dev', keyHash, '10 minutes')) >= LIMITS.postsPer10Min) {
        return fail(429, 'rate_limited', 'That\'s a lot of typos at once. Try again in a few minutes.');
      }
      if ((await countEvents(db, 'post:net', net, '24 hours')) >= LIMITS.postsPerNetworkPerDay) {
        return fail(429, 'rate_limited', 'Too many posts from this network today. Try again tomorrow.');
      }
      const [dup] = await db.query(
        `select id from posts where key_hash = $1 and lower(said) = lower($2) and status <> 'removed' and created_at > now() - interval '30 days' limit 1`,
        [keyHash, post.said]
      );
      if (dup) return fail(409, 'duplicate', 'You already shared this one.');

      const id = randomUUID();
      const [row] = await db.query<PostRow>(
        `insert into posts (id, key_hash, said, meant, category, city_id, read_by_app, show_name)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
        [id, keyHash, post.said, post.meant, post.category, city.id, post.readByApp, post.showName ? device.nickname : null]
      );
      await db.query(`insert into events (kind, key) values ('post:dev', $1), ('post:net', $2)`, [keyHash, net]);
      return json({ post: publicPost(row) }, 201);
    }

    const postRoute = /^\/posts\/([^/]+)(\/flag)?$/.exec(path);
    if (postRoute) {
      if (!isUuid(postRoute[1])) return fail(404, 'not_found', 'Post not found.');
      const [post] = await db.query<PostRow & { key_hash: string }>('select * from posts where id = $1', [postRoute[1]]);

      if (!postRoute[2] && method === 'DELETE') {
        // Deleting your own post removes it completely.
        if (!post || post.key_hash !== keyHash) return fail(404, 'not_found', 'Post not found.');
        if (post.status === 'removed') return json({ ok: true });
        await db.query('delete from posts where id = $1 and key_hash = $2', [post.id, keyHash]);
        return json({ ok: true });
      }

      if (postRoute[2] && method === 'POST') {
        if (!post || post.status === 'removed') return fail(404, 'not_found', 'Post not found.');
        if (post.key_hash === keyHash) return fail(400, 'own_post', 'You can delete your own post instead of flagging it.');
        if (device.banned) return fail(403, 'banned', 'This device can no longer flag posts.');
        const body = await readBody(request);
        const reason = String(body?.reason || '');
        if (!(FLAG_REASONS as readonly string[]).includes(reason)) return fail(400, 'bad_request', 'Choose a reason.');
        if ((await countEvents(db, 'flag:dev', keyHash, '24 hours')) >= LIMITS.flagsPerDay) {
          return fail(429, 'rate_limited', 'You\'ve flagged a lot today. Try again tomorrow.');
        }
        const net = networkHash(request, env);
        // One flag per phone, and one per network, so a single person can't hide a post alone.
        const [already] = await db.query('select 1 as x from flags where post_id = $1 and (key_hash = $2 or net_hash = $3) limit 1', [post.id, keyHash, net]);
        if (already) return json({ ok: true, alreadyFlagged: true });
        const weight = hoursSince(device.created_at) < 24 ? 0.5 : 1;
        const inserted = await db.query(
          'insert into flags (post_id, key_hash, net_hash, reason, weight) values ($1, $2, $3, $4, $5) on conflict do nothing returning post_id',
          [post.id, keyHash, net, reason, weight]
        );
        if (inserted.length > 0) {
          await db.query(
            `update posts set flag_weight = flag_weight + $2,
               status = case when status = 'visible' and flag_weight + $2 >= $3 then 'hidden' else status end
             where id = $1`,
            [post.id, weight, LIMITS.flagWeightToHide]
          );
          await db.query(`insert into events (kind, key) values ('flag:dev', $1)`, [keyHash]);
        }
        return json({ ok: true });
      }
    }

    return fail(404, 'not_found', 'Unknown route.');
  } catch (err) {
    console.error('[api] request failed', err);
    return fail(500, 'server_error', 'Something went wrong. Please try again.');
  }
}
