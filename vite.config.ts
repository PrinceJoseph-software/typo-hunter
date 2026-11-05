import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { buildPrivacyPage } from './scripts/privacy-page';

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
        .filter(f => f !== '/sw.js' && !f.endsWith('.map') && !f.startsWith('/ocr/') && !/^\/google[0-9a-f]+\.html$/.test(f))
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
  plugins: [react(), typoHunterPrivacyPage(), typoHunterOcrAssets(), typoHunterPrecache()],
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
      },
    },
  },
});
