# Architecture reference

This describes what the code does now (verified against the source after the F-01 to F-12 fixes, November 2026), not what is planned.

## Runtime overview

Typo Hunter is a static single-page React app. There is no server component.

| Concern | Implementation | File |
|---|---|---|
| Entry, service worker registration (production only) | `ReactDOM.createRoot`, `navigator.serviceWorker.register('/sw.js')` | `src/main.tsx` |
| Navigation | `currentView` string in React state; no URL routing | `src/App.tsx` |
| Global state | `useState` in `App`; list data (with thumbnails, not full photos) loaded from IndexedDB | `src/App.tsx` |
| Entries and photos | IndexedDB via `idb` | `src/db/database.ts` |
| Locked points | IndexedDB `meta` store, cached in memory | `src/utils/pointsLedger.ts` |
| Device identity | Random 16-hex id in localStorage | `src/utils/identity.ts` |
| Everything else | `localStorage` | various `src/utils/*` |
| Offline and reminders | Service worker; precache list generated at build time | `public/sw.js`, `vite.config.ts` |
| Device-to-device exchange | JSON inside QR codes (`qrcode` to render, `jsqr` to read), plus JSON files | `src/components/BattleQrScannerModal.tsx` |

## Data model

### IndexedDB: database `typo-hunter-db`, version 3

| Store | Key | Value |
|---|---|---|
| `discoveries` | `id` (keyPath) | Entry record **without** the full photo. Indexes: `by-date`, `by-category`, `by-number` |
| `images` | entry id | Full-size JPEG `Blob` (up to 1200 px) |
| `meta` | string | `pointsLedger`, `pointsLedgerSeeded`, `notificationSettings`, `reminderMessages`, `lastCaptureAt`, `lastNudgeAt`, `lastDailyDate` |

The **v2 → v3 migration** moves each record's `image` data URL into `images` as a Blob and strips it from the record, one record at a time inside the upgrade transaction.

```ts
interface Discovery {
  id: string;               // "typo_<epoch>_<random>"; imports from others: "imp_<owner>_<id>"
  discoveryNumber: number;
  thumbnail: string;        // JPEG data URL, ≤360 px (lists only ever load this)
  image?: string;           // legacy / transient on import only
  title: string;            // ≤100 chars
  originalWording?: string; // ≤200
  intendedWording?: string; // ≤200
  category: string;         // one of CATEGORIES, otherwise stored as "Other"
  location?: string;        // ≤120
  notes?: string;           // ≤1000
  createdAt: string;        // ISO 8601
  isFavorite: boolean;
  isHallOfFame: boolean;    // personal pick, no points
  rating: number;           // 0–5, personal pick, no points
  capturedFresh?: boolean;  // photo file < 30 min old when saved (camera vs. old gallery photo)
  imageHash?: string;       // 64-bit difference hash, for duplicate detection
  duplicateOf?: string;     // earlier scored entry with the same photo → earns 0
  origin?: 'own' | 'imported';
  sourceHunter?: string;    // who an imported entry came from
}
```

Every write goes through `validateDiscovery()`, which checks types and enforces length caps and the category list.

### Points

`calculateSpecimenScore()` (`src/utils/proofOfSighting.ts`):

| Component | Points |
|---|---|
| Photo | 50 |
| Intended wording | 30 |
| Category (specific / `Other`) | 20 / 10 |
| Location, notes | 10 each |
| **Max per entry** | **120** |

Imported entries and duplicate photos score 0. Star ratings and Hall of Fame status score nothing.

**Points ledger** (`pointsLedger.ts`):
- When an entry is saved or edited, the ledger records the highest score that entry has ever reached, together with its photo hash.
- Your total is the sum of these values, so deleting a photo never lowers it.
- A new photo within 6 bits (out of 64) of any hash already in the ledger counts as a duplicate.
- On upgrade, the ledger is seeded once from existing entries.

### localStorage keys

