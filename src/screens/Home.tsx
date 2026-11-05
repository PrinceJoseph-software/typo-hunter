/**
 * @file Home.tsx
 * @description Editorial landing screen presenting curatorial metrics, daily field mission,
 * latest archived specimen, recent discoveries gallery, and random archive vault highlight.
 *
 * Designed in the authentic Warm Paper editorial magazine style:
 * crisp typography, black border frames, Warm Paper palette, and generous whitespace.
 */

import React from 'react';
import { Discovery } from '../db/database';
import { ROTATING_PROMPTS } from '../utils/constants';
import { IconCamera, IconTrophy, IconSwords, IconGraduationCap } from '../components/Icons';

interface HomeProps {
  discoveries: Discovery[];
  nickname: string;
  onNavigate: (view: string, param?: string) => void;
  onOpenHelp?: () => void;
  onOpenPvp?: () => void;
  onOpenTeacherMode?: () => void;
}

function getGreeting(nickname: string): string {
  const hour = new Date().getHours();
  const name = nickname.trim() || 'Hunter';
  if (hour < 12) return `Good morning, ${name}.`;
  if (hour < 17) return `Good afternoon, ${name}.`;
  return `Good evening, ${name}.`;
}

export const Home: React.FC<HomeProps> = ({
  discoveries,
  nickname,
  onNavigate,
  onOpenHelp,
  onOpenPvp,
  onOpenTeacherMode,
}) => {
  const latest = discoveries[0];
  const recentList = discoveries.slice(1, 4);

  const randomPrompt = React.useMemo(() => {
    const idx = Math.floor(Math.random() * ROTATING_PROMPTS.length);
    return ROTATING_PROMPTS[idx];
  }, []);

  const randomDiscovery = React.useMemo(() => {
    if (discoveries.length < 2) return null;
    const pool = discoveries.slice(1);
    return pool[Math.floor(Math.random() * pool.length)];
  }, [discoveries]);

  const hofCount = discoveries.filter(d => d.isHallOfFame).length;

  return (
    <div className="pb-32 px-4 pt-6 max-w-xl mx-auto">
      {/* Editorial Masthead */}
      <header className="border-b-2 border-black pb-4 mb-6">
        <div className="flex justify-between items-center text-[11px] font-mono font-bold tracking-widest uppercase text-gray-600 mb-1">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 bg-[#D66A4A] rounded-full"></span>
            Field Station Active
          </span>
          <div className="flex items-center gap-2">
            <span>Archive Vol. 1</span>
            {onOpenHelp && (
              <button
                onClick={onOpenHelp}
                className="bg-white hover:bg-gray-100 border border-black rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px] text-black shadow-sm cursor-pointer"
                title="Field Guide & Help"
                aria-label="Field Guide & Help"
              >
                ?
              </button>
            )}
          </div>
        </div>
        
        <div className="flex justify-between items-end mt-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#D66A4A] font-heading">
              Curator Desk
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold font-heading text-black tracking-tight leading-tight">
              {getGreeting(nickname)}
            </h1>
          </div>

          <div className="flex gap-2 text-right">
            <div className="bg-[#FFFDF9] border-2 border-black rounded-lg px-3 py-1.5 shadow-brutal-sm text-center">
              <span className="block text-xl font-bold font-heading leading-none">{discoveries.length}</span>
              <span className="text-[9px] font-mono uppercase text-gray-500 font-bold">Specimens</span>
            </div>
            {hofCount > 0 && (
              <div className="bg-[#E8B92D] border-2 border-black rounded-lg px-2.5 py-1.5 shadow-brutal-sm text-center">
                <span className="block text-xl font-bold font-heading leading-none">{hofCount}</span>
                <span className="text-[9px] font-mono uppercase text-black font-bold">Legends</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Primary Hero Capture CTA */}
      <section className="mb-7" aria-label="Spot something prompt">
        <button
          onClick={() => onNavigate('capture')}
          className="w-full py-5 px-6 btn-primary rounded-2xl flex items-center justify-between text-left group"
          aria-label="Capture a new typo discovery"
        >
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="bg-black text-[#E8B92D] text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase">
                Active Assignment
              </span>
              <span className="text-xs font-bold text-gray-800 tracking-wider uppercase font-mono">
                Tap to record
              </span>
            </div>
            <span className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight block text-black">
              SPOT SOMETHING?
            </span>
            <p className="text-xs font-medium text-gray-800 mt-0.5">
              Capture or upload funny signage from the wild
            </p>
          </div>

          <div className="w-14 h-14 bg-black text-[#E8B92D] rounded-full border-2 border-black flex items-center justify-center text-3xl font-bold flex-shrink-0 group-hover:rotate-90 group-hover:bg-[#FFFDF9] group-hover:text-black transition-all shadow-[2px_2px_0px_#FFFDF9]">
            +
          </div>
        </button>
      </section>

      {/* P2P Multiplayer Battle Arena Banner */}
      {onOpenPvp && (
        <section className="mb-6" aria-label="Multiplayer PvP Arena">
          <div className="editorial-card p-4 rounded-2xl bg-[#FFFDF9] border-2 border-black shadow-brutal-sm flex items-center justify-between">
            <div className="pr-3">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="bg-[#D66A4A] text-white text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase">
                  P2P Multiplayer
                </span>
                <span className="text-[10px] font-mono font-bold text-gray-500">
                  Quick Battle & Teams
                </span>
              </div>
              <h3 className="font-heading font-extrabold text-base text-black flex items-center gap-1.5">
                <IconSwords size={16} className="text-[#D66A4A]" />
                Curator PvP Arena & Timed Hunts
              </h3>
              <p className="text-[11px] font-mono text-gray-600 mt-0.5">
                Join a squad, challenge rivals head-to-head, or sprint in a timed hunt
              </p>
            </div>
            <button
              onClick={onOpenPvp}
              className="btn-primary py-2.5 px-3.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex-shrink-0 cursor-pointer shadow-brutal-sm"
            >
              Enter Arena
            </button>
          </div>
        </section>
      )}

      {/* Classroom Expedition & Teacher Mode Banner */}
      {onOpenTeacherMode && (
        <section className="mb-6" aria-label="Classroom and Teacher Terminal">
          <div className="editorial-card p-4 rounded-2xl bg-[#FFF9EC] border-2 border-black shadow-brutal-sm flex items-center justify-between">
            <div className="pr-3">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="bg-black text-[#E8B92D] text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase">
                  Classroom Suite
                </span>
                <span className="text-[10px] font-mono font-bold text-gray-500">
                  Academic Overseer
                </span>
              </div>
              <h3 className="font-heading font-extrabold text-base text-black flex items-center gap-1.5">
                <IconGraduationCap size={16} className="text-[#D66A4A]" />
                Teacher Terminal & Class Expeditions
              </h3>
              <p className="text-[11px] font-mono text-gray-600 mt-0.5">
                Launch synchronized class hunts via Master QR, inspect student systems, and export gradebooks
              </p>
            </div>
            <button
              onClick={onOpenTeacherMode}
              className="btn-secondary py-2.5 px-3 rounded-xl text-xs font-extrabold uppercase tracking-wider flex-shrink-0 cursor-pointer shadow-brutal-sm flex items-center gap-1"
            >
              <span>Teacher Mode</span>
            </button>
          </div>
        </section>
      )}

      {/* Daily Rotating Mission Prompt */}
      <section className="mb-8" aria-label="Daily hunter mission">
        <div className="editorial-card p-4 rounded-xl bg-[#FFF9EC] relative">
          <div className="flex items-center justify-between mb-1.5">
            <span className="bg-[#D66A4A] text-white text-[10px] font-bold px-2 py-0.5 rounded border border-black uppercase tracking-wider font-heading">
              Today's Field Mission
            </span>
            <span className="text-[10px] font-mono text-gray-500 font-bold">#PROMPT</span>
          </div>
          <p className="text-sm font-medium italic text-black leading-snug">
            "{randomPrompt}"
          </p>
        </div>
      </section>

      {/* Latest Discovery Specimen */}
      <section className="mb-8" aria-label="Featured latest specimen">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold tracking-widest uppercase font-heading text-black">
              Latest Specimen
            </h2>
            {latest && (
              <span className="bg-black text-[#E8B92D] text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                #{String(latest.discoveryNumber).padStart(3, '0')}
              </span>
            )}
          </div>
          {discoveries.length > 0 && (
            <button
              onClick={() => onNavigate('collection')}
              className="text-xs font-bold text-[#D66A4A] hover:underline font-mono uppercase tracking-wider cursor-pointer"
            >
              View All ({discoveries.length}) →
            </button>
          )}
        </div>

        {latest ? (
          <div
            onClick={() => onNavigate('detail', latest.id)}
            className="editorial-card-interactive rounded-2xl overflow-hidden bg-white group cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onNavigate('detail', latest.id)}
            aria-label={`View specimen ${latest.title}`}
          >
            <div className="h-64 sm:h-72 bg-[#1C1A17] overflow-hidden relative flex items-center justify-center">
              <img
                src={latest.image || latest.thumbnail}
                alt={latest.title}
                className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-200"
              />
              <span className="absolute top-3 left-3 bg-[#E8B92D] text-black text-[11px] font-bold px-2.5 py-1 rounded border-2 border-black uppercase tracking-wider shadow-brutal-sm">
                {latest.category}
              </span>
              {latest.isHallOfFame && (
                <span className="absolute top-3 right-3 bg-[#D66A4A] text-white text-[10px] font-bold px-2 py-1 rounded border border-black uppercase flex items-center gap-1 shadow-brutal-sm">
                  <IconTrophy size={12} filled={true} />
                  <span>Legend</span>
                </span>
              )}
            </div>

            <div className="p-5">
              <h3 className="font-heading font-extrabold text-xl sm:text-2xl text-black leading-tight mb-2 group-hover:text-[#D66A4A] transition-colors">
                {latest.title}
              </h3>

              {latest.originalWording && (
                <div className="bg-[#F4EBDD] border border-black/30 rounded-lg p-2.5 mb-3 font-mono">
                  <span className="text-[10px] uppercase font-bold text-[#D66A4A] block mb-0.5">As Written:</span>
                  <p className="text-sm font-bold text-black italic">"{latest.originalWording}"</p>
                </div>
              )}

              <div className="flex justify-between items-center text-xs text-gray-600 font-medium pt-2 border-t border-gray-100">
                <span className="font-mono">{new Date(latest.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span className="truncate max-w-[180px] font-medium text-right text-gray-700">{latest.location || 'Unknown coordinates'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="editorial-card p-8 text-center rounded-2xl bg-white">
            <div className="w-16 h-16 bg-[#F4EBDD] border-2 border-black rounded-full flex items-center justify-center mx-auto mb-3 shadow-brutal-sm">
              <IconCamera size={28} className="text-black" />
            </div>
            <h3 className="font-heading font-extrabold text-xl mb-1">Your Museum Is Empty</h3>
            <p className="text-sm text-gray-600 max-w-sm mx-auto mb-5 leading-relaxed">
              Step outside and document language in the wild, or load the curator sample archive to explore the features.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                onClick={() => onNavigate('capture')}
                className="btn-primary py-2.5 px-5 rounded-xl text-sm uppercase font-bold tracking-wider cursor-pointer"
              >
                Capture First Typo
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Recent Discoveries Gallery */}
      {recentList.length > 0 && (
        <section className="mb-8" aria-label="Recent discoveries gallery">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs font-bold tracking-widest uppercase font-heading text-black">
              Recent Additions
            </h2>
            <button
              onClick={() => onNavigate('collection')}
              className="text-xs font-bold text-gray-600 hover:text-black font-mono uppercase cursor-pointer"
            >
              Archive Grid →
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {recentList.map(item => (
              <div
                key={item.id}
                onClick={() => onNavigate('detail', item.id)}
                className="editorial-card-interactive rounded-xl overflow-hidden bg-white flex flex-col group cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onNavigate('detail', item.id)}
                aria-label={`View ${item.title}`}
              >
                <div className="h-24 bg-[#1C1A17] overflow-hidden relative">
                  <img src={item.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <span className="absolute bottom-1 left-1 bg-black text-[#E8B92D] text-[9px] font-mono font-bold px-1 rounded">
                    #{item.discoveryNumber}
                  </span>
                </div>
                <div className="p-2 flex-1 flex flex-col justify-between">
                  <h4 className="font-heading font-bold text-xs truncate group-hover:text-[#D66A4A]">
                    {item.title}
                  </h4>
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider block mt-1 truncate">
                    {item.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Random Vault Pick */}
      {randomDiscovery && discoveries.length > 1 && (
        <section aria-label="Museum archive highlight">
          <h2 className="text-xs font-bold tracking-widest uppercase mb-3 font-heading text-black flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 bg-[#82917B] rounded-full"></span>
            Vault Highlight
          </h2>
          <div
            onClick={() => onNavigate('detail', randomDiscovery.id)}
            className="editorial-card-interactive p-3.5 rounded-xl bg-white flex items-center gap-3.5 group cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onNavigate('detail', randomDiscovery.id)}
            aria-label={`View vault highlight ${randomDiscovery.title}`}
          >
            <div className="w-16 h-16 bg-black rounded-lg border-2 border-black overflow-hidden flex-shrink-0">
              <img src={randomDiscovery.thumbnail} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="overflow-hidden min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-mono font-bold text-[#82917B] uppercase tracking-wider">
                  Specimen #{String(randomDiscovery.discoveryNumber).padStart(3, '0')}
                </span>
                <span className="text-[9px] font-bold text-gray-400 font-mono">— {randomDiscovery.category}</span>
              </div>
              <h4 className="font-heading font-extrabold text-base truncate text-black group-hover:text-[#D66A4A] transition-colors">
                {randomDiscovery.title}
              </h4>
              {randomDiscovery.originalWording && (
                <p className="text-xs text-gray-600 truncate font-mono italic">
                  "{randomDiscovery.originalWording}"
                </p>
              )}
            </div>
            <div className="text-lg font-bold text-gray-400 group-hover:text-black pr-2">
              →
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
