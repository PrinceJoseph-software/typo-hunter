import { PvpMatchRecord } from './pvpService';
/**
 * @file shareCard.ts
 * @description High-resolution editorial placard generator built upon the HTML5 Canvas API.
 *
 * ARCHITECTURAL DESIGN:
 * Rather than generating shareable assets via third-party server renderers (e.g. Puppeteer, Cloudinary),
 * TYPO HUNTER renders the card 100% locally and synchronously within the browser:
 *   - Offline-First: Functions seamlessly in airplane mode with zero external network roundtrips.
 *   - Resolution: 1080x1350 pixels (exact 4:5 portrait aspect ratio optimized for Instagram, Twitter, and messaging).
 *   - Typography Integration: Awaits `document.fonts.ready` prior to canvas drawing to prevent font substitution flashes.
 *   - Share Strategy: Employs progressive enhancement via `navigator.canShare({ files })`:
 *       1. If the operating system share sheet is available (iOS / Android), triggers native mobile share.
 *       2. Falls back cleanly to direct programmatic `<a download="...">` binary file export on desktop browsers.
 */

import { Discovery } from '../db/database';

/**
 * Wraps text cleanly across multiple lines within a maximum pixel width constraint.
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Renders an editorial museum placard onto an off-screen canvas and returns an optimized JPEG Blob.
 *
 * @param discovery - The specimen entity to enshrine into the card
 * @returns Promise resolving to a binary JPEG Blob
 */
export async function generateShareCardBlob(discovery: Discovery): Promise<Blob> {
  // Ensure custom web fonts (Space Grotesk & Courier Prime) are loaded in the browser
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Fallback silently if font check is unsupported
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350; // Standard 4:5 aspect ratio
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Failed to acquire 2D canvas context for share card rendering.');

  // --- Step 1: Base Background & Double Editorial Border ---
  ctx.fillStyle = '#F4EBDD'; // Warm Paper
  ctx.fillRect(0, 0, 1080, 1350);

  // Outer primary stroke
  ctx.strokeStyle = '#282722';
  ctx.lineWidth = 14;
  ctx.strokeRect(36, 36, 1008, 1278);

  // Inner inset frame line
  ctx.strokeStyle = '#282722';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(48, 48, 984, 1254);

  // --- Step 2: Editorial Masthead Header ---
  ctx.fillStyle = '#D66A4A'; // Brick Red
  ctx.font = '700 20px "Courier Prime", monospace';
  ctx.fillText('FIELD STATION ARCHIVE · VOL. 1', 75, 92);

  ctx.fillStyle = '#282722'; // Ink Black
  ctx.font = '800 40px "Space Grotesk", sans-serif';
  ctx.fillText('TYPO HUNTER', 75, 138);

  ctx.font = '700 22px "Courier Prime", monospace';
  ctx.fillStyle = '#282722';
  const numText = `SPECIMEN #${String(discovery.discoveryNumber).padStart(3, '0')}`;
  const numWidth = ctx.measureText(numText).width;
  ctx.fillText(numText, 1005 - numWidth, 138);

  // --- Step 3: Specimen Photography Canvas Container ---
  const imgX = 75;
  const imgY = 165;
  const imgW = 930;
  const imgH = 635;

  // Brutalist shadow offset
  ctx.fillStyle = '#282722';
  ctx.fillRect(imgX + 8, imgY + 8, imgW, imgH);

  // Dark museum photography aperture
  ctx.fillStyle = '#1C1A17';
  ctx.fillRect(imgX, imgY, imgW, imgH);
  ctx.strokeStyle = '#282722';
  ctx.lineWidth = 4;
  ctx.strokeRect(imgX, imgY, imgW, imgH);

  // Draw image while preserving aspect ratio
  await new Promise<void>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(imgW / img.width, imgH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = imgX + (imgW - w) / 2;
      const y = imgY + (imgH - h) / 2;
      ctx.drawImage(img, x, y, w, h);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = discovery.image;
  });

  // --- Step 4: Typography Dossier Container ---
  const boxY = 835;
  const boxH = 430;

  // Dossier brutalist shadow
  ctx.fillStyle = '#282722';
  ctx.fillRect(imgX + 8, boxY + 8, imgW, boxH);

  // Dossier body
  ctx.fillStyle = '#FFFDF9';
  ctx.fillRect(imgX, boxY, imgW, boxH);
  ctx.strokeStyle = '#282722';
  ctx.lineWidth = 4;
  ctx.strokeRect(imgX, boxY, imgW, boxH);

  // Category Tag Badge
  ctx.fillStyle = '#E8B92D';
  ctx.fillRect(imgX + 35, boxY + 35, 240, 42);
  ctx.strokeStyle = '#282722';
  ctx.lineWidth = 3;
  ctx.strokeRect(imgX + 35, boxY + 35, 240, 42);

  ctx.fillStyle = '#282722';
  ctx.font = '800 18px "Space Grotesk", sans-serif';
  ctx.fillText(discovery.category.toUpperCase(), imgX + 50, boxY + 62);

  // Specimen Title (with multi-line safety wrapping)
  ctx.fillStyle = '#282722';
  ctx.font = '800 36px "Space Grotesk", sans-serif';
  const titleLines = wrapCanvasText(ctx, discovery.title, imgW - 70);
  const displayTitle = titleLines[0] || discovery.title;
  ctx.fillText(displayTitle, imgX + 35, boxY + 125);

  // As Written Box
  if (discovery.originalWording) {
    ctx.fillStyle = '#F4EBDD';
    ctx.fillRect(imgX + 35, boxY + 155, imgW - 70, 75);
    ctx.strokeStyle = '#282722';
    ctx.lineWidth = 2;
    ctx.strokeRect(imgX + 35, boxY + 155, imgW - 70, 75);

    ctx.font = '700 15px "Courier Prime", monospace';
    ctx.fillStyle = '#D66A4A';
    ctx.fillText('AS WRITTEN:', imgX + 50, boxY + 185);

    ctx.font = '700 24px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#282722';
    const writtenText = `"${discovery.originalWording}"`;
    const clippedWritten = writtenText.length > 46 ? writtenText.slice(0, 43) + '…' : writtenText;
    ctx.fillText(clippedWritten, imgX + 50, boxY + 215);
  }

  // Intended Wording
  if (discovery.intendedWording) {
    ctx.font = '700 16px "Courier Prime", monospace';
    ctx.fillStyle = '#82917B';
    const intendedText = `LIKELY INTENDED: "${discovery.intendedWording}"`;
    const clippedIntended = intendedText.length > 52 ? intendedText.slice(0, 49) + '…' : intendedText;
    ctx.fillText(clippedIntended, imgX + 35, boxY + 265);
  }

  // Location Descriptor
  if (discovery.location) {
    ctx.font = '600 18px Inter, sans-serif';
    ctx.fillStyle = '#666666';
    ctx.fillText(`Location: ${discovery.location}`, imgX + 35, boxY + 390);
  }

  // App Footer Branding
  ctx.font = '800 20px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#282722';
  ctx.fillText('TYPOHUNTER.APP', imgX + imgW - 220, boxY + 390);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Canvas toBlob serialization returned null.'));
      }
    }, 'image/jpeg', 0.95);
  });
}


