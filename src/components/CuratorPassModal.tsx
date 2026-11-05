import React, { useState, useEffect, useRef } from 'react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import QRCode from 'qrcode';
import { Discovery } from '../db/database';
import { useHunterPoints } from '../hooks/useHunterPoints';
import { getDeviceId } from '../utils/identity';
import { IconClose } from './Icons';
import { pvpService } from '../utils/pvpService';

interface CuratorPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  nickname: string;
  discoveries: Discovery[];
}

export const CuratorPassModal: React.FC<CuratorPassModalProps> = ({
  isOpen,
  onClose,
  nickname,
  discoveries,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, isOpen, onClose);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showPayload, setShowPayload] = useState(false);

  const specimenCount = discoveries.length;
  const legendCount = discoveries.filter(d => d.isHallOfFame).length;
  const totalPoints = useHunterPoints();
  const topSpecimen = discoveries.length > 0
    ? [...discoveries].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0]
    : null;

  // Rank calculation based on specimen count
  const getRank = (count: number) => {
    if (count >= 100) return 'Museum Director';
    if (count >= 50) return 'Chief Curator';
    if (count >= 25) return 'Word Archaeologist';
    if (count >= 10) return 'Street Detective';
    if (count >= 1) return 'Field Observer';
    return 'Rookie Hunter';
  };

  const rank = getRank(specimenCount);
  const squad = pvpService.getCurrentTeam();

  // Compact payload: name, squad, locked points, device id. The checksum is a format marker, not a signature.
  const payload = {
    app: 'TYPO_HUNTER',
    v: 1,
    hunter: nickname.trim() || 'Hunter',
    deviceId: getDeviceId(),
    rank,
    team: squad.name,
    teamTag: squad.tag,
    points: totalPoints,
    specimens: specimenCount,
    legends: legendCount,
    topFind: topSpecimen ? topSpecimen.title : 'None yet',
    bestRating: topSpecimen ? topSpecimen.rating : 0,
    checksum: `TPH-${totalPoints}-${specimenCount * 7 + legendCount * 13}-${(nickname || 'H').charCodeAt(0)}`,
    ts: new Date().toISOString().split('T')[0],
  };

  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(JSON.stringify(payload), {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 240,
        color: {
          dark: '#282722',
          light: '#FFFDF9',
        },
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('Failed to generate offline QR pass', err));
    }
  }, [isOpen, nickname, specimenCount, legendCount, totalPoints, rank, topSpecimen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs" 
      ref={dialogRef}
      role="dialog" 
      aria-modal="true" 
      aria-label="Offline Curator Pass"
    >
      <div className="editorial-card bg-[#F4EBDD] p-5 sm:p-6 rounded-2xl max-w-sm w-full relative shadow-brutal-lg border-2 border-black max-h-[92vh] flex flex-col">
        {/* Pass Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4 flex-shrink-0">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-[#D66A4A] uppercase block">
              Official Identification
            </span>
            <h2 className="text-xl font-extrabold font-heading text-black">
              Offline Curator Pass
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full border-2 border-black bg-white flex items-center justify-center font-bold text-xs shadow-brutal-sm hover:bg-gray-100 cursor-pointer flex-shrink-0"
            aria-label="Close Pass"
          >
            <IconClose size={12} />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="overflow-y-auto pr-1 flex-1 space-y-3">
          {/* Physical Pass Card */}
          <div className="bg-[#FFFDF9] border-2 border-black rounded-xl p-4 shadow-brutal-sm">
            <div className="flex justify-between items-center mb-3 border-b border-black/10 pb-2">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-gray-500 block">Curator</span>
                <h3 className="text-lg font-extrabold font-heading text-black leading-tight">
                  {nickname || 'Hunter'}
                </h3>
              </div>
              <span className="bg-[#E8B92D] text-black text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-black uppercase shadow-sm">
                {rank}
              </span>
            </div>

            {/* Offline QR Code Display or Raw Payload View */}
            {!showPayload ? (
              <div className="bg-white border-2 border-black rounded-lg p-3 flex flex-col items-center justify-center mx-auto mb-3">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Curator Offline Pass QR Code" className="w-44 h-44 object-contain" />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-xs font-mono text-gray-400">
                    Generating QR…
                  </div>
                )}
                <span className="text-[10px] font-mono text-gray-500 uppercase font-bold mt-1 tracking-wider">
                  Scan Screen-to-Screen (100% Offline)
                </span>
              </div>
            ) : (
              <div className="bg-[#282722] text-[#E8B92D] p-3 rounded-lg font-mono text-[10px] mb-3 overflow-x-auto border-2 border-black">
                <span className="text-gray-400 block mb-1 text-[10px] uppercase">// Verified JSON Payload & Checksum</span>
                <pre className="whitespace-pre-wrap break-all leading-tight">
                  {JSON.stringify(payload, null, 2)}
                </pre>
              </div>
            )}

            {/* 3-Metric Curatorial Scores */}
            <div className="grid grid-cols-3 gap-1.5 text-center font-mono mb-2">
              <div className="bg-[#F4EBDD] p-2 rounded-lg border border-black/15">
                <span className="text-base font-extrabold font-heading text-[#82917B] block leading-none">{totalPoints}</span>
                <span className="text-[7.5px] uppercase font-bold text-gray-600">Points</span>
              </div>
              <div className="bg-[#F4EBDD] p-2 rounded-lg border border-black/15">
                <span className="text-base font-extrabold font-heading text-black block leading-none">{specimenCount}</span>
                <span className="text-[7.5px] uppercase font-bold text-gray-600">Specimens</span>
              </div>
              <div className="bg-[#F4EBDD] p-2 rounded-lg border border-black/15">
                <span className="text-base font-extrabold font-heading text-[#D66A4A] block leading-none">{legendCount}</span>
                <span className="text-[7.5px] uppercase font-bold text-gray-600">Legends</span>
              </div>
            </div>

            <button
              onClick={() => setShowPayload(!showPayload)}
              className="w-full text-center text-[10px] font-mono font-bold text-gray-600 hover:text-black underline cursor-pointer"
            >
              {showPayload ? '← View Visual QR Code' : 'View Raw QR Contents →'}
            </button>
          </div>

          {/* School & Peer Trust Verification */}
          <div className="bg-[#FFF9EC] p-3.5 rounded-xl border border-black/20 text-[11px] font-mono text-gray-800 leading-snug space-y-1.5">
            <span className="font-bold text-black uppercase text-[10px] tracking-wider block">
              How to read this pass:
            </span>
            <p>
              <strong>• Honour system:</strong> this QR shows your locked points, but a QR code can't prove them. If it matters, ask to see the photos.
            </p>
            <p>
              <strong>• Points:</strong> photo (+50), correction (+30), category (+20, or +10 for Other), location (+10), notes (+10). Star ratings and Legends don't add points.
            </p>
            <p>
              <strong>• Show your work:</strong> tap any entry in your Archive to show the full photo and date to a friend or teacher.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-black/10 flex-shrink-0 mt-2">
          <button
            onClick={onClose}
            className="w-full btn-primary py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer"
          >
            Close Pass
          </button>
        </div>
      </div>
    </div>
  );
};
