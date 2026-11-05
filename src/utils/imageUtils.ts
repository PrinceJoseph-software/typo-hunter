/**
 * @file imageUtils.ts
 * @description High-performance client-side image downsampling, aspect preservation,
 * and dual-resolution (primary + thumbnail) encoding pipeline.
 *
 * ARCHITECTURAL CONTEXT:
 * Mobile cameras frequently capture photos at 12MP-48MP (resolutions exceeding 4032x3024),
 * producing raw JPEG/HEIC blobs of 4MB-15MB each. Storing raw uncompressed camera images
 * directly in client-side IndexedDB causes three catastrophic issues:
 *   1. Rapid exhaustion of browser storage quotas (typically 50MB-500MB depending on device/browser).
 *   2. Severe UI thread jank when hydrating grid collections due to base64 deserialization overhead.
 *   3. Out-Of-Memory (OOM) browser tab crashes on lower-end mobile hardware.
 *
 * ENGINEERING SOLUTION:
 * We execute an off-screen HTML5 Canvas downsampling pipeline directly on the client:
 *   - Primary Image: Downscaled proportionally to a max bounding dimension of 1200px at 0.82 JPEG quality.
 *     This yields sharp editorial viewing fidelity while reducing footprint from ~8MB to ~150KB (98% reduction).
 *   - Specimen Thumbnail: Downscaled to a max bounding dimension of 360px at 0.70 JPEG quality (~20KB).
 *     Used for $O(1)$ snappy collection grids, lists, and carousel cards without loading full-size specimens.
 *   - Memory Safety: Uses `URL.createObjectURL` instead of `FileReader.readAsDataURL` to avoid
 *     allocating multi-megabyte base64 strings in the V8 heap before canvas drawing, followed by
 *     immediate `URL.revokeObjectURL` cleanup upon image decode.
 */

export interface ProcessedImageResult {
  /** High-resolution compressed JPEG (stored as a Blob, ~25% smaller than a data URL) */
  imageBlob: Blob;
  /** Lightweight low-footprint thumbnail Data URL optimized for rapid grid virtual lists */
  thumbnail: string;
  /** Original image width in pixels */
  width: number;
  /** Original image height in pixels */
  height: number;
  /** 64-bit perceptual difference hash (16 hex chars) for duplicate-photo detection */
  hash: string;
}

/**
 * Computes a 64-bit difference hash (dHash): the image is shrunk to 9x8 grayscale
 * and each bit records whether a pixel is brighter than its right neighbour.
 * Re-saved, re-compressed or slightly resized copies of a photo give near-identical hashes.
 */
export function computeDifferenceHash(source: CanvasImageSource): string {
  const canvas = document.createElement('canvas');
  canvas.width = 9;
  canvas.height = 8;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';
  ctx.drawImage(source, 0, 0, 9, 8);
  const { data } = ctx.getImageData(0, 0, 9, 8);
  let bits = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = (y * 9 + x) * 4;
      const j = i + 4;
      const left = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const right = data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114;
      bits += left > right ? '1' : '0';
    }
  }
  let hex = '';
  for (let k = 0; k < 64; k += 4) hex += parseInt(bits.slice(k, k + 4), 2).toString(16);
  return hex;
}

/** Number of differing bits between two 16-hex-char hashes (64 = completely different). */
export function hashDistance(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Canvas could not be encoded as JPEG.'))),
      'image/jpeg',
      quality
    );
  });
}

export interface CompressionOptions {
  /** Maximum bounding dimension for primary image (width or height). Defaults to 1200px */
  maxPrimaryDimension?: number;
  /** Primary JPEG encoding quality (0.0 to 1.0). Defaults to 0.82 */
  primaryQuality?: number;
  /** Maximum bounding dimension for thumbnail. Defaults to 360px */
  maxThumbDimension?: number;
  /** Thumbnail JPEG encoding quality (0.0 to 1.0). Defaults to 0.70 */
  thumbQuality?: number;
}

/**
 * Computes constrained dimensions while strictly preserving original aspect ratio.
 *
 * @param srcWidth - Original source pixel width
 * @param srcHeight - Original source pixel height
 * @param maxDimension - Maximum allowed width or height
 * @returns Object with constrained width and height
 */
