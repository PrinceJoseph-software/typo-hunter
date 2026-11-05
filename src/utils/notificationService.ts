/**
 * @file notificationService.ts
 * @description Customizable notification engine with playful guilt-trip dispatches,
 * proofreader alerts, and inactivity nudges.
 *
 * ARCHITECTURAL DESIGN:
 * - 100% Client-Side & Offline: Uses the Web Notifications API and Service Worker notifications
 *   with zero remote tracking servers.
 * - Persona System:
 *     - "Dramatic Mascot": Hilarious, dramatic, passive-aggressive guilt trips.
 *     - "Stern Proofreader": Academic emergency field citations and punctuation alerts.
 *     - "Urban Safari Scout": Street photography prompts and observational encouragement.
 * - Inactivity Triggers: Correlated with the dynamic favicon states (24h, 48h, 72h).
 */

export type NotificationTone = 'playful' | 'stern' | 'safari';

import { ROTATING_PROMPTS } from './constants';

export interface NotificationSettings {
  enabled: boolean;
  tone: NotificationTone;
  inactivityReminder: boolean;
  inactivityHoursThreshold: 24 | 48 | 72;
  dailySafariTime: '09:00' | '13:00' | '18:00' | 'off';
  soundVibration: boolean;
  lastNotificationSentAt?: string;
}

const STORAGE_KEY_SETTINGS = 'typo_hunter_notification_settings';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  tone: 'playful',
  inactivityReminder: true,
  inactivityHoursThreshold: 24,
  dailySafariTime: 'off',
  soundVibration: true,
};

export const NOTIFICATION_PERSONAS = [
  {
    id: 'playful' as NotificationTone,
    name: 'Dramatic Mascot',
    badge: 'GUILT-TRIP',
    tagline: 'Dramatic, over-the-top guilt trips when you go quiet.',
    sample: '"Your 3-day hunting streak is sobbing in the corner. Don\'t make me come down there."',
    badgeBg: '#E8B92D',
    badgeText: '#282722',
  },
  {
    id: 'stern' as NotificationTone,
    name: 'Stern Proofreader',
    badge: 'ACADEMIC',
    tagline: 'Strict editorial citations & institutional punctuation emergencies.',
    sample: '"Curatorial Notice: 14 uncatalogued apostrophe catastrophes reported in your sector."',
    badgeBg: '#D66A4A',
    badgeText: '#FFFFFF',
  },
  {
    id: 'safari' as NotificationTone,
    name: 'Urban Safari Scout',
    badge: 'OBSERVER',
    tagline: 'Friendly street photography prompts & casual observational cues.',
    sample: '"Look up! The café on the corner has something hilarious on their chalkboard."',
    badgeBg: '#82917B',
    badgeText: '#FFFFFF',
  },
];

/**
 * Retrieves saved notification preferences from localStorage.
 */
export function getNotificationSettings(): NotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    const parsed = { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
    // Older versions stored the playful tone under a different id.
    if (!['playful', 'stern', 'safari'].includes(parsed.tone)) parsed.tone = 'playful';
    // The inactivity schedule is internal (staged 24h / 48h / 72h); always start at 24h.
    parsed.inactivityReminder = true;
    parsed.inactivityHoursThreshold = 24;
    return parsed;
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

/**
 * Persists notification preferences to localStorage.
 */
export function saveNotificationSettings(settings: NotificationSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  syncReminderSchedule();
}

export const REMINDER_SYNC_TAG = 'typo-hunter-reminders';

type PeriodicSyncRegistration = ServiceWorkerRegistration & {
  periodicSync?: {
    register: (tag: string, options: { minInterval: number }) => Promise<void>;
    unregister: (tag: string) => Promise<void>;
  };
};

/**
 * Whether reminders can arrive while the app is closed. Background delivery uses
 * Periodic Background Sync, which currently works only in Chromium browsers for an
 * installed app, at a rate the browser decides (roughly at most a few times a day).
 */
export async function getReminderSupport(): Promise<'background' | 'needs-install' | 'unsupported'> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
  try {
    const reg = (await navigator.serviceWorker.ready) as PeriodicSyncRegistration;
    if (!reg.periodicSync) return 'unsupported';
    const status = await navigator.permissions
      .query({ name: 'periodic-background-sync' as PermissionName })
      .catch(() => null);
    return status && status.state === 'granted' ? 'background' : 'needs-install';
  } catch {
    return 'unsupported';
  }
}

/**
 * Copies reminder settings to IndexedDB (the service worker can't read localStorage)
 * and registers or removes the background check accordingly.
 */
export async function syncReminderSchedule(): Promise<void> {
  if (typeof window === 'undefined') return;
  const settings = getNotificationSettings();
  try {
    const { dbService } = await import('../db/database');
    await dbService.setMeta('notificationSettings', settings);
    // The worker can't import app code, so hand it the texts for the chosen tone.
    await dbService.setMeta('reminderMessages', {
      inactivity: {
        h24: getInactivityDispatchMessage(settings.tone, 24),
        h48: getInactivityDispatchMessage(settings.tone, 48),
        h72: getInactivityDispatchMessage(settings.tone, 72),
      },
      daily: {
        title: 'Daily typo hunt',
        body: ROTATING_PROMPTS[new Date().getDate() % ROTATING_PROMPTS.length],
      },
    });
  } catch {
    // storage unavailable; nothing to schedule
  }
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = (await navigator.serviceWorker.ready) as PeriodicSyncRegistration;
    if (!reg.periodicSync) return;
    const wantsReminders =
      settings.enabled && (settings.inactivityReminder || settings.dailySafariTime !== 'off');
    if (wantsReminders && Notification.permission === 'granted') {
      await reg.periodicSync.register(REMINDER_SYNC_TAG, { minInterval: 6 * 60 * 60 * 1000 });
    } else {
      await reg.periodicSync.unregister(REMINDER_SYNC_TAG);
    }
  } catch (err) {
    // Typically: not installed, so the browser refuses periodic sync.
    console.info('[reminders] Background reminders unavailable:', (err as Error)?.message);
  }
}

