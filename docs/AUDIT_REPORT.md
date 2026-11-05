# Typo Hunter: Independent Technical Audit

**Date:** 5 November 2026
**Scope:** the whole repository on branch `feat/qr-squads-teacher-class` at `f6eda8c`. This includes the open PR #4.
**Method:** I read every source file and traced the main workflows end to end. Bugs were confirmed in headless Chromium (Playwright) and with isolated runs of the service modules. I also ran the type check, the build and the dependency audit, and did external research for the competitive comparison.
**Conflict of interest:** I wrote the PR #4 code in an earlier part of this session (squad rules, teacher roster scanning). It is audited here like everything else, and two findings (F-08 and F-09) are in that code.

Evidence labels used below:
- **[RUN]**: reproduced by executing the app or the code.
- **[CODE]**: certain from reading the code, not executed.
- **[RISK]**: plausible problem, not confirmed.

## Status update (after the audit)

Findings **F-01 to F-12 have been fixed** on branch `fix/audit-f01-f12`. Each fix was confirmed in headless Chromium with scripted user journeys: two-phone Speed Blitz, a teacher with two students of the same name, backup restore and import, offline reload, and the v2 to v3 database migration. The findings below describe the code as it was *at audit time*.

| Finding | Resolution |
|---|---|
| F-01 Blitz single capture | Form resets after each save; the round timer runs in `App` and survives a reload |
| F-02 Offline after first visit | Build-time precache of every output file; versioned cache; URL-based cache lookups |
| F-03 Reminders never fire | Inactivity is measured from the last capture; reminders delivered by the service worker via Periodic Background Sync; support status shown honestly |
| F-04 Self-awarded scores | Ratings and Hall of Fame no longer score; max 120 per entry; duplicate photos score 0; points locked in a ledger |
| F-05 Forgeable "anti-cheat" | Security claims removed; QR scores labelled self-reported; teachers grade by approving photos from a class review file |
| F-06 Imports inflate points | Backups carry an owner id; own backup restores, anyone else's is view-only and scores 0 |
| F-07 Blitz compares wrong numbers | Both start at 0; result QRs exchanged and matched by battle id; each battle settled once |
| F-08 Grades whole history; name collisions | Class scoring counts only fresh photos inside the class window; roster keyed by device id; name required to join |
| F-09 Squad de-dup by name | De-duplicated by device id |
| F-10 Fake OCR | Shown only where `TextDetector` exists; fake confidence and possessive false-positive removed |
| F-11 Accessibility | Zoom re-enabled; Escape, focus trap and focus return on all 11 dialogs; minimum text 10 px |
| F-12 Memory | Full photos stored as Blobs in a separate store and loaded on demand; backups built as Blobs |

**Still open:** F-13 to F-27, plus automated tests and CI (roadmap P1-12).

---

## A. Executive summary

Typo Hunter is a phone-first React PWA for photographing and cataloguing real-world typos. It stores everything on the device, with no backend. On top of that it adds QR-based competitive modes (duel, squads, timed blitz) and a teacher mode for classroom hunts.

**Maturity: prototype.** The core loop works and looks polished: capture a photo, add notes, browse the collection, view details, share a card. The type check passes and runtime dependencies have no known vulnerabilities.

The rest is weaker:

- **Several headline features don't work as described.**
  - Speed Blitz only allows one photo per round [RUN].
  - Offline use fails after a first visit [RUN].
  - Inactivity notifications can never fire [RUN].
  - "Offline OCR" extracts no text in mainstream browsers, and shows a made-up confidence number instead [CODE].
- **The competitive and classroom features rest on a broken trust model.**
  - Scores are self-assessed. One photo can be worth up to 270 points [RUN].
  - Checksums and "signatures" can be forged by anyone. A forged 99,999-point submission is graded "A+" and marked verified [RUN].
  - Importing a friend's archive adds their points to yours [CODE].
  - Teacher grades cover a student's whole history, not the class session [CODE].
- **Documentation and in-app copy overclaim.** Phrases such as "cryptographic anti-cheat", "focus-managed modals", "self-hosted fonts", "SHA-256 verified" and the stated bundle size were all inaccurate.
- **There are no tests**, no linter and no CI.

**Overall:** the personal "typo museum" is sound and close to shippable after a handful of fixes. The multiplayer and classroom layer is not fit for purpose in its current form, because none of its results can be trusted. That is a product and architecture decision, not a bug fix (see section I).

