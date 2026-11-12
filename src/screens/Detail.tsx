/**
 * @file Detail.tsx
 * @description Comprehensive specimen dossier view with full-resolution photograph rendering,
 * side-by-side wording comparison, funniness scoring, metadata inspector, and canvas share integration.
 *
 * ARCHITECTURAL DESIGN:
 *   - Atomic Mutations: Toggling favorites, Hall of Fame induction, and funniness scores invoke
 *     `dbService.saveDiscovery` with immutable state updates, followed by parent callback hydration.
 *   - Rating Toggle Pattern: Clicking an active star rating toggles it off (sets to 0), avoiding
 *     locked score traps.
 *   - Native Share Integration: Bridges to `generateShareCardBlob` with Web Share API and JPEG download fallback.
 */

import React, { useState, useRef } from 'react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { Discovery, dbService } from '../db/database';
import { CATEGORIES } from '../utils/constants';
import { generateShareCardBlob } from '../utils/shareCard';
import { generateProofOfSighting } from '../utils/proofOfSighting';
import { pointsLedger } from '../utils/pointsLedger';
import { useDiscoveryImage } from '../hooks/useDiscoveryImage';
import { ReadByAppBadge } from '../components/ReadByAppBadge';
import { SharePublicly } from '../components/SharePublicly';
import { IconHeart, IconTrophy, IconStar, IconArrowLeft, IconChevronDown } from '../components/Icons';

interface DetailProps {
  discovery: Discovery;
  onBack: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}