/**
 * Checks if browser supports notifications.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Gets current notification permission status ('granted' | 'denied' | 'default').
 */
export function getNotificationPermissionStatus(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Requests notification permission from the user.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const current = getNotificationSettings();
      saveNotificationSettings({ ...current, enabled: true });
    }
    return permission;
  } catch (err) {
    console.error('Failed to request notification permission', err);
    return 'denied';
  }
}

/**
 * Dispatches a formatted notification via Service Worker or Web Notification API.
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  tag: string = 'typo-hunter-dispatch'
): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  try {
    // Attempt to use Service Worker registration if available
    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
      const registration = await navigator.serviceWorker.ready;
      const { soundVibration } = getNotificationSettings();
      await registration.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag,
        silent: !soundVibration,
        vibrate: soundVibration ? [120, 60, 120] : undefined,
        data: { url: '/' },
      } as NotificationOptions);
      return true;
    }

    // Direct Web Notification fallback
    new Notification(title, {
      body,
      icon: '/favicon.svg',
      tag,
    });
    return true;
  } catch (err) {
    console.error('Failed to trigger notification', err);
    return false;
  }
}

/**
 * Tone-specific message dictionary for inactivity dispatches.
 */
export function getInactivityDispatchMessage(
  tone: NotificationTone,
  hoursInactive: number
): { title: string; body: string } {
  if (tone === 'playful') {
    if (hoursInactive >= 72) {
      return {
        title: '[ALERT] THE MASCOT IS MELTING!',
        body: 'You haven\'t documented a typo in 3 days. Your Typo Hunter mascot has literally melted into a puddle of grammatical despair. Save it now!',
      };
    }
    if (hoursInactive >= 48) {
      return {
        title: 'The typos are multiplying without you...',
        body: 'A local diner just printed "COLD SWEAT SANDWICHES" on their awning and you weren\'t there to photograph it. Don\'t break my heart.',
      };
    }
    return {
      title: 'Did you get eaten by a rogue apostrophe?',
      body: 'Your typo hunting streak is feeling abandoned. One quick snap before you go to sleep?',
    };
  }

  if (tone === 'stern') {
    if (hoursInactive >= 72) {
      return {
        title: '[CRITICAL] ARCHIVE BREACH: Curator Inactive',
        body: '72 hours without field observation. Municipal signage standards are degrading unchecked. Return to duty immediately.',
      };
    }
    if (hoursInactive >= 48) {
      return {
        title: '[DISPATCH] Punctuation Alert: Sector Unmonitored',
        body: 'Field station reports uncatalogued comma splices and misplaced hyphens. Immediate photographic documentation required.',
      };
    }
    return {
      title: '[NOTICE] Daily Field Standby',
      body: 'Curator presence logged below daily quota. Keep your optical lens trained on local storefronts.',
    };
  }

  // safari
  if (hoursInactive >= 72) {
    return {
      title: '[SCOUT] Street Scout: Fresh Signs in the Wild!',
      body: 'It\'s been a couple of days! Next time you take a walk, look up at the shop windows — something funny is waiting for your museum.',
    };
  }
  if (hoursInactive >= 48) {
    return {
      title: '[PROMPT] Lunch Walk Typography Prompt',
      body: 'Spot an odd menu translation or a rogue billboard today? Add it to your collection before it gets fixed!',
    };
  }
  return {
    title: '[SAFARI] Street Safari Check-in',
    body: 'Keeping your eyes peeled today? Great typos hide in the most ordinary places.',
  };
}

/**
 * Triggers an immediate test notification with selected persona.
 */
export async function sendTestNotification(tone?: NotificationTone): Promise<{ success: boolean; message: string }> {
  const settings = getNotificationSettings();
  const selectedTone = tone || settings.tone;

  const sampleMessages: Record<NotificationTone, { title: string; body: string }> = {
    playful: {
      title: '[DISPATCH] Dramatic Mascot Test',
      body: 'These street typos won\'t photograph themselves! Keep your streak alive or our mascot will start crying.',
    },
    stern: {
      title: '[DISPATCH] Proofreader Test #001',
      body: 'Field protocol verified. Optical transmission successful. Maintain high linguistic standards.',
    },
    safari: {
      title: '[DISPATCH] Urban Safari Test',
      body: 'Camera connection test successful! Ready to spot hilarious English in the wild.',
    },
  };

  const sample = sampleMessages[selectedTone];

  if (!isNotificationSupported()) {
    return {
      success: false,
      message: 'Browser notifications are not supported on this platform.',
    };
  }

  if (Notification.permission !== 'granted') {
    const granted = await requestNotificationPermission();
    if (granted !== 'granted') {
      return {
        success: false,
        message: 'Permission was not granted. Please enable notifications in your browser settings.',
      };
    }
  }

  const sent = await sendLocalNotification(sample.title, sample.body, `test-${Date.now()}`);
  return {
    success: sent,
    message: sent
      ? `Sent test notification in "${NOTIFICATION_PERSONAS.find(p => p.id === selectedTone)?.name}" voice!`
      : 'Failed to deliver notification. Check your system alert permissions.',
  };
}
