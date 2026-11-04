/**
 * @file Collection.tsx
 * @description Multi-faceted visual museum archive with dual view modes (Photography Grid vs. Ledger List),
 * multi-attribute search, category chip filters, and chronological/favorite sorting.
 *
 * ARCHITECTURAL DESIGN:
 *   - Dual View Projection: Supports responsive 2-column photography grid and dense ledger list view.
 *   - Client-side Pipeline: Uses `useMemo` to construct a multi-predicate filtering and sorting pipeline:
 *       1. Text predicate: Case-insensitive token match on Title, Written Wording, or Location.
 *       2. Category predicate: Exact match or 'ALL' wildcard.
 *       3. Favorite predicate: Filters to starred specimens when active.
 *       4. Comparator: Epoch timestamp comparison for Newest vs. Oldest sorting.
 */

import React, { useState, useMemo } from 'react';
import { Discovery } from '../db/database';
import { CATEGORIES } from '../utils/constants';
import { IconHeart, IconSearch, IconGrid, IconTrophy, IconClose, IconStar } from '../components/Icons';

interface CollectionProps {
  discoveries: Discovery[];
  onSelectDiscovery: (id: string) => void;
  onNavigateCapture: () => void;
}

export const Collection: React.FC<CollectionProps> = ({ discoveries, onSelectDiscovery, onNavigateCapture }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'favorites'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredDiscoveries = useMemo(() => {
    return discoveries
      .filter(d => {
        const matchesSearch =
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          (d.originalWording && d.originalWording.toLowerCase().includes(search.toLowerCase())) ||
          (d.location && d.location.toLowerCase().includes(search.toLowerCase()));

        const matchesCategory = selectedCategory === 'ALL' || d.category === selectedCategory;
        const matchesFavorite = sortBy !== 'favorites' || d.isFavorite;

        return matchesSearch && matchesCategory && matchesFavorite;
      })
      .sort((a, b) => {
        if (sortBy === 'oldest') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [discoveries, search, selectedCategory, sortBy]);

  const hasActiveFilter = search !== '' || selectedCategory !== 'ALL' || sortBy !== 'newest';

  return (
    <div className="pb-32 px-4 pt-6 max-w-xl mx-auto">
      {/* Editorial Header */}
      <div className="flex justify-between items-baseline mb-5 border-b-2 border-black pb-3">
        <div>
          <span className="text-xs font-bold font-mono tracking-widest text-[#82917B] uppercase block">
            Permanent Museum Archive
          </span>
          <h1 className="text-3xl font-extrabold font-heading text-black tracking-tight">
            The Collection
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold bg-black text-[#E8B92D] px-2.5 py-1 rounded shadow-brutal-sm" aria-live="polite">
            {filteredDiscoveries.length} {filteredDiscoveries.length === 1 ? 'Specimen' : 'Specimens'}
          </span>
        </div>
      </div>

      {/* Controls: Search, View Mode, Category Pills, Sort */}
      <div className="space-y-3 mb-6">
        {/* Search Bar + Grid/List Toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <label htmlFor="collection-search" className="sr-only">Search collection</label>
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
              <IconSearch size={18} />
            </div>
            <input
              id="collection-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search wording, titles, or locations…"
              className="w-full pl-10 pr-9 py-2.5 border-2 border-black rounded-xl text-sm font-medium bg-white focus:outline-none shadow-brutal-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black text-sm font-bold p-1 flex items-center justify-center cursor-pointer"
                aria-label="Clear search"
              >
                <IconClose size={12} />
              </button>
            )}
          </div>

          {/* Grid / List Toggle */}
          <div className="flex bg-[#FFFDF9] border-2 border-black rounded-xl p-0.5 shadow-brutal-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg text-xs font-bold transition-colors ${
                viewMode === 'grid' ? 'bg-black text-[#E8B92D]' : 'text-gray-600 hover:text-black'
              }`}
              title="Grid View"
              aria-label="Grid View"
            >
              <IconGrid size={16} filled={viewMode === 'grid'} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center ${
                viewMode === 'list' ? 'bg-black text-[#E8B92D]' : 'text-gray-600 hover:text-black'
              }`}
              title="List View"
              aria-label="List View"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Categories Horizontal Carousel */}
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none" role="group" aria-label="Filter by category">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-black flex-shrink-0 cursor-pointer shadow-brutal-sm transition-all ${
              selectedCategory === 'ALL' ? 'bg-black text-[#E8B92D]' : 'bg-white hover:bg-gray-50 text-gray-700'
            }`}
            aria-pressed={selectedCategory === 'ALL'}
          >
            All Categories
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-black flex-shrink-0 cursor-pointer shadow-brutal-sm transition-all ${
                selectedCategory === cat ? 'bg-black text-[#E8B92D]' : 'bg-white hover:bg-gray-50 text-gray-700'
              }`}
              aria-pressed={selectedCategory === cat}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort Filter Tabs */}
        <div className="flex justify-between items-center pt-1 border-t border-black/10">
          <span className="text-[10px] font-mono uppercase font-bold text-gray-500">
            Sort By:
          </span>
          <div className="flex gap-1.5" role="group" aria-label="Sort order">
            {(['newest', 'oldest', 'favorites'] as const).map(option => (
              <button
                key={option}
                onClick={() => setSortBy(option)}
                className={`text-xs font-bold px-2.5 py-1 rounded-md border border-black capitalize cursor-pointer transition-colors ${
                  sortBy === option
                    ? option === 'favorites'
                      ? 'bg-[#D66A4A] text-white'
                      : 'bg-[#E8B92D] text-black font-extrabold'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                aria-pressed={sortBy === option}
              >
                {option === 'favorites' ? <span className="flex items-center gap-1"><IconStar size={11} filled /> Favorites</span> : option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Discoveries Display: Grid or List */}
      {filteredDiscoveries.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5" role="list" aria-label="Discoveries Grid">
            {filteredDiscoveries.map(item => (
              <div
                key={item.id}
                onClick={() => onSelectDiscovery(item.id)}
                className="editorial-card-interactive rounded-xl overflow-hidden bg-white flex flex-col justify-between group"
                role="listitem button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelectDiscovery(item.id)}
                aria-label={`${item.title}, ${item.category}`}
              >
                <div>
                  <div className="h-36 sm:h-44 bg-[#1C1A17] relative overflow-hidden flex items-center justify-center">
                    <img 
                      src={item.thumbnail || item.image} 
                      alt={item.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" 
                    />
                    <div className="absolute top-2 left-2 flex gap-1 items-center">
                      <span className="bg-black text-[#E8B92D] text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                        #{String(item.discoveryNumber).padStart(3, '0')}
                      </span>
                      {item.isFavorite && (
                        <span className="bg-[#D66A4A] text-white p-1 rounded flex items-center justify-center" aria-label="Favorite">
                          <IconHeart size={10} filled={true} />
                        </span>
                      )}
                    </div>
                    {item.isHallOfFame && (
                      <span className="absolute bottom-2 right-2 bg-[#E8B92D] text-black p-1 rounded-full border border-black shadow-sm" title="Hall of Fame">
                        <IconTrophy size={11} filled={true} />
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-wider block mb-0.5 truncate">
                      {item.category}
                    </span>
                    <h3 className="font-heading font-extrabold text-sm sm:text-base text-black mb-1 line-clamp-2 leading-snug group-hover:text-[#D66A4A] transition-colors">
                      {item.title}
                    </h3>
                    {item.originalWording && (
                      <p className="text-xs text-gray-600 line-clamp-1 italic font-mono bg-[#F4EBDD] px-1.5 py-0.5 rounded border border-black/10">
                        "{item.originalWording}"
                      </p>
                    )}
                  </div>
                </div>
                <div className="px-3 pb-3 pt-1.5 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-500 font-mono">
                  <span>{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  <span className="truncate max-w-[80px]">{item.location || '—'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List Mode (Ledger Style) */
          <div className="space-y-2.5" role="list" aria-label="Discoveries List">
            {filteredDiscoveries.map(item => (
              <div
                key={item.id}
                onClick={() => onSelectDiscovery(item.id)}
                className="editorial-card-interactive p-3 rounded-xl bg-white flex items-center gap-3.5 group"
                role="listitem button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelectDiscovery(item.id)}
                aria-label={`${item.title}, ${item.category}`}
              >
                <div className="w-16 h-16 bg-[#1C1A17] rounded-lg border-2 border-black overflow-hidden flex-shrink-0">
                  <img src={item.thumbnail || item.image} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="overflow-hidden min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="bg-black text-[#E8B92D] text-[9px] font-mono font-bold px-1.5 py-0.2 rounded">
                      #{String(item.discoveryNumber).padStart(3, '0')}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-gray-500 uppercase truncate">
                      {item.category}
                    </span>
                    {item.isFavorite && (
                      <span className="text-[#D66A4A]"><IconHeart size={12} filled={true} /></span>
                    )}
                    {item.isHallOfFame && (
                      <span className="text-[#E8B92D]"><IconTrophy size={12} filled={true} /></span>
                    )}
                  </div>
                  <h3 className="font-heading font-extrabold text-sm sm:text-base text-black truncate group-hover:text-[#D66A4A] transition-colors">
                    {item.title}
                  </h3>
                  {item.originalWording && (
                    <p className="text-xs text-gray-600 truncate font-mono italic">
                      "{item.originalWording}"
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-[10px] font-mono text-gray-400 block">
                    {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                  </span>
                  <span className="text-gray-400 font-bold group-hover:text-black">→</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="editorial-card p-10 text-center rounded-2xl bg-white mt-4">
          <div className="w-12 h-12 bg-[#F4EBDD] border-2 border-black rounded-full flex items-center justify-center mx-auto mb-3 shadow-brutal-sm">
            <IconSearch size={22} className="text-black" />
          </div>
          <h3 className="font-heading font-extrabold text-lg mb-1">
            {hasActiveFilter ? 'No Specimens Found' : 'Archive Is Empty'}
          </h3>
          <p className="text-xs text-gray-600 mb-5 max-w-xs mx-auto leading-relaxed">
            {hasActiveFilter
              ? 'No discoveries match your active search terms or category filters.'
              : 'Start building your visual archive by capturing your first typo in the wild.'}
          </p>
          {hasActiveFilter ? (
            <button
              onClick={() => { setSearch(''); setSelectedCategory('ALL'); setSortBy('newest'); }}
              className="btn-primary py-2 px-4 rounded-xl text-xs uppercase font-bold"
            >
              Reset Filters
            </button>
          ) : (
            <button
              onClick={onNavigateCapture}
              className="btn-primary py-2.5 px-5 rounded-xl text-xs uppercase font-bold"
            >
              Spot a Typo Now
            </button>
          )}
        </div>
      )}
    </div>
  );
};
