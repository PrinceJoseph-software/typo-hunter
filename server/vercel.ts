/**
 * Entry point for the single Vercel Function behind /api/* and /city/* (see vercel.json).
 * `pnpm build:api` bundles this file into api/index.js, which is committed so Vercel
 * deploys one self-contained file. Uses the classic (req, res) handler signature.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handle } from './app';
import { getProductionDb } from './db';

type VercelRequest = IncomingMessage & { body?: unknown };

async function readBody(req: VercelRequest): Promise<string | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  // Vercel may have parsed the body already.
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 16_000) break;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req: VercelRequest, res: ServerResponse): Promise<void> {
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(', '));
    }
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const body = await readBody(req);
    const request = new Request(`${proto}://${host}${req.url || '/'}`, { method: req.method, headers, body });
    const response = await handle(request, getProductionDb(), {
      ADMIN_SECRET: process.env.ADMIN_SECRET,
      BLOCKED_WORDS: process.env.BLOCKED_WORDS,
      RATE_SALT: process.env.RATE_SALT,
    });
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error('[api] adapter failed', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'server_error', message: 'Something went wrong. Please try again.' }));
  }
}