---

## B. System understanding

**Purpose.** Turn spotting typos into a collecting hobby (a personal "museum"), with light gamification, and possibly a classroom literacy activity.

**Users** (inferred from the code): casual individuals, friend groups competing in person, and teachers running field activities.

**Architecture.**
- A single React 18 app. `App.tsx` holds all state and switches between seven screens through a `currentView` string.
- Collection entries live in IndexedDB. Everything else (settings, match history, teacher roster) lives in localStorage.
- Devices exchange data only through JSON QR codes.
- A hand-written service worker provides caching.
- See `docs/ARCHITECTURE.md` for the data model, storage keys and QR formats.

**Key workflows traced:**

| Workflow | Path | Status |
|---|---|---|
| Capture | `Capture.tsx` → `compressImage` → `dbService.saveDiscovery` → `App.loadDiscoveries` (reloads the entire DB) | Works |
| Edit, rate, Hall of Fame, delete | `Detail.tsx` → `saveDiscovery` / `deleteDiscovery` → full reload | Works; no error handling |
| Export / import | `Profile.tsx` → `archiveSecurity.ts` → data-URL download / `saveDiscovery` loop | Works; trust issues (F-05, F-06) |
| Quick Duel | Scan pass → `pvpService.resolveDuel` | Works mechanically |
| Squad battle | Scan passes → `checkSquadReadiness` → `resolveSquadClash` | Works mechanically |
| Speed Blitz | Host QR → join → `Capture` with timer → `handleFinishBlitz` | **Broken** (F-01, F-07) |
| Class hunt | Teacher Master QR → student join → capture → Submission QR → teacher scan → grade | Mechanically works; results meaningless (F-08) |
| Notifications and favicon | `App` mount → `syncFavicon` → `recordActivity` → `checkInactivityNotification` | **Never triggers** (F-03) |

**Dead or disconnected code:**
- Functions never called: `calculateOpticalMatch`, `pvpService.resolveTimedHunt`, `teacherService.parseClassPayload` and `parseStudentSubmission` (the scanner re-implements their parsing inline), `dbService.getMeta`, `setMeta` and `clearAllData`.
- The `meta` object store is never used.
- `OCRResult.hasSuspiciousPunctuation` is never read.
- Notification settings `dailySafariTime` and `soundVibration` are saved but never acted on.

---

## C. Engineering scores (1–10)

| Area | Score | Why |
|---|---|---|
| Architecture | 5 | Local-first static PWA is a good fit for a personal collection. But all state and orchestration sits in `App`, there's no routing, there are 1,000+ line components, and business logic is mixed into UI code. It is the wrong architecture for any feature that needs trust between users. |
| Code quality | 5 | Strict TypeScript compiles cleanly and naming is readable. Against that: two 1,000+ line modal components, duplicated parsing and score logic, dead code, and many comments that describe behaviour the code doesn't have. |
| Business logic | 3 | Core cataloguing is correct. Blitz, OCR, notifications, scoring integrity, grading scope and identity are each wrong in ways users will notice or exploit. |
| Security | 4 | The attack surface is tiny (no server, no auth, React escaping). But the integrity features presented as security are bypassable, privacy copy conflicts with the Google Fonts loading, and there's no CSP. |
| Performance | 4 | Every full-size image of every entry is loaded into memory on start and after every edit. The 564 KB single JS bundle (166 KB gzip) loads QR libraries for all users up front. |
| Scalability | 4 | Hosting scales without limit because it's a static CDN. Data volume on one device does not (see section E, F-12). |
| Reliability | 4 | Offline fails after the first visit. The service worker cache grows without bound. No mutation has error handling. Data loss on clearing site data is undisclosed. No backup prompt. |
| Testing | 1 | No tests, no lint, no CI. Only `tsc` exists. |
| Documentation | 3 | Before this audit, the README was long, repetitive and wrong in many places: database name, indexes, bundle size, accessibility, license. It has been rewritten. |
| User experience | 6 | Visually coherent with good empty states. But the copy is heavy on jargon ("Curatorial Envelope", "Sovereign"), Back exits the app, zoom is disabled, dialogs have no Escape or focus handling, and the modals are dense. |
| Maintainability | 4 | Large files, logic inside components, no tests, misleading comments. Simple changes are risky. |
| Product differentiation | 5 | The "typo museum" angle is charming and uncommon. The classroom hunt overlaps with mature tools (section G) that do it with real verification. |