/**
 * Renders an editorial PvP Victory Placard onto an off-screen canvas and returns a binary JPEG Blob.
 */
export async function generatePvpVictoryCardBlob(match: PvpMatchRecord): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Fallback
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Failed to acquire canvas context for PvP victory card.');

  // 1. Warm Paper Base & Double Frame
  ctx.fillStyle = '#F4EBDD';
  ctx.fillRect(0, 0, 1080, 1350);

  ctx.strokeStyle = '#282722';
  ctx.lineWidth = 14;
  ctx.strokeRect(36, 36, 1008, 1278);

  ctx.strokeStyle = '#282722';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(48, 48, 984, 1254);

  // 2. Top Header Masthead
  ctx.fillStyle = '#E8B92D';
  ctx.fillRect(80, 80, 920, 50);
  ctx.strokeStyle = '#282722';
  ctx.lineWidth = 3;
  ctx.strokeRect(80, 80, 920, 50);

  ctx.font = '800 20px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#282722';
  ctx.fillText('TYPO HUNTER · CURATORIAL LEAGUE · P2P MULTIPLAYER', 105, 112);

  // 3. Outcome Banner
  const isVictory = match.outcome === 'VICTORY';
  const isDraw = match.outcome === 'DRAW';

  ctx.fillStyle = isVictory ? '#D66A4A' : isDraw ? '#E8B92D' : '#282722';
  ctx.fillRect(80, 160, 920, 140);
  ctx.strokeStyle = '#282722';
  ctx.lineWidth = 4;
  ctx.strokeRect(80, 160, 920, 140);

  ctx.font = '900 64px "Space Grotesk", sans-serif';
  ctx.fillStyle = isDraw ? '#282722' : '#FFFFFF';
  const outcomeText = isVictory ? 'VICTORY' : isDraw ? 'HONORS EVEN (DRAW)' : 'BATTLE REPORT';
  ctx.fillText(outcomeText, 110, 255);

  // 4. Head-to-Head Duel Card
  ctx.fillStyle = '#FFFDF9';
  ctx.fillRect(80, 340, 920, 520);
  ctx.strokeStyle = '#282722';
  ctx.lineWidth = 4;
  ctx.strokeRect(80, 340, 920, 520);

  // Subtle Center Dashed Separator
  ctx.save();
  ctx.strokeStyle = '#D9CEBF';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(540, 380);
  ctx.lineTo(540, 640);
  ctx.stroke();
  ctx.restore();

  // Player Column (Left)
  ctx.fillStyle = '#282722';
  ctx.font = '700 22px "Courier Prime", monospace';
  ctx.fillText(`TEAM: ${match.playerTeam.toUpperCase()}`, 120, 400, 360);

  ctx.font = '900 44px "Space Grotesk", sans-serif';
  ctx.fillText(match.playerNickname, 120, 455, 360);

  ctx.font = '900 100px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#D66A4A';
  ctx.fillText(`${match.playerScore}`, 120, 570);
  ctx.font = '700 22px "Courier Prime", monospace';
  ctx.fillStyle = '#666666';
  ctx.fillText('POINTS CATALOGED', 120, 615);

  // Opponent Column (Right)
  ctx.fillStyle = '#282722';
  ctx.font = '700 22px "Courier Prime", monospace';
  ctx.fillText(`TEAM: ${match.opponentTeam.toUpperCase()}`, 600, 400, 360);

  ctx.font = '900 44px "Space Grotesk", sans-serif';
  ctx.fillText(match.opponentName, 600, 455, 360);

  ctx.font = '900 100px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#282722';
  ctx.fillText(`${match.opponentScore}`, 600, 570);
  ctx.font = '700 22px "Courier Prime", monospace';
  ctx.fillStyle = '#666666';
  ctx.fillText('POINTS BENCHMARK', 600, 615);

  // Centered VS Badge (Vertically and Horizontally Aligned Between Competitors)
  const vsX = 540;
  const vsY = 515;
  const vsRadius = 40;

  // Background circle with brutalist paper outline
  ctx.beginPath();
  ctx.arc(vsX, vsY, vsRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#282722';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#FFFDF9';
  ctx.stroke();

  // Outer thin brutal border
  ctx.beginPath();
  ctx.arc(vsX, vsY, vsRadius + 2, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#282722';
  ctx.stroke();

  // VS Typography perfectly centered
  ctx.font = '900 28px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#E8B92D';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VS', vsX, vsY + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Delta Ribbon
  ctx.fillStyle = '#FAF6EE';
  ctx.fillRect(110, 680, 860, 130);
  ctx.strokeStyle = '#282722';
  ctx.lineWidth = 2;
  ctx.strokeRect(110, 680, 860, 130);

  ctx.font = '800 28px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#282722';
  const deltaString = match.pointsDelta >= 0 ? `+${match.pointsDelta}` : `${match.pointsDelta}`;
  ctx.fillText(`POINTS SPREAD: ${deltaString} PTS`, 140, 740);

  ctx.font = '600 20px "Courier Prime", monospace';
  ctx.fillStyle = '#666666';
  ctx.fillText(match.battleType === 'timed_hunt' ? `MODE: ${match.durationMinutes}-MIN SPEED BLITZ HUNT` : 'MODE: QUICK DUEL FACE-OFF', 140, 775);

  // 5. Verification & Security Stamp Block
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(80, 900, 920, 260);
  ctx.strokeStyle = '#282722';
  ctx.lineWidth = 3;
  ctx.strokeRect(80, 900, 920, 260);

  ctx.font = '800 20px "Courier Prime", monospace';
  ctx.fillStyle = '#D66A4A';
  ctx.fillText('CRYPTOGRAPHIC PROOF & ANTI-CHEAT VERIFICATION:', 110, 945);

  ctx.font = '700 26px "Courier Prime", monospace';
  ctx.fillStyle = '#282722';
  ctx.fillText(match.verificationHash, 110, 995);

  ctx.font = '600 18px "Courier Prime", monospace';
  ctx.fillStyle = '#666666';
  ctx.fillText(`TIMESTAMP: ${new Date(match.timestamp).toUTCString()}`, 110, 1045);
  ctx.fillText('PEER-TO-PEER ENCRYPTED · ZERO-CLOUD SOVEREIGN RECORD', 110, 1085);

  // 6. Bottom Footer
  ctx.font = '800 22px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#282722';
  ctx.fillText('TYPOHUNTER.APP', 80, 1220);
  ctx.font = '600 18px "Courier Prime", monospace';
  ctx.fillStyle = '#666666';
  ctx.fillText('DOCUMENTING URBAN FOLKLORE BEFORE ERASURE', 360, 1220);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed for PvP Victory card.'));
    }, 'image/jpeg', 0.95);
  });
}

/**
 * Universal mobile share or desktop download helper for generated placards.
 */
export async function shareOrDownloadBlob(
  blob: Blob,
  filename: string,
  title: string,
  text: string
): Promise<boolean> {
  const file = new File([blob], filename, { type: 'image/jpeg' });
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title,
        text,
        files: [file],
      });
      return true;
    } catch {
      // User cancelled native sheet
    }
  }

  // Fallback programmatic download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return false;
}
