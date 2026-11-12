/** City list shared by the server and (as /geo/cities.json) the app. Data: GeoNames, CC BY 4.0. */
import rows from './data/cities.json';

export interface City {
  id: number;
  name: string;
  country: string;
  lat: number;
  lng: number;
  population: number;
  slug: string;
}

const slugify = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const byId = new Map<number, City>();
const bySlug = new Map<string, City>();

// Rows are sorted by population, so the biggest city of a name gets the short address.
for (const [id, name, country, lat, lng, population] of rows as Array<[number, string, string, number, number, number]>) {
  const base = `${slugify(name) || 'city'}-${country.toLowerCase()}`;
  const slug = bySlug.has(base) ? `${base}-${id}` : base;
  const city: City = { id, name, country, lat, lng, population, slug };
  byId.set(id, city);
  bySlug.set(slug, city);
}

export const getCity = (id: number): City | undefined => byId.get(id);
export const getCityBySlug = (slug: string): City | undefined => bySlug.get(slug);
