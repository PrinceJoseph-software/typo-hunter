/**
 * @file ocrService.ts
 * @description Optional on-device text recognition.
 *
 * Uses the browser's experimental `TextDetector` (Shape Detection API). It is not
 * enabled by default in mainstream browsers, so this feature is a progressive
 * enhancement: when it is unavailable the UI hides it and the user types the
 * wording. No text is ever invented, and no fake "confidence" is reported.
 */

export interface OCRResult {
  detectedText: string;
  words: string[];
  lines: string[];
  method: 'native-vision';
  detectedMistakeHint?: string;
}

type TextDetectorCtor = new () => { detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>> };

function getTextDetector(): TextDetectorCtor | null {
  if (typeof window === 'undefined') return null;
  const ctor = (window as unknown as { TextDetector?: TextDetectorCtor }).TextDetector;
  return typeof ctor === 'function' ? ctor : null;
}

/** True when this browser exposes on-device text recognition. */
export function isTextRecognitionSupported(): boolean {
  return getTextDetector() !== null;
}

/**
 * Recognises text in an image. Resolves to null when recognition is unsupported
 * or fails; resolves to a result (possibly with empty text) otherwise.
 */
export async function runOfflineOCR(imageInput: File | Blob | string): Promise<OCRResult | null> {
  const Detector = getTextDetector();
  if (!Detector) return null;

  try {
    const img = await loadImageElement(imageInput);
    const detected = await new Detector().detect(img);
    const lines = (detected || []).map(d => d.rawValue?.trim() || '').filter(Boolean);
    const fullText = lines.join(' ');
    const words = fullText.split(/\s+/).filter(Boolean);
    return {
      detectedText: fullText,
      words,
      lines,
      method: 'native-vision',
      detectedMistakeHint: /(\b\w+\b)\s+\1\b/i.test(fullText) ? 'Repeated word detected.' : undefined,
    };
  } catch (e) {
    console.warn('[OCR] Text recognition failed', e);
    return null;
  }
}

function loadImageElement(source: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectUrl: string | null = null;
    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for text recognition'));
    };
    if (typeof source === 'string') {
      img.src = source;
    } else {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    }
  });
}
