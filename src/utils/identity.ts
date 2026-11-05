/**
 * @file identity.ts
 * @description Stable, anonymous per-install identity.
 *
 * Names are not unique (many people keep the default "Hunter"), so rosters,
 * squads and backups key on this random id instead. It never leaves the device
 * except inside QR codes / files the user chooses to share.
 */

const STORAGE_KEY_DEVICE_ID = 'typo_hunter_device_id';
export const DEFAULT_NICKNAME = 'Hunter';

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

let cachedId: string | null = null;

/** Returns this install's id, creating it on first use. */
export function getDeviceId(): string {
  if (cachedId) return cachedId;
  try {
    let id = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    if (!id || !/^[0-9a-f]{16}$/.test(id)) {
      id = randomId();
      localStorage.setItem(STORAGE_KEY_DEVICE_ID, id);
    }
    cachedId = id;
    return id;
  } catch {
    cachedId = randomId();
    return cachedId;
  }
}

/** Short human-readable form for display next to names (e.g. "#3fa2"). */
export function shortDeviceTag(deviceId?: string): string {
  return deviceId ? `#${deviceId.slice(0, 4)}` : '';
}

export function isDefaultNickname(name: string | null | undefined): boolean {
  const n = (name || '').trim();
  return n === '' || n.toLowerCase() === DEFAULT_NICKNAME.toLowerCase();
}
