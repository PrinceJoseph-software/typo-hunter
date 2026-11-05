/**
 * @file App.tsx
 * @description Root application shell, state coordinator, and bottom navigation bar.
 *
 * ARCHITECTURAL DESIGN:
 *   - Sovereign Single-Page Router: Uses an internal view state router (`currentView`)
 *     coupled with window scroll management to deliver fast transitions without full browser reloads.
 *   - Mobile Viewport Bounding: Constrains desktop browsers into an editorial container (`max-w-2xl mx-auto`)
 *     while expanding naturally to 100% viewport width on mobile devices.
 *   - Symmetrical 5-Slot Navigation: Implements an accessible 5-destination bottom navigation bar
 *     with an elevated Hunter Yellow center Capture button.
 */

import { useState, useEffect } from 'react';
import { dbService, Discovery } from './db/database';
import { Home } from './screens/Home';
import { Capture, ActiveSpeedBlitzSession } from './screens/Capture';
import { pvpService, PvpMatchRecord } from './utils/pvpService';
import { generatePvpVictoryCardBlob, shareOrDownloadBlob } from './utils/shareCard';
import { Collection } from './screens/Collection';
import { Detail } from './screens/Detail';
import { HallOfFame } from './screens/HallOfFame';
import { Profile } from './screens/Profile';
import { NotFound } from './screens/NotFound';
import { IconHome, IconGrid, IconAward, IconUser, IconFlame, IconClose, IconGraduationCap } from './components/Icons';
import { recordCuratorActivity, syncFaviconWithInactivity } from './utils/dynamicFavicon';
import { checkInactivityNotification } from './utils/notificationService';
import { OnboardingModal } from './components/OnboardingModal';
import { HelpModal } from './components/HelpModal';
import { PrivacyModal } from './components/PrivacyModal';
import { PvpArenaModal } from './components/PvpArenaModal';
import { TeacherModeModal } from './components/TeacherModeModal';
import { teacherService, ClassExpedition } from './utils/teacherService';

