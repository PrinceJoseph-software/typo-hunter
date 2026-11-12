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
import { CATEGORIES } from '../utils/constants';

/**
 * Core domain entity representing an archived typographical specimen.
 */
export interface Discovery {
  /** Unique primary key, format: typo_{timestamp}_{randomSuffix} */
  id: string;
  /** Monotonically increasing human-readable specimen serial (e.g. #001, #002) */
  discoveryNumber: number;
  /**
   * Legacy only: full image as a data URL. Since DB v3 full images live in the
   * separate `images` store as Blobs (see dbService.getImage) so lists never load them.
   * Present transiently on imported records before they are saved.
   */
  image?: string;
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
  /** True when the photo file was created within minutes of saving (camera, not an old gallery pick). Heuristic. */
  capturedFresh?: boolean;
  /** 64-bit perceptual hash (16 hex chars) of the photo, used to detect re-used photos. */
  imageHash?: string;
  /** Id of an earlier scored entry with (nearly) the same photo. Such entries earn no points. */
  duplicateOf?: string;
  /** 'imported' = came from another hunter's archive and earns no points. */
  origin?: 'own' | 'imported';
  /** Display name of the hunter an imported record came from. */
  sourceHunter?: string;
  /** Text the on-device reader found in the photo (≤500 chars). */
  ocrText?: string;
  /** "Read by app": the saved wording matches text the app read from the photo on the device. Not proof. */
  readByApp?: boolean;
  /** Set when the owner chose to share this find's words publicly (never the photo). */
  publicPost?: PublicPostState;
}

export interface PublicPostState {
  /** queued = waiting for a connection; posted = live; failed = the server refused it (see error). */
  status: 'queued' | 'posted' | 'failed';
  /** Server id once posted. */
  id?: string;
  cityId: number;
  cityName: string;
  citySlug?: string;
  showName: boolean;
  error?: string;
  at: string;
}

function validatePublicPost(input: unknown): PublicPostState | undefined {
  const p = input as Partial<PublicPostState> | undefined;
  if (!p || typeof p !== 'object' || !['queued', 'posted', 'failed'].includes(String(p.status))) return undefined;
  if (!Number.isInteger(p.cityId) || typeof p.cityName !== 'string') return undefined;
  return {
    status: p.status as PublicPostState['status'],
    id: typeof p.id === 'string' ? p.id.slice(0, 40) : undefined,
    cityId: p.cityId as number,
    cityName: p.cityName.slice(0, 80),
    citySlug: typeof p.citySlug === 'string' ? p.citySlug.slice(0, 100) : undefined,
    showName: p.showName === true,
    error: typeof p.error === 'string' ? p.error.slice(0, 200) : undefined,
    at: typeof p.at === 'string' ? p.at : new Date().toISOString(),
  };
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
  images: {
    key: string;
    value: Blob;
  };
}

const DB_NAME = 'typo-hunter-db';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<TypoHunterDB>> | null = null;

/** Synchronously converts a base64 data URL into a Blob (safe inside IDB upgrade transactions). */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] || 'application/octet-stream';
  try {
    if (match[2]) {
      const binary = atob(match[3]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(match[3])], { type: mime });
  } catch {
    return null;
  }
}

/** Reads a Blob as a data URL (used for export). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Acquires a singleton database connection with automatic schema migration handling.
 */
