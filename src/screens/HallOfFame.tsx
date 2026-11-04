/**
 * @file HallOfFame.tsx
 * @description Curated "THE ABSOLUTE LEGENDS" exhibition showcasing user-inducted typographical masterpieces,
 * 5-star funniness ratings, and random discovery surprise feature.
 *
 * ARCHITECTURAL DESIGN:
 *   - Curatorial Partitioning: Distinguishes between standard archive specimens and prestigious
 *     inductees via the `isHallOfFame` boolean flag.
 *   - Graceful Degradation: If no specimens have been manually inducted yet, the view automatically
 *     spotlights the highest-rated specimen in the archive as the fallback centerpiece.
 */

import React from 'react';
import { Discovery } from '../db/database';
import { IconStar, IconTrophy, IconRefresh, IconAward, IconCamera, IconGrid } from '../components/Icons';

interface HallOfFameProps {
  discoveries: Discovery[];
  onSelectDiscovery: (id: string) => void;
  onNavigateCapture?: () => void;
  onNavigateCollection?: () => void;
  onResetSample?: () => void;
}

const StarRatingDisplay = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5 items-center" aria-label={`Rating: ${rating} out of 5`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <IconStar
        key={star}
        size={14}
        filled={star <= rating}
        className={star <= rating ? 'text-[#E8B92D]' : 'text-gray-300'}
      />
    ))}
  </div>
);

