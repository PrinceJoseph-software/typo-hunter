/**
 * @file Profile.tsx
 * @description Curator profile, on-device telemetry metrics, milestone gamification,
 * point scoring, and checksummed JSON backup import/export.
 *
 * ARCHITECTURAL DESIGN:
 * Unlike conventional consumer applications that tie user identity to centralized authentication
 * systems (Firebase, Supabase, OAuth), TYPO HUNTER operates under a sovereign, zero-cloud model:
 *   - Identity: Stored locally in `localStorage` under `typo_hunter_nickname`.
 *   - Academic Scoring: Deterministic point calculation for school competitions & peer challenges.
 *   - Backups: JSON exports carry a SHA-256 checksum that detects accidental damage
 *     (not a security signature).
 *   - Telemetry: Metrics (specimen counts, category distribution, earliest discovery timestamp)
 *     are dynamically computed from IndexedDB without background tracking.
 *   - Milestones: Evaluated declaratively against the local dataset without coercive habit loops.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Discovery, dbService } from '../db/database';
import {
  IconCheck,
  IconLock,
  IconShield,
  IconClose,
  IconAlert,
  IconDownload,
  IconSwords,
  IconCamera,
  IconGraduationCap,
} from '../components/Icons';
import { CuratorPassModal } from '../components/CuratorPassModal';
import { PrivacyModal } from '../components/PrivacyModal';
import { createArchiveExportBlob, downloadBlob, verifyAndUnpackArchive } from '../utils/archiveSecurity';
import { calculateSpecimenScore } from '../utils/proofOfSighting';
import { useHunterPoints } from '../hooks/useHunterPoints';
import { pointsLedger } from '../utils/pointsLedger';
import { NotificationSettingsCard } from '../components/NotificationSettingsCard';

interface ProfileProps {
  discoveries: Discovery[];
  nickname: string;
  onUpdateNickname: (name: string) => void;
  onImportComplete: () => void;
  onOpenHelp?: () => void;
  onOpenPvp?: () => void;
  onOpenTeacherMode?: () => void;
  canInstall?: boolean;
  isInstalled?: boolean;
  onInstall?: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ 
  discoveries, 
  nickname, 
  onUpdateNickname, 
  onImportComplete, 
  onOpenHelp,
  onOpenPvp,
  onOpenTeacherMode,
  canInstall,
  isInstalled,
  onInstall,
}) => {
  const [localNickname, setLocalNickname] = useState(nickname);
  const [savedMessage, setSavedMessage] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    type: 'idle' | 'success' | 'tampered' | 'error';
    message: string;
  }>({ type: 'idle', message: '' });
  const [storageStats, setStorageStats] = useState<{ usedFormatted: string; quotaFormatted: string; percentage: number } | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [sessionStartTime] = useState(() => {
    let start = sessionStorage.getItem('typo_session_start');
    if (!start) {
      start = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      sessionStorage.setItem('typo_session_start', start);
    }
    return start;
  });
  const [sessionEnded, setSessionEnded] = useState(false);

  const handleEndSession = () => {
    sessionStorage.removeItem('typo_session_start');
    sessionStorage.clear();
    setSessionEnded(true);
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  useEffect(() => {
    setLocalNickname(nickname);
  }, [nickname]);

  useEffect(() => {
    dbService.getStorageEstimate().then(setStorageStats);
  }, [discoveries]);

  const handleSaveNickname = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = localNickname.trim() || 'Hunter';
    localStorage.setItem('typo_hunter_nickname', cleanName);
    onUpdateNickname(cleanName);
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2000);
  };

  // Backup export (checksummed, not signed)
  const exportJSON = async () => {
    setIsExporting(true);
    try {
      const blob = await createArchiveExportBlob(discoveries, nickname);
      downloadBlob(blob, `typo-hunter-backup-${new Date().toISOString().split('T')[0]}.json`);
    } catch {
      setImportFeedback({
        type: 'error',
        message: 'Could not create the backup file. Please try again.',
      });
      setTimeout(() => setImportFeedback({ type: 'idle', message: '' }), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  // Backup import: own backup restores; anyone else's becomes view-only
  const importJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const result = await verifyAndUnpackArchive(text);

        if (!result.isValid) {
          if (result.isTampered) {
            setImportFeedback({
              type: 'tampered',
              message: result.statusMessage,
            });
          } else {
            setImportFeedback({
              type: 'error',
              message: result.statusMessage || 'Invalid archive format. Ensure file is a valid Typo Hunter export.',
            });
          }
          setTimeout(() => setImportFeedback({ type: 'idle', message: '' }), 6000);
          return;
        }

        // Your own backup → restore entries and locked points.
        // Anyone else's file → view-only copies that never count toward your points.
        let importedCount = 0;
        let nextNumber = await dbService.getNextDiscoveryNumber();
        const sourceKey = (result.ownerId || result.hunterName || 'unknown').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || 'unknown';
        for (const item of result.discoveries) {
          try {
            if (result.isOwnBackup) {
              await dbService.saveDiscovery({ ...item, origin: 'own' });
            } else {
              const foreignId = `imp_${sourceKey}_${String(item.id).slice(0, 40)}`;
              const existing = discoveries.find(d => d.id === foreignId);
              await dbService.saveDiscovery({
                ...item,
                id: foreignId,
                discoveryNumber: existing ? existing.discoveryNumber : nextNumber++,
                origin: 'imported',
                sourceHunter: item.sourceHunter || result.hunterName || 'another hunter',
                duplicateOf: undefined,
              });
            }
            importedCount++;
          } catch {
            // Skip invalid records
          }
        }
        if (result.isOwnBackup && result.pointsLedger) {
          await pointsLedger.merge(result.pointsLedger);
        }

        if (importedCount > 0) {
          onImportComplete();
          setImportFeedback({
            type: 'success',
            message: result.isOwnBackup
              ? `Restored ${importedCount} entr${importedCount === 1 ? 'y' : 'ies'} and your locked points from your backup.`
              : `Added ${importedCount} entr${importedCount === 1 ? 'y' : 'ies'} from ${result.hunterName || 'another hunter'}. Imported entries are view-only and don't count toward your points.`,
          });
        } else {
          setImportFeedback({
            type: 'error',
            message: 'No valid entries could be read from this file.',
          });
        }
        setTimeout(() => setImportFeedback({ type: 'idle', message: '' }), 5000);
      } catch {
        setImportFeedback({
          type: 'error',
          message: 'Failed to read or parse archive file.',
        });
        setTimeout(() => setImportFeedback({ type: 'idle', message: '' }), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const count = discoveries.length;
  const favCount = discoveries.filter(d => d.isFavorite).length;
  const hofCount = discoveries.filter(d => d.isHallOfFame).length;

  // Curatorial Points Calculation & Breakdown
  const totalPoints = useHunterPoints();
  const scoreBreakdown = useMemo(() => {
    return discoveries.reduce(
      (acc, d) => {
        const s = calculateSpecimenScore(d);
        acc.photos += s.basePoints;
        acc.corrections += s.correctionBonus;
        acc.categories += s.categorizationBonus;
        acc.notes += s.fieldNotesBonus;
        return acc;
      },
      { photos: 0, corrections: 0, categories: 0, notes: 0 }
    );
  }, [discoveries]);

  // Category frequency breakdown
  const categoryCounts: Record<string, number> = {};
  discoveries.forEach(d => {
    categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
  });
  const uniqueCategoriesCount = Object.keys(categoryCounts).length;
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None yet';

  // Temporal analysis: First cataloged discovery
  const oldestDiscovery = discoveries.length > 0 
    ? [...discoveries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]
    : null;

  // Declarative milestones
  const milestones = [
    { name: 'First Blood', description: 'Catalog your first discovery', achieved: count >= 1 },
    { name: 'Category Explorer', description: 'Spot typos across 3+ categories', achieved: uniqueCategoriesCount >= 3 },
    { name: 'Street Detective', description: 'Reach 10 cataloged specimens', achieved: count >= 10 },
    { name: 'Word Archaeologist', description: 'Reach 25 cataloged specimens', achieved: count >= 25 },
    { name: 'The Curator', description: 'Reach 50 cataloged specimens', achieved: count >= 50 },
    { name: 'Museum Director', description: 'Enshrine 100 discoveries in total', achieved: count >= 100 },
  ];

  return (
    <div className="pb-32 px-4 pt-6 max-w-xl mx-auto">
      {/* Editorial Header */}
      <div className="mb-6 border-b-2 border-black pb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-mono font-bold tracking-widest text-[#D66A4A] uppercase block">
            Museum Staff Dossier
          </span>
          {onOpenHelp && (
            <button
              onClick={onOpenHelp}
              className="text-xs font-mono font-bold text-[#D66A4A] hover:underline cursor-pointer flex items-center gap-1"
            >
              Field Guide & FAQ
            </button>
          )}
        </div>
        <h1 className="text-3xl font-extrabold font-heading text-black tracking-tight mt-1">
          Curator Profile
        </h1>
        <p className="text-xs text-gray-600 mt-1 font-mono">
          Private on-device credentials, academic points, and museum statistics.
        </p>
      </div>

      {/* Novice Empty State Callout when archive has 0 specimens */}
      {count === 0 && (
        <div className="editorial-card p-5 rounded-2xl bg-[#FFF9EC] border-2 border-black mb-6 shadow-brutal-sm text-center">
          <div className="w-12 h-12 bg-white border-2 border-black rounded-full flex items-center justify-center mx-auto mb-2.5 shadow-brutal-sm">
            <IconCamera size={22} className="text-[#D66A4A]" />
          </div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-black bg-[#E8B92D] px-2 py-0.5 rounded border border-black inline-block mb-1">
            Curator Level: Apprentice Scout
          </span>
          <h3 className="font-heading font-extrabold text-base text-black mb-1">
            Dossier Ready for First Expedition
          </h3>
          <p className="text-xs font-mono text-gray-600 max-w-sm mx-auto leading-relaxed mb-3">
            Your curatorial points, category exploration, and milestone awards will activate once you log your first specimen in the wild.
          </p>
        </div>
      )}

      {/* Offline P2P Curator Pass Hero Card */}
      <div className="editorial-card p-4 rounded-2xl bg-[#FFF9EC] mb-6 border-2 border-black shadow-brutal-sm">
        <div className="flex items-center justify-between mb-3 border-b border-black/10 pb-2">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-[#D66A4A] uppercase block">
              Offline P2P Competition & Teams
            </span>
            <h3 className="font-heading font-extrabold text-base text-black mt-0.5">
              Curator Pass & Battle Arena
            </h3>
            <p className="text-[11px] font-mono text-gray-600 mt-0.5">
              Compare rank, join a squad, duel rivals, and track timed speed hunts
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setShowPass(true)}
            className="flex-1 btn-primary py-2.5 px-3 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer text-center"
          >
            Show QR Pass
          </button>
          {onOpenPvp && (
            <button
              onClick={onOpenPvp}
              className="flex-1 btn-secondary py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer text-center flex items-center justify-center gap-1.5"
            >
              <IconSwords size={13} className="text-[#D66A4A]" />
              <span>PvP & Squads</span>
            </button>
          )}
          {onOpenTeacherMode && (
            <button
              onClick={onOpenTeacherMode}
              className="flex-1 btn-secondary py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer text-center flex items-center justify-center gap-1.5"
            >
              <IconGraduationCap size={14} className="text-[#D66A4A]" />
              <span>Teacher Mode</span>
            </button>
          )}
        </div>
      </div>

      {/* Curatorial Score & Classroom Point System */}
      <div className="editorial-card p-5 rounded-2xl bg-white mb-6 border-2 border-black shadow-brutal-sm">
        <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-3">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-[#D66A4A] uppercase block">
              Academic Scoring Engine
            </span>
            <h2 className="font-heading font-extrabold text-lg text-black">
              Total Curatorial Points
            </h2>
          </div>
          <div className="bg-[#E8B92D] border-2 border-black px-3.5 py-1.5 rounded-xl shadow-brutal-sm text-center">
            <span className="font-heading font-extrabold text-2xl text-black leading-none block">
              {totalPoints}
            </span>
            <span className="text-[10px] font-mono font-bold uppercase text-black">POINTS</span>
          </div>
        </div>

        <p className="text-xs font-mono text-gray-600 mb-3 leading-relaxed">
          Points come from how fully you document each typo: photo, correction, category, location and notes (up to 120 per photo).
        </p>

        {/* Detailed Points Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
          <div className="bg-[#FAF6EE] p-2.5 rounded-xl border border-black/15">
            <span className="text-gray-500 uppercase text-[10px] block">Photo Evidence</span>
            <span className="font-bold text-black text-sm">{scoreBreakdown.photos} pts</span>
            <span className="text-[10px] text-gray-500 block">+50 / photo</span>
          </div>
          <div className="bg-[#FAF6EE] p-2.5 rounded-xl border border-black/15">
            <span className="text-gray-500 uppercase text-[10px] block">Linguistic Analysis</span>
            <span className="font-bold text-black text-sm">{scoreBreakdown.corrections} pts</span>
            <span className="text-[10px] text-gray-500 block">+30 / fix</span>
          </div>
          <div className="bg-[#FAF6EE] p-2.5 rounded-xl border border-black/15">
            <span className="text-gray-500 uppercase text-[10px] block">Category Label</span>
            <span className="font-bold text-black text-sm">{scoreBreakdown.categories} pts</span>
            <span className="text-[10px] text-gray-500 block">+20 / category</span>
          </div>
          <div className="bg-[#FAF6EE] p-2.5 rounded-xl border border-black/15">
            <span className="text-gray-500 uppercase text-[10px] block">Field Context</span>
            <span className="font-bold text-black text-sm">{scoreBreakdown.notes} pts</span>
            <span className="text-[10px] text-gray-500 block">+10-20 notes</span>
          </div>
        </div>

        <p className="mt-3 pt-2.5 border-t border-black/10 text-[11px] font-mono text-gray-600 leading-relaxed">
          The breakdown covers the entries you have now. Your total is locked: points stay even after you delete photos.
          Star ratings and Legends are personal picks and don't earn points. Repeated photos and imported entries earn nothing.
        </p>
      </div>

      {/* Nickname Stamped Card */}
      <div className="editorial-card p-5 rounded-2xl bg-white mb-6">
        <form onSubmit={handleSaveNickname} className="space-y-3">
          <label htmlFor="nickname" className="block text-xs font-bold uppercase tracking-wider font-heading">
            Hunter Display Name
          </label>
          <div className="flex gap-2">
            <input
              id="nickname"
              type="text"
              value={localNickname}
              onChange={(e) => setLocalNickname(e.target.value)}
              placeholder="e.g. Master Hunter"
              className="flex-1 p-2.5 border-2 border-black rounded-xl text-sm font-bold font-heading focus:outline-none"
            />
            <button type="submit" className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider">
              Save
            </button>
          </div>
          {savedMessage && (
            <p className="text-xs text-[#82917B] font-bold font-mono flex items-center gap-1.5" role="status">
              <IconCheck size={14} />
              <span>Display name updated.</span>
            </p>
          )}
        </form>
      </div>

      {/* Collection Statistics Grid */}
      <div className="editorial-card p-5 rounded-2xl bg-white mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest font-heading text-gray-500 mb-3">
          Museum Archive Metrics
        </h2>
        
        <div className="grid grid-cols-3 gap-2.5 text-center mb-4">
          <div className="bg-[#FAF6EE] p-3 rounded-xl border border-black/20">
            <span className="text-3xl font-extrabold font-heading text-black block leading-none">{count}</span>
            <span className="text-[10px] font-mono uppercase text-gray-600 font-bold block mt-1">Specimens</span>
          </div>
          <div className="bg-[#FAF6EE] p-3 rounded-xl border border-black/20">
            <span className="text-3xl font-extrabold font-heading text-[#D66A4A] block leading-none">{favCount}</span>
            <span className="text-[10px] font-mono uppercase text-gray-600 font-bold block mt-1">Favorites</span>
          </div>
          <div className="bg-[#FAF6EE] p-3 rounded-xl border border-black/20">
            <span className="text-3xl font-extrabold font-heading text-[#E8B92D] block leading-none">{hofCount}</span>
            <span className="text-[10px] font-mono uppercase text-gray-600 font-bold block mt-1">Legends</span>
          </div>
        </div>

        <dl className="text-xs space-y-2 pt-3 border-t border-gray-100 font-mono text-gray-700">
          <div className="flex justify-between">
            <dt className="text-gray-500 uppercase">Top Category:</dt>
            <dd className="font-bold text-black">{topCategory}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500 uppercase">First Specimen Date:</dt>
            <dd className="font-bold text-black">
              {oldestDiscovery 
                ? new Date(oldestDiscovery.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
                : 'None cataloged'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500 uppercase">Categories Explored:</dt>
            <dd className="font-bold text-black">{uniqueCategoriesCount} of 8</dd>
          </div>
          {storageStats && (
            <div className="flex justify-between pt-1 border-t border-dashed border-gray-200">
              <dt className="text-gray-500 uppercase">IndexedDB Disk Usage:</dt>
              <dd className="font-bold text-black">
                {storageStats.usedFormatted} of {storageStats.quotaFormatted} ({storageStats.percentage}% quota)
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Milestones & Badges */}
      <div className="editorial-card p-5 rounded-2xl bg-white mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest font-heading text-gray-500 mb-3">
          Curator Milestones ({milestones.filter(m => m.achieved).length} of {milestones.length})
        </h2>
        <div className="space-y-2.5">
          {milestones.map((m) => (
            <div
              key={m.name}
              className={`p-3 rounded-xl border-2 border-black flex justify-between items-center transition-all ${
                m.achieved ? 'bg-[#FFF9EC] shadow-brutal-sm' : 'bg-gray-50 opacity-50'
              }`}
            >
              <div>
                <h4 className="font-heading font-extrabold text-sm text-black">{m.name}</h4>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{m.description}</p>
              </div>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-1 rounded border border-black flex items-center gap-1 ${
                  m.achieved ? 'bg-black text-[#E8B92D]' : 'bg-white text-gray-400'
                }`}
              >
                {m.achieved ? (
                  <>
                    <IconCheck size={11} />
                    <span>Unlocked</span>
                  </>
                ) : (
                  <>
                    <IconLock size={11} />
                    <span>Locked</span>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Progressive Web App (PWA) Standalone Installation */}
      <div className="editorial-card p-5 rounded-2xl bg-[#FFF9EC] mb-6 border-2 border-black shadow-brutal-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-black text-[#E8B92D] px-2 py-0.5 rounded">
            {isInstalled ? 'Installed Native App' : 'Progressive Web App'}
          </span>
          <span className="text-[10px] font-mono text-gray-500 font-bold">100% Offline</span>
        </div>
        <h3 className="font-heading font-extrabold text-base text-black">
          {isInstalled ? 'Running as Installed Application' : 'Install Typo Hunter on Your Device'}
        </h3>
        <p className="text-xs font-mono text-gray-600 mt-1 leading-relaxed">
          {isInstalled
            ? 'Typo Hunter is running directly from your home screen with zero network latency and full offline local database access.'
            : 'Install this visual museum onto your home screen or desktop. Works offline with camera capture and instant local archiving.'}
        </p>

        {!isInstalled && (
          <div className="mt-3">
            {canInstall && onInstall ? (
              <button
                onClick={onInstall}
                className="w-full btn-primary py-3 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                + Install Typo Hunter Now
              </button>
            ) : (
              <div className="bg-white border border-black/20 rounded-xl p-3 text-[11px] font-mono text-gray-700 space-y-1">
                <p className="font-bold text-black uppercase text-[10px] tracking-wider">How to install on this device:</p>
                <p>• <strong>Chrome / Edge (Desktop):</strong> Click the install icon in the address bar (or Menu → "Install Typo Hunter").</p>
                <p>• <strong>Safari (iOS):</strong> Tap the <em>Share</em> button (square with arrow) → <em>"Add to Home Screen"</em>.</p>
                <p>• <strong>Chrome (Android):</strong> Tap Menu (⋮) → <em>"Install app"</em> or <em>"Add to Home screen"</em>.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reminder settings (the mascot favicon itself is automatic) */}
      <NotificationSettingsCard />

      {/* Backup & restore */}
      <div className="editorial-card p-5 rounded-2xl bg-white mb-6 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-bold uppercase tracking-widest font-heading text-gray-500">
              Backup & Restore
            </h2>
            <span className="text-[10px] font-mono font-bold text-[#82917B] flex items-center gap-1">
              <IconShield size={12} />
              Checksummed
            </span>
          </div>
          <p className="text-xs text-gray-600 font-mono leading-relaxed">
            Everything lives only on this device. Export a backup regularly: clearing site data or losing the phone deletes your museum. Restoring your own backup brings back your locked points; importing a friend's file adds their entries as view-only.
          </p>
        </div>

        {/* Dynamic Verification Feedback Banners */}
        {importFeedback.type === 'success' && (
          <div className="text-xs font-bold text-[#82917B] border-2 border-[#82917B] bg-[#f4f7f2] p-3 rounded-xl font-mono flex items-center gap-2" role="status">
            <IconCheck size={16} className="flex-shrink-0" />
            <span>{importFeedback.message}</span>
          </div>
        )}
        {importFeedback.type === 'tampered' && (
          <div className="text-xs font-bold text-[#D66A4A] border-2 border-[#D66A4A] bg-[#fdf6f4] p-3 rounded-xl font-mono flex items-start gap-2" role="alert">
            <IconAlert size={18} className="flex-shrink-0 mt-0.5 text-[#D66A4A]" />
            <span>{importFeedback.message}</span>
          </div>
        )}
        {importFeedback.type === 'error' && (
          <div className="text-xs font-bold text-[#D66A4A] border-2 border-[#D66A4A] bg-[#fdf6f4] p-3 rounded-xl font-mono flex items-center gap-2" role="alert">
            <IconClose size={16} className="flex-shrink-0" />
            <span>{importFeedback.message}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            onClick={exportJSON}
            disabled={discoveries.length === 0 || isExporting}
            className="flex-1 btn-primary py-3 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <IconDownload size={14} />
            <span>{isExporting ? 'Preparing backup…' : 'Export Backup'}</span>
          </button>
          <label className="flex-1 btn-secondary py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-center cursor-pointer select-none flex items-center justify-center">
            Import Backup
            <input type="file" accept=".json" onChange={importJSON} className="hidden" />
          </label>
        </div>

      </div>

      {/* Curator Session & Privacy Rights */}
      <div className="editorial-card p-5 rounded-2xl bg-white mb-6 space-y-4">
        <div className="flex justify-between items-center border-b border-black/10 pb-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest font-heading text-black">
              Curator Session & Privacy
            </h2>
            <p className="text-[11px] font-mono text-gray-500 mt-0.5">
              Current Expedition: active since {sessionStartTime}
            </p>
          </div>
          <button
            onClick={() => setShowPrivacy(true)}
            className="text-[11px] font-mono font-bold text-[#D66A4A] hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>Zero-Cookie Policy</span>
            <IconShield size={13} />
          </button>
        </div>

        <div className="bg-[#FFFDF9] border border-black/15 p-3 rounded-xl text-xs font-mono text-gray-700 leading-relaxed">
          <p className="mb-2">
            <strong>How Sessions Work in Offline Apps:</strong> There is no remote login server. Your session is an active local curation expedition on this device.
          </p>
          <p className="text-[11px] text-gray-500">
            Ending a session flushes temporary memory, purges session draft buffers, and reinitializes the active workspace without affecting your permanently saved IndexedDB specimens.
          </p>
        </div>

        <div className="pt-1 flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleEndSession}
            disabled={sessionEnded}
            className="flex-1 btn-secondary py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-center cursor-pointer"
          >
            {sessionEnded ? 'Ending Session...' : 'End Active Session / Reset Cache'}
          </button>
          <button
            onClick={() => setShowPrivacy(true)}
            className="btn-primary py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer text-center"
          >
            Privacy Rights
          </button>
        </div>
      </div>

      {/* Offline P2P Curator Pass Modal */}
      <CuratorPassModal
        isOpen={showPass}
        onClose={() => setShowPass(false)}
        nickname={nickname}
        discoveries={discoveries}
      />

      {/* Privacy Policy & Zero-Cookie Modal */}
      <PrivacyModal
        isOpen={showPrivacy}
        onClose={() => setShowPrivacy(false)}
      />
    </div>
  );
};
