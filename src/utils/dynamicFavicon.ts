/**
 * @file dynamicFavicon.ts
 * @description Dynamic browser favicon morphing engine inspired by Duolingo's iconic
 * mascot states (Pristine -> Pleading -> Melting Meltdown) when inactive.
 *
 * ARCHITECTURAL DESIGN:
 * - Offline-First & Client-Side: Generates zero-network SVG data URIs directly in-memory.
 * - Inactivity State Progression:
 *     1. Pristine / Active (< 24h): Crisp Hunter Yellow aperture emblem with red dot.
 *     2. Pleading / Sad (24h - 72h): Tilted pleading aperture with slanted brows, puppy eyes, and tear drop.
 *     3. Melting Meltdown (> 72h): Full unhinged Duolingo-style melting puddles, dripping base, and alert exclamation badge.
 * - Interactive Testing: Allows curators to manually test and preview each favicon in the browser tab.
 */

export type FaviconStage = 'pristine' | 'pleading' | 'melting';

export const FAVICON_SVGS: Record<FaviconStage, string> = {
  pristine: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <filter id="brutal-shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="3" dy="3" stdDeviation="0" flood-color="#282722" />
    </filter>
  </defs>
  <rect x="6" y="6" width="50" height="50" rx="12" fill="#E8B92D" stroke="#282722" stroke-width="4" filter="url(#brutal-shadow)" />
  <circle cx="31" cy="31" r="17" fill="#F4EBDD" stroke="#282722" stroke-width="3" />
  <line x1="31" y1="9" x2="31" y2="14" stroke="#282722" stroke-width="3" stroke-linecap="round" />
  <line x1="31" y1="48" x2="31" y2="53" stroke="#282722" stroke-width="3" stroke-linecap="round" />
  <line x1="9" y1="31" x2="14" y2="31" stroke="#282722" stroke-width="3" stroke-linecap="round" />
  <line x1="48" y1="31" x2="53" y2="31" stroke="#282722" stroke-width="3" stroke-linecap="round" />
  <path d="M22 23 H40 V28 H33.5 V41 H28.5 V28 H22 Z" fill="#282722" />
  <circle cx="43" cy="19" r="3.5" fill="#D66A4A" stroke="#282722" stroke-width="1.5" />
</svg>`,

  pleading: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <filter id="brutal-shadow-plead" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="3" dy="3" stdDeviation="0" flood-color="#282722" />
    </filter>
  </defs>
  <g transform="rotate(-3 31 31)">
    <rect x="6" y="6" width="50" height="50" rx="12" fill="#E8B92D" stroke="#282722" stroke-width="4" filter="url(#brutal-shadow-plead)" />
    <circle cx="31" cy="33" r="17" fill="#F4EBDD" stroke="#282722" stroke-width="3" />
    <!-- Sad Pleading Eyebrows -->
    <line x1="18" y1="19" x2="26" y2="23" stroke="#282722" stroke-width="3.5" stroke-linecap="round" />
    <line x1="44" y1="19" x2="36" y2="23" stroke="#282722" stroke-width="3.5" stroke-linecap="round" />
    <!-- Tilted Slanted T Emblem -->
    <path d="M23 27 H39 V31 H33.5 V43 H28.5 V31 H23 Z" fill="#282722" transform="rotate(5 31 35)" />
    <!-- Tear Drop -->
    <path d="M43 35 C43 35 48 41 46 44 C44 46 41 44 41 41 Z" fill="#6AA4B4" stroke="#282722" stroke-width="1.2" />
    <!-- Pleading Question Indicator -->
    <circle cx="48" cy="14" r="6.5" fill="#FFFDF9" stroke="#282722" stroke-width="2" />
    <text x="48" y="18.5" font-size="10" font-weight="900" fill="#D66A4A" text-anchor="middle" font-family="monospace">?</text>
  </g>
</svg>`,

  melting: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <filter id="brutal-shadow-melt" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="3" dy="3" stdDeviation="0" flood-color="#282722" />
    </filter>
  </defs>
  <!-- Melting Sagging Puddle Base -->
  <path d="M6 18 C6 10 12 6 20 6 H42 C50 6 56 10 56 18 V40 C56 40 53 58 47 58 C43 58 42 49 38 49 C34 49 33 62 28 62 C23 62 22 50 18 50 C15 50 14 59 10 59 C7 59 6 48 6 40 Z" fill="#EDA338" stroke="#282722" stroke-width="4" filter="url(#brutal-shadow-melt)" />
  <!-- Sagging Aperture Ellipse -->
  <ellipse cx="31" cy="31" rx="16" ry="13" fill="#F4EBDD" stroke="#282722" stroke-width="3" />
  <!-- Distressed Slanted Eyes -->
  <line x1="20" y1="26" x2="26" y2="28" stroke="#282722" stroke-width="3.5" stroke-linecap="round" />
  <line x1="42" y1="26" x2="36" y2="28" stroke="#282722" stroke-width="3.5" stroke-linecap="round" />
  <!-- Melting Dripping 'T' -->
  <path d="M24 28 H38 V32 H33 V42 C33 46 31 48 29 48 C27 48 27 44 29 42 V32 H24 Z" fill="#282722" />
  <!-- Red Drip Drop -->
  <path d="M28 50 C28 50 29 57 27 57 C25 57 25 52 26 50 Z" fill="#D66A4A" stroke="#282722" stroke-width="1" />
  <!-- Alarmed Exclamation Badge -->
  <circle cx="49" cy="13" r="7.5" fill="#D66A4A" stroke="#282722" stroke-width="2" />
  <text x="49" y="17.5" font-size="11" font-weight="900" fill="#FFFFFF" text-anchor="middle" font-family="monospace">!</text>
</svg>`,
};

const STORAGE_KEY_LAST_ACTIVE = 'typo_hunter_last_active_timestamp';
const STORAGE_KEY_FAVICON_MODE = 'typo_hunter_favicon_mode'; // 'auto' | 'pristine' | 'pleading' | 'melting'

export interface InactivityDetails {
  hoursInactive: number;
  stage: FaviconStage;
  lastActiveDate: Date | null;
  stageLabel: string;
  stageDescription: string;
}

/**
 * Calculates current inactivity duration and maps to Duolingo-style stage.
 */
export function getInactivityDetails(): InactivityDetails {
  if (typeof window === 'undefined') {
    return {
      hoursInactive: 0,
      stage: 'pristine',
      lastActiveDate: new Date(),
      stageLabel: 'Pristine Curator',
      stageDescription: 'Active & hunting regularly.',
    };
  }

  const raw = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE);
  const manualMode = localStorage.getItem(STORAGE_KEY_FAVICON_MODE);

  if (manualMode && ['pristine', 'pleading', 'melting'].includes(manualMode)) {
    const stage = manualMode as FaviconStage;
    return {
      hoursInactive: stage === 'melting' ? 76 : stage === 'pleading' ? 32 : 1,
      stage,
      lastActiveDate: raw ? new Date(parseInt(raw, 10)) : new Date(),
      stageLabel: stage === 'melting' ? 'Melting Meltdown' : stage === 'pleading' ? 'Pleading Streak' : 'Pristine Curator',
      stageDescription: stage === 'melting' ? 'Critical inactivity! Mascot has melted.' : stage === 'pleading' ? 'Neglected streak. Mascot is concerned.' : 'Active & hunting regularly.',
    };
  }

  if (!raw) {
    return {
      hoursInactive: 0,
      stage: 'pristine',
      lastActiveDate: null,
      stageLabel: 'Pristine Curator',
      stageDescription: 'New expedition initialized.',
    };
  }

  const lastActive = parseInt(raw, 10);
  const now = Date.now();
  const diffMs = Math.max(0, now - lastActive);
  const hoursInactive = Math.floor(diffMs / (1000 * 60 * 60));

  let stage: FaviconStage = 'pristine';
  let stageLabel = 'Pristine Curator';
  let stageDescription = 'Active & hunting regularly.';

  if (hoursInactive >= 72) {
    stage = 'melting';
    stageLabel = 'Melting Meltdown';
    stageDescription = `Inactive for ${Math.floor(hoursInactive / 24)} days! Mascot has melted like Duolingo.`;
  } else if (hoursInactive >= 24) {
    stage = 'pleading';
    stageLabel = 'Pleading Streak';
    stageDescription = `Inactive for ${hoursInactive} hours! Mascot is getting worried.`;
  }

  return {
    hoursInactive,
    stage,
    lastActiveDate: new Date(lastActive),
    stageLabel,
    stageDescription,
  };
}

/**
 * Updates the actual <link rel="icon"> in document.head with an SVG data URI.
 */
export function setBrowserFavicon(stage: FaviconStage): void {
  if (typeof document === 'undefined') return;

  const svg = FAVICON_SVGS[stage];
  if (!svg) return;

  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }

  link.type = 'image/svg+xml';
  link.href = dataUri;
}

/**
 * Records user activity, refreshes the last active timestamp, and resets favicon to pristine.
 * Returns true if the user was returning from a long absence (> 24 hours).
 */
export function recordCuratorActivity(): { wasReturning: boolean; hoursInactive: number } {
  if (typeof window === 'undefined') return { wasReturning: false, hoursInactive: 0 };

  const raw = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE);
  let wasReturning = false;
  let hoursInactive = 0;

  if (raw) {
    const lastActive = parseInt(raw, 10);
    const diffMs = Date.now() - lastActive;
    hoursInactive = Math.floor(diffMs / (1000 * 60 * 60));
    if (hoursInactive >= 24) {
      wasReturning = true;
    }
  }

  // Update timestamp
  localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, Date.now().toString());

  // Only auto-reset favicon if not locked into manual test mode
  const manualMode = localStorage.getItem(STORAGE_KEY_FAVICON_MODE);
  if (!manualMode || manualMode === 'auto') {
    setBrowserFavicon('pristine');
  }

  return { wasReturning, hoursInactive };
}

/**
 * Synchronizes the browser favicon based on current inactivity.
 */
export function syncFaviconWithInactivity(): FaviconStage {
  const details = getInactivityDetails();
  setBrowserFavicon(details.stage);
  return details.stage;
}

/**
 * Allows the user in Settings to test/preview a specific favicon state.
 */
export function setManualFaviconPreview(stage: FaviconStage | 'auto'): void {
  if (typeof window === 'undefined') return;

  if (stage === 'auto') {
    localStorage.removeItem(STORAGE_KEY_FAVICON_MODE);
    syncFaviconWithInactivity();
  } else {
    localStorage.setItem(STORAGE_KEY_FAVICON_MODE, stage);
    setBrowserFavicon(stage);
  }
}
