# Development guide

Technical details for people who want to run, change or deploy Typo Hunter. For what the app is and who it's for, see the [README](../README.md).

## How it works

```
Browser
├── React UI (single page, view switching via component state)
├── IndexedDB  "typo-hunter-db"   → discoveries (thumbnails), images (full photos as Blobs),
│                                   meta (points ledger, reminder settings)
├── localStorage                  → nickname, settings, PvP history, teacher roster
├── Service worker (public/sw.js) → caches the app shell and assets
└── Camera + jsQR / qrcode        → device-to-device data exchange via QR codes
```

- **No server.** The site is static files. Devices only exchange data when one shows a QR code and another scans it.
- **Text recognition** uses the browser's experimental `TextDetector` API. Most browsers don't enable it, so the "Read Text" button only appears where it actually works.
- **Points** are calculated by `src/utils/proofOfSighting.ts` and locked in by `src/utils/pointsLedger.ts`.

A detailed reference (data model, storage keys, QR payload formats) is in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Tech stack

| Area | Choice |
|---|---|
| UI | React 18, TypeScript (strict) |
| Styling | Tailwind CSS 3 |
| Build | Vite 4 |
| Storage | IndexedDB via `idb`, plus `localStorage` |
| QR | `qrcode` (generate), `jsqr` (scan) |
| Hosting | Any static host; `vercel.json` is included |

## Project structure

```
public/            index.html (Vite root), manifest.json, sw.js, icons
src/
  main.tsx         React entry + service worker registration
  App.tsx          App shell, view switching, bottom navigation, global modals
  screens/         Home, Capture, Collection, Detail, HallOfFame, Profile, NotFound
  components/      Modals (PvP arena, teacher mode, QR scanner, pass, help, privacy,
                   onboarding), notification settings, icons, error boundary
  db/database.ts   IndexedDB schema, validation and data access
  hooks/           Locked points, on-demand full images, accessible dialogs
  utils/           Image compression and duplicate hashing, scoring, points ledger,
                   device identity, backups, PvP and teacher logic, share cards,
                   notifications, favicon, OCR
docs/              Architecture reference and audit report
```

## Getting started

**Prerequisites:** Node.js and pnpm. The repository doesn't pin versions. It was verified with Node 22 and the committed `pnpm-lock.yaml`.

```bash
git clone https://github.com/PrinceJoseph-software/typo-hunter.git
cd typo-hunter
pnpm install

pnpm dev        # start the dev server
pnpm build      # type-check (tsc) and build to dist/
pnpm preview    # serve the production build locally
```

The camera and service worker need a secure context. `localhost` works; other devices on your network need HTTPS.

## Configuration

There are no environment variables and no configuration files to fill in. All settings live in the app's Profile screen and are stored in the browser.

## Testing and checks

There is **no automated test suite** yet. The checks you can run today:

```bash
pnpm exec tsc --noEmit   # type check
pnpm build               # type check + production build
```

## Deployment

The app is a static site. `pnpm build` outputs `dist/`. Serve it from any static host with a fallback to `index.html`.

For Vercel, `vercel.json` sets the build command, the output directory, the SPA rewrite and cache headers. You can either import the repository in the Vercel dashboard or run:

```bash
pnpm run deploy   # runs: vercel --prod (requires a logged-in Vercel CLI)
                  # note: plain `pnpm deploy` is a different, built-in pnpm command
```

## Security and privacy

- **Your data stays on your device.** Photos and entries are never uploaded. Clearing site data, or losing the device, loses the collection unless you exported it.
- **Fonts are loaded from Google Fonts** (`src/index.css`), so Google receives a request from your device when the app loads online.
- **Numbers alone can't be trusted; photos can be checked.** Without a server, anything a device sends (a QR code, a file) can be edited by a determined person. So QR scores are labelled "self-reported", backup checksums only detect accidental damage, and teachers grade by reviewing the actual photos in each student's review file.
- A random device ID is stored on each device and shared only inside QR codes and files the user chooses to share.
- Imported archives are checked against the expected structure and string lengths are capped before storage.

## Known limitations

- **Fully offline means no server.** Results can't be verified automatically; teachers verify by looking at photos. A future optional sync server could add automatic checks while keeping offline capture.
- **"Just taken" detection is a heuristic** (the photo file must be less than 30 minutes old). Some phones re-stamp gallery photos when sharing them.
- **Background reminders** need Periodic Background Sync (Chromium, installed app). The browser decides the exact timing.
- **Text recognition** is unavailable in most browsers (see above).
- Browser Back leaves the app (views aren't URLs yet).
- Fonts load from Google Fonts when online.
- There are no automated tests in the repository yet; fixes were verified with browser scripts during the audit.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md).
