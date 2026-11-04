/**
 * @file notificationService.ts
 * @description Customizable notification engine with Duolingo-style guilt-trip dispatches,
 * proofreader alerts, and inactivity nudges.
 *
 * ARCHITECTURAL DESIGN:
 * - 100% Client-Side & Offline: Uses the Web Notifications API and Service Worker notifications
 *   with zero remote tracking servers.
 * - Duolingo Persona System:
 *     - "Unhinged Duolingo": Hilarious, dramatic, passive-aggressive guilt trips.
 *     - "Stern Proofreader": Academic emergency field citations and punctuation alerts.
 *     - "Urban Safari Scout": Street photography prompts and observational encouragement.
 * - Inactivity Triggers: Correlated with the dynamic favicon states (24h, 48h, 72h).
 */

export type NotificationTone = 'duolingo' | 'stern' | 'safari';

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
  tone: 'duolingo',
  inactivityReminder: true,
  inactivityHoursThreshold: 24,
  dailySafariTime: 'off',
  soundVibration: true,
};

export const NOTIFICATION_PERSONAS = [
  {
    id: 'duolingo' as NotificationTone,
    name: 'Unhinged Duolingo',
    badge: 'GUILT-TRIP',
    tagline: 'Dramatic, passive-aggressive guilt trips & melting mascot warnings.',
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
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
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
      await registration.showNotification(title, {
        body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag,
        data: { url: '/' },
      } as any);
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
  if (tone === 'duolingo') {
    if (hoursInactive >= 72) {
      return {
        title: '[ALERT] YOUR FAVICON IS MELTING!',
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
    duolingo: {
      title: '[DISPATCH] Unhinged Duolingo Test',
      body: 'These street typos won\'t photograph themselves! Keep your streak alive or your favicon will start crying.',
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

/**
 * Periodic inactivity check called on app initialization or service worker wakeup.
 */
export async function checkInactivityNotification(): Promise<boolean> {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.inactivityReminder) return false;

  const raw = localStorage.getItem('typo_hunter_last_active_timestamp');
  if (!raw) return false;

  const lastActive = parseInt(raw, 10);
  const hoursInactive = Math.floor((Date.now() - lastActive) / (1000 * 60 * 60));

  if (hoursInactive >= settings.inactivityHoursThreshold) {
    // Check if we already alerted in the last 12 hours
    const lastSentRaw = localStorage.getItem('typo_hunter_last_nudge_sent');
    if (lastSentRaw) {
      const lastSentTime = parseInt(lastSentRaw, 10);
      if (Date.now() - lastSentTime < 12 * 60 * 60 * 1000) {
        return false;
      }
    }

    const dispatch = getInactivityDispatchMessage(settings.tone, hoursInactive);
    const sent = await sendLocalNotification(dispatch.title, dispatch.body, 'inactivity-nudge');
    if (sent) {
      localStorage.setItem('typo_hunter_last_nudge_sent', Date.now().toString());
    }
    return sent;
  }

  return false;
}