export const getDB = (): Promise<IDBPDatabase<TypoHunterDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<TypoHunterDB>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, transaction) {
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

        // Migration to v3: move full-size images out of the list records into an
        // `images` store as Blobs. Lists then load only small thumbnails.
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images');
        }
        if (oldVersion > 0 && oldVersion < 3) {
          const images = transaction.objectStore('images');
          let cursor = await store.openCursor();
          while (cursor) {
            const value = cursor.value as Discovery;
            if (typeof value.image === 'string' && value.image.startsWith('data:')) {
              const blob = dataUrlToBlob(value.image);
              if (blob) await images.put(blob, value.id);
              const { image: _drop, ...rest } = value;
              await cursor.update(rest as Discovery);
            }
            cursor = await cursor.continue();
          }
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
  const hasImage = typeof d.image === 'string' && d.image.startsWith('data:image/');
  const hasThumb = typeof d.thumbnail === 'string' && d.thumbnail.startsWith('data:image/');
  if (!hasImage && !hasThumb) {
    throw new Error('Record is missing an image or thumbnail.');
  }
  if (!d.category || typeof d.category !== 'string') {
    throw new Error('Record is missing a "category" assignment.');
  }

  return {
    id: String(d.id).slice(0, 80),
    discoveryNumber: Number(d.discoveryNumber) || 1,
    image: hasImage ? String(d.image) : undefined,
    thumbnail: String(hasThumb ? d.thumbnail : d.image),
    title: String(d.title).trim().slice(0, 100),
    originalWording: d.originalWording ? String(d.originalWording).trim().slice(0, 200) : undefined,
    intendedWording: d.intendedWording ? String(d.intendedWording).trim().slice(0, 200) : undefined,
    category: (CATEGORIES as readonly string[]).includes(String(d.category).trim()) ? String(d.category).trim() : 'Other',
    location: d.location ? String(d.location).trim().slice(0, 120) : undefined,
    notes: d.notes ? String(d.notes).trim().slice(0, 1000) : undefined,
    createdAt: d.createdAt && !isNaN(Date.parse(d.createdAt)) ? d.createdAt : new Date().toISOString(),
    isFavorite: Boolean(d.isFavorite),
    isHallOfFame: Boolean(d.isHallOfFame),
    rating: Math.max(0, Math.min(5, Math.round(Number(d.rating) || 0))),
    capturedFresh: d.capturedFresh === true ? true : undefined,
    imageHash: typeof d.imageHash === 'string' && /^[0-9a-f]{16}$/.test(d.imageHash) ? d.imageHash : undefined,
    duplicateOf: typeof d.duplicateOf === 'string' ? d.duplicateOf.slice(0, 80) : undefined,
    origin: d.origin === 'imported' ? 'imported' : 'own',
    sourceHunter: typeof d.sourceHunter === 'string' ? d.sourceHunter.trim().slice(0, 40) : undefined,
    ocrText: typeof d.ocrText === 'string' && d.ocrText.trim() ? d.ocrText.trim().slice(0, 500) : undefined,
    readByApp: d.readByApp === true ? true : undefined,
    publicPost: validatePublicPost(d.publicPost),
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
        const wtx = db.transaction(['discoveries', 'images'], 'readwrite');
        for (const sample of legacySamples) {
          await wtx.objectStore('discoveries').delete(sample.id);
          await wtx.objectStore('images').delete(sample.id);
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
   * Persists or updates a discovery. The full image is stored separately as a Blob:
   * pass `imageBlob` for new captures; an `image` data URL on the record (imports)
   * is converted automatically. Record and image are written in one transaction.
   */
  async saveDiscovery(discovery: Discovery, imageBlob?: Blob): Promise<Discovery> {
    const sanitized = validateDiscovery(discovery);
    const blob = imageBlob || (sanitized.image ? dataUrlToBlob(sanitized.image) : null);
    const { image: _drop, ...record } = sanitized;
    const db = await getDB();
    const tx = db.transaction(['discoveries', 'images'], 'readwrite');
    await tx.objectStore('discoveries').put(record as Discovery);
    if (blob) await tx.objectStore('images').put(blob, record.id);
    await tx.done;
    return record as Discovery;
  },

  /** Full-size image for one discovery, or undefined (falls back to the thumbnail). */
  async getImage(id: string): Promise<Blob | undefined> {
    const db = await getDB();
    return db.get('images', id);
  },

  /**
   * Permanently deletes a discovery and its image. Points already earned stay
   * locked in the points ledger.
   */
  async deleteDiscovery(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['discoveries', 'images'], 'readwrite');
    await tx.objectStore('discoveries').delete(id);
    await tx.objectStore('images').delete(id);
    await tx.done;
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
    await db.clear('images');
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
