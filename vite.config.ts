import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { buildPrivacyPage } from './scripts/privacy-page';

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
      const assets = files.filter(f => f !== '/sw.js' && !f.endsWith('.map')).sort();

      const hash = createHash('sha256');
      for (const f of assets) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);

      const swPath = join(outDir, 'sw.js');
      let sw = readFileSync(swPath, 'utf8');
      const list = ['/', ...assets].map(a => JSON.stringify(a)).join(', ');
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
  plugins: [react(), typoHunterPrivacyPage(), typoHunterPrecache()],
  // index.html lives in public/; publicDir holds static assets like manifest.json, sw.js, icons
  root: 'public',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
