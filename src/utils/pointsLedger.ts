/**
 * @file pointsLedger.ts
 * @description Locked lifetime points.
 *
 * Points are "locked in" when an entry is saved or improved: the ledger keeps the
 * highest score each entry ever reached, so deleting a photo later never removes
 * points already earned. The ledger also remembers every scored photo's perceptual
 * hash, so re-uploading a deleted photo can't earn points twice.
 *
 * Stored in the IndexedDB `meta` store (key `pointsLedger`) and kept in a
 * module-level cache so screens can read the total synchronously after `load()`.
 */

import { dbService, Discovery } from '../db/database';
import { calculateSpecimenScore, MAX_POINTS_PER_SPECIMEN } from './proofOfSighting';
import { hashDistance } from './imageUtils';

export interface LedgerEntry {
  points: number;
  hash?: string;
  /** ISO time the entry was first locked. */
  at: string;
}

export type Ledger = Record<string, LedgerEntry>;

const META_KEY = 'pointsLedger';
const META_SEEDED = 'pointsLedgerSeeded';
/** Max Hamming distance (out of 64 bits) for two photos to count as the same picture. */
export const DUPLICATE_HASH_DISTANCE = 6;

let cache: Ledger = {};
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(fn => fn());
}

async function persist() {
  await dbService.setMeta(META_KEY, cache);
  notify();
}

export const pointsLedger = {
  async load(): Promise<void> {
    const stored = await dbService.getMeta<Ledger>(META_KEY);
    cache = stored && typeof stored === 'object' ? { ...stored } : {};
    loaded = true;
    notify();
  },

  isLoaded(): boolean {
    return loaded;
  },

  /**
   * One-time migration: lock the points that existing (pre-ledger) own entries earn
   * under the current rules, so upgrading doesn't wipe anyone's score.
   */
  async seedIfNeeded(discoveries: Discovery[]): Promise<void> {
    if (await dbService.getMeta<boolean>(META_SEEDED)) return;
    const now = new Date().toISOString();
    for (const d of discoveries) {
      const score = calculateSpecimenScore(d);
      if (score.eligible && !cache[d.id]) {
        cache[d.id] = { points: score.totalPoints, hash: d.imageHash, at: d.createdAt || now };
      }
    }
    await dbService.setMeta(META_SEEDED, true);
    await persist();
  },

  getTotal(): number {
    return Object.values(cache).reduce((sum, e) => sum + (e.points || 0), 0);
  },

  getEntry(id: string): LedgerEntry | undefined {
    return cache[id];
  },

  getAll(): Ledger {
    return { ...cache };
  },

  /** Locks the discovery's current score (never lowers an existing lock). Returns points newly added. */
  async lockDiscovery(d: Discovery): Promise<number> {
    const score = calculateSpecimenScore(d);
    if (!score.eligible) return 0;
    const prev = cache[d.id];
    const prevPoints = prev?.points || 0;
    if (prev && prevPoints >= score.totalPoints && (prev.hash || !d.imageHash)) return 0;
    cache[d.id] = {
      points: Math.max(prevPoints, score.totalPoints),
      hash: prev?.hash || d.imageHash,
      at: prev?.at || new Date().toISOString(),
    };
    await persist();
    return Math.max(0, score.totalPoints - prevPoints);
  },

  /** Id of an already-scored entry whose photo matches `hash`, if any. */
  findDuplicate(hash: string | undefined, excludeId?: string): string | undefined {
    if (!hash) return undefined;
    for (const [id, entry] of Object.entries(cache)) {
      if (id === excludeId || !entry.hash) continue;
      if (hashDistance(entry.hash, hash) <= DUPLICATE_HASH_DISTANCE) return id;
    }
    return undefined;
  },

  /** Restoring your own backup: keep the higher value for every entry. */
  async merge(incoming: Ledger): Promise<void> {
    for (const [id, entry] of Object.entries(incoming || {})) {
      if (!entry || typeof entry.points !== 'number' || entry.points < 0) continue;
      const points = Math.min(entry.points, MAX_POINTS_PER_SPECIMEN);
      const current = cache[id];
      if (!current || current.points < points) {
        cache[id] = {
          points,
          hash: current?.hash || (typeof entry.hash === 'string' ? entry.hash : undefined),
          at: current?.at || (typeof entry.at === 'string' ? entry.at : new Date().toISOString()),
        };
      }
    }
    await persist();
  },

  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
