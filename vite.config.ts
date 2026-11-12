import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { buildPrivacyPage } from './scripts/privacy-page';
import { handle } from './server/app';

const require = createRequire(import.meta.url);

/** Public address of the deployed app (used for canonical links in generated pages). */
const SITE_URL = 'https://typo-hunter-topaz.vercel.app/';

/** Generates /privacy.html from PRIVACY.md so the public page always matches the policy. */
function typoHunterPrivacyPage(): Plugin {
  const render = () => buildPrivacyPage(readFileSync(resolve(__dirname, 'PRIVACY.md'), 'utf8'), SITE_URL);
  return {
    name: 'typo-hunter-privacy-page',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'privacy.html', source: render() });
    },
    configureServer(server) {
      server.middlewares.use('/privacy.html', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(render());
      });
    },
  };
}

/**
 * Serves the on-device text-reading engine and the spell-check word list under /ocr/,
 * copied from the installed packages (never loaded from a CDN). Only the LSTM core
 * builds are shipped, because the app uses the LSTM-only English model.
 */
function typoHunterOcrAssets(): Plugin {
  const tesseractDir = dirname(require.resolve('tesseract.js/package.json'));
  const coreDir = dirname(createRequire(join(tesseractDir, 'package.json')).resolve('tesseract.js-core/package.json'));
  const files: Record<string, () => Buffer | string> = {
    'worker.min.js': () => readFileSync(join(tesseractDir, 'dist/worker.min.js')),
    'tesseract-core-lstm.wasm.js': () => readFileSync(join(coreDir, 'tesseract-core-lstm.wasm.js')),
    'tesseract-core-simd-lstm.wasm.js': () => readFileSync(join(coreDir, 'tesseract-core-simd-lstm.wasm.js')),
    'tesseract-core-relaxedsimd-lstm.wasm.js': () => readFileSync(join(coreDir, 'tesseract-core-relaxedsimd-lstm.wasm.js')),
    'words.txt': () => (require('an-array-of-english-words') as string[]).join('\n'),
    // Spell-check lists for other languages (MIT). Loaded only when that language is chosen.
    'words-fra.txt': () => (require('an-array-of-french-words') as string[]).join('\n'),
    'words-spa.txt': () => (require('an-array-of-spanish-words') as string[]).join('\n'),
    // SCOWL lists by how common words are ("#1" = most common), used to rank spelling suggestions.
    'common.txt': () => {
      const lists = require('wordlist-english') as Record<string, string[]>;
      return ['english/10', 'english/20', 'english/35', 'english/40', 'english/50']
        .map((key, i) => `#${i + 1}\n${lists[key].join('\n')}`)
        .join('\n');
    },
    'LICENSE-SCOWL.txt': () => readFileSync(join(dirname(require.resolve('wordlist-english/package.json')), 'Copyright')),
  };
  return {
    name: 'typo-hunter-ocr-assets',
    generateBundle() {
      for (const [name, read] of Object.entries(files)) {
        this.emitFile({ type: 'asset', fileName: `ocr/${name}`, source: read() });
      }
    },
    configureServer(server) {
      server.middlewares.use('/ocr/', (req, res, next) => {
        const name = (req.url || '').replace(/^\//, '').split('?')[0];
        const read = files[name];
        if (!read) return next();
        res.setHeader('Content-Type', name.endsWith('.txt') ? 'text/plain; charset=utf-8' : 'text/javascript');
        res.end(read());
      });
    },
  };
}

/** City list for the on-device "which city am I in?" lookup (same data the server validates against). */
function typoHunterGeoData(): Plugin {
  const read = () => readFileSync(resolve(__dirname, 'server/data/cities.json'));
  return {
    name: 'typo-hunter-geo-data',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'geo/cities.json', source: read() });
    },
    configureServer(server) {
      server.middlewares.use('/geo/cities.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(read());
      });
    },
  };
}

/**
 * Runs the public-feed API locally (`pnpm dev` / `pnpm preview`) with an in-memory
 * Postgres (PGlite), so the whole app can be tried without a Neon database.
 * Data is lost when the server stops. Production uses api/index.ts on Vercel.
 */
