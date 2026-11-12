/**
 * Regenerates server/data/cities.json from the `all-the-cities` package
 * (GeoNames data, CC BY 4.0): cities with 15,000+ people, as compact rows
 * [id, name, countryCode, lat, lng, population]. Run: node scripts/build-cities.mjs
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const all = require('all-the-cities');
const rows = all
  .filter(c => c.population >= 15000)
  .sort((a, b) => b.population - a.population)
  .map(c => [
    c.cityId,
    c.name,
    c.country,
    Math.round(c.loc.coordinates[1] * 1000) / 1000,
    Math.round(c.loc.coordinates[0] * 1000) / 1000,
    c.population,
  ]);
writeFileSync(new URL('../server/data/cities.json', import.meta.url), JSON.stringify(rows));
console.log(`wrote ${rows.length} cities`);