export function App() {
  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedDiscoveryId, setSelectedDiscoveryId] = useState<string | null>(null);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [nickname, setNickname] = useState<string>(() => {
    return localStorage.getItem('typo_hunter_nickname') || 'Hunter';
  });
  const [loading, setLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showPvpArena, setShowPvpArena] = useState(false);
  const [showTeacherMode, setShowTeacherMode] = useState(false);
  const [activeClassExpedition, setActiveClassExpedition] = useState<ClassExpedition | null>(() =>
    teacherService.getActiveClassExpedition()
  );
  const [activeSpeedBlitz, setActiveSpeedBlitz] = useState<ActiveSpeedBlitzSession | null>(null);
  const [blitzVerdict, setBlitzVerdict] = useState<PvpMatchRecord | null>(null);
  const [sharingPlacard, setSharingPlacard] = useState(false);
  const [welcomeBackBanner, setWelcomeBackBanner] = useState<{
    show: boolean;
    hours: number;
    message: string;
  } | null>(null);

  const handleStartSpeedBlitz = (blitz: {
    opponentName: string;
    opponentTeam: string;
    opponentTeamTag: string;
    opponentScore: number;
    durationMinutes: number;
  }) => {
    setActiveSpeedBlitz({
      battleId: `blitz_${Date.now()}`,
      opponentName: blitz.opponentName,
      opponentTeam: blitz.opponentTeam,
      opponentTeamTag: blitz.opponentTeamTag,
      opponentScore: blitz.opponentScore,
      durationMinutes: blitz.durationMinutes,
      endTime: Date.now() + blitz.durationMinutes * 60 * 1000,
      earnedScore: 0,
    });
    setCurrentView('capture');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddBlitzPoints = (pts: number) => {
    setActiveSpeedBlitz(prev => prev ? { ...prev, earnedScore: prev.earnedScore + pts } : null);
  };

  const handleShareBlitzVerdict = async () => {
    if (!blitzVerdict) return;
    setSharingPlacard(true);
    try {
      const blob = await generatePvpVictoryCardBlob(blitzVerdict);
      await shareOrDownloadBlob(
        blob,
        `typo-hunter-blitz-${blitzVerdict.outcome.toLowerCase()}-${blitzVerdict.id}.jpg`,
        `Typo Hunter Speed Blitz: ${blitzVerdict.playerNickname} vs ${blitzVerdict.opponentName}`,
        `Speed Blitz Battle: ${blitzVerdict.playerNickname} scored ${blitzVerdict.playerScore} pts vs ${blitzVerdict.opponentName} (${blitzVerdict.opponentScore} pts)!`
      );
    } catch (err) {
      console.error('Failed to export blitz victory placard', err);
    } finally {
      setSharingPlacard(false);
    }
  };

  const handleFinishBlitz = (finalScore?: number) => {
    if (!activeSpeedBlitz) return;
    const score = finalScore ?? activeSpeedBlitz.earnedScore;
    const result = pvpService.resolveDuel(
      nickname,
      score,
      Math.max(1, Math.round(score / 50)),
      0,
      activeSpeedBlitz.opponentName,
      activeSpeedBlitz.opponentTeam,
      activeSpeedBlitz.opponentScore
    );
    setBlitzVerdict(result);
    setActiveSpeedBlitz(null);
  };
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('typo_hunter_onboarded');
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
  });

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  };

  const handleCloseOnboarding = () => {
    localStorage.setItem('typo_hunter_onboarded', 'true');
    setShowOnboarding(false);
  };

  const loadDiscoveries = async () => {
    try {
      const items = await dbService.getAllDiscoveries();
      setDiscoveries(items);
    } catch (err) {
      console.error('Failed to load discoveries from DB', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiscoveries();
    syncFaviconWithInactivity();
    const { wasReturning, hoursInactive } = recordCuratorActivity();
    if (wasReturning) {
      setWelcomeBackBanner({
        show: true,
        hours: hoursInactive,
        message:
          hoursInactive >= 72
            ? `You saved us! Inactive for ${Math.floor(hoursInactive / 24)} days — your mascot was literally melting! Favicon restored to pristine yellow.`
            : `Welcome back! Inactive for ${hoursInactive} hours. Mascot favicon restored from pleading to pristine yellow.`,
      });
    }
    checkInactivityNotification();
  }, []);

  const navigateTo = (view: string, param?: string) => {
    if (param && view === 'detail') {
      setSelectedDiscoveryId(param);
    }
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectedDiscovery = discoveries.find(d => d.id === selectedDiscoveryId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4EBDD] text-[#282722]">
        <div className="text-center p-6 bg-white border-2 border-black rounded-2xl shadow-brutal max-w-xs mx-auto">
          <div className="w-10 h-10 border-4 border-black border-t-[#E8B92D] rounded-full animate-spin mx-auto mb-3" role="status" aria-label="Loading" />
          <h2 className="font-heading font-extrabold text-base tracking-wider uppercase">Entering Museum</h2>
          <p className="text-xs text-gray-500 font-mono mt-1">Loading local IndexedDB…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4EBDD] text-[#282722] selection:bg-[#E8B92D] flex flex-col items-center">
      {/* Mobile-optimized Container */}
      <div className="w-full max-w-2xl min-h-screen relative flex flex-col bg-[#F4EBDD]">
        
        {/* Duolingo Re-engagement Welcome Banner */}
        {welcomeBackBanner?.show && (
          <div className="mx-4 mt-3 bg-[#FFFDF9] border-2 border-black p-3.5 rounded-2xl shadow-brutal flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#E8B92D] border-2 border-black flex items-center justify-center flex-shrink-0">
                <IconFlame size={16} className="text-black" />
              </div>
              <div>
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#D66A4A] block">
                  Curator Re-Engagement
                </span>
                <p className="text-xs font-mono font-bold text-black leading-tight mt-0.5">
                  {welcomeBackBanner.message}
                </p>
              </div>
            </div>
            <button
              onClick={() => setWelcomeBackBanner(null)}
              className="w-6 h-6 rounded-full border border-black bg-white flex items-center justify-center hover:bg-gray-100 cursor-pointer flex-shrink-0"
              aria-label="Dismiss banner"
            >
              <IconClose size={10} />
            </button>
          </div>
        )}

        {/* Active Classroom Expedition HUD Banner */}
        {activeClassExpedition && (
          <div className="mx-4 mt-3 bg-[#282722] text-white border-2 border-black p-3.5 rounded-2xl shadow-brutal flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#D66A4A] text-white border border-white/30 flex items-center justify-center flex-shrink-0">
                <IconGraduationCap size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#E8B92D] block truncate">
                  Class Assignment Active · {activeClassExpedition.instructorName}
                </span>
                <p className="text-xs font-mono font-bold text-white truncate">
                  {activeClassExpedition.className}
                </p>
                <p className="text-[10px] font-mono text-gray-300 truncate">
                  Target: {activeClassExpedition.targetPoints} pts · {activeClassExpedition.objective}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowTeacherMode(true)}
                className="btn-secondary py-1 px-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
              >
                Inspect
              </button>
              <button
                type="button"
                onClick={() => {
                  teacherService.clearActiveClassExpedition();
                  setActiveClassExpedition(null);
                }}
                className="w-6 h-6 rounded-full border border-white/20 bg-black/40 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer"
                title="Leave class hunt"
                aria-label="Leave class hunt"
              >
                <IconClose size={10} />
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 w-full" role="main">
          {currentView === 'home' && (
            <Home 
              discoveries={discoveries} 
              nickname={nickname}
              onNavigate={navigateTo} 
              onOpenHelp={() => setShowHelp(true)}
              onOpenPvp={() => setShowPvpArena(true)}
              onOpenTeacherMode={() => setShowTeacherMode(true)}
            />
          )}
          {currentView === 'capture' && (
            <Capture 
              onSaveComplete={() => { 
                loadDiscoveries(); 
                if (!activeSpeedBlitz) {
                  setCurrentView('collection'); 
                }
              }}
              activeBlitz={activeSpeedBlitz}
              activeClassExpedition={activeClassExpedition}
              onFinishBlitz={handleFinishBlitz}
              onAddBlitzPoints={handleAddBlitzPoints}
            />
          )}
          {currentView === 'collection' && (
            <Collection
              discoveries={discoveries}
              onSelectDiscovery={(id) => navigateTo('detail', id)}
              onNavigateCapture={() => setCurrentView('capture')}
            />
          )}
          {currentView === 'detail' && selectedDiscovery && (
            <Detail
              discovery={selectedDiscovery}
              onBack={() => setCurrentView('collection')}
              onUpdate={loadDiscoveries}
              onDelete={() => { 
                loadDiscoveries(); 
                setCurrentView('collection'); 
              }}
            />
          )}
          {currentView === 'detail' && !selectedDiscovery && (
            <NotFound
              missingId={selectedDiscoveryId}
              onGoHome={() => setCurrentView('home')}
              onGoCollection={() => setCurrentView('collection')}
            />
          )}
          {!['home', 'capture', 'collection', 'detail', 'hall', 'profile'].includes(currentView) && (
            <NotFound
              onGoHome={() => setCurrentView('home')}
              onGoCollection={() => setCurrentView('collection')}
            />
          )}
          {currentView === 'hall' && (
            <HallOfFame
              discoveries={discoveries}
              onSelectDiscovery={(id) => navigateTo('detail', id)}
              onNavigateCapture={() => setCurrentView('capture')}
              onNavigateCollection={() => setCurrentView('collection')}
            />
          )}
          {currentView === 'profile' && (
            <Profile 
              discoveries={discoveries} 
              nickname={nickname}
              onUpdateNickname={setNickname}
              onImportComplete={loadDiscoveries}
              onOpenHelp={() => setShowHelp(true)}
              onOpenPvp={() => setShowPvpArena(true)}
              onOpenTeacherMode={() => setShowTeacherMode(true)}
              canInstall={!!deferredPrompt}
              isInstalled={isInstalled}
              onInstall={handleInstallApp}
            />
          )}
        </main>

        {/* First-time Onboarding Interactive Tour */}
        <OnboardingModal
          isOpen={showOnboarding}
          onClose={handleCloseOnboarding}
        />

        {/* Global Field Guide & FAQ Modal */}
        <HelpModal
          isOpen={showHelp}
          onClose={() => setShowHelp(false)}
          onReplayTour={() => setShowOnboarding(true)}
          onOpenPrivacy={() => setShowPrivacy(true)}
        />

        {/* Global Privacy & Zero-Cookie Policy Modal */}
        <PrivacyModal
          isOpen={showPrivacy}
          onClose={() => setShowPrivacy(false)}
        />

        {/* P2P Multiplayer Battle Arena Modal */}
        <PvpArenaModal
          isOpen={showPvpArena}
          onClose={() => setShowPvpArena(false)}
          nickname={nickname}
          discoveries={discoveries}
          onStartSpeedBlitz={handleStartSpeedBlitz}
        />

        {/* Academic Terminal & Teacher Mode Modal */}
        <TeacherModeModal
          isOpen={showTeacherMode}
          onClose={() => {
            setShowTeacherMode(false);
            // The student may have joined or left a class inside the terminal.
            setActiveClassExpedition(teacherService.getActiveClassExpedition());
          }}
          nickname={nickname}
          discoveries={discoveries}
          onClassJoined={(expedition) => {
            // Student device: the teacher's Master QR starts the hunt for everyone who scans it.
            setActiveClassExpedition(expedition);
            setShowTeacherMode(false);
            setCurrentView('capture');
          }}
        />

        {/* Speed Blitz Battle Verdict Dialog */}
        {blitzVerdict && (
          <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none"
            role="dialog"
            aria-modal="true"
          >
            <div className="editorial-card bg-[#F4EBDD] p-6 rounded-3xl max-w-sm w-full border-3 border-black shadow-brutal-lg text-center space-y-4">
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#D66A4A] uppercase block">
                Speed Blitz Battle Settle
              </span>
              <h2 className="font-heading font-extrabold text-2xl text-black">
                {blitzVerdict.outcome === 'VICTORY' && 'VICTORY! SQUAD TRIUMPH'}
                {blitzVerdict.outcome === 'DEFEAT' && 'CHALLENGER DEFEATED YOU'}
                {blitzVerdict.outcome === 'DRAW' && 'DRAW! HONORS EVEN'}
              </h2>

              <div className="bg-[#FFFDF9] border-2 border-black rounded-2xl p-4 shadow-brutal-sm font-mono text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-500 uppercase">You ({blitzVerdict.playerTeam}):</span>
                  <span className="font-bold text-black text-sm">{blitzVerdict.playerScore} pts</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-500 uppercase">{blitzVerdict.opponentName}:</span>
                  <span className="font-bold text-black text-sm">{blitzVerdict.opponentScore} pts</span>
                </div>
                <div className="pt-2 border-t border-black/10 flex justify-between font-bold text-black">
                  <span>Delta:</span>
                  <span>{blitzVerdict.pointsDelta >= 0 ? `+${blitzVerdict.pointsDelta}` : blitzVerdict.pointsDelta} pts</span>
                </div>
              </div>

              <p className="text-xs font-mono text-gray-600">
                Logged to your permanent Battle Ledger ({blitzVerdict.verificationHash}).
              </p>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleShareBlitzVerdict}
                  disabled={sharingPlacard}
                  className="w-full btn-secondary py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer border-2 border-black shadow-brutal-sm flex items-center justify-center gap-1.5"
                >
                  <span>{sharingPlacard ? 'Rendering Placard…' : 'Export / Share Battle Placard'}</span>
                </button>

                {blitzVerdict.outcome === 'DRAW' && (
                  <button
                    type="button"
                    onClick={() => {
                      const opp = {
                        opponentName: blitzVerdict.opponentName,
                        opponentTeam: blitzVerdict.opponentTeam,
                        opponentTeamTag: 'TIE',
                        opponentScore: blitzVerdict.opponentScore,
                        durationMinutes: 2,
                      };
                      setBlitzVerdict(null);
                      handleStartSpeedBlitz(opp);
                    }}
                    className="w-full bg-[#D66A4A] text-white py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer border-2 border-black shadow-brutal-sm"
                  >
                    Launch 2-Min Sudden Death Duel!
                  </button>
                )}

                <button
                  onClick={() => setBlitzVerdict(null)}
                  className="w-full btn-primary py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-brutal"
                >
                  Continue Expedition →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5-Destination Custom Bottom Navigation Bar */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-50 bg-[#FFFDF9] border-t-2 border-black max-w-2xl mx-auto shadow-[0_-3px_0px_#282722] pb-[env(safe-area-inset-bottom)] select-none"
          aria-label="Primary navigation"
        >
          <div className="grid grid-cols-5 items-end h-16 px-1">
            
            {/* 1. Home */}
            <button
              onClick={() => setCurrentView('home')}
              className={`flex flex-col items-center justify-center h-full transition-colors cursor-pointer ${
                currentView === 'home' ? 'text-[#D66A4A]' : 'text-gray-500 hover:text-black'
              }`}
              aria-label="Home"
              aria-current={currentView === 'home' ? 'page' : undefined}
            >
              <IconHome size={22} filled={currentView === 'home'} />
              <span className={`text-[10px] font-heading font-bold mt-1 tracking-wider uppercase ${
                currentView === 'home' ? 'text-[#D66A4A]' : 'text-gray-600'
              }`}>
                Home
              </span>
            </button>

            {/* 2. Collection */}
            <button
              onClick={() => setCurrentView('collection')}
              className={`flex flex-col items-center justify-center h-full transition-colors cursor-pointer ${
                currentView === 'collection' ? 'text-[#D66A4A]' : 'text-gray-500 hover:text-black'
              }`}
              aria-label="Collection"
              aria-current={currentView === 'collection' ? 'page' : undefined}
            >
              <IconGrid size={22} filled={currentView === 'collection'} />
              <span className={`text-[10px] font-heading font-bold mt-1 tracking-wider uppercase ${
                currentView === 'collection' ? 'text-[#D66A4A]' : 'text-gray-600'
              }`}>
                Archive
              </span>
            </button>

            {/* 3. Center Prominent Capture Button */}
            <div className="flex flex-col items-center justify-center relative -top-3">
              <button
                onClick={() => setCurrentView('capture')}
                className={`w-14 h-14 rounded-full border-2 border-black flex items-center justify-center text-3xl font-extrabold cursor-pointer transition-transform duration-150 ${
                  currentView === 'capture'
                    ? 'bg-black text-[#E8B92D] scale-105 shadow-[0px_0px_0px_3px_#E8B92D]'
                    : 'bg-[#E8B92D] text-black shadow-brutal hover:scale-105 active:scale-95 active:shadow-none'
                }`}
                title="Capture a new typo"
                aria-label="Capture a new typo"
              >
                +
              </button>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-black mt-0.5">
                Spot
              </span>
            </div>

            {/* 4. Legends / Hall of Fame */}
            <button
              onClick={() => setCurrentView('hall')}
              className={`flex flex-col items-center justify-center h-full transition-colors cursor-pointer ${
                currentView === 'hall' ? 'text-[#D66A4A]' : 'text-gray-500 hover:text-black'
              }`}
              aria-label="Hall of Fame"
              aria-current={currentView === 'hall' ? 'page' : undefined}
            >
              <IconAward size={22} filled={currentView === 'hall'} />
              <span className={`text-[10px] font-heading font-bold mt-1 tracking-wider uppercase ${
                currentView === 'hall' ? 'text-[#D66A4A]' : 'text-gray-600'
              }`}>
                Legends
              </span>
            </button>

            {/* 5. Profile */}
            <button
              onClick={() => setCurrentView('profile')}
              className={`flex flex-col items-center justify-center h-full transition-colors cursor-pointer ${
                currentView === 'profile' ? 'text-[#D66A4A]' : 'text-gray-500 hover:text-black'
              }`}
              aria-label="Profile"
              aria-current={currentView === 'profile' ? 'page' : undefined}
            >
              <IconUser size={22} filled={currentView === 'profile'} />
              <span className={`text-[10px] font-heading font-bold mt-1 tracking-wider uppercase ${
                currentView === 'profile' ? 'text-[#D66A4A]' : 'text-gray-600'
              }`}>
                Curator
              </span>
            </button>

          </div>
        </nav>

      </div>
    </div>
  );
}

export default App;
