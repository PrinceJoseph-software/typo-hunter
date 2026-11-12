/**
 * Database access. Production uses Neon's serverless Postgres driver over HTTPS
 * (works on Vercel's free plan, no connection pool to manage). Tests and local
 * development pass in any object with the same `query` method (PGlite).
 */
import { neon } from '@neondatabase/serverless';

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

let cached: Db | null = null;

/** Returns the production database, or null when DATABASE_URL isn't configured yet. */
export function getProductionDb(): Db | null {
  if (cached) return cached;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  const sql = neon(url);
  cached = {
    query: async <T>(text: string, params: unknown[] = []) => (await sql.query(text, params)) as unknown as T[],
  };
  return cached;
}

const SCHEMA = [
  `create table if not exists devices (
     key_hash text primary key,
     created_at timestamptz not null default now(),
     strikes int not null default 0,
     banned boolean not null default false,
     nickname text,
     nickname_changed_at timestamptz
   )`,
  // A nickname's "skeleton" (look-alike characters folded together) belongs to one device forever.
  `create table if not exists nicknames (
     skeleton text primary key,
     display text not null,
     key_hash text not null references devices(key_hash),
     created_at timestamptz not null default now()
   )`,
  `create table if not exists posts (
     id uuid primary key,
     key_hash text not null references devices(key_hash),
     said text not null,
     meant text not null,
     category text not null,
     city_id int not null,
     read_by_app boolean not null default false,
     show_name text,
     created_at timestamptz not null default now(),
     status text not null default 'visible' check (status in ('visible','hidden','removed')),
     flag_weight real not null default 0
   )`,
  `create index if not exists posts_feed_idx on posts (status, created_at desc)`,
  `create index if not exists posts_city_idx on posts (city_id, status, created_at desc)`,
  `create index if not exists posts_device_idx on posts (key_hash, created_at desc)`,
  `create table if not exists flags (
     post_id uuid not null references posts(id) on delete cascade,
     key_hash text not null,
     net_hash text not null,
     reason text not null,
     weight real not null,
     created_at timestamptz not null default now(),
     primary key (post_id, key_hash)
   )`,
  // Short-lived counters for per-network limits. `key` is a salted daily hash, never a raw IP address.
  `create table if not exists events (
     kind text not null,
     key text not null,
     at timestamptz not null default now()
   )`,
  `create index if not exists events_idx on events (kind, key, at)`,
];

const ready = new WeakMap<Db, Promise<void>>();

/** Creates the tables on first use (idempotent), so there is no manual migration step. */
export function ensureSchema(db: Db): Promise<void> {
  let p = ready.get(db);
  if (!p) {
    p = (async () => {
      for (const statement of SCHEMA) await db.query(statement);
    })();
    p.catch(() => ready.delete(db));
    ready.set(db, p);
  }
  return p;
}