function typoHunterLocalApi(): Plugin {
  type Middlewares = { use: (fn: (req: any, res: any, next: () => void) => void) => void };
  let dbPromise: Promise<{ query: <T>(text: string, params?: unknown[]) => Promise<T[]> }> | null = null;
  const getDb = () => {
    if (!dbPromise) {
      dbPromise = import('@electric-sql/pglite').then(({ PGlite }) => {
        const pg = new PGlite();
        return { query: async <T>(text: string, params: unknown[] = []) => (await pg.query(text, params)).rows as T[] };
      });
    }
    return dbPromise;
  };
  const install = (middlewares: Middlewares) => {
    middlewares.use(async (req, res, next) => {
      const path = String(req.url || '').split('?')[0];
      if (path !== '/api' && !path.startsWith('/api/') && !path.startsWith('/city/')) return next();
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
        const hasBody = !['GET', 'HEAD'].includes(req.method);
        const request = new Request(`http://${req.headers.host}${req.url}`, {
          method: req.method,
          headers,
          body: hasBody ? Buffer.concat(chunks) : undefined,
        });
        const response = await handle(request, await getDb(), {
          ADMIN_SECRET: process.env.ADMIN_SECRET || 'local-admin-secret-0000',
          BLOCKED_WORDS: process.env.BLOCKED_WORDS,
        });
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (err) {
        res.statusCode = 500;
        res.end(String(err));
      }
    });
  };
  return {
    name: 'typo-hunter-local-api',
    configureServer: server => install(server.middlewares as Middlewares),
    configurePreviewServer: server => install(server.middlewares as Middlewares),
  };
}

/**
 * After the build, writes the full list of output files and a content-based
 * version into dist/sw.js, so the service worker precaches the real hashed
 * bundles (offline works after the first visit) and every deploy gets a new cache.
 */
function typoHunterPrecache(): Plugin {
  const outDir = resolve(__dirname, 'dist');
  return {
    name: 'typo-hunter-precache',
    apply: 'build',
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          if (statSync(full).isDirectory()) walk(full);
          else files.push('/' + relative(outDir, full).split('\\').join('/'));
        }
      };
      walk(outDir);
      // OCR engine files are large and only needed by people who use text reading:
      // the service worker caches them on first use instead of on install.
      const assets = files
        .filter(f => f !== '/sw.js' && !f.endsWith('.map') && !f.startsWith('/ocr/') && !f.startsWith('/geo/') && !f.startsWith('/admin/') && !/^\/google[0-9a-f]+\.html$/.test(f))
        .sort();

      const hash = createHash('sha256');
      for (const f of assets) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);

      const swPath = join(outDir, 'sw.js');
      let sw = readFileSync(swPath, 'utf8');
      const list = ['/', '/app/', ...assets].map(a => JSON.stringify(a)).join(', ');
      sw = sw.replace(/\/\*__PRECACHE_START__\*\/[\s\S]*?\/\*__PRECACHE_END__\*\//, list);
      sw = sw.replace(/'dev'; \/\*__BUILD_VERSION__\*\//, `'${version}';`);
      if (sw.includes('__PRECACHE_START__') || sw.includes('__BUILD_VERSION__')) {
        throw new Error('typo-hunter-precache: placeholders not found in sw.js');
      }
      writeFileSync(swPath, sw);
      this.info?.(`precached ${assets.length + 1} files, cache version ${version}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), typoHunterPrivacyPage(), typoHunterOcrAssets(), typoHunterGeoData(), typoHunterLocalApi(), typoHunterPrecache()],
  // index.html lives in public/; publicDir holds static assets like manifest.json, sw.js, icons
  root: 'public',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      // Two pages: the public front page (/) and the app (/app/).
      input: {
        landing: resolve(__dirname, 'public/index.html'),
        app: resolve(__dirname, 'public/app/index.html'),
        admin: resolve(__dirname, 'public/admin/index.html'),
        // Script for the server-rendered /city/<slug> pages; needs a fixed name they can link to.
        'city-feed': resolve(__dirname, 'src/feed/cityFeed.ts'),
      },
      output: {
        entryFileNames: chunk => (chunk.name === 'city-feed' ? 'city-feed.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
});
