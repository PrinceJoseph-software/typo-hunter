/**
 * @file ocrService.ts
 * @description On-device text reading for sign photos (Tesseract.js, English).
 *
 * Everything runs on the phone. The engine, its WebAssembly core and the English
 * model are served from this site under /ocr/ (never a CDN), downloaded only the
 * first time someone reads a photo, and cached by the service worker for offline use.
 * Nothing about the photo leaves the device.
 *
 * The result feeds the "Read by app" badge: it shows the wording was read from the
 * photo on this phone. It is a helpful signal, not proof (anything on a device can be
 * altered), and the app never presents it as verification.
 */

import type { Worker as TesseractWorker } from 'tesseract.js';
import { findMisspellings, suggestCorrection, FlaggedWord } from './spellcheck';

export interface OCRResult {
  /** Cleaned text read from the photo (low-confidence noise removed). */
  detectedText: string;
  lines: string[];
  /** Words that look misspelt, with suggestions. */
  flagged: FlaggedWord[];
  /** The detected text with the top suggestion applied to each flagged word. */
  suggestedCorrection?: string;
  /** Average recognition confidence 0–100 reported by the engine for the kept lines. */
  confidence: number;
  method: 'on-device-ocr';
}

export type OCRProgress = { stage: 'download' | 'reading'; progress: number };

/** True when this browser can run the on-device reader (WebAssembly + Web Workers). */
export function isTextRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && typeof WebAssembly === 'object' && typeof Worker === 'function';
}

let workerPromise: Promise<TesseractWorker> | null = null;
let progressListener: ((p: OCRProgress) => void) | null = null;

async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM, PSM } = await import('tesseract.js');
      const worker = await createWorker('eng', OEM.LSTM_ONLY, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/',
        langPath: '/ocr/',
        gzip: true,
        // Load the worker straight from our origin (no blob: URL), which keeps the
        // Content-Security-Policy strict.
        workerBlobURL: false,
        logger: m => {
          if (!progressListener) return;
          const stage = m.status === 'recognizing text' ? 'reading' : 'download';
          progressListener({ stage, progress: typeof m.progress === 'number' ? m.progress : 0 });
        },
      });
      // Signs are short blocks of text, often at odd angles: let the engine find sparse text.
      // user_defined_dpi stops the engine guessing (and logging) the photo's resolution.
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, user_defined_dpi: '300' });
      return worker;
    })().catch(err => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

/** Downscales large photos so reading is fast on phones (text stays legible at ~1600px). */
async function prepareImage(input: File | Blob | string): Promise<HTMLCanvasElement | string> {
  if (typeof input === 'string') return input;
  const url = URL.createObjectURL(input);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not open the photo for reading.'));
      el.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Keeps words the engine is reasonably sure about and that look like real text. */
function cleanLines(blocks: Array<{ paragraphs: Array<{ lines: Array<{ words: Array<{ text: string; confidence: number }> }> }> }> | null): {
  lines: string[];
  confidence: number;
} {
  const lines: string[] = [];
  const confidences: number[] = [];
  for (const block of blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        const words = (line.words || []).filter(
          w => w.confidence >= 55 && /[A-Za-z0-9]/.test(w.text) && !/^[^A-Za-z0-9]+$/.test(w.text)
        );
        if (words.length === 0) continue;
        lines.push(words.map(w => w.text).join(' '));
        confidences.push(...words.map(w => w.confidence));
      }
    }
  }
  const confidence = confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : 0;
  return { lines, confidence };
}

/**
 * Reads the text in a photo on this device. Resolves to null when the reader isn't
 * supported or fails; otherwise to a result (text may be empty if none was found).
 */
export async function runOfflineOCR(
  imageInput: File | Blob | string,
  onProgress?: (p: OCRProgress) => void
): Promise<OCRResult | null> {
  if (!isTextRecognitionSupported()) return null;
  progressListener = onProgress || null;
  try {
    const [worker, image] = await Promise.all([getWorker(), prepareImage(imageInput)]);
    const { data } = await worker.recognize(image, {}, { text: true, blocks: true });
    const { lines, confidence } = cleanLines(data.blocks as never);
    const detectedText = lines.join(' ').replace(/\s+/g, ' ').trim();
    const flagged = detectedText ? await findMisspellings(detectedText).catch(() => []) : [];
    const correction = flagged.length ? suggestCorrection(detectedText, flagged) : undefined;
    return {
      detectedText,
      lines,
      flagged,
      suggestedCorrection: correction && correction !== detectedText ? correction : undefined,
      confidence,
      method: 'on-device-ocr',
    };
  } catch (e) {
    console.warn('[OCR] Text reading failed', e);
    return null;
  } finally {
    progressListener = null;
  }
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * True when the wording the user saved matches what the app read from the photo
 * (contained in it, or at least 80% of its words found there). Drives "Read by app".
 */
export function wordingMatchesOcr(claimed: string, ocrText: string): boolean {
  const a = normalise(claimed);
  const b = normalise(ocrText);
  if (!a || !b) return false;
  if (b.includes(a)) return true;
  const ocrWords = new Set(b.split(' '));
  const claimedWords = a.split(' ');
  const found = claimedWords.filter(w => ocrWords.has(w)).length;
  return claimedWords.length > 0 && found / claimedWords.length >= 0.8;
}
