/**
 * @file NotFound.tsx
 * @description Editorial 404 error view rendered when a specimen or route is not found.
 */

import React from 'react';
import { IconSearch } from '../components/Icons';

interface NotFoundProps {
  onGoHome: () => void;
  onGoCollection: () => void;
  missingId?: string | null;
}

export const NotFound: React.FC<NotFoundProps> = ({ onGoHome, onGoCollection, missingId }) => {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="editorial-card p-6 sm:p-8 rounded-2xl bg-white max-w-md w-full text-center border-2 border-black shadow-brutal-lg">
        {/* Status Tag */}
        <div className="inline-block bg-[#D66A4A] text-white text-[10px] font-mono font-bold px-3 py-1 rounded border border-black uppercase tracking-widest shadow-brutal-sm mb-4">
          Error 404 • Missing Specimen
        </div>

        {/* Icon */}
        <div className="w-16 h-16 bg-[#F4EBDD] border-2 border-black rounded-full flex items-center justify-center mx-auto mb-4 shadow-brutal-sm">
          <IconSearch size={28} className="text-black" />
        </div>

        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-black tracking-tight leading-tight mb-2">
          Specimen Expedition Lost
        </h1>

        <p className="text-xs sm:text-sm font-mono text-gray-700 leading-relaxed mb-4">
          The typographical record you are searching for {missingId ? `(#${missingId})` : ''} has either been corrected by a rogue grammarian, painted over by municipal workers, or never existed in this museum wing.
        </p>

        <div className="bg-[#FFF9EC] border border-black/20 rounded-xl p-3 text-[11px] font-mono text-gray-600 mb-6 text-left space-y-1">
          <div className="font-bold text-black uppercase tracking-wider text-[10px]">Curator Diagnostic:</div>
          <p>• Verify the specimen serial number in your catalog.</p>
          <p>• Check if the item was deleted during a local database cleanup.</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={onGoHome}
            className="flex-1 btn-primary py-3 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            ← Museum Foyer (Home)
          </button>
          <button
            onClick={onGoCollection}
            className="flex-1 btn-secondary py-3 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            Browse Archive Grid
          </button>
        </div>
      </div>
    </div>
  );
};
