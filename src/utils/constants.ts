/**
 * @file constants.ts
 * @description Canonical taxonomies, categories, and field assignment prompts for TYPO HUNTER.
 */

/**
 * Standardized categories for classifying real-world typographical anomalies.
 */
export const CATEGORIES = [
  'Food and Drink',
  'Business Signs',
  'Transport',
  'Advertising',
  'Menus',
  'Handwritten Signs',
  'Translation Mishaps',
  'Other'
] as const;

export type Category = typeof CATEGORIES[number];

/**
 * Rotating daily field missions presented on the Home dashboard to encourage observational hunting.
 */
export const ROTATING_PROMPTS = [
  "Spotted a menu where the soup sounds threatening? Snap it.",
  "Did an auto-correct failure make it onto a highway billboard? Document the legend.",
  "Found a restroom sign with creative phonetic spelling? You're on curatorial duty.",
  "Check local grocery store price tags for rogue apostrophes and unintended plurals.",
  "Translation software gave up completely? Capture the physical proof.",
  "Spotted a parking sign that contradicts itself? Archive the bureaucratic confusion.",
  "Found a handwritten note on a staff refrigerator with aggressive underline energy? Enshrine it.",
] as const;
