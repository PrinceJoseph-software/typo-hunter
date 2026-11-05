/**
 * @file proofOfSighting.ts
 * @description Educational Scoring Engine and Proof-of-Sighting Verification Protocol.
 *
 * ARCHITECTURAL DESIGN FOR SCHOOLS & PEER COMPETITIONS:
 * Deterministic points for how completely a typo is documented. Lifetime totals are
 * locked in the points ledger (src/utils/pointsLedger.ts) so deleting a photo never
 * removes points already earned.
 *
 *   1. Deterministic Point Calculation (see calculateSpecimenScore).
 *   2. Imported records and duplicate photos earn no points.
 *   3. Record fingerprint: a short checksum of the record's metadata. It identifies a
 *      record; it is NOT a security signature and does not prove anything.
 */

import { Discovery } from '../db/database';

export interface SpecimenScore {
  basePoints: number;          // +50 for a photo
  correctionBonus: number;     // +30 for the intended wording
  categorizationBonus: number; // +20 for a specific category, +10 for "Other"
  fieldNotesBonus: number;     // +10 location, +10 notes
  totalPoints: number;
  /** False when the entry earns nothing (imported from someone else, or a duplicate photo). */
  eligible: boolean;
  ineligibleReason?: string;
}

export interface ProofOfSighting {
  verificationHash: string;
  isPhysicalEvidenceVerified: boolean;
  score: SpecimenScore;
  criteria: {
    hasRealPhoto: boolean;
    hasWordingAnalysis: boolean;
    hasContextNotes: boolean;
  };
}

/** Highest number of points a single entry can earn. */
export const MAX_POINTS_PER_SPECIMEN = 120;

/**
 * Points a discovery earns for how completely it is documented.
 *
 * Personal curation (star rating, favourite, Hall of Fame) deliberately earns
 * nothing: those are the owner's own opinions, so counting them let anyone
 * inflate their score. Imported records and duplicate photos earn nothing.
 */
export function calculateSpecimenScore(discovery: Discovery): SpecimenScore {
  if (discovery.origin === 'imported') {
    return { basePoints: 0, correctionBonus: 0, categorizationBonus: 0, fieldNotesBonus: 0, totalPoints: 0, eligible: false, ineligibleReason: 'Imported from another hunter' };
  }
  if (discovery.duplicateOf) {
    return { basePoints: 0, correctionBonus: 0, categorizationBonus: 0, fieldNotesBonus: 0, totalPoints: 0, eligible: false, ineligibleReason: 'Same photo was already scored' };
  }
  const basePoints = discovery.thumbnail || discovery.image ? 50 : 0;
  const correctionBonus = discovery.intendedWording && discovery.intendedWording.trim().length > 0 ? 30 : 0;
  const categorizationBonus = discovery.category && discovery.category !== 'Other' ? 20 : 10;
  const fieldNotesBonus = (discovery.location?.trim() ? 10 : 0) + (discovery.notes?.trim() ? 10 : 0);
  const totalPoints = basePoints + correctionBonus + categorizationBonus + fieldNotesBonus;

  return { basePoints, correctionBonus, categorizationBonus, fieldNotesBonus, totalPoints, eligible: true };
}

/**
 * Points earned *right now* by a set of discoveries (not the locked lifetime total).
 * Used for session scoring such as a class hunt window.
 */
export function sumSpecimenPoints(discoveries: Discovery[]): number {
  return discoveries.reduce((sum, d) => sum + calculateSpecimenScore(d).totalPoints, 0);
}

/**
 * Generates an optical Proof-of-Sighting certificate for an archived specimen.
 * Creates a deterministic verification fingerprint from the image payload and text.
 */
export function generateProofOfSighting(discovery: Discovery): ProofOfSighting {
  const score = calculateSpecimenScore(discovery);
  const hasRealPhoto = Boolean(discovery.thumbnail && discovery.thumbnail.length > 100);
  const hasWordingAnalysis = Boolean(discovery.originalWording && discovery.intendedWording);
  const hasContextNotes = Boolean(discovery.location || discovery.notes);

  // Deterministic FNV-1a checksum hash of photo + metadata
  const payloadToHash = `${discovery.id}_${discovery.discoveryNumber}_${discovery.createdAt}_${discovery.title}_${discovery.originalWording || ''}`;
  let hash = 2166136261;
  for (let i = 0; i < payloadToHash.length; i++) {
    hash ^= payloadToHash.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hexHash = (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  const verificationHash = `PROOF-${discovery.discoveryNumber.toString().padStart(3, '0')}-${hexHash}`;

  return {
    verificationHash,
    isPhysicalEvidenceVerified: hasRealPhoto,
    score,
    criteria: {
      hasRealPhoto,
      hasWordingAnalysis,
      hasContextNotes,
    },
  };
}