function calculateAspectRatioFit(srcWidth: number, srcHeight: number, maxDimension: number): { width: number; height: number } {
  if (srcWidth <= 0 || srcHeight <= 0) {
    return { width: maxDimension, height: maxDimension };
  }

  if (srcWidth <= maxDimension && srcHeight <= maxDimension) {
    return { width: srcWidth, height: srcHeight };
  }

  const ratio = Math.min(maxDimension / srcWidth, maxDimension / srcHeight);
  return {
    width: Math.max(1, Math.round(srcWidth * ratio)),
    height: Math.max(1, Math.round(srcHeight * ratio)),
  };
}

/**
 * Compresses and dual-encodes an image file or blob on an off-screen canvas.
 *
 * @param fileOrBlob - Input image File from <input type="file"> or Blob
 * @param options - Tunable compression options
 * @returns Promise resolving to primary image and thumbnail Data URLs
 * @throws Error if image decoding or canvas context fails
 */
export async function compressImage(
  fileOrBlob: File | Blob,
  options: CompressionOptions = {}
): Promise<ProcessedImageResult> {
  const {
    maxPrimaryDimension = 1200,
    primaryQuality = 0.82,
    maxThumbDimension = 360,
    thumbQuality = 0.70,
  } = options;

  return new Promise((resolve, reject) => {
    // Basic MIME-type validation before initiating decode
    if (fileOrBlob.type && !fileOrBlob.type.startsWith('image/')) {
      return reject(new Error(`Invalid MIME type "${fileOrBlob.type}". Expected an image format.`));
    }

    // Allocate object URL pointing to raw memory blob (avoids intermediate base64 heap allocation)
    const blobUrl = URL.createObjectURL(fileOrBlob);
    const img = new Image();

    img.onload = async () => {
      // Free object URL immediately once decoded into browser memory
      URL.revokeObjectURL(blobUrl);

      const srcWidth = img.naturalWidth || img.width;
      const srcHeight = img.naturalHeight || img.height;

      if (!srcWidth || !srcHeight) {
        return reject(new Error('Image has zero dimensions or could not be decoded.'));
      }

      try {
        // --- Step 1: Render Primary Compressed Image ---
        const primaryDim = calculateAspectRatioFit(srcWidth, srcHeight, maxPrimaryDimension);
        const primaryCanvas = document.createElement('canvas');
        primaryCanvas.width = primaryDim.width;
        primaryCanvas.height = primaryDim.height;

        const primaryCtx = primaryCanvas.getContext('2d', { alpha: false });
        if (!primaryCtx) {
          return reject(new Error('Unable to acquire 2D rendering context for primary canvas.'));
        }

        // Enable high-fidelity bilinear downsampling
        primaryCtx.imageSmoothingEnabled = true;
        primaryCtx.imageSmoothingQuality = 'high';
        primaryCtx.fillStyle = '#FFFFFF';
        primaryCtx.fillRect(0, 0, primaryDim.width, primaryDim.height);
        primaryCtx.drawImage(img, 0, 0, primaryDim.width, primaryDim.height);

        const primaryBlob = await canvasToBlob(primaryCanvas, primaryQuality);

        // --- Step 2: Render Specimen Thumbnail ---
        const thumbDim = calculateAspectRatioFit(srcWidth, srcHeight, maxThumbDimension);
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = thumbDim.width;
        thumbCanvas.height = thumbDim.height;

        const thumbCtx = thumbCanvas.getContext('2d', { alpha: false });
        if (!thumbCtx) {
          return reject(new Error('Unable to acquire 2D rendering context for thumbnail canvas.'));
        }

        thumbCtx.imageSmoothingEnabled = true;
        thumbCtx.imageSmoothingQuality = 'high';
        thumbCtx.fillStyle = '#FFFFFF';
        thumbCtx.fillRect(0, 0, thumbDim.width, thumbDim.height);
        thumbCtx.drawImage(img, 0, 0, thumbDim.width, thumbDim.height);

        const thumbDataUrl = thumbCanvas.toDataURL('image/jpeg', thumbQuality);
        const hash = computeDifferenceHash(thumbCanvas);

        // Explicitly tear down canvas buffers to hint garbage collector
        primaryCanvas.width = 0;
        primaryCanvas.height = 0;
        thumbCanvas.width = 0;
        thumbCanvas.height = 0;

        resolve({
          imageBlob: primaryBlob,
          thumbnail: thumbDataUrl,
          width: srcWidth,
          height: srcHeight,
          hash,
        });
      } catch (err) {
        reject(new Error(`Canvas compression pipeline failure: ${(err as Error).message}`));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error('Failed to load image into decode pipeline. The file may be corrupted or an unsupported format.'));
    };

    img.src = blobUrl;
  });
}
