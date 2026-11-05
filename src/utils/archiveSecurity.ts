/**
 * @file archiveSecurity.ts
 * @description Backup export/import with an integrity checksum.
 *
 * WHAT THE CHECKSUM DOES AND DOES NOT DO:
 * The SHA-256 checksum detects accidental damage (truncated downloads, broken edits).
 * It is NOT a security signature: everything needed to recompute it ships with the app,
 * so a determined person can edit a file and fix the checksum. Do not use imported files
 * as proof of anything.
 *
 * OWNERSHIP:
 * Exports carry the exporting device's id. Importing your own backup restores your
 * entries and locked points. Importing anyone else's file adds their entries to your
 * museum for viewing, marked as imported, and they never count toward your points.
 *
 * FORMAT v3 (current): images are embedded per entry; the file is assembled as a Blob
 * one entry at a time so large collections don't need one giant string in memory.
 * v2 (salted whole-file hash) and v1 (bare array) files can still be imported.
 */

import { Discovery, dbService, blobToDataUrl } from '../db/database';
import { pointsLedger, Ledger } from './pointsLedger';
import { getDeviceId } from './identity';

export interface ArchiveHeaderV3 {
  app: 'TYPO_HUNTER_ARCHIVE';
  formatVersion: 3;
  exportedAt: string;
  hunter: string;
  ownerId: string;
  totalPoints: number;
  specimenCount: number;
  pointsLedger: Ledger;
  checksum: string;
}

const LEGACY_V2_SALT = 'TYPO_HUNTER_CURATORIAL_SOVEREIGNTY_2026';

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('');
}

function checksumInput(h: Omit<ArchiveHeaderV3, 'checksum'>, itemHashes: string[]): string {
  return [h.formatVersion, h.exportedAt, h.hunter, h.ownerId, h.totalPoints, h.specimenCount, JSON.stringify(h.pointsLedger), itemHashes.join(',')].join('::');
}

/**
 * Builds a v3 backup file as a Blob. Full-size images are read and encoded one at a time.
 */
export async function createArchiveExportBlob(discoveries: Discovery[], hunterName: string): Promise<Blob> {
  const parts: string[] = [];
  const itemHashes: string[] = [];

  for (const d of discoveries) {
    const blob = await dbService.getImage(d.id).catch(() => undefined);
    const image = blob ? await blobToDataUrl(blob) : d.thumbnail;
    const itemJson = JSON.stringify({ ...d, image });
    itemHashes.push(await sha256Hex(itemJson));
    parts.push(itemJson);
  }

  const headerNoChecksum: Omit<ArchiveHeaderV3, 'checksum'> = {
    app: 'TYPO_HUNTER_ARCHIVE',
    formatVersion: 3,
    exportedAt: new Date().toISOString(),
    hunter: hunterName.trim() || 'Hunter',
    ownerId: getDeviceId(),
    totalPoints: pointsLedger.getTotal(),
    specimenCount: discoveries.length,
    pointsLedger: pointsLedger.getAll(),
  };
  const header: ArchiveHeaderV3 = {
    ...headerNoChecksum,
    checksum: await sha256Hex(checksumInput(headerNoChecksum, itemHashes)),
  };

  const headerJson = JSON.stringify(header);
  const blobParts: BlobPart[] = [headerJson.slice(0, -1), ',"discoveries":['];
  parts.forEach((p, i) => {
    if (i > 0) blobParts.push(',');
    blobParts.push(p);
  });
  blobParts.push(']}');
  return new Blob(blobParts, { type: 'application/json' });
}

/** Saves a Blob as a file via an object URL (no huge data: URL strings). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface VerificationResult {
  isValid: boolean;
  /** Checksum didn't match: the file was damaged or edited. */
  isTampered: boolean;
  isLegacy: boolean;
  discoveries: Discovery[];
  hunterName?: string;
  /** Device that exported the file (v3 only). */
  ownerId?: string;
  /** True when the file was exported by this device. */
  isOwnBackup: boolean;
  pointsLedger?: Ledger;
  totalPoints?: number;
  statusMessage: string;
}

function invalid(message: string, extra: Partial<VerificationResult> = {}): VerificationResult {
  return { isValid: false, isTampered: false, isLegacy: false, isOwnBackup: false, discoveries: [], statusMessage: message, ...extra };
}

/** Parses an archive file and checks its checksum. */
export async function verifyAndUnpackArchive(jsonString: string): Promise<VerificationResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return invalid('This file is not valid JSON.');
  }

  // v1: bare array, no checksum, no owner → treated as someone else's entries.
  if (Array.isArray(parsed)) {
    const valid = parsed.every(item => item && typeof item.title === 'string' && (typeof item.image === 'string' || typeof item.thumbnail === 'string'));
    if (!valid) return invalid('Old-format backup contains invalid entries.', { isLegacy: true });
    return {
      isValid: true,
      isTampered: false,
      isLegacy: true,
      isOwnBackup: false,
      discoveries: parsed as Discovery[],
      statusMessage: 'Old-format backup (no checksum, no owner).',
    };
  }

  const pkg = parsed as Record<string, unknown>;
  if (pkg.app !== 'TYPO_HUNTER_ARCHIVE' || !Array.isArray(pkg.discoveries)) {
    return invalid('Not a Typo Hunter backup file.');
  }
  const discoveries = pkg.discoveries as Discovery[];

  if (pkg.formatVersion === 3) {
    const header = pkg as unknown as ArchiveHeaderV3;
    const itemHashes: string[] = [];
    for (const item of discoveries) itemHashes.push(await sha256Hex(JSON.stringify(item)));
    const { checksum, ...rest } = header;
    const expected = await sha256Hex(checksumInput(rest, itemHashes));
    if (expected !== checksum) {
      return invalid('Checksum mismatch: the file is damaged or was edited. Import cancelled.', { isTampered: true });
    }
    const isOwnBackup = header.ownerId === getDeviceId();
    return {
      isValid: true,
      isTampered: false,
      isLegacy: false,
      isOwnBackup,
      discoveries,
      hunterName: header.hunter,
      ownerId: header.ownerId,
      pointsLedger: header.pointsLedger,
      totalPoints: header.totalPoints,
      statusMessage: 'Checksum OK.',
    };
  }

  // v2: salted whole-file hash, no owner → treated as someone else's entries.
  if (typeof pkg.integritySignature === 'string') {
    const payload = `${pkg.exportedAt}::${pkg.hunter}::${pkg.totalPoints}::${pkg.specimenCount}::${JSON.stringify(discoveries)}`;
    const expected = await sha256Hex(payload + LEGACY_V2_SALT);
    if (expected !== pkg.integritySignature) {
      return invalid('Checksum mismatch: the file is damaged or was edited. Import cancelled.', { isTampered: true });
    }
    return {
      isValid: true,
      isTampered: false,
      isLegacy: true,
      isOwnBackup: false,
      discoveries,
      hunterName: typeof pkg.hunter === 'string' ? pkg.hunter : undefined,
      statusMessage: 'Checksum OK (older format without an owner).',
    };
  }

  return invalid('Unrecognized backup format.');
}