---

## D. Findings

Severity reflects impact on users or on the product's claims. It is not the same as a CVSS score.

### Critical

**F-01: Speed Blitz accepts only one capture** [RUN]
- **Location:** `src/screens/Capture.tsx`, `handleSubmit`.
- **Evidence:** on success, `setSaving(false)` is never called. Outside a blitz the component unmounts, so this doesn't show. During a blitz, `App` keeps `Capture` mounted. After the first save the button stays disabled with the text "CATALOGING & COMPRESSING SPECIMEN..." and the form is not cleared (reproduced in Chromium).
- **Impact:** the core mechanic of Speed Blitz is unusable.
- **Fix:** on success, reset `saving` and the form fields. Add a regression test.

**F-02: Offline mode fails after the first visit** [RUN]
- **Location:** `public/sw.js`.
- **Evidence:** the service worker installs after the page has already fetched its hashed JS and CSS, and `PRECACHE_ASSETS` lists only the shell and icons. After one online visit the cache held seven files and no bundle. An offline reload didn't render the app.
- **Impact:** the "offline-first" promise fails exactly when a user first relies on it, for example a phone on a field trip.
- **Fix:** precache the built asset list with a generated manifest (vite-plugin-pwa / Workbox). Version the cache per build.

**F-03: Inactivity notifications and favicon can never trigger** [RUN]
- **Location:** `src/App.tsx` mount effect; `dynamicFavicon.recordCuratorActivity`; `notificationService.checkInactivityNotification`.
- **Evidence:**
  - The order of calls is: set favicon from inactivity, then `recordCuratorActivity()` (which resets the timestamp to now and the favicon to "pristine"), then the notification check.
  - With 80 hours of simulated inactivity, notifications enabled and permission granted, no notification was sent. The check then sees 0 hours.
  - The checks also only run while the app is open, and there's no background scheduler (no Periodic Background Sync or push).
  - The `dailySafariTime` setting is never read.
- **Impact:** an entire settings card advertises behaviour that doesn't exist.
- **Fix:** decide whether reminders matter (section I). If they do, they need push from a server or Periodic Background Sync, which has limited browser support. If not, remove the feature and its settings.

**F-04: Scores are self-awarded and unbounded in practice** [RUN]
- **Location:** `src/utils/proofOfSighting.ts`, `calculateSpecimenScore`; `src/screens/Detail.tsx`.
- **Evidence:**
  - The user sets their own 5-star rating (+50) and their own Hall of Fame status (+100).
  - One photo scores up to 270 points, and the same photo can be uploaded again and again from the gallery.
  - A blitz awards points for any saved photo, including old gallery images.
- **Impact:** every competitive comparison (duel, squad, blitz, class grade) measures how much effort someone puts into gaming the score, not the typos they found.
- **Fix:** separate *collection* metadata (rating, favourite, Hall of Fame) from *competition* scoring. Competition scores should count only items captured during the session, through the camera, and de-duplicated by image hash. Peer or teacher judgement should replace self-rating.