export const Detail: React.FC<DetailProps> = ({ discovery, onBack, onUpdate, onDelete }) => {
  const [sharing, setSharing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(discovery.title);
  const [originalWording, setOriginalWording] = useState(discovery.originalWording || '');
  const [intendedWording, setIntendedWording] = useState(discovery.intendedWording || '');
  const [category, setCategory] = useState(discovery.category);
  const [location, setLocation] = useState(discovery.location || '');
  const [notes, setNotes] = useState(discovery.notes || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const proof = generateProofOfSighting(discovery);
  const lockedPoints = pointsLedger.getEntry(discovery.id)?.points ?? 0;
  const fullImage = useDiscoveryImage(discovery.id, discovery.thumbnail);
  const [actionError, setActionError] = useState<string | null>(null);
  const editDialogRef = useRef<HTMLDivElement>(null);
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(editDialogRef, isEditing, () => setIsEditing(false));
  useDialogA11y(deleteDialogRef, showDeleteConfirm, () => setShowDeleteConfirm(false));

  // Every mutation reports failure instead of failing silently.
  const persist = async (updated: Discovery): Promise<boolean> => {
    try {
      const saved = await dbService.saveDiscovery(updated);
      await pointsLedger.lockDiscovery(saved);
      setActionError(null);
      onUpdate();
      return true;
    } catch (err) {
      console.error('[Detail] Save failed', err);
      setActionError('Could not save that change. Check your device storage and try again.');
      return false;
    }
  };

  const toggleFavorite = async () => {
    await persist({ ...discovery, isFavorite: !discovery.isFavorite });
  };

  const toggleHallOfFame = async () => {
    await persist({ ...discovery, isHallOfFame: !discovery.isHallOfFame });
  };

  const handleRating = async (rating: number) => {
    const newRating = rating === discovery.rating ? 0 : rating;
    await persist({ ...discovery, rating: newRating });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...discovery,
      title: title.trim(),
      category,
      originalWording: originalWording.trim() || undefined,
      intendedWording: intendedWording.trim() || undefined,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    if (!updated.title) {
      setActionError('A title is required.');
      return;
    }
    if (await persist(updated)) setIsEditing(false);
  };

  const handleShareCard = async () => {
    setSharing(true);
    try {
      const blob = await generateShareCardBlob(discovery);
      const file = new File([blob], `typo-hunter-${discovery.discoveryNumber}.jpg`, { type: 'image/jpeg' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: discovery.title,
          text: `Spotted in the wild: "${discovery.originalWording || discovery.title}" #TypoHunter`,
          files: [file],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `typo-hunter-specimen-${discovery.discoveryNumber}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="pb-32 px-4 pt-6 max-w-xl mx-auto">
      {/* Top Header Navigation */}
      <div className="flex justify-between items-center mb-5 border-b-2 border-black pb-3">
        <button
          onClick={onBack}
          className="text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer hover:text-[#D66A4A] transition-colors py-1 px-2 -ml-2 rounded-lg"
          aria-label="Back to Collection"
        >
          <IconArrowLeft size={16} />
          <span>Back to Archive</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold bg-black text-[#E8B92D] px-2.5 py-1 rounded shadow-brutal-sm">
            Specimen #{String(discovery.discoveryNumber).padStart(3, '0')}
          </span>
        </div>
      </div>

      {/* Main Specimen Dossier Card */}
      <article className="editorial-card rounded-2xl overflow-hidden bg-white mb-6">
        {/* Specimen Photograph */}
        <div className="relative bg-[#1C1A17] flex items-center justify-center border-b-2 border-black max-h-[460px] overflow-hidden">
          <img 
 src={fullImage} 
            alt={discovery.title} 
            className="w-full h-auto max-h-[460px] object-contain" 
          />
          <div className="absolute top-3 left-3">
            <span className="bg-[#E8B92D] text-black text-xs font-bold px-2.5 py-1 rounded border-2 border-black uppercase tracking-wider shadow-brutal-sm">
              {discovery.category}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Title & Quick Actions */}
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-black leading-tight">
                {discovery.title}
              </h1>
              {discovery.readByApp && (
                <div className="mt-1.5">
                  <ReadByAppBadge />
                </div>
              )}
            </div>

            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={toggleFavorite}
                className={`p-2.5 rounded-xl border-2 border-black font-bold text-sm cursor-pointer shadow-brutal-sm transition-all ${
                  discovery.isFavorite ? 'bg-[#D66A4A] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title={discovery.isFavorite ? 'Favorited' : 'Add to Favorites'}
                aria-label={discovery.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                aria-pressed={discovery.isFavorite}
              >
                <IconHeart size={18} filled={discovery.isFavorite} />
              </button>
              <button
                onClick={toggleHallOfFame}
                className={`p-2.5 rounded-xl border-2 border-black font-bold text-xs cursor-pointer shadow-brutal-sm transition-all ${
                  discovery.isHallOfFame ? 'bg-black text-[#E8B92D]' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title={discovery.isHallOfFame ? 'Hall of Fame Inductee' : 'Nominate to Hall of Fame'}
                aria-label={discovery.isHallOfFame ? 'Remove from Hall of Fame' : 'Nominate to Hall of Fame'}
                aria-pressed={discovery.isHallOfFame}
              >
                <IconTrophy size={18} filled={discovery.isHallOfFame} />
              </button>
            </div>
          </div>

          {/* Wording Dossier Comparison */}
          {(discovery.originalWording || discovery.intendedWording) && (
            <div className="bg-[#F4EBDD] p-4 rounded-xl border-2 border-black space-y-3 font-mono">
              {discovery.originalWording && (
                <div>
                  <span className="text-[10px] font-bold text-[#D66A4A] uppercase tracking-wider block mb-0.5">
                    Actual Written Text:
                  </span>
                  <p className="text-base font-bold text-black italic">
                    "{discovery.originalWording}"
                  </p>
                </div>
              )}
              {discovery.intendedWording && (
                <div className="pt-2 border-t border-black/10">
                  <span className="text-[10px] font-bold text-[#82917B] uppercase tracking-wider block mb-0.5">
                    Likely Intended:
                  </span>
                  <p className="text-sm font-semibold text-gray-800 italic">
                    "{discovery.intendedWording}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Funniness Rating Stars */}
          <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 font-heading block mb-1">
                Funniness Rating
              </span>
              <div className="flex gap-1 items-center" role="group" aria-label={`Rating: ${discovery.rating} out of 5`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRating(star)}
                    className="cursor-pointer p-0.5 hover:scale-110 transition-transform"
                    aria-label={`${star} star${star !== 1 ? 's' : ''}`}
                    aria-pressed={star <= discovery.rating}
                  >
                    <IconStar
                      size={24}
                      filled={star <= discovery.rating}
                      className={star <= discovery.rating ? 'text-[#E8B92D]' : 'text-gray-300'}
                    />
                  </button>
                ))}
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-gray-500">
              {discovery.rating > 0 ? `${discovery.rating} / 5 Rating` : 'Unrated'}
            </span>
          </div>

          {/* Metadata Dossier */}
          <dl className="text-xs space-y-2 pt-3 border-t border-gray-100 font-mono text-gray-700">
            {discovery.location && (
              <div className="flex justify-between">
                <dt className="font-bold text-gray-500 uppercase">Location:</dt>
                <dd className="font-medium text-right text-black">{discovery.location}</dd>
              </div>
            )}
            {discovery.notes && (
              <div className="pt-1">
                <dt className="font-bold text-gray-500 uppercase mb-0.5">Hunter Notes:</dt>
                <dd className="font-medium text-black bg-[#FAF6EE] p-2.5 rounded-lg border border-black/10 italic">
                  {discovery.notes}
                </dd>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-dashed border-gray-200">
              <dt className="font-bold text-gray-400 uppercase">Archived Date:</dt>
              <dd className="text-gray-500">{new Date(discovery.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</dd>
            </div>
          </dl>

          {/* Points for this entry */}
          <div className="bg-[#FFF9EC] p-3.5 rounded-xl border-2 border-black shadow-brutal-sm space-y-2 font-mono">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-black text-[#E8B92D] px-2 py-0.5 rounded">
                Points
              </span>
              <span className="text-xs font-bold font-heading text-black">
                {lockedPoints} pts locked
              </span>
            </div>

            {proof.score.eligible ? (
              <div className="flex flex-wrap gap-1.5 text-[10px] pt-1">
                <span className="bg-white px-2 py-0.5 rounded border border-black/20">Photo +{proof.score.basePoints}</span>
                {proof.score.correctionBonus > 0 && (
                  <span className="bg-white px-2 py-0.5 rounded border border-black/20 text-[#82917B] font-bold">Correction +30</span>
                )}
                <span className="bg-white px-2 py-0.5 rounded border border-black/20">Category +{proof.score.categorizationBonus}</span>
                {proof.score.fieldNotesBonus > 0 && (
                  <span className="bg-white px-2 py-0.5 rounded border border-black/20">Context +{proof.score.fieldNotesBonus}</span>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-gray-700">No points: {proof.score.ineligibleReason?.toLowerCase()}.</p>
            )}

            <p className="text-[10px] text-gray-600 pt-1 border-t border-black/10">
              Stars and Legends are your personal picks and don't add points. Points stay locked even if you delete this photo.
              {discovery.sourceHunter && ` Imported from ${discovery.sourceHunter}.`}
            </p>
            <p className="text-[10px] text-gray-400">Record ID: <code>{proof.verificationHash}</code></p>
          </div>

          <SharePublicly discovery={discovery} onChanged={onUpdate} />

          {actionError && (
            <div className="bg-[#D66A4A] text-white p-2.5 rounded-xl text-xs font-bold font-mono border-2 border-black" role="alert">
              {actionError}
            </div>
          )}

          {/* Action Bar */}
          <div className="pt-4 flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={handleShareCard}
              disabled={sharing}
              className="flex-1 btn-primary py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <span>{sharing ? 'Rendering Card…' : 'Export Share Card'}</span>
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="btn-secondary flex-1 sm:flex-none py-3 px-4 rounded-xl text-xs font-extrabold uppercase tracking-wider"
              >
                Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn-danger flex-1 sm:flex-none py-3 px-4 rounded-xl text-xs font-extrabold uppercase tracking-wider"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </article>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" ref={editDialogRef} role="dialog" aria-modal="true" aria-label="Edit specimen">
          <div className="editorial-card bg-white p-5 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-extrabold font-heading mb-4">Edit Specimen Dossier</h2>
            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label htmlFor="edit-title" className="block text-xs font-bold uppercase mb-1 font-heading">Title</label>
                <input id="edit-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2.5 border-2 border-black rounded-lg text-sm font-medium" required />
              </div>
              <div>
                <label htmlFor="edit-category" className="block text-xs font-bold uppercase mb-1 font-heading">Category</label>
                <div className="relative">
                  <select
                    id="edit-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full pl-3 pr-9 py-2.5 border-2 border-black rounded-lg text-sm font-medium bg-white appearance-none cursor-pointer"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black flex items-center justify-center">
                    <IconChevronDown size={16} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-written" className="block text-xs font-bold uppercase mb-1 text-[#D66A4A] font-heading">As Written</label>
                  <input id="edit-written" type="text" value={originalWording} onChange={(e) => setOriginalWording(e.target.value)} className="w-full p-2.5 border-2 border-black rounded-lg text-sm font-mono" />
                </div>
                <div>
                  <label htmlFor="edit-intended" className="block text-xs font-bold uppercase mb-1 text-[#82917B] font-heading">Intended</label>
                  <input id="edit-intended" type="text" value={intendedWording} onChange={(e) => setIntendedWording(e.target.value)} className="w-full p-2.5 border-2 border-black rounded-lg text-sm font-mono" />
                </div>
              </div>
              <div>
                <label htmlFor="edit-location" className="block text-xs font-bold uppercase mb-1 font-heading">Location Label</label>
                <input id="edit-location" type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full p-2.5 border-2 border-black rounded-lg text-sm" />
              </div>
              <div>
                <label htmlFor="edit-notes" className="block text-xs font-bold uppercase mb-1 font-heading">Notes</label>
                <textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full p-2.5 border-2 border-black rounded-lg text-sm resize-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 btn-primary py-2.5 rounded-xl text-xs font-bold uppercase">Save Changes</button>
                <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary py-2.5 px-4 rounded-xl text-xs font-bold uppercase">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" ref={deleteDialogRef} role="dialog" aria-modal="true" aria-label="Confirm delete">
          <div className="editorial-card bg-white p-6 rounded-2xl max-w-sm w-full text-center">
            <h3 className="font-heading font-extrabold text-xl mb-2 text-black">Remove Specimen?</h3>
            <p className="text-xs text-gray-600 mb-6 leading-relaxed">
              This will permanently delete this discovery from your local museum archive. This cannot be undone.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={async () => {
                  try {
                    await dbService.deleteDiscovery(discovery.id);
                    onDelete();
                  } catch (err) {
                    console.error('[Detail] Delete failed', err);
                    setShowDeleteConfirm(false);
                    setActionError('Could not delete this entry. Please try again.');
                  }
                }}
                className="flex-1 btn-danger py-2.5 rounded-xl text-xs font-extrabold uppercase"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 btn-secondary py-2.5 rounded-xl text-xs font-extrabold uppercase"
              >
                Keep
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
