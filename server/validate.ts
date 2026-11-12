/** Input rules for public posts and nicknames. Shared with the app so people see problems before sending. */

export const CATEGORIES = [
  'Food and Drink',
  'Business Signs',
  'Transport',
  'Advertising',
  'Menus',
  'Handwritten Signs',
  'Translation Mishaps',
  'Other',
] as const;

export const FLAG_REASONS = ['offensive', 'personal_info', 'spam', 'not_a_typo'] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

export const MAX_TEXT = 200;

const clean = (s: unknown) =>
  typeof s === 'string'
    ? s
        .normalize('NFC')
        .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';

/** Why a piece of text can't be posted, or null when it's fine. Keeps personal details out of the feed. */
export function textProblem(text: string, blocked: string[] = []): string | null {
  if (!text) return 'This field is empty.';
  if (text.length > MAX_TEXT) return `Keep it under ${MAX_TEXT} characters.`;
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|app|co|ng|uk)\b/i.test(text)) return 'Web addresses can\'t be shared publicly.';
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text)) return 'Email addresses can\'t be shared publicly.';
  if (/(\+?\d[\s().-]?){7,}/.test(text)) return 'Phone numbers and long numbers can\'t be shared publicly.';
  const lower = text.toLowerCase();
  if (blocked.some(w => w && lower.includes(w))) return 'This text contains words that aren\'t allowed.';
  return null;
}

export interface PostInput {
  said: string;
  meant: string;
  category: string;
  cityId: number;
  readByApp: boolean;
  showName: boolean;
}

export function parsePost(body: Record<string, unknown>, blocked: string[] = []): { post?: PostInput; error?: string } {
  const said = clean(body.said);
  const meant = clean(body.meant);
  const saidProblem = textProblem(said, blocked);
  if (saidProblem) return { error: `What it said: ${saidProblem}` };
  const meantProblem = textProblem(meant, blocked);
  if (meantProblem) return { error: `What they meant: ${meantProblem}` };
  if (said.toLowerCase() === meant.toLowerCase()) return { error: '"What it said" and "What they meant" are the same.' };
  const category = (CATEGORIES as readonly string[]).includes(String(body.category)) ? String(body.category) : 'Other';
  const cityId = Number(body.cityId);
  if (!Number.isInteger(cityId)) return { error: 'Choose a city.' };
  if (body.age13 !== true) return { error: 'You need to confirm you are 13 or older to post publicly.' };
  return { post: { said, meant, category, cityId, readByApp: body.readByApp === true, showName: body.showName === true } };
}

const RESERVED = ['admin', 'administrator', 'moderator', 'mod', 'typohunter', 'official', 'support', 'staff', 'system', 'anonymous', 'hunter', 'teacher', 'owner'];

/**
 * Folds look-alike spellings together so "Pr1nce_Joe", "PrinceJoe" and "prince_j0e"
 * all count as the same name. Two nicknames with the same skeleton can't both exist.
 */
export function nicknameSkeleton(name: string): string {
  return name
    .toLowerCase()
    .replace(/_/g, '')
    .replace(/vv/g, 'w')
    .replace(/rn/g, 'm')
    .replace(/[0]/g, 'o')
    .replace(/[1i|]/g, 'l')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b');
}

const RESERVED_SKELETONS = new Set(RESERVED.map(nicknameSkeleton));

export function nicknameProblem(name: string, blocked: string[] = []): string | null {
  if (!/^[A-Za-z][A-Za-z0-9_]{2,19}$/.test(name)) {
    return 'Use 3–20 letters, numbers or underscores, starting with a letter.';
  }
  const skeleton = nicknameSkeleton(name);
  if (skeleton.length < 3) return 'That name is too short.';
  if (RESERVED_SKELETONS.has(skeleton) || [...RESERVED_SKELETONS].some(r => r.length >= 5 && skeleton.includes(r))) {
    return 'That name is reserved.';
  }
  if (blocked.some(w => w && name.toLowerCase().includes(w))) return 'That name isn\'t allowed.';
  return null;
}
