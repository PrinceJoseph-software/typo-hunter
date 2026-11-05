/**
 * @file database.ts
 * @description Offline-first persistence layer powered by IndexedDB with asynchronous transactions.
 *
 * ARCHITECTURAL DESIGN:
 * Modern web applications requiring offline reliability face hard constraints with `localStorage`:
 *   - Synchronous blocking I/O on the main rendering thread.
 *   - 5MB maximum capacity limit across all domains.
 *   - String-only serialization requiring expensive JSON.stringify / JSON.parse cycles.
 *
 * Instead, TYPO HUNTER leverages IndexedDB via the lightweight `idb` Promise wrapper:
 *   - Fully asynchronous, non-blocking transactional reads and writes.
 *   - Indexed queries by date (`by-date`), category (`by-category`), and specimen sequence (`by-number`).
 *   - Multi-hundred megabyte capacity managed by the browser's persistent storage quota.
 *   - Strict version migrations (v1 -> v2) ensuring schema stability across app updates.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

/**
 * Core domain entity representing an archived typographical specimen.
 */
export interface Discovery {
  /** Unique primary key, format: typo_{timestamp}_{randomSuffix} */
  id: string;
  /** Monotonically increasing human-readable specimen serial (e.g. #001, #002) */
  discoveryNumber: number;
  /** Primary compressed photographic payload (base64 data URL or blob) */
  image: string;
  /** Lightweight photographic thumbnail (~20KB) for rapid grid rendering */
  thumbnail: string;
  /** User-assigned descriptive title */
  title: string;
  /** Verbatim text as actually printed on the physical sign or menu */
  originalWording?: string;
  /** Probable intended text before the typographical error occurred */
  intendedWording?: string;
  /** Canonical category classification from CATEGORIES constant */
  category: string;
  /** Optional real-world location descriptor (e.g., "Main St. Bakery, Downtown") */
  location?: string;
  /** Curatorial observations, funny backstory, or field notes */
  notes?: string;
  /** ISO 8601 creation timestamp string for temporal indexing */
  createdAt: string;
  /** User favorite flag for rapid filtering */
  isFavorite: boolean;
  /** Hall of Fame induction status for curated exhibition */
  isHallOfFame: boolean;
  /** Curatorial funniness score from 1 (mildly amusing) to 5 (absolute legend) */
  rating: number;
}

/**
 * Strongly-typed IndexedDB schema definition.
 */
interface TypoHunterDB extends DBSchema {
  discoveries: {
    key: string;
    value: Discovery;
    indexes: {
      'by-date': string;
      'by-category': string;
      'by-number': number;
    };
  };
  meta: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'typo-hunter-db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<TypoHunterDB>> | null = null;

/**
 * Acquires a singleton database connection with automatic schema migration handling.
 */
export const getDB = (): Promise<IDBPDatabase<TypoHunterDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<TypoHunterDB>(DB_NAME, DB_VERSION, {
      upgrade(db, _oldVersion, _newVersion, transaction) {
        let store;
        if (!db.objectStoreNames.contains('discoveries')) {
          store = db.createObjectStore('discoveries', { keyPath: 'id' });
          store.createIndex('by-date', 'createdAt');
          store.createIndex('by-category', 'category');
        } else {
          store = transaction.objectStore('discoveries');
        }

        // Migration to v2: Add monotonic sequence index for O(1) number generation
        if (!store.indexNames.contains('by-number')) {
          store.createIndex('by-number', 'discoveryNumber');
        }

        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      },
      blocked() {
        console.warn('[IndexedDB] Database upgrade blocked by open tab elsewhere.');
      },
      blocking() {
        console.warn('[IndexedDB] This connection is blocking an upgrade in another tab.');
      },
    });
  }
  return dbPromise;
};

/**
 * Validates and sanitizes a raw untrusted object into a conformant Discovery entity.
 * Critical when importing JSON backup files from external devices.
 *
 * @param input - Untrusted JSON object
 * @returns Sanitized Discovery entity
 * @throws Error if required fields are missing or corrupted
 */
