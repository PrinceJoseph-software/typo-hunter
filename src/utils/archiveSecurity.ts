/**
 * @file archiveSecurity.ts
 * @description Tamper-evident cryptographic hashing and signature verification for JSON archive export/import.
 *
 * ARCHITECTURAL DESIGN:
 * To prevent malicious or accidental score tampering, unauthorized point inflation, or modified
 * specimen records, exports are wrapped in a signed Curatorial Envelope containing a SHA-256
 * cryptographic integrity digest.
 *
 * On import, the client re-computes the digest across the canonical payload. If an external editor
 * altered titles, scores, timestamps, or wording, the signature check fails immediately and flags
 * the file as tampered.
 */

import { Discovery } from '../db/database';
import { calculateTotalCuratorPoints } from './proofOfSighting';

export interface SecureArchivePackage {
  app: 'TYPO_HUNTER_ARCHIVE';
  formatVersion: 2;
  exportedAt: string;
  hunter: string;
  totalPoints: number;
  specimenCount: number;
  integritySignature: string;
  discoveries: Discovery[];
}

const ARCHIVE_SALT = 'TYPO_HUNTER_CURATORIAL_SOVEREIGNTY_2026';

/**
 * Computes a SHA-256 hex digest using the browser's native Web Crypto API.
 */
async function computeSha256(canonicalString: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalString + ARCHIVE_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Creates a signed, tamper-evident JSON archive export package.
 */
export async function createSecureArchiveExport(
  discoveries: Discovery[],
  hunterName: string
): Promise<string> {
  const exportedAt = new Date().toISOString();
  const totalPoints = calculateTotalCuratorPoints(discoveries);
  const specimenCount = discoveries.length;

  // Build deterministic canonical string of discoveries
  const canonicalData = JSON.stringify(discoveries);
  const payloadToSign = `${exportedAt}::${hunterName}::${totalPoints}::${specimenCount}::${canonicalData}`;
  const integritySignature = await computeSha256(payloadToSign);

  const archivePackage: SecureArchivePackage = {
    app: 'TYPO_HUNTER_ARCHIVE',
    formatVersion: 2,
    exportedAt,
    hunter: hunterName.trim() || 'Hunter',
    totalPoints,
    specimenCount,
    integritySignature,
    discoveries,
  };

  return JSON.stringify(archivePackage, null, 2);
}

export interface VerificationResult {
  isValid: boolean;
  isTampered: boolean;
  isLegacy: boolean;
  discoveries: Discovery[];
  hunterName?: string;
  totalPoints?: number;
  statusMessage: string;
}

/**
 * Verifies a JSON archive payload for tampering and integrity.
 */
export async function verifyAndUnpackArchive(jsonString: string): Promise<VerificationResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return {
      isValid: false,
      isTampered: false,
      isLegacy: false,
      discoveries: [],
      statusMessage: 'Invalid JSON file format. Parsing failed.',
    };
  }

  // Handle Legacy Array Import (v1 format without signature)
  if (Array.isArray(parsed)) {
    const valid = parsed.every(item => item && typeof item.title === 'string' && typeof item.image === 'string');
    if (!valid) {
      return {
        isValid: false,
        isTampered: false,
        isLegacy: true,
        discoveries: [],
        statusMessage: 'Legacy archive contains invalid specimen structures.',
      };
    }
    return {
      isValid: true,
      isTampered: false,
      isLegacy: true,
      discoveries: parsed as Discovery[],
      statusMessage: 'Legacy v1 archive loaded (No cryptographic hash present).',
    };
  }

  // Handle Signed Archive Package (v2)
  const pkg = parsed as Partial<SecureArchivePackage>;
  if (pkg.app === 'TYPO_HUNTER_ARCHIVE' && Array.isArray(pkg.discoveries) && typeof pkg.integritySignature === 'string') {
    const canonicalData = JSON.stringify(pkg.discoveries);
    const payloadToVerify = `${pkg.exportedAt}::${pkg.hunter}::${pkg.totalPoints}::${pkg.specimenCount}::${canonicalData}`;
    const expectedSignature = await computeSha256(payloadToVerify);

    if (expectedSignature === pkg.integritySignature) {
      return {
        isValid: true,
        isTampered: false,
        isLegacy: false,
        discoveries: pkg.discoveries,
        hunterName: pkg.hunter,
        totalPoints: pkg.totalPoints,
        statusMessage: `Authentic Signed Archive. Cryptographic integrity verified (0 tampering detected).`,
      };
    } else {
      return {
        isValid: false,
        isTampered: true,
        isLegacy: false,
        discoveries: [],
        statusMessage: 'TAMPER DETECTED: The archive contents or score were modified externally. Import rejected.',
      };
    }
  }

  return {
    isValid: false,
    isTampered: false,
    isLegacy: false,
    discoveries: [],
    statusMessage: 'Unrecognized archive package format.',
  };
}
