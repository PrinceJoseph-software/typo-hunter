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
import { IconStar, IconTrophy, IconRefresh } from '../components/Icons';

interface HallOfFameProps {
  discoveries: Discovery[];
  onSelectDiscovery: (id: string) => void;
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

export const HallOfFame: React.FC<HallOfFameProps> = ({ discoveries, onSelectDiscovery }) => {
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
          {hallOfFameItems.length > 0 && (
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
            : 'Enshrine your most hilarious typographical discoveries from their detail view.'}
        </p>
      </div>

      {/* Featured Masterpiece */}
      {displayFeatured ? (
        <section className="mb-8" aria-label="Featured legend specimen">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-xs font-bold tracking-widest uppercase font-heading text-[#D66A4A] flex items-center gap-1.5">
              <IconTrophy size={14} filled={true} />
              <span>{featured ? 'Masterpiece Inductee' : 'Highest Rated Specimen'}</span>
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
        <div className="editorial-card p-10 text-center rounded-2xl bg-white mb-8">
          <div className="w-14 h-14 bg-[#F4EBDD] border-2 border-black rounded-full flex items-center justify-center mx-auto mb-3 shadow-brutal-sm">
            <IconTrophy size={26} className="text-black" />
          </div>
          <h3 className="font-heading font-extrabold text-xl mb-1">No Legends Inducted Yet</h3>
          <p className="text-xs text-gray-600 max-w-xs mx-auto leading-relaxed mb-4">
            Tap the trophy icon on any specimen in your collection to enshrine it into the Hall of Fame.
          </p>
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
