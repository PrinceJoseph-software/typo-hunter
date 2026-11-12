/**
 * Works out the user's city ON THE PHONE. The list of ~24,000 cities (GeoNames, CC BY 4.0)
 * is downloaded once from this site; GPS coordinates are compared locally and never sent
 * anywhere. Only the chosen city's id leaves the device, and only when the user posts.
 */

export interface CityOption {
  id: number;
  name: string;
  country: string;
  lat: number;
  lng: number;
  population: number;
  /** Kilometres from the user, when found by location. */
  distanceKm?: number;
}

let cities: CityOption[] | null = null;
let loading: Promise<CityOption[]> | null = null;

export function loadCities(): Promise<CityOption[]> {
  if (cities) return Promise.resolve(cities);
  if (!loading) {
    loading = fetch('/geo/cities.json')
      .then(r => {
        if (!r.ok) throw new Error(`City list unavailable (${r.status})`);
        return r.json() as Promise<Array<[number, string, string, number, number, number]>>;
      })
      .then(rows => {
        cities = rows.map(([id, name, country, lat, lng, population]) => ({ id, name, country, lat, lng, population }));
        return cities;
      })
      .catch(err => {
        loading = null;
        throw err;
      });
  }
  return loading;
}

const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Cities whose name starts with (then contains) the query, biggest first. */
export async function searchCities(query: string, limit = 8): Promise<CityOption[]> {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const all = await loadCities(); // already sorted by population
  const starts: CityOption[] = [];
  const contains: CityOption[] = [];
  for (const c of all) {
    const name = fold(c.name);
    if (name.startsWith(q)) starts.push(c);
    else if (contains.length < limit && name.includes(q)) contains.push(c);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

/**
 * Cities near a position. The biggest city within 40 km comes first (so a suburb
 * suggests its metropolis: Ikeja → Lagos), followed by the closest ones.
 */
export async function nearestCities(lat: number, lng: number, limit = 5): Promise<CityOption[]> {
  const all = await loadCities();
  const near = all
    .map(c => ({ ...c, distanceKm: distanceKm(lat, lng, c.lat, c.lng) }))
    .filter(c => c.distanceKm <= 150)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  if (near.length === 0) return [];
  const metro = near.filter(c => c.distanceKm <= 40).sort((a, b) => b.population - a.population)[0];
  const ordered = metro ? [metro, ...near.filter(c => c.id !== metro.id)] : near;
  return ordered.slice(0, limit);
}

/** Asks the browser for the position (permission prompt). Coordinates stay in memory on this device. */
export function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Location isn\'t available on this device.'));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(new Error(err.code === err.PERMISSION_DENIED ? 'Location permission was denied. Search for your city instead.' : 'Couldn\'t get your location. Search for your city instead.')),
      // City level only: no need for a precise or fresh fix.
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 15000 }
    );
  });
}
