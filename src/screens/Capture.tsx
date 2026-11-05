/**
 * @file Capture.tsx
 * @description Photographic specimen capture, client-side downsampling,
 * on-device OCR text extraction, and curatorial cataloging workflow.
 *
 * ARCHITECTURAL DESIGN:
 *   - Offline Optical Character Recognition: Upon image selection, triggers `runOfflineOCR`
 *     to detect physical signage text and flag grammatical warning signs (rogue apostrophes,
 *     repeated words) without network dependencies.
 *   - Educational Value Meter: Displays deterministic scoring breakdown for school & peer challenges.
 *   - Off-screen Downsampling: Compresses raw camera photos into optimized primary (~150KB)
 *     and thumbnail (~20KB) payloads via `compressImage`.
 */

import React, { useState, useRef, useEffect } from 'react';
import { CATEGORIES } from '../utils/constants';
import { compressImage } from '../utils/imageUtils';
import { dbService, Discovery } from '../db/database';
import { runOfflineOCR, OCRResult, isTextRecognitionSupported } from '../utils/ocrService';
import { pointsLedger } from '../utils/pointsLedger';
import { calculateSpecimenScore } from '../utils/proofOfSighting';
import { recordCaptureActivity } from '../utils/dynamicFavicon';
import { IconCamera, IconClose, IconRefresh, IconBolt, IconAlert, IconChevronDown, IconGraduationCap } from '../components/Icons';
import { ClassExpedition } from '../utils/teacherService';

export interface ActiveSpeedBlitzSession {
  /** Shared by both players' devices so their result QRs can be matched. */
  battleId: string;
  role: 'host' | 'join';
  opponentName: string;
  opponentTeam: string;
  opponentTeamTag: string;
  durationMinutes: number;
  startTime: number;
  endTime: number;
  /** Points from fresh, non-duplicate photos taken during the round. Both players start at 0. */
  earnedScore: number;
  specimens: number;
}

/** A photo file modified this recently counts as "just taken" (camera), not an old gallery pick. */
const FRESH_CAPTURE_WINDOW_MS = 30 * 60 * 1000;

interface CaptureProps {
  onSaveComplete: () => void;
  activeBlitz?: ActiveSpeedBlitzSession | null;
  activeClassExpedition?: ClassExpedition | null;
  onFinishBlitz?: () => void;
  onAddBlitzPoints?: (pts: number) => void;
}