export function validateDiscovery(input: unknown): Discovery {
  if (!input || typeof input !== 'object') {
    throw new Error('Record must be a valid JSON object.');
  }

  const d = input as Partial<Discovery>;

  if (!d.id || typeof d.id !== 'string') {
    throw new Error('Record is missing a valid unique "id" string.');
  }
  if (!d.title || typeof d.title !== 'string' || !d.title.trim()) {
    throw new Error('Record is missing a valid "title".');
  }
  if (!d.image || typeof d.image !== 'string') {
    throw new Error('Record is missing an "image" payload.');
  }
  if (!d.category || typeof d.category !== 'string') {
    throw new Error('Record is missing a "category" assignment.');
  }

  return {
    id: String(d.id).slice(0, 64),
    discoveryNumber: Number(d.discoveryNumber) || 1,
    image: String(d.image),
    thumbnail: String(d.thumbnail || d.image),
    title: String(d.title).trim().slice(0, 100),
    originalWording: d.originalWording ? String(d.originalWording).trim().slice(0, 200) : undefined,
    intendedWording: d.intendedWording ? String(d.intendedWording).trim().slice(0, 200) : undefined,
    category: String(d.category).trim(),
    location: d.location ? String(d.location).trim().slice(0, 120) : undefined,
    notes: d.notes ? String(d.notes).trim().slice(0, 1000) : undefined,
    createdAt: d.createdAt && !isNaN(Date.parse(d.createdAt)) ? d.createdAt : new Date().toISOString(),
    isFavorite: Boolean(d.isFavorite),
    isHallOfFame: Boolean(d.isHallOfFame),
    rating: Math.max(0, Math.min(5, Math.round(Number(d.rating) || 0))),
  };
}

/** Id prefix of the demo specimens older versions seeded on first launch. */
const LEGACY_SAMPLE_PREFIX = 'sample_typo_';

export const dbService = {
  /**
   * Retrieves all cataloged discoveries ordered newest-to-oldest.
   * New curators start with an empty museum; sample specimens seeded by older
   * versions of the app are purged on read.
   */
  async getAllDiscoveries(): Promise<Discovery[]> {
    try {
      const db = await getDB();
      const tx = db.transaction('discoveries', 'readonly');
      const index = tx.store.index('by-date');
      const items = await index.getAll();

      const legacySamples = items.filter(d => d.id.startsWith(LEGACY_SAMPLE_PREFIX));
      if (legacySamples.length > 0) {
        const wtx = db.transaction('discoveries', 'readwrite');
        for (const sample of legacySamples) {
          await wtx.store.delete(sample.id);
        }
        await wtx.done;
      }

      return items.filter(d => !d.id.startsWith(LEGACY_SAMPLE_PREFIX)).reverse();
    } catch (err) {
      console.error('[IndexedDB] Failed to query all discoveries:', err);
      return [];
    }
  },

  /**
   * Persists or updates an individual discovery within an atomic read-write transaction.
   */
  async saveDiscovery(discovery: Discovery): Promise<void> {
    const sanitized = validateDiscovery(discovery);
    const db = await getDB();
    await db.put('discoveries', sanitized);
  },

  /**
   * Permanently deletes a discovery by primary key.
   */
  async deleteDiscovery(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('discoveries', id);
  },

  /**
   * Calculates the next sequential discovery number in O(1) time
   * using a reverse cursor on the `by-number` B-tree index.
   *
   * PREVIOUS WEAKNESS: Previously loaded all records into memory (`getAll()`)
   * and took Math.max(), creating severe memory pressure with large image blobs.
   * This implementation fetches ONLY the single highest index value without reading blobs.
   */
  async getNextDiscoveryNumber(): Promise<number> {
    try {
      const db = await getDB();
      const tx = db.transaction('discoveries', 'readonly');
      const index = tx.store.index('by-number');
      const cursor = await index.openCursor(null, 'prev');
      return cursor ? (cursor.value.discoveryNumber || 0) + 1 : 1;
    } catch (err) {
      console.warn('[IndexedDB] Sequence cursor failed, falling back to count query:', err);
      const db = await getDB();
      const count = await db.count('discoveries');
      return count + 1;
    }
  },

  /**
   * Completely purges all discoveries from IndexedDB.
   */
  async clearAllData(): Promise<void> {
    const db = await getDB();
    await db.clear('discoveries');
  },

  /**
   * Queries real-time client storage quota information via StorageManager API.
   * Provides transparency into on-device usage.
   */
  async getStorageEstimate(): Promise<{ usedFormatted: string; quotaFormatted: string; percentage: number }> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const total = estimate.quota || 0;

        const formatBytes = (bytes: number) => {
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
          return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        };

        const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
        return {
          usedFormatted: formatBytes(used),
          quotaFormatted: formatBytes(total),
          percentage: Number(pct.toFixed(1)),
        };
      } catch {
        // Fallback for restricted iframes or unsupported browsers
      }
    }
    return { usedFormatted: 'Local', quotaFormatted: 'Unlimited', percentage: 0 };
  },

  /**
   * Retrieves arbitrary metadata keys from the meta store.
   */
  async getMeta<T = unknown>(key: string): Promise<T | undefined> {
    const db = await getDB();
    return db.get('meta', key) as Promise<T | undefined>;
  },

  /**
   * Sets arbitrary metadata keys in the meta store.
   */
  async setMeta(key: string, value: unknown): Promise<void> {
    const db = await getDB();
    await db.put('meta', value, key);
  },
};