export const HallOfFame: React.FC<HallOfFameProps> = ({
  discoveries,
  onSelectDiscovery,
  onNavigateCapture,
  onNavigateCollection,
  onResetSample,
}) => {
  const hallOfFameItems = discoveries.filter(d => d.isHallOfFame);
  const featured = hallOfFameItems[0] || null;
  const rest = hallOfFameItems.slice(1);

  // If nothing is Hall of Fame nominated, fall back to highest-rated
  const fallbackFeatured = discoveries.length > 0
    ? [...discoveries].sort((a, b) => b.rating - a.rating)[0]
    : null;

  const displayFeatured = featured || fallbackFeatured;

  const handleRandomPick = () => {
    if (hallOfFameItems.length > 0) {
      const pick = hallOfFameItems[Math.floor(Math.random() * hallOfFameItems.length)];
      onSelectDiscovery(pick.id);
    } else if (discoveries.length > 0) {
      const pick = discoveries[Math.floor(Math.random() * discoveries.length)];
      onSelectDiscovery(pick.id);
    }
  };

  return (
    <div className="pb-32 px-4 pt-6 max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-6 border-b-2 border-black pb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono font-bold tracking-widest text-[#E8B92D] uppercase bg-black px-2 py-0.5 rounded shadow-brutal-sm">
            Museum Exhibition
          </span>
          {hallOfFameItems.length > 1 && (
            <button
              onClick={handleRandomPick}
              className="text-xs font-mono font-bold text-[#D66A4A] hover:underline cursor-pointer flex items-center gap-1"
            >
              Surprise Me <IconRefresh size={12} />
            </button>
          )}
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold font-heading text-black tracking-tight mt-1">
          THE ABSOLUTE LEGENDS
        </h1>
        <p className="text-xs text-gray-600 mt-1 font-mono">
          {hallOfFameItems.length > 0
            ? `${hallOfFameItems.length} inducted specimen${hallOfFameItems.length !== 1 ? 's' : ''} enshrined in typographical glory.`
            : discoveries.length > 0
            ? 'No official inductees yet. Highlighting your highest-rated discovery.'
            : 'Enshrine your most hilarious typographical discoveries from their detail dossier.'}
        </p>
      </div>

      {/* Featured Masterpiece or Empty Exhibition */}
      {displayFeatured ? (
        <section className="mb-8" aria-label="Featured legend specimen">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold tracking-widest uppercase font-heading text-[#D66A4A] flex items-center gap-1.5">
              <IconTrophy size={14} filled={true} />
              <span>{featured ? 'Masterpiece Inductee' : 'Provisional Spotlight (Highest Rated)'}</span>
            </span>
            <span className="font-mono text-[10px] bg-black text-[#E8B92D] px-1.5 py-0.2 rounded font-bold">
              #{String(displayFeatured.discoveryNumber).padStart(3, '0')}
            </span>
          </div>

          <div
            onClick={() => onSelectDiscovery(displayFeatured.id)}
            className="editorial-card-interactive rounded-2xl overflow-hidden bg-white group border-2 border-black"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelectDiscovery(displayFeatured.id)}
            aria-label={`View ${displayFeatured.title}`}
          >
            <div className="h-64 sm:h-72 bg-[#1C1A17] relative flex items-center justify-center overflow-hidden">
              <img 
                src={displayFeatured.image} 
                alt={displayFeatured.title} 
                className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-200" 
              />
              <span className="absolute top-3 left-3 bg-[#E8B92D] text-black text-xs font-bold px-2.5 py-1 rounded border-2 border-black uppercase tracking-wider shadow-brutal-sm">
                {displayFeatured.category}
              </span>
            </div>

            <div className="p-5">
              <h3 className="text-2xl font-extrabold font-heading text-black group-hover:text-[#D66A4A] transition-colors leading-tight mb-2">
                {displayFeatured.title}
              </h3>

              {displayFeatured.originalWording && (
                <div className="bg-[#F4EBDD] p-3 rounded-lg border border-black/20 font-mono mb-3">
                  <span className="text-[10px] font-bold text-[#D66A4A] uppercase block mb-0.5">As Written:</span>
                  <p className="text-sm font-bold text-black italic">"{displayFeatured.originalWording}"</p>
                </div>
              )}

              {displayFeatured.notes && (
                <p className="text-xs text-gray-600 mb-3 font-mono leading-relaxed line-clamp-2">
                  {displayFeatured.notes}
                </p>
              )}

              <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-xs font-bold">
                <StarRatingDisplay rating={displayFeatured.rating || 0} />
                <span className="text-xs font-mono text-[#D66A4A] group-hover:underline">View Dossier →</span>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* Rich Empty State when 0 discoveries in total */
        <div className="editorial-card p-8 sm:p-10 text-center rounded-2xl bg-white mb-8 border-2 border-black shadow-brutal">
          <div className="w-16 h-16 bg-[#F4EBDD] border-2 border-black rounded-full flex items-center justify-center mx-auto mb-4 shadow-brutal-sm">
            <IconTrophy size={28} className="text-[#D66A4A]" />
          </div>
          <div className="inline-block bg-black text-[#E8B92D] text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider mb-2">
            Curatorial Exhibition Status: Empty
          </div>
          <h3 className="font-heading font-extrabold text-xl text-black mb-1">
            Hall of Fame Awaiting Inductees
          </h3>
          <p className="text-xs font-mono text-gray-600 max-w-sm mx-auto leading-relaxed mb-6">
            No typographical specimens have been cataloged in your museum yet. Document language blunders in the wild to inaugurate this prestigious exhibition wing.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            {onNavigateCapture && (
              <button
                type="button"
                onClick={onNavigateCapture}
                className="btn-primary py-2.5 px-5 rounded-xl text-xs uppercase font-extrabold tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-brutal-sm"
              >
                <IconCamera size={14} />
                <span>Spot a Typo Now</span>
              </button>
            )}
            {onResetSample && (
              <button
                type="button"
                onClick={onResetSample}
                className="btn-secondary py-2.5 px-4 rounded-xl text-xs uppercase font-bold tracking-wider cursor-pointer"
              >
                Load Sample Archive (Demo)
              </button>
            )}
          </div>
        </div>
      )}

      {/* When specimens exist but none are officially inducted into Hall of Fame */}
      {discoveries.length > 0 && hallOfFameItems.length === 0 && (
        <div className="editorial-card p-6 rounded-2xl bg-[#FFF9EC] border-2 border-black text-center mb-6 shadow-brutal-sm">
          <div className="w-10 h-10 bg-white border-2 border-black rounded-full flex items-center justify-center mx-auto mb-2 shadow-brutal-sm">
            <IconAward size={20} className="text-[#D66A4A]" />
          </div>
          <h4 className="font-heading font-extrabold text-sm text-black mb-1">
            Enshrine Official Hall of Fame Legends
          </h4>
          <p className="text-xs text-gray-700 font-mono max-w-sm mx-auto mb-3 leading-relaxed">
            The specimen above is currently showcased based on rating. To permanently induct items into the Hall of Fame, open any specimen dossier and tap the Trophy icon.
          </p>
          {onNavigateCollection && (
            <button
              type="button"
              onClick={onNavigateCollection}
              className="btn-secondary py-2 px-4 rounded-xl text-xs uppercase font-bold tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
            >
              <IconGrid size={13} />
              <span>Browse All Specimens →</span>
            </button>
          )}
        </div>
      )}

      {/* Additional Inductees Grid */}
      {rest.length > 0 && (
        <section aria-label="Other Hall of Fame inductees">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs font-bold tracking-widest uppercase font-heading text-black">
              Additional Enshrined Legends ({rest.length})
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            {rest.map(item => (
              <div
                key={item.id}
                onClick={() => onSelectDiscovery(item.id)}
                className="editorial-card-interactive rounded-xl overflow-hidden bg-white p-3 flex flex-col justify-between group"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelectDiscovery(item.id)}
                aria-label={`View ${item.title}`}
              >
                <div>
                  <div className="h-28 bg-[#1C1A17] rounded-lg border border-black overflow-hidden mb-2 relative">
                    <img src={item.thumbnail || item.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <span className="absolute bottom-1 left-1 bg-black text-[#E8B92D] text-[9px] font-mono font-bold px-1 rounded">
                      #{item.discoveryNumber}
                    </span>
                  </div>
                  <h4 className="font-heading font-extrabold text-xs sm:text-sm truncate text-black group-hover:text-[#D66A4A]">
                    {item.title}
                  </h4>
                  <span className="text-[9px] font-mono text-gray-500 uppercase block mb-1 truncate">
                    {item.category}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                  <StarRatingDisplay rating={item.rating} />
                  <span className="text-xs text-gray-400 font-bold group-hover:text-black">→</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
