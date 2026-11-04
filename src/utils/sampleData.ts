/**
 * @file sampleData.ts
 * @description Curated offline sample discoveries rendered via zero-dependency SVG data URIs.
 *
 * ARCHITECTURAL DESIGN:
 * To fulfill the development preview requirement without relying on external image CDNs
 * (Unsplash, Imgur, Cloudinary) that fail when offline or trigger CORS blocks,
 * this module programmatically renders authentic graphic signs using vector SVG data URIs:
 *   - 100% Offline: Zero HTTP image requests.
 *   - Scalable & Crisp: Renders at any DPI or retina screen density.
 *   - Stored in IndexedDB: Can be queried, updated, deleted, or reset like real user photography.
 */

import { Discovery } from '../db/database';

function createSignSvg(bg: string, border: string, textLines: { text: string; color: string; size: number; weight?: string; font?: string; y: number }[]): string {
  const content = textLines.map(line => 
    `<text x="400" y="${line.y}" fill="${line.color}" font-family="${line.font || 'Space Grotesk, Arial, sans-serif'}" font-size="${line.size}" font-weight="${line.weight || '700'}" text-anchor="middle">${line.text}</text>`
  ).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <rect width="800" height="600" fill="${bg}" />
    <!-- Texture overlay lines -->
    <path d="M0,0 L800,600 M0,200 L800,800 M0,-200 L800,400" stroke="#000000" stroke-opacity="0.03" stroke-width="2" />
    <!-- Sign board -->
    <rect x="60" y="50" width="680" height="500" rx="20" fill="#FFFDF9" stroke="${border}" stroke-width="8" filter="drop-shadow(6px 6px 0px ${border})" />
    <!-- Rivet bolts on corners -->
    <circle cx="95" cy="85" r="8" fill="${border}" />
    <circle cx="705" cy="85" r="8" fill="${border}" />
    <circle cx="95" cy="515" r="8" fill="${border}" />
    <circle cx="705" cy="515" r="8" fill="${border}" />
    <!-- Inner stamped frame -->
    <rect x="90" y="80" width="620" height="440" rx="10" fill="none" stroke="${border}" stroke-width="2" stroke-dasharray="6,4" />
    ${content}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SAMPLE_DISCOVERIES: Discovery[] = [
  {
    id: 'sample_typo_001',
    discoveryNumber: 1,
    image: createSignSvg('#E6D7C3', '#282722', [
      { text: "TODAY'S SPECIAL", color: '#D66A4A', size: 36, weight: '800', y: 190 },
      { text: "AGGRESSIVE ONION SOUP", color: '#282722', size: 42, weight: '900', y: 270 },
      { text: "Served with a hostile crusty baguette", color: '#666666', size: 24, weight: '500', font: 'Courier Prime, monospace', y: 340 },
      { text: "$9.50 — ORDER AT YOUR OWN RISK", color: '#82917B', size: 22, weight: '700', y: 410 },
    ]),
    thumbnail: createSignSvg('#E6D7C3', '#282722', [
      { text: "TODAY'S SPECIAL", color: '#D66A4A', size: 36, weight: '800', y: 190 },
      { text: "AGGRESSIVE ONION SOUP", color: '#282722', size: 42, weight: '900', y: 270 },
    ]),
    title: 'The Menacing Soup Chalkboard',
    originalWording: 'Aggressive Onion Soup',
    intendedWording: 'French Onion Soup',
    category: 'Menus',
    location: "O'Malley's Cafe, Downtown",
    notes: 'The staff insisted it is simply seasoned with extra hostility.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    isFavorite: true,
    isHallOfFame: true,
    rating: 5,
  },
  {
    id: 'sample_typo_002',
    discoveryNumber: 2,
    image: createSignSvg('#D4DFD2', '#282722', [
      { text: "ATTENTION VISITORS", color: '#282722', size: 34, weight: '800', y: 180 },
      { text: "TRESPASSERS WILL BE", color: '#282722', size: 38, weight: '800', y: 250 },
      { text: "COMPOSTED IMMEDIATELY", color: '#D66A4A', size: 44, weight: '900', y: 320 },
      { text: "Organic matter only. City Ordinance § 42-B", color: '#82917B', size: 20, weight: '600', font: 'Courier Prime, monospace', y: 400 },
    ]),
    thumbnail: createSignSvg('#D4DFD2', '#282722', [
      { text: "TRESPASSERS WILL BE", color: '#282722', size: 38, weight: '800', y: 250 },
      { text: "COMPOSTED IMMEDIATELY", color: '#D66A4A', size: 44, weight: '900', y: 320 },
    ]),
    title: 'Eco-Friendly Legal Threat',
    originalWording: 'Trespassers will be composted immediately',
    intendedWording: 'Trespassers will be prosecuted immediately',
    category: 'Handwritten Signs',
    location: 'Northside Community Garden',
    notes: 'A remarkably sustainable approach to criminal justice.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    isFavorite: true,
    isHallOfFame: true,
    rating: 5,
  },
  {
    id: 'sample_typo_003',
    discoveryNumber: 3,
    image: createSignSvg('#F7EDD9', '#282722', [
      { text: "SEAFOOD PLATTER", color: '#282722', size: 38, weight: '800', y: 190 },
      { text: "CALAMARI & REGRET", color: '#D66A4A', size: 46, weight: '900', y: 280 },
      { text: "Tartar sauce included upon request", color: '#666666', size: 24, weight: '500', font: 'Courier Prime, monospace', y: 360 },
      { text: "MARKET PRICE", color: '#E8B92D', size: 26, weight: '800', y: 430 },
    ]),
    thumbnail: createSignSvg('#F7EDD9', '#282722', [
      { text: "CALAMARI & REGRET", color: '#D66A4A', size: 46, weight: '900', y: 280 },
    ]),
    title: 'The Honest Seafood Menu',
    originalWording: 'Calamari with Tartar Sauce and Regret',
    intendedWording: 'Calamari with Tartar Sauce and Lemon',
    category: 'Food and Drink',
    location: 'Pier 4 Fishery',
    notes: 'Accurate description of eating deep-fried squid at 2:00 AM.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    isFavorite: false,
    isHallOfFame: true,
    rating: 4,
  },
  {
    id: 'sample_typo_004',
    discoveryNumber: 4,
    image: createSignSvg('#E2D7CC', '#282722', [
      { text: "TRANSIT ALERT", color: '#E8B92D', size: 36, weight: '800', y: 190 },
      { text: "PLEASE MIND THE GAP", color: '#282722', size: 40, weight: '800', y: 260 },
      { text: "IN YOUR REASONING", color: '#D66A4A', size: 44, weight: '900', y: 330 },
      { text: "Metropolitan Transit Authority", color: '#82917B', size: 22, weight: '600', font: 'Courier Prime, monospace', y: 410 },
    ]),
    thumbnail: createSignSvg('#E2D7CC', '#282722', [
      { text: "MIND THE GAP IN YOUR REASONING", color: '#D66A4A', size: 38, weight: '900', y: 280 },
    ]),
    title: 'Philosophical Subway Platform',
    originalWording: 'Please mind the gap in your reasoning',
    intendedWording: 'Please mind the platform gap',
    category: 'Translation Mishaps',
    location: 'Subway Central Station, Platform 3',
    notes: 'Left commuter deeply contemplating life choices on a Tuesday morning.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 180).toISOString(),
    isFavorite: true,
    isHallOfFame: true,
    rating: 5,
  },
  {
    id: 'sample_typo_005',
    discoveryNumber: 5,
    image: createSignSvg('#F0E6D2', '#282722', [
      { text: "WEEKEND SALE", color: '#282722', size: 36, weight: '800', y: 190 },
      { text: "SLEEP LIKE A LOG", color: '#282722', size: 42, weight: '800', y: 260 },
      { text: "OR DIE TRYING", color: '#D66A4A', size: 48, weight: '900', y: 340 },
      { text: "50% Off Selected Orthopedic Mattresses", color: '#82917B', size: 22, weight: '600', y: 410 },
    ]),
    thumbnail: createSignSvg('#F0E6D2', '#282722', [
      { text: "SLEEP LIKE A LOG OR DIE TRYING", color: '#D66A4A', size: 38, weight: '900', y: 280 },
    ]),
    title: 'High-Stakes Mattress Billboard',
    originalWording: 'Sleep like a log or die trying',
    intendedWording: 'Sleep like a baby with our premium mattresses',
    category: 'Advertising',
    location: 'Route 9 Commercial Highway',
    notes: 'An intensely aggressive sleep proposition.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 240).toISOString(),
    isFavorite: false,
    isHallOfFame: false,
    rating: 4,
  },
];
