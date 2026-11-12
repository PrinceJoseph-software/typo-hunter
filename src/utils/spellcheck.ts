/**
 * @file spellcheck.ts
 * @description On-device spell check for text read from signs.
 *
 * Word lists are served from /ocr/ and loaded only for the language in use:
 * English (~275k words, plus SCOWL frequency levels to rank suggestions), French and
 * Spanish. Words missing from the list are flagged with up to three nearby suggestions.
 * It catches misspellings ("Coffe", "Resturant"); mistakes that are real words
 * ("Soap of the Day") can't be caught by a dictionary, so the user has the final say.
 */

const EXTRA_ENGLISH = [
  'wifi', 'wi-fi', 'email', 'emails', 'online', 'app', 'apps', 'ok', 'okay', 'covid', 'selfie', 'selfies',
  'smartphone', 'website', 'websites', 'login', 'logout', 'takeaway', 'takeaways', 'latte', 'lattes', 'espresso',
  'cappuccino', 'panini', 'paninis', 'smoothie', 'smoothies', 'vegan', 'gluten', 'halal', 'kosher', 'atm', 'atms',
  'usb', 'tv', 'pm', 'am', 'mr', 'mrs', 'ms', 'dr', 'st', 'rd', 'ave', 'no', 'nos', 'etc', 'vs', 'pcs', 'kg', 'km', 'ml',
];

interface LanguageRules {
  wordList: string;
  /** Optional frequency file ("#1" = most common words first). */
  commonList?: string;
  alphabet: string;
  extra?: string[];
  /** Strips language-specific prefixes before lookup (French elisions like l', d', qu'). */
  prepare?: (word: string) => string;
}

const RULES: Record<string, LanguageRules> = {
  eng: { wordList: '/ocr/words.txt', commonList: '/ocr/common.txt', alphabet: 'abcdefghijklmnopqrstuvwxyz', extra: EXTRA_ENGLISH },
  fra: {
    wordList: '/ocr/words-fra.txt',
    alphabet: 'abcdefghijklmnopqrstuvwxyzàâäçéèêëîïôöùûüÿœ',
    prepare: w => w.replace(/^(l|d|j|n|s|c|m|t|qu|jusqu|lorsqu|puisqu)'/, ''),
  },
  spa: { wordList: '/ocr/words-spa.txt', alphabet: 'abcdefghijklmnopqrstuvwxyzáéíóúüñ' },
};

/** Languages the app can spell-check (others are read but not checked). */
export const hasSpellcheck = (lang: string): boolean => lang in RULES;

interface Dictionary {
  words: Set<string>;
  /** 1 = among the most common words … 5 = less common; missing = rare. */
  commonness: Map<string, number>;
  rules: LanguageRules;
}

const loaded = new Map<string, Promise<Dictionary>>();

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} unavailable (${r.status})`);
  return r.text();
}

export function loadDictionary(lang = 'eng'): Promise<Dictionary> {
  const rules = RULES[lang];
  if (!rules) return Promise.reject(new Error(`No dictionary for ${lang}`));
  let p = loaded.get(lang);
  if (!p) {
    p = Promise.all([fetchText(rules.wordList), rules.commonList ? fetchText(rules.commonList).catch(() => '') : Promise.resolve('')])
      .then(([wordText, commonText]) => {
        const words = new Set(wordText.split('\n').map(w => w.toLowerCase()));
        (rules.extra || []).forEach(w => words.add(w));
        const commonness = new Map<string, number>();
        let level = 5;
        for (const line of commonText.split('\n')) {
          if (line.startsWith('#')) {
            level = Number(line.slice(1)) || 5;
          } else if (line && !commonness.has(line.toLowerCase())) {
            commonness.set(line.toLowerCase(), level);
            words.add(line.toLowerCase());
          }
        }
        return { words, commonness, rules };
      });
    p.catch(() => loaded.delete(lang));
    loaded.set(lang, p);
  }
  return p;
}

/** Lower-cases and strips surrounding punctuation and English possessive 's. */
export function normaliseWord(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')
    .replace(/'s$/, '');
}

function isKnown(dict: Dictionary, word: string): boolean {
  if (dict.words.has(word)) return true;
  // Hyphenated words: accept when every part is a word ("self-service").
  if (word.includes('-')) return word.split('-').every(part => !part || dict.words.has(part));
  return false;
}

function edits1(word: string, alphabet: string): string[] {
  const out: string[] = [];
  for (let i = 0; i <= word.length; i++) {
    const a = word.slice(0, i);
    const b = word.slice(i);
    if (b) out.push(a + b.slice(1)); // deletion
    if (b.length > 1) out.push(a + b[1] + b[0] + b.slice(2)); // transposition
    for (const c of alphabet) {
      if (b) out.push(a + c + b.slice(1)); // replacement
      out.push(a + c + b); // insertion
    }
  }
  return out;
}

/** Up to `max` dictionary words within one or two edits, best first. */
export function suggest(dict: Dictionary, word: string, max = 3): string[] {
  const { words, commonness, rules } = dict;
  // Lower is better: fewer edits first, then everyday words before rare ones
  // (so "coffe" → "coffee", not "coffs"), then same first letter, then similar length.
  const score = (cand: string, distance: number) =>
    distance * 10 + (commonness.size ? (commonness.get(cand) ?? 8) * 2 : 0) + (cand[0] === word[0] ? 0 : 3) + Math.abs(cand.length - word.length);
  const found = new Map<string, number>();
  const first = edits1(word, rules.alphabet);
  for (const e of first) if (words.has(e) && !found.has(e)) found.set(e, score(e, 1));
  // Look two edits away too when nothing (or, with frequency data, nothing common) is one edit away.
  const goodEnough = commonness.size ? [...found.keys()].some(k => (commonness.get(k) ?? 9) <= 3) : found.size > 0;
  if (!goodEnough && word.length <= 12) {
    for (const e of first) {
      for (const e2 of edits1(e, rules.alphabet)) {
        if (words.has(e2) && !found.has(e2)) found.set(e2, score(e2, 2));
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
  if (original === original.toUpperCase() && original !== original.toLowerCase()) return replacement.toUpperCase();
  if (original[0] && original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Finds words that look misspelt in `text`. Short words (< 3 letters), numbers and
 * words with digits/symbols are skipped to avoid noise from sign photos.
 * Returns [] for languages without a word list.
 */
export async function findMisspellings(text: string, lang = 'eng'): Promise<FlaggedWord[]> {
  if (!hasSpellcheck(lang)) return [];
  const dict = await loadDictionary(lang);
  const seen = new Set<string>();
  const flagged: FlaggedWord[] = [];
  for (const token of text.split(/\s+/)) {
    const cleaned = token.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
    if (cleaned.length < 3 || /[^\p{L}'’-]/u.test(cleaned)) continue;
    let word = normaliseWord(cleaned);
    if (dict.rules.prepare) word = dict.rules.prepare(word);
    if (word.length < 3 || seen.has(word) || isKnown(dict, word)) continue;
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
    out = out.split(f.original).join(f.suggestions[0]);
  }
  return out;
}
