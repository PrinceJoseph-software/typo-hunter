/**
 * @file spellcheck.ts
 * @description On-device spell check for text read from signs.
 *
 * Loads the English word list (/ocr/words.txt, ~275k words, MIT) on first use and
 * flags words that aren't in it, with up to three nearby suggestions. It catches
 * misspellings ("Coffe", "Resturant"); mistakes that are real words ("Soap of the Day")
 * can't be caught by a dictionary, so the user always has the final say.
 */

const EXTRA_WORDS = [
  'wifi', 'wi-fi', 'email', 'emails', 'online', 'app', 'apps', 'ok', 'okay', 'covid', 'selfie', 'selfies',
  'smartphone', 'website', 'websites', 'login', 'logout', 'takeaway', 'takeaways', 'latte', 'lattes', 'espresso',
  'cappuccino', 'panini', 'paninis', 'smoothie', 'smoothies', 'vegan', 'gluten', 'halal', 'kosher', 'atm', 'atms',
  'usb', 'tv', 'pm', 'am', 'mr', 'mrs', 'ms', 'dr', 'st', 'rd', 'ave', 'no', 'nos', 'etc', 'vs', 'pcs', 'kg', 'km', 'ml',
];

let dictionary: Set<string> | null = null;
/** How common a word is: 1 = among the most common English words … 5 = less common (SCOWL levels). */
let commonness: Map<string, number> = new Map();
let loading: Promise<Set<string>> | null = null;

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} unavailable (${r.status})`);
  return r.text();
}

export function loadDictionary(): Promise<Set<string>> {
  if (dictionary) return Promise.resolve(dictionary);
  if (!loading) {
    loading = Promise.all([fetchText('/ocr/words.txt'), fetchText('/ocr/common.txt').catch(() => '')])
      .then(([words, common]) => {
        dictionary = new Set(words.split('\n'));
        EXTRA_WORDS.forEach(w => dictionary!.add(w));
        const levels = new Map<string, number>();
        let level = 5;
        for (const line of common.split('\n')) {
          if (line.startsWith('#')) {
            level = Number(line.slice(1)) || 5;
          } else if (line && !levels.has(line.toLowerCase())) {
            levels.set(line.toLowerCase(), level);
            dictionary.add(line.toLowerCase());
          }
        }
        commonness = levels;
        return dictionary;
      })
      .catch(err => {
        loading = null;
        throw err;
      });
  }
  return loading;
}

/** Lower-cases and strips surrounding punctuation and possessive 's. */
export function normaliseWord(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/^[^a-z]+|[^a-z]+$/g, '')
    .replace(/'s$/, '');
}

function isKnown(dict: Set<string>, word: string): boolean {
  if (dict.has(word)) return true;
  // Hyphenated words: accept when every part is a word ("self-service").
  if (word.includes('-')) return word.split('-').every(part => !part || dict.has(part));
  return false;
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

function edits1(word: string): string[] {
  const out: string[] = [];
  for (let i = 0; i <= word.length; i++) {
    const a = word.slice(0, i);
    const b = word.slice(i);
    if (b) out.push(a + b.slice(1)); // deletion
    if (b.length > 1) out.push(a + b[1] + b[0] + b.slice(2)); // transposition
    for (const c of ALPHABET) {
      if (b) out.push(a + c + b.slice(1)); // replacement
      out.push(a + c + b); // insertion
    }
  }
  return out;
}

/** Up to `max` dictionary words within one or two edits, best first. */
export function suggest(dict: Set<string>, word: string, max = 3): string[] {
  // Lower is better: fewer edits first, then everyday words before rare ones
  // (so "coffe" → "coffee", not "coffs"), then same first letter, then similar length.
  const score = (cand: string, distance: number) =>
    distance * 10 + (commonness.get(cand) ?? 8) * 2 + (cand[0] === word[0] ? 0 : 3) + Math.abs(cand.length - word.length);
  const found = new Map<string, number>();
  const first = edits1(word);
  for (const e of first) if (dict.has(e) && !found.has(e)) found.set(e, score(e, 1));
  // Look two edits away too when nothing common is one edit away.
  const hasCommon = [...found.keys()].some(k => (commonness.get(k) ?? 9) <= 3);
  if (!hasCommon && word.length <= 12) {
    for (const e of first) {
      for (const e2 of edits1(e)) {
        if (dict.has(e2) && !found.has(e2)) found.set(e2, score(e2, 2));
      }
      if (found.size > 40) break;
    }
  }
  return [...found.entries()].sort((a, b) => a[1] - b[1]).slice(0, max).map(([w]) => w);
}

export interface FlaggedWord {
  /** The word as it appeared (original casing). */
  original: string;
  suggestions: string[];
}

/** Keeps the original's capitalisation pattern on a suggestion ("Coffe" → "Coffee"). */
export function matchCase(original: string, replacement: string): string {
  if (original === original.toUpperCase() && /[A-Z]/.test(original)) return replacement.toUpperCase();
  if (original[0] && original[0] === original[0].toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

/**
 * Finds words that look misspelt in `text`. Short words (< 3 letters), numbers and
 * words with digits/symbols are skipped to avoid noise from sign photos.
 */
export async function findMisspellings(text: string): Promise<FlaggedWord[]> {
  const dict = await loadDictionary();
  const seen = new Set<string>();
  const flagged: FlaggedWord[] = [];
  for (const token of text.split(/\s+/)) {
    const cleaned = token.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
    if (cleaned.length < 3 || /[^A-Za-z'’-]/.test(cleaned)) continue;
    const word = normaliseWord(cleaned);
    if (!word || seen.has(word) || isKnown(dict, word)) continue;
    seen.add(word);
    flagged.push({ original: cleaned, suggestions: suggest(dict, word).map(s => matchCase(cleaned, s)) });
  }
  return flagged;
}

/** Applies the first suggestion for each flagged word, giving a likely intended wording. */
export function suggestCorrection(text: string, flagged: FlaggedWord[]): string {
  let out = text;
  for (const f of flagged) {
    if (!f.suggestions[0]) continue;
    const escaped = f.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\b${escaped}\\b`, 'g'), f.suggestions[0]);
  }
  return out;
}