export const Capture: React.FC<CaptureProps> = ({
  onSaveComplete,
  activeBlitz,
  activeClassExpedition,
  onFinishBlitz,
  onAddBlitzPoints,
}) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [originalWording, setOriginalWording] = useState('');
  const [intendedWording, setIntendedWording] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  // Speed Blitz countdown (display only; App ends the round even if this screen is closed)
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    activeBlitz ? Math.max(0, Math.floor((activeBlitz.endTime - Date.now()) / 1000)) : 0
  );

  useEffect(() => {
    if (!activeBlitz) return;
    const tick = () => setSecondsRemaining(Math.max(0, Math.floor((activeBlitz.endTime - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeBlitz]);

  const ocrSupported = isTextRecognitionSupported();

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Clean up object URLs on component unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPEG, PNG, WebP, etc.).');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError('Selected image exceeds the 25MB safety limit. Please choose a smaller photo.');
      return;
    }

    try {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }

      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      previewUrlRef.current = previewUrl;
      setImagePreview(previewUrl);
      setError(null);
      setOcrResult(null);

      // On-device text recognition, only where the browser actually supports it
      if (!ocrSupported) return;
      setOcrLoading(true);
      runOfflineOCR(file)
        .then(result => {
          if (!result) return;
          setOcrResult(result);
          // If text was detected and title is empty, pre-fill title suggestion
          if (result.detectedText && !title) {
            setTitle(result.detectedText.slice(0, 40));
          }
          if (result.detectedText && !originalWording) {
            setOriginalWording(result.detectedText);
          }
        })
        .catch(err => {
          console.warn('[Capture] OCR optical scan error:', err);
        })
        .finally(() => {
          setOcrLoading(false);
        });
    } catch {
      setError('Failed to load image preview.');
    }
  };

  const handleRetake = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setImageFile(null);
    setImagePreview(null);
    setOcrResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleManualOCR = async () => {
    if (!imagePreview && !imageFile) return;
    setOcrLoading(true);
    try {
      const source = imageFile || imagePreview!;
      const result = await runOfflineOCR(source);
      if (!result || !result.detectedText) {
        setNotice('No text was recognised in this photo. Type the wording yourself.');
        return;
      }
      setOcrResult(result);
      if (result.detectedText && !originalWording) {
        setOriginalWording(result.detectedText);
      }
    } catch (e) {
      console.warn('Manual OCR error:', e);
    } finally {
      setOcrLoading(false);
    }
  };

  // Calculate estimated points preview for students / hunters
  const estimatedPoints = calculateSpecimenScore({
    id: 'draft', discoveryNumber: 0, thumbnail: 'x', title, category, intendedWording, location, notes,
    createdAt: '', isFavorite: false, isHallOfFame: false, rating: 0,
  }).totalPoints;

  const resetForm = () => {
    handleRetake();
    setTitle('');
    setCategory(CATEGORIES[0]);
    setOriginalWording('');
    setIntendedWording('');
    setLocation('');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageFile && !imagePreview) {
      setError('Please provide a photograph of the typo.');
      return;
    }
    if (!title.trim()) {
      setError('Please provide a title for this discovery.');
      return;
    }

    if (!imageFile) {
      setError('Please provide a photograph of the typo.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const compressed = await compressImage(imageFile);
      const now = Date.now();
      const capturedFresh = typeof imageFile.lastModified === 'number' && now - imageFile.lastModified < FRESH_CAPTURE_WINDOW_MS;
      const id = 'typo_' + now + '_' + Math.random().toString(36).slice(2, 8);
      const duplicateOf = pointsLedger.findDuplicate(compressed.hash, id);

      const nextNum = await dbService.getNextDiscoveryNumber();
      const newDiscovery: Discovery = {
        id,
        discoveryNumber: nextNum,
        thumbnail: compressed.thumbnail,
        title: title.trim(),
        originalWording: originalWording.trim() || undefined,
        intendedWording: intendedWording.trim() || undefined,
        category,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: new Date(now).toISOString(),
        isFavorite: false,
        isHallOfFame: false,
        rating: 0,
        capturedFresh,
        imageHash: compressed.hash || undefined,
        duplicateOf,
        origin: 'own',
      };

      const saved = await dbService.saveDiscovery(newDiscovery, compressed.imageBlob);
      const earned = await pointsLedger.lockDiscovery(saved);
      recordCaptureActivity();

      // Speed Blitz only counts photos taken during the round, never old gallery pictures or repeats.
      let blitzMessage = '';
      if (activeBlitz && onAddBlitzPoints) {
        if (capturedFresh && earned > 0 && now >= activeBlitz.startTime && now <= activeBlitz.endTime) {
          onAddBlitzPoints(earned);
        } else if (!capturedFresh) {
          blitzMessage = ' Not counted for the blitz: only photos taken during the round count.';
        }
      }

      setSaving(false);
      resetForm();
      setNotice(
        duplicateOf
          ? `Saved #${String(nextNum).padStart(3, '0')}. This photo was already scored before, so it earns no points.${blitzMessage}`
          : `Saved #${String(nextNum).padStart(3, '0')} · +${earned} pts locked in.${blitzMessage}`
      );
      onSaveComplete();
    } catch (err) {
      console.error('[Capture] Error cataloging discovery:', err);
      setError('Could not save this discovery. Check that your device has free storage and try again.');
      setSaving(false);
    }
  };

  return (
    <div className="pb-32 px-4 pt-6 max-w-xl mx-auto">
      {/* Active Classroom Expedition Assignment Header */}
      {activeClassExpedition && !activeBlitz && (
        <div className="editorial-card p-4 rounded-2xl bg-[#282722] text-white border-2 border-black shadow-brutal mb-6 box-border">
          <div className="flex justify-between items-center mb-1 flex-wrap gap-1">
            <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#E8B92D]">
              <IconGraduationCap size={14} className="text-[#E8B92D]" />
              Class Field Assignment
            </span>
            <span className="text-xs font-mono font-extrabold text-[#E8B92D] bg-black/40 px-2 py-0.5 rounded border border-white/20">
              Instructor: {activeClassExpedition.instructorName}
            </span>
          </div>
          <h3 className="font-heading font-extrabold text-base text-white mt-1">
            {activeClassExpedition.className}
          </h3>
          <p className="text-[11px] font-mono text-gray-300 mt-0.5">
            Objective: {activeClassExpedition.objective} (Target: {activeClassExpedition.targetPoints} pts)
          </p>
        </div>
      )}

      {/* Active Speed Blitz Battle Header */}
      {activeBlitz && (
        <div className="editorial-card p-4 rounded-2xl bg-[#282722] text-white border-2 border-black shadow-brutal mb-6 box-border">
          <div className="flex justify-between items-center mb-2 flex-wrap gap-1">
            <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#E8B92D]">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              Speed Blitz in progress
            </span>
            <span className="text-xs font-mono font-extrabold text-[#E8B92D] bg-black/40 px-2 py-0.5 rounded border border-white/20">
              Rival: [{activeBlitz.opponentTeamTag}] {activeBlitz.opponentName}
            </span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-white/15 gap-3">
            <div className="min-w-0">
              <div className="font-mono font-black text-3xl sm:text-4xl text-[#E8B92D] tracking-wider leading-none">
                {formatTimer(secondsRemaining)}
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-[11px] font-mono flex-wrap">
                <span className="text-gray-300">
                  Your score: <strong className="text-[#E8B92D] font-bold">{activeBlitz.earnedScore} pts</strong> · {activeBlitz.specimens} photo{activeBlitz.specimens === 1 ? '' : 's'}
                </span>
                <span className="text-gray-400 block w-full">
                  Only photos you take now count. Swap result QRs with your rival at the end.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onFinishBlitz?.()}
              className="btn-primary py-2 px-3 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-sm flex-shrink-0"
            >
              Finish & Settle
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 border-b-2 border-black pb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-mono font-bold tracking-widest text-[#E8B92D] uppercase bg-black px-2 py-0.5 rounded shadow-brutal-sm">
            Field Documentation
          </span>
          <span className="text-[11px] font-mono font-bold text-[#82917B]">
            Est. Value: +{estimatedPoints} pts
          </span>
        </div>
        <h1 className="text-3xl font-extrabold font-heading text-black tracking-tight mt-1">
          Capture Specimen
        </h1>
        <p className="text-xs text-gray-600 font-mono mt-0.5">
          Photograph and catalog a language anomaly from the wild.
        </p>
      </div>

      {error && (
        <div className="bg-[#D66A4A] text-white p-3.5 rounded-xl font-bold text-xs mb-5 border-2 border-black shadow-brutal-sm font-mono flex items-center gap-2" role="alert">
          <IconClose size={14} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="bg-[#EBF3E8] text-[#2D5A27] p-3.5 rounded-xl font-bold text-xs mb-5 border-2 border-black font-mono" role="status">
          {notice}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Photo Upload Zone */}
        <div className="editorial-card p-4 rounded-2xl bg-white text-center">
          {imagePreview ? (
            <div className="relative">
              <div className="w-full h-64 sm:h-72 bg-[#1C1A17] rounded-xl border-2 border-black mb-3 overflow-hidden flex items-center justify-center relative">
                <img src={imagePreview} alt="Preview of specimen" className="w-full h-full object-contain" />
                {ocrLoading && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white font-mono text-xs gap-2">
                    <div className="w-8 h-8 border-3 border-white border-t-[#E8B92D] rounded-full animate-spin" />
                    <span>Reading text on the photo…</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="btn-secondary text-xs font-bold px-4 py-2 rounded-xl uppercase tracking-wider cursor-pointer"
                >
                  <span className="flex items-center gap-1.5"><IconRefresh size={12} /> Retake / Change Photo</span>
                </button>
                {ocrSupported && (
                  <button
                    type="button"
                    onClick={handleManualOCR}
                    disabled={ocrLoading}
                    className="btn-secondary text-xs font-bold px-3 py-2 rounded-xl uppercase tracking-wider cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5"><IconBolt size={12} /> Read Text</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              className="border-2 border-dashed border-black rounded-xl p-8 cursor-pointer hover:bg-[#FAF6EE] transition-colors flex flex-col items-center gap-3"
              role="button"
              tabIndex={0}
              aria-label="Tap to take photo or select from gallery"
            >
              <div className="w-14 h-14 bg-[#E8B92D] border-2 border-black rounded-full flex items-center justify-center shadow-brutal-sm">
                <IconCamera size={26} className="text-black" />
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-base text-black">
                  Tap to Snap or Upload Photo
                </h3>
                <p className="text-xs text-gray-500 font-mono mt-1">
                  Take a photo now, or pick one from your gallery. Old gallery photos don't count in Speed Blitz or class hunts.
                </p>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            aria-label="Upload specimen photograph"
          />
        </div>

        {/* OCR Result Banner */}
        {ocrResult && (
          <div className="editorial-card p-4 rounded-2xl bg-[#FFF9EC] border-2 border-black shadow-brutal-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-black text-[#E8B92D] px-2 py-0.5 rounded">
                <span className="flex items-center gap-1"><IconBolt size={10} /> Text found on photo</span>
              </span>
            </div>

            {ocrResult.detectedText ? (
              <div className="bg-white p-2.5 rounded-xl border border-black/15 font-mono text-xs text-black italic">
                "{ocrResult.detectedText}"
              </div>
            ) : null}

            {ocrResult.detectedMistakeHint && (
              <div className="text-[11px] font-mono font-bold text-[#D66A4A] bg-[#fdf6f4] p-2 rounded-lg border border-[#D66A4A]/30 flex items-center gap-1.5">
                <IconAlert size={14} className="flex-shrink-0" />
                <span>{ocrResult.detectedMistakeHint}</span>
              </div>
            )}

            {ocrResult.detectedText && (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOriginalWording(ocrResult.detectedText)}
                  className="flex-1 btn-secondary text-[11px] font-bold py-1.5 rounded-lg uppercase tracking-wider cursor-pointer"
                >
                  Use as "What It Said"
                </button>
                <button
                  type="button"
                  onClick={() => setTitle(ocrResult.detectedText.slice(0, 40))}
                  className="flex-1 btn-secondary text-[11px] font-bold py-1.5 rounded-lg uppercase tracking-wider cursor-pointer"
                >
                  Use as Title
                </button>
              </div>
            )}
          </div>
        )}

        {/* Core Metadata Fields */}
        <div className="editorial-card p-5 rounded-2xl bg-white space-y-4">
          <div>
            <label htmlFor="title" className="block text-xs font-bold uppercase tracking-wider font-heading mb-1 text-black">
              Discovery Title <span className="text-[#D66A4A]">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Menacing Soup Sign"
              required
              className="w-full p-3 border-2 border-black rounded-xl text-sm font-bold font-heading focus:outline-none focus:bg-[#FFFDF9]"
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-xs font-bold uppercase tracking-wider font-heading mb-1 text-black">
              Category <span className="text-[#D66A4A]">*</span>
            </label>
            <div className="relative">
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full pl-3.5 pr-10 py-3 border-2 border-black rounded-xl text-sm font-bold bg-white focus:outline-none focus:bg-[#FFFDF9] cursor-pointer appearance-none shadow-brutal-sm"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-black flex items-center justify-center">
                <IconChevronDown size={18} />
              </div>
            </div>
          </div>
        </div>

        {/* Wording Comparison & Details */}
        <div className="editorial-card p-5 rounded-2xl bg-white space-y-4">
          <div className="border-b border-gray-100 pb-2 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-widest font-heading text-gray-500">
              Grammar & Wording Analysis
            </h3>
            <span className="text-[10px] font-mono font-bold text-[#82917B]">+30 pts for analysis</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="written" className="block text-xs font-bold uppercase tracking-wider font-heading mb-1 text-[#D66A4A]">
                What It Actually Said:
              </label>
              <input
                id="written"
                type="text"
                value={originalWording}
                maxLength={200}
                onChange={(e) => setOriginalWording(e.target.value)}
                placeholder="e.g. Coffe and Trea"
                className="w-full p-2.5 border-2 border-black rounded-xl text-sm font-mono focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="intended" className="block text-xs font-bold uppercase tracking-wider font-heading mb-1 text-[#82917B]">
                What They Meant (Correction):
              </label>
              <input
                id="intended"
                type="text"
                value={intendedWording}
                maxLength={200}
                onChange={(e) => setIntendedWording(e.target.value)}
                placeholder="e.g. Coffee and Tea"
                className="w-full p-2.5 border-2 border-black rounded-xl text-sm font-mono focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="location" className="block text-xs font-bold uppercase tracking-wider font-heading mb-1 text-black">
              Location Label (+10 pts)
            </label>
            <input
              id="location"
              type="text"
              value={location}
              maxLength={120}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Corner Bakery, Downtown"
              className="w-full p-2.5 border-2 border-black rounded-xl text-sm font-medium focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-xs font-bold uppercase tracking-wider font-heading mb-1 text-black">
              Field Notes & Curatorial Observations (+10 pts)
            </label>
            <textarea
              id="notes"
              value={notes}
              maxLength={500}
              rows={3}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record the comedic context, how long it was displayed, or what caused the typo..."
              className="w-full p-2.5 border-2 border-black rounded-xl text-xs font-mono focus:outline-none"
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full btn-primary py-4 rounded-xl text-sm font-extrabold uppercase tracking-wider cursor-pointer shadow-brutal disabled:opacity-50"
          >
            {saving ? 'Saving…' : `Archive Specimen (+${estimatedPoints} pts)`}
          </button>
        </div>
      </form>
    </div>
  );
};
