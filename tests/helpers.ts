import { PGlite } from '@electric-sql/pglite';
import { randomBytes } from 'node:crypto';
import type { Db } from '../server/db';
import { handle, Env } from '../server/app';

export const ADMIN = 'test-admin-secret-123456';
export const LAGOS = 2332459;
export const LONDON = 2643743;

export async function createTestDb(): Promise<Db & { raw: PGlite }> {
  const raw = new PGlite();
  return { raw, query: async <T>(text: string, params: unknown[] = []) => (await raw.query(text, params)).rows as T[] };
}

export const newKey = () => randomBytes(32).toString('hex');

export function client(db: Db, env: Env = { ADMIN_SECRET: ADMIN }) {
  return async (
    method: string,
    path: string,
    opts: { key?: string; body?: unknown; ip?: string; admin?: string } = {}
  ): Promise<{ status: number; data: any; text: string; headers: Headers }> => {
    const headers: Record<string, string> = { 'x-forwarded-for': opts.ip || '203.0.113.1' };
    if (opts.key) headers.authorization = `Bearer ${opts.key}`;
    if (opts.admin) headers['x-admin-secret'] = opts.admin;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    const res = await handle(
      new Request(`https://example.test${path}`, { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined }),
      db,
      env
    );
    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      // HTML page
    }
    return { status: res.status, data, text, headers: res.headers };
  };
}

export const post = (over: Record<string, unknown> = {}) => ({
  said: 'COFFE AND TREA',
  meant: 'Coffee and Tea',
  category: 'Menus',
  cityId: LAGOS,
  readByApp: true,
  showName: false,
  age13: true,
  ...over,
});