**F-05: "Tamper-evident" archives and checksums can be forged** [RUN/CODE]
- **Locations:**
  - `src/utils/archiveSecurity.ts`: the salt `ARCHIVE_SALT` ships in the JS bundle, so anyone can recompute the "signature".
  - `CuratorPassModal.tsx`, `teacherService.createStudentSubmissionPayload`: checksums are readable strings built from the payload's own fields.
  - `teacherService.submissionFromScan` (PR #4): "verification" checks only the checksum's text prefix.
- **Evidence:** a hand-written submission with 99,999 points was accepted as `tamperVerified: true` and graded "A+ (High Honors)".
- **Impact:** the UI and the old README promise "cryptographic anti-cheat". Teachers who trusted it would grade on forged data.
- **Fix, short term:** stop claiming security. Rename "verified" to "format OK", or remove it.
- **Fix, real:** asymmetric signatures can't help either, because any key held on a student's device can be extracted. Trustworthy results need either a server that receives submissions directly, or the teacher reviewing the evidence (photos) rather than a number.

### High

**F-06: Importing someone else's archive adds their points to yours** [CODE]
- **Location:** `Profile.tsx`, `importJSON` → `saveDiscovery` for each record.
- **Evidence:** imported records keep their original ids and serial numbers and merge into your museum. Your pass, submission and duel scores are calculated from everything in the database. The same id overwrites an existing record without asking, and serial numbers can be duplicated.
- **Fix:** keep restore (your own backup) and share (someone else's) as separate operations. Track an owner or origin on each record. Exclude foreign records from scoring. Show a merge or overwrite preview.

**F-07: Speed Blitz compares the wrong numbers** [CODE]
- **Location:** `PvpArenaModal.handleHostStartBlitz` (opponent score = the host's *own* lifetime total) and `handleBlitzJoined` / `BattleQrScannerModal` (opponent score = the host's lifetime total).
- **Evidence:** `App.handleFinishBlitz` compares points earned during the round against those lifetime totals. Results are never exchanged after the round.
- **Impact:** a blitz is effectively unwinnable for anyone playing an established player, and the two devices can show contradictory winners.
- **Fix:** both devices start at 0. At the end, each shows a result QR that the other scans, or a referee device collects both.

**F-08: Teacher grades cover the wrong scope and identities collide** [RUN/CODE]
- **Location:** `teacherService.createStudentSubmissionPayload` (uses *all* discoveries); `saveStudentToGradebook` (de-duplicates by lowercase name).
- **Evidence:**
  - Two different students who both kept the default name "Hunter" left one roster entry, with the second student's score [RUN].
  - Class `durationMinutes` is shown but never enforced.
  - Submissions include entries made before the class began.
- **Fix:** give each device a random install id. Key the roster on (installId, classId). Count only entries created between the class start and end times. Require a name before a student can join a class.

**F-09: Squad de-duplication blocks two players with the same name** [CODE]
- **Location:** `pvpService.findDuplicateHunter` (PR #4).
- **Impact:** two real players named "Hunter" can't both join. This is the same root cause as F-08: there's no stable identity.
- **Fix:** match on the device install id.

**F-10: The OCR feature is effectively fake** [CODE + external]
- **Location:** `src/utils/ocrService.ts`.
- **Evidence:**
  - `TextDetector` is experimental. Chrome's documentation describes enabling it with `#enable-experimental-web-platform-features`.
  - Without it, `analyzeImageCanvas` returns empty text with a "confidence" of 30–95 derived from edge density. That is not a recognition confidence.
  - The "rogue apostrophe" check flags every possessive ("John's").
  - Onboarding still advertises "Offline OCR".
- **Fix:** either integrate real on-device OCR (for example Tesseract.js, loaded lazily with its own cache budget) or remove the feature and its claims.

**F-11: Accessibility gaps contradict documented claims** [CODE]
- **Evidence:**
  - `public/index.html` sets `maximum-scale=1.0, user-scalable=no`, which disables pinch-zoom (WCAG 1.4.4).
  - None of the 10 `role="dialog"` modals handles Escape, traps focus or returns focus when closed.
  - Many labels use text sizes of 8–10 px.
  - The old README claimed "focus management".
- **Fix:** remove the zoom lock. Use a shared accessible dialog primitive (native `<dialog>` or a small hook). Set a minimum text size.

**F-12: Memory and performance at realistic collection sizes** [CODE, estimate]
- **Location:** `dbService.getAllDiscoveries()` loads every record, including full-size `image` data URLs, into React state. It runs on start and after every favourite, rating or edit. `Profile` export builds one data-URL string of the whole archive.
- **Estimate:** about 200–230 KB per entry (base64 adds about a third to JPEG size). With 100 entries, about 23 MB is held in JS strings. With 1,000 entries, about 230 MB, plus a similarly sized export string. That is likely to crash mobile browser tabs.
- **Fix:** store images as `Blob`s in a separate store. List screens load thumbnails only, through a cursor with pagination and virtualisation. Update entries in place instead of reloading everything. Export through `Blob` + `URL.createObjectURL`.

### Medium

**F-13: Service worker caching problems** [CODE]
- The cache name is fixed (`typo-hunter-v3`), so old hashed bundles accumulate forever.
- Stale-while-revalidate on HTML means users get the previous deploy until a second load.
- `caches.match('/index.html') || caches.match('/')`: the `||` applies to a Promise, so the fallback never runs.
- Failed non-navigation requests resolve to `null`, which makes `respondWith` throw a network error.
- Every GET request is cached, including third-party ones.

**F-14: No URL routing** [CODE]
- Back exits the app, deep links and refresh lose the current view, and analytics or sharing of a specific entry is impossible.
- `vercel.json` rewrites everything to `index.html`, but nothing reads the URL.

**F-15: Mutations have no error handling** [CODE]
- `Detail.tsx` (favourite, rating, Hall of Fame, edit, delete) and the import loop silently swallow errors.
- `saveDiscovery` throws on an empty title, and the edit form path doesn't catch it, so the result is an unhandled rejection with no message to the user.

**F-16: Undisclosed risk of data loss** [CODE]
- All data is device-local, and the app never requests persistent storage (`navigator.storage.persist()`).
- Safari can evict script-writable storage after a period of inactivity for sites not added to the home screen. That is general WebKit storage policy, which I didn't re-verify for this audit.
- There are no backup reminders.

**F-17: Privacy copy conflicts with Google Fonts** [CODE]
- `src/index.css` loads Google Fonts, under a comment claiming "Self-hosted font stack … without Google Fonts dependency".
- The Privacy modal says data never travels to any remote server. That is true for user content, but each online load sends the visitor's IP address to Google.
- **Fix:** self-host the fonts.

**F-18: `pnpm deploy` doesn't run the deploy script** [RUN]
- `pnpm deploy` is a built-in pnpm command, so it shadows the `deploy` script. The old README told users to run it.
- **Fix:** rename the script to `deploy:vercel`, or document `pnpm run deploy` (the new README does the latter).

**F-19: Camera stream can leak** [RISK]
- `BattleQrScannerModal.startCamera` awaits `getUserMedia`. If the modal closes before that resolves, the stream is attached after cleanup has already run, so the camera can stay on.
- jsQR also runs on every animation frame on the main thread, which drains the battery.

**F-20: No licence** [CODE]
- The README claimed MIT, but there's no `LICENSE` file and no `license` field in `package.json`.

### Low and informational

- **F-21:** `discoveryNumber` is read and then written in separate transactions, so two quick saves can get the same number [RISK]. Serial numbers aren't unique after imports either.
- **F-22:** The Collection "Favorites" sort option is actually a filter. Search ignores notes and intended wording.
- **F-23:** "End Active Session / Reset Cache" only clears sessionStorage and reloads. Its label implies a privacy action that doesn't happen.
- **F-24:** `validateDiscovery` doesn't check `category` against `CATEGORIES`, and it accepts any string as `image`. This is harmless in `<img src>`, but the data is not well-formed.
- **F-25:** Dev dependencies have 73 advisories (1 critical, 25 high), almost all through the `vercel` CLI devDependency and the Vite 4 dev server. Runtime dependencies are clean (`pnpm audit --prod`). Vite 4 is several majors behind (current 8.x).
- **F-26:** No Content-Security-Policy header in `vercel.json`. The current XSS exposure is low (React escaping, no `dangerouslySetInnerHTML`), but a CSP is a cheap defence in depth.
- **F-27:** The squad "factions" are cosmetic only. `generatePvpVictoryCardBlob` and the share cards work, but they are large canvas-drawing routines (`shareCard.ts`, 436 lines) with no tests.

---

## E. Performance and scale scenarios (hypothetical, not load-tested)

Hosting is a static CDN, so 10×, 100× or 1,000× more *users* costs almost nothing and nothing breaks. Growth that matters is *per device* and *per classroom*:

| Growth | What happens |
|---|---|
| 10× entries (about 100) | About 23 MB of image strings held in memory. Every edit re-reads everything. Noticeable lag on low-end phones. |
| 100× entries (about 1,000) | About 230 MB in memory. Likely mobile tab crashes. Export as a data URL likely fails. The service worker cache keeps growing. |
| Classroom of 30 | Works mechanically, but the teacher scans 30 QR codes one at a time, roster identity collides (F-08), and results can't be trusted. |
| Many classes or schools | Impossible without a server: there's no shared roster, no persistence beyond the teacher's single browser, and no recovery if the teacher's phone is lost. |

What breaks first: memory on the device (F-12), then trust in multiplayer results (F-04, F-05). The engineering fixes are blob storage, paginated thumbnails and code-splitting the QR and canvas modules. For classrooms, a backend.

---

## F. What is already good, and should be kept

- A local-first, no-account design for the *personal* collection. It is private, free to host and quick to start.
- Client-side image compression with a separate thumbnail (`imageUtils.ts`): correct use of object URLs and canvas, with sensible limits.
- Input validation and length caps at the persistence boundary (`validateDiscovery`).
- Strict TypeScript with zero errors. Small runtime dependency set (React, idb, qrcode, jsqr).
- A consistent visual language, thoughtful empty states, and an error boundary with an emergency export.
- QR exchange as a fun, offline, in-person mechanic, as long as it is presented as a *game*, not as proof.

---

## G. Industry comparison

**Category.** Gamified, photo-based collecting and field activities, at the intersection of three groups:

1. **Classroom scavenger-hunt platforms.**
   - [GooseChase EDU](https://www.techlearning.com/news/goosechase-what-it-is-and-how-educators-can-use-it): teachers build photo, video, text and location missions, set teams, start and end times and point values, review submissions, award bonuses and download all media. It needs an internet connection ([Common Sense Education](https://www.commonsense.org/education/reviews/goosechase-edu)).
   - [Actionbound](https://www.leuphana.de/en/teaching/digital-tools/from-a-to-z/actionbound.html): browser-based creator, GPS, quizzes, QR codes, with Teacher and Educational licences.
2. **Citizen-science linguistic-landscape apps.** [Lingscape](https://bop.unibe.ch/linguistik-online/article/download/4086/6130?inline=1) (University of Luxembourg) crowdsources photos of public signs onto a shared map. It reported 18,000+ public photos from 1,000+ participants by 2019 ([Purschke 2021](https://orbilu.uni.lu/bitstream/10993/40581/1/Purschke_2021_Crowdscapes.pdf)), with custom taxonomies for sub-projects and use in school projects.
3. **Social typo humour.** Large online communities already share photos of signage mistakes. This is my own observation of the market, not a sourced statistic.

**Where Typo Hunter stands.**
- Against the classroom tools, it is **behind on what teachers actually need**: verified submissions with the media itself, teacher review, time-boxed sessions, and team management that works across devices. Its single advantage is that it needs no account and no network. That matters in some schools, but it can't produce trustworthy results.
- Against Lingscape, it lacks the shared map and community that make collection meaningful, but its personal-museum framing and humour are more consumer-friendly.
- **What's genuinely distinctive:** the narrow focus on *typos specifically*, the editorial "museum" presentation, and in-person QR play. **Not distinctive:** photo collection, points, teacher scavenger hunts, streak-style nudges.

**Verdict on positioning:** a differentiated implementation of an existing idea. Technical complexity (pseudo-cryptography, pseudo-OCR) has been mistaken for innovation. The real differentiator is tone and focus, and it doesn't need those.

---

## H. Recommended roadmap

Complexity: S = under a day, M = a few days, L = one to two weeks or more.

### P0: fix what is broken or misleading now

| # | Item | Complexity | Depends on |
|---|---|---|---|
| 1 | Fix Speed Blitz multi-capture (F-01) | S | — |
| 2 | Precache built assets and version the cache (F-02, F-13), ideally via vite-plugin-pwa | S–M | — |
| 3 | Remove or rename every security/anti-cheat/"verified"/"SHA-256 verified" claim in UI copy (F-05) | S | — |
| 4 | Remove the fake OCR confidence and "Offline OCR" claims, or replace with real OCR (F-10) | S (remove) / M (Tesseract.js) | Owner decision |
| 5 | Remove or repair inactivity notifications and the favicon trigger (F-03) | S (remove) / L (push) | Owner decision |
| 6 | Re-enable zoom; Escape and focus handling for dialogs (F-11) | S–M | — |
| 7 | Add a LICENSE file (F-20) | S | Owner decision |

### P1: make results meaningful

| # | Item | Complexity | Depends on |
|---|---|---|---|
| 8 | Device install id; key roster and squads on it; require a name to join a class (F-08, F-09) | S–M | — |
| 9 | Session-scoped scoring: count only entries captured during a blitz or class window; reset blitz scores to 0 and exchange results (F-07, F-08) | M | 8 |
| 10 | Separate personal ratings from competitive points (F-04) | M | Owner decision |
| 11 | Restore vs. share import; origin field; exclude foreign records from scoring (F-06) | M | — |
| 12 | Test harness (Vitest for services, Playwright for 5 core journeys) plus CI running tsc, tests and build | M | — |
| 13 | Error handling and user feedback for every mutation (F-15) | S | — |

### P2: strategic

| # | Item | Complexity | Depends on |
|---|---|---|---|
| 14 | Storage redesign: images as Blobs, thumbnail-only lists, pagination, in-place updates, Blob export (F-12) | L | 12 |
| 15 | URL routing (F-14) and splitting `App`, `PvpArenaModal` and `TeacherModeModal` into feature modules | M–L | 12 |
| 16 | Decide classroom direction: an optional lightweight backend (submission upload, teacher review of photos, class rosters) vs. dropping grading | L | Owner decision |
| 17 | Self-host fonts; add CSP; `navigator.storage.persist()` and backup reminders (F-16, F-17, F-26) | S | — |
| 18 | Upgrade Vite and the plugin; move the Vercel CLI out of devDependencies (F-25) | S–M | 12 |

### P3: opportunities

- Real on-device OCR to pre-fill wording and suggest corrections. A spellcheck-style diff between "as written" and "intended" is the most useful AI-like feature for this product.
- An opt-in public gallery or map (a Lingscape-style community) if the goal is to grow the product beyond private collections.
- Teacher review mode built on photos rather than points: approve or reject submissions and award bonuses for creativity.
- Duplicate-photo detection using a perceptual hash on capture.

---

## I. Questions for the owner

These answers change the architecture, so they come first.

**1. What is this product, mainly?**
- (a) A personal, private typo museum with some fun extras; (b) a classroom tool teachers rely on for grading; or (c) a social or community platform?
- *Why it matters:* (a) works with the current no-backend design after the P0 fixes. (b) and (c) can't be done honestly without a server, because device-only data can't be trusted or shared.

**2. Are you willing to add a backend?**
- If yes, what is acceptable in cost, privacy (student data, which brings COPPA/FERPA/GDPR-K obligations depending on region) and accounts?
- If no, should grading and "anti-cheat" be removed and the competitive modes presented as honour-system games?

**3. Who is the primary user: teachers, students, or adults?**
- *Why it matters:* it decides the copy (the current "Sovereign / Curatorial Envelope" jargon is hard for children), the minimum text size, the privacy obligations and the onboarding.

**4. Which features are essential, and which were experiments?**
- For each, keep, fix or remove: Speed Blitz, squads and factions, mascot-style notifications, the melting favicon, OCR, victory placards, teacher grading.
- *Why it matters:* the codebase is about 10,800 lines of TypeScript, much of it for features that don't currently work. Cutting is cheaper than fixing.

**5. What should points mean?**
- Should a rating you give yourself or a Hall of Fame entry ever count in a competition?
- Should gallery uploads, rather than camera captures, count?
- Should duplicate photos count?

**6. What collection size per device should be supported?**
- Is 50 entries, 500 or 5,000 the target? This decides whether the storage redesign (P2-14) is needed now.

**7. Identity.**
- Is a random device id plus a required display name enough, or do teachers need class rosters fixed in advance?

**8. Licence and openness.**
- Do you intend MIT (as previously claimed), another licence, or keeping the code private?

**9. Platforms.**
- Is iOS Safari a primary target? Its storage-eviction and notification limits change what offline-only can promise.

---

## J. Final verdict

- **Fundamentally sound?** The personal-collection core, yes. The multiplayer and classroom layer, no: its results can be faked trivially and are partly miscalculated.
- **Ready for production?** Not yet. With the P0 items (about a week of work), it could ship as a personal app with honour-system games. It isn't ready for any use where grades or prizes depend on scores.
- **Technically competitive?** Not against GooseChase or Actionbound for classrooms. Its plausible niche is a delightful single-purpose consumer app.
- **Is the architecture appropriate?** For a private museum, yes. For trusted competition and teaching, no. That needs a server or a different trust model (teachers reviewing photos instead of numbers).
- **Targeted fixes or redesign?** Targeted fixes for the core. A deliberate keep/cut decision on the feature set. A redesign only if you choose the classroom or community direction.
- **The single most important next step:** answer question I-1. Everything else, including whether to invest in a backend, which features to delete and how points work, depends on it.