| Key | Contents |
|---|---|
| `typo_hunter_device_id` | Random install id |
| `typo_hunter_nickname` | Display name (default `Hunter`; a real name is required to join a class) |
| `typo_hunter_onboarded` | Onboarding seen flag |
| `typo_hunter_team` | Selected squad id |
| `typo_hunter_pvp_matches` | Last 50 match records |
| `typo_hunter_active_blitz` | The Speed Blitz round in progress (survives reload) |
| `typo_hunter_settled_blitz_ids` | Blitz rounds already settled (each can be recorded once) |
| `typo_hunter_notification_settings` | Reminder preferences: on/off, tone, daily prompt time. The inactivity schedule (24h / 48h / 72h) is internal. Mirrored to IndexedDB for the worker. |
| `typo_hunter_last_active_timestamp` | Time of the last **capture** (drives favicon, banner and reminders) |
| `typo_hunter_active_class_expedition` | Class a **student** joined |
| `typo_hunter_teacher_hosted_class` | Class a **teacher** is running |
| `typo_hunter_teacher_profile` | Instructor name, default class name |
| `typo_hunter_teacher_gradebook` | Class roster (rows keyed by device id) |
| `typo_hunter_teacher_class_squads` | Alpha/Omega assignment |
| `typo_hunter_teacher_class_battles` | Last 30 class battle results |

## QR payloads and files

All payloads are JSON. Device ids let rosters and squads tell people apart; names are not unique.

| `app` / `action` | Produced by | Consumed by | Key fields |
|---|---|---|---|
| `TYPO_HUNTER` | Curator Pass | Duel, squad, teacher scan | hunter, deviceId, teamTag, points (locked), specimens |
| `TYPO_HUNTER_PVP` / `SPEED_BLITZ_CHALLENGE` | Blitz host | Blitz join | battleId, hostName, hostDeviceId, durationMinutes |
| `TYPO_HUNTER_PVP` / `BLITZ_RESULT` | Each player at the end | The rival | battleId, deviceId, hunter, score, specimens |
| `TYPO_HUNTER_CLASS` / `JOIN_CLASS_EXPEDITION` | Teacher | Student join | classId, className, timestamp, durationMinutes, targetPoints |
| `TYPO_HUNTER_SUBMISSION` / `SUBMIT_ASSIGNMENT` | Student | Teacher roster | studentName, deviceId, classId, points (this class only), specimens |
| `TYPO_HUNTER_CLASS_REVIEW` (file) | Student | Teacher review | deviceId, classId, entries[] with thumbnails |

**Class scoring.**
- Only the student's own entries count, and each must be freshly taken, earn points, and fall inside the class window (start to start + duration, with 2 minutes' allowance either side).
- The QR tally is self-reported.
- The review file holds the photos themselves. The teacher approves each one, and the grade is the sum of the approved photos.

**Speed Blitz.**
- Both players' rounds share one `battleId` and start at 0.
- Points come only from fresh, non-duplicate photos saved during the round.
- `settleBlitz()` checks that the result QR is from the same battle, from a different device, and not already recorded.

## Backup format (v3)

`createArchiveExportBlob()` (`src/utils/archiveSecurity.ts`) assembles the file as a `Blob`, one entry at a time:

```json
{ "app": "TYPO_HUNTER_ARCHIVE", "formatVersion": 3, "exportedAt": "...", "hunter": "...",
  "ownerId": "<device id>", "totalPoints": 0, "specimenCount": 0, "pointsLedger": {},
  "checksum": "<sha256>", "discoveries": [ { "...": "...", "image": "data:image/jpeg;base64,..." } ] }
```

- The checksum is SHA-256 over the header fields plus a per-entry hash list. It detects accidental damage. It is **not** a signature.
- If `ownerId` equals this device's id, the import restores the entries and merges the ledger.
- **New phone:** if this device has no entries of its own and no locked points yet, the user is asked whether the file is their own backup. "Yes" restores it like an own backup (older files without a ledger get their points locked at current values); "No" imports it view-only. This is an honour-system choice, like the rest of the offline app.
- Otherwise the entries are imported as `origin: 'imported'` (view-only, 0 points).
- v2 and v1 files are still accepted and imported as view-only.

## Service worker

The build step (`typoHunterPrecache` in `vite.config.ts`) writes every output file and a content-hash version into `dist/sw.js`.

- **Install:** precaches everything, so the app works offline after the first visit.
- **Activate:** deletes old versions.
- **Navigations:** network first, falling back to the cached shell.
- **`/assets/*`:** cache first.
- **Fonts:** self-hosted in `src/assets/fonts` (latin + latin-ext subsets) and precached like every other built file. The old Google Fonts cache is deleted on activate.
- **Cache lookups:** by URL with `ignoreVary`, because the precache request and the module-script request differ in their `Origin` header.
- **`periodicsync` (`typo-hunter-reminders`):** reads settings and the last capture time from IndexedDB, then shows at most one inactivity nudge per 20 hours and one daily prompt per day. The page can trigger the same check with `postMessage({ type: 'CHECK_REMINDERS' })`.
