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
public/            index.html (front page), app/index.html (app shell), manifest.json, sw.js,
                   icons, SEO files, ocr/ (English OCR model)
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

**Continuous integration** (`.github/workflows/ci.yml`) runs on every pull request and every push to `main`:

1. Install dependencies exactly as locked (`pnpm install --frozen-lockfile`)
2. Type check (`tsc --noEmit`)
3. Production build
4. Check that every built file is in the service worker's offline precache list
5. Fail if any third-party font, analytics or tracking host appears in the code or build
6. Fail on high-severity known vulnerabilities in app dependencies (`pnpm audit --prod`)

Run the same core checks locally before opening a pull request:

```bash
pnpm exec tsc --noEmit   # type check
pnpm build               # type check + production build
```

There are no unit or end-to-end tests yet.

## Pages and text reading

- `/` is a static front page (`public/index.html`, styles in `src/landing/landing.css`, a tiny script in `src/landing/landing.ts`). The installed app skips it and opens `/app/`.
- `/app/` is the React app (`public/app/index.html` → `src/main.tsx`). `vercel.json` rewrites `/app/*` to it.
- **Text reading** (`src/utils/ocrService.ts`) runs Tesseract.js on the device. The build copies the engine (`worker.min.js`, the LSTM WebAssembly cores) and word lists into `/ocr/`; the English model lives in `public/ocr/eng.traineddata.gz`. Nothing loads from a CDN. The service worker caches `/ocr/*` on first use (not on install), and the CSP allows WebAssembly via `'wasm-unsafe-eval'`.
- **Spell check** (`src/utils/spellcheck.ts`) flags words missing from a 275k-word list and ranks suggestions by SCOWL frequency levels.

## Search, sharing and AI-readable files

| File | Purpose |
|---|---|
| `public/index.html` | Title, description, canonical URL, Open Graph / Twitter preview tags, `WebApplication` structured data (JSON-LD), and a `<noscript>` summary for crawlers that don't run JavaScript |
| `public/og-image.png` | 1200×630 link-preview image |
| `public/robots.txt`, `public/sitemap.xml` | Crawling rules and page list |
| `public/llms.txt`, `public/llms-full.txt` | Plain-text summaries for AI assistants ([llmstxt.org](https://llmstxt.org/) format) |
| `/privacy.html` | Generated from `PRIVACY.md` on every build (`scripts/privacy-page.ts`) |

**Changing the domain?** Update the address in `public/index.html`, `public/robots.txt`, `public/sitemap.xml`, `public/llms.txt`, `public/llms-full.txt` and `SITE_URL` in `vite.config.ts`.

**Security headers** (`vercel.json`): Content-Security-Policy (only the app's own scripts, styles, fonts and images; `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a strict referrer policy, and a permissions policy that allows only the camera. If you add any external service, the CSP and `PRIVACY.md` must both be updated.

## Deployment

The app is a static site. `pnpm build` outputs `dist/`. Serve it from any static host with a fallback to `index.html`.

For Vercel, `vercel.json` sets the build command, the output directory, the SPA rewrite and cache headers. You can either import the repository in the Vercel dashboard or run:

```bash
pnpm run deploy   # runs: vercel --prod (requires a logged-in Vercel CLI)
                  # note: plain `pnpm deploy` is a different, built-in pnpm command
```

## Security and privacy

- **Your data stays on your device.** Photos and entries are never uploaded. Clearing site data, or losing the device, loses the collection unless you exported it.
- **Fonts are self-hosted** (`src/assets/fonts`, SIL Open Font License). The app makes no third-party requests; CI fails if a third-party font, analytics or tracking host appears in the code or build.
- **Numbers alone can't be trusted; photos can be checked.** Without a server, anything a device sends (a QR code, a file) can be edited by a determined person. So QR scores are labelled "self-reported", backup checksums only detect accidental damage, and teachers grade by reviewing the actual photos in each student's review file.
- A random device ID is stored on each device and shared only inside QR codes and files the user chooses to share.
- Imported archives are checked against the expected structure and string lengths are capped before storage.

## Known limitations

- **Fully offline means no server.** Results can't be verified automatically; teachers verify by looking at photos. A future optional sync server could add automatic checks while keeping offline capture.
- **"Just taken" detection is a heuristic** (the photo file must be less than 30 minutes old). Some phones re-stamp gallery photos when sharing them.
- **Background reminders** need Periodic Background Sync (Chromium, installed app). The browser decides the exact timing.
- **Text recognition** is unavailable in most browsers (see above).
- Browser Back leaves the app (views aren't URLs yet).
- There are no automated tests in the repository yet; fixes were verified with browser scripts during the audit.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md).
