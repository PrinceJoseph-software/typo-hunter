/**
 * @file PvpArenaModal.tsx
 * @description Peer-to-Peer Multiplayer Battle Arena, QR-Activated Speed Blitz Battles,
 * Sudden-Death Tie-Breakers, Squad Selector, and Shareable Victory Placards.
 *
 * ARCHITECTURAL DESIGN:
 * Operates offline with zero server dependencies:
 *   - Optical Battle Scan: Scan a rival's pass to retrieve their live metrics and battle.
 *   - Speed Blitz: both players start at 0; at the end they swap result QRs to settle.
 *   - Real-Time Opponent Score Tracking: Opponent's baseline score is transmitted via QR.
 *   - Shareable Victory Placards: Exports 1080x1350 JPEG placards via HTML5 Canvas.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import QRCode from 'qrcode';
import { Discovery } from '../db/database';
import { useHunterPoints } from '../hooks/useHunterPoints';
import { getDeviceId } from '../utils/identity';
import {
  pvpService,
  CuratorTeam,
  PRESET_TEAMS,
  SQUAD_RULES,
  PvpMatchRecord,
  SpeedBlitzPayload,
  SquadMember,
  SquadTeam,
  SquadBattleResult,
} from '../utils/pvpService';
import { BattleQrScannerModal } from './BattleQrScannerModal';
import { generatePvpVictoryCardBlob, shareOrDownloadBlob } from '../utils/shareCard';
import {
  IconClose,
  IconSwords,
  IconTimer,
  IconUsers,
  IconTrophy,
  IconCheck,
  IconQrCode,
  IconCamera,
  IconDownload,
  IconTrash,
} from './Icons';

interface PvpArenaModalProps {
  isOpen: boolean;
  onClose: () => void;
  nickname: string;
  discoveries: Discovery[];
  onStartSpeedBlitz: (blitz: {
    battleId: string;
    role: 'host' | 'join';
    opponentName: string;
    opponentTeam: string;
    opponentTeamTag: string;
    durationMinutes: number;
  }) => void;
  /** Open on a specific tab (e.g. after a blitz, to start a rematch). */
  initialTab?: 'timer' | 'duel' | 'team' | 'history';
}

export const PvpArenaModal: React.FC<PvpArenaModalProps> = ({
  isOpen,
  onClose,
  nickname,
  discoveries,
  onStartSpeedBlitz,
  initialTab,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, isOpen, onClose);

  const [activeTab, setActiveTab] = useState<'timer' | 'duel' | 'team' | 'history'>('timer');
  useEffect(() => {
    if (isOpen && initialTab) setActiveTab(initialTab);
  }, [isOpen, initialTab]);
  const [currentTeam, setCurrentTeam] = useState<CuratorTeam>(() => pvpService.getCurrentTeam());
  const [history, setHistory] = useState<PvpMatchRecord[]>([]);
  const [stats, setStats] = useState(pvpService.getPvpStats());

  // Quick Duel State
  const totalPoints = useHunterPoints();
  const specimenCount = discoveries.length;
  const legendCount = discoveries.filter(d => d.isHallOfFame).length;

  // Quick Duel opponent: only ever a real friend (scanned pass or manually entered score).
  const [challenger, setChallenger] = useState<{
    opponentName: string;
    opponentTeam: CuratorTeam;
    opponentScore: number;
    opponentSpecimens: number;
    opponentLegends: number;
  } | null>(null);
  const [duelResult, setDuelResult] = useState<PvpMatchRecord | null>(null);
  const [customOpponentScore, setCustomOpponentScore] = useState<string>('');
  const [customOpponentName, setCustomOpponentName] = useState<string>('');
  const [sharingPlacard, setSharingPlacard] = useState(false);

  // Speed Blitz QR State
  const [blitzSubTab, setBlitzSubTab] = useState<'host' | 'scan'>('host');
  const [huntDuration, setHuntDuration] = useState<3 | 5 | 10>(5);
  const [hostedBlitzQr, setHostedBlitzQr] = useState<string | null>(null);
  const [hostedBlitzPayload, setHostedBlitzPayload] = useState<SpeedBlitzPayload | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [scannerMode, setScannerMode] = useState<'blitz' | 'pass'>('blitz');

  // Multi-Hunter Squad Battle State (Supports 3v3, 3v2, 4v1, N vs M)
  const [squadTeamA, setSquadTeamA] = useState<SquadMember[]>([]);
  const [squadTeamB, setSquadTeamB] = useState<SquadMember[]>([]);
  const [squadScoringMode, setSquadScoringMode] = useState<'total' | 'average'>('average');
  const [squadClashResult, setSquadClashResult] = useState<SquadBattleResult | null>(null);
  const [scannerTargetTeam, setScannerTargetTeam] = useState<'teamA' | 'teamB' | null>(null);
  const [squadSubTab, setSquadSubTab] = useState<'battle' | 'allegiance'>('battle');
  const [squadNotice, setSquadNotice] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);

  const squadReadiness = pvpService.checkSquadReadiness(squadTeamA, squadTeamB);
  const squadsUneven = squadTeamA.length !== squadTeamB.length;
  // Uneven squads (3v2, 3v1, 4v2…) always use the Average handicap so headcount can't decide the match.
  const effectiveScoringMode: 'total' | 'average' = squadsUneven ? 'average' : squadScoringMode;

  useEffect(() => {
    if (isOpen) {
      const activeTeam = pvpService.getCurrentTeam();
      setCurrentTeam(activeTeam);
      setHistory(pvpService.getMatchHistory());
      setStats(pvpService.getPvpStats());

      // Initialize Squad Team A with host player
      setSquadTeamA([
        pvpService.createSquadMember({
          nickname: nickname || 'Hunter',
          points: totalPoints,
          specimens: specimenCount,
          legends: legendCount,
          teamTag: activeTeam.tag,
          isHost: true,
          deviceId: getDeviceId(),
        }),
      ]);

      // Team Omega starts empty: every rival must scan in with their own QR pass.
      setSquadTeamB([]);
      setSquadClashResult(null);
      setSquadNotice(null);
    }
  }, [isOpen, nickname, totalPoints, specimenCount, legendCount]);

  // Generate Speed Blitz QR for host
  const handleGenerateBlitzQr = (duration: 3 | 5 | 10) => {
    setHuntDuration(duration);
    const payload = pvpService.createSpeedBlitzPayload(nickname, duration, getDeviceId());
    setHostedBlitzPayload(payload);

    QRCode.toDataURL(JSON.stringify(payload), {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 220,
      color: {
        dark: '#282722',
        light: '#FFFDF9',
      },
    })
      .then(url => setHostedBlitzQr(url))
      .catch(err => console.error('Failed to generate Blitz QR', err));
  };

  useEffect(() => {
    if (isOpen && activeTab === 'timer' && blitzSubTab === 'host') {
      handleGenerateBlitzQr(huntDuration);
    }
  }, [isOpen, activeTab, blitzSubTab, nickname]);

  const handleHostStartBlitz = () => {
    if (!hostedBlitzPayload) return;
    onClose();
    onStartSpeedBlitz({
      battleId: hostedBlitzPayload.battleId,
      role: 'host',
      opponentName: 'your rival',
      opponentTeam: 'Rival',
      opponentTeamTag: 'VS',
      durationMinutes: hostedBlitzPayload.durationMinutes,
    });
  };

  const handleBlitzJoined = (payload: SpeedBlitzPayload) => {
    setShowQrScanner(false);
    onClose();
    onStartSpeedBlitz({
      battleId: payload.battleId,
      role: 'join',
      opponentName: payload.hostName,
      opponentTeam: payload.hostTeam,
      opponentTeamTag: payload.hostTeamTag,
      durationMinutes: payload.durationMinutes,
    });
  };

  const handleScanSquadMember = (team: 'A' | 'B') => {
    const roster = team === 'A' ? squadTeamA : squadTeamB;
    if (roster.length >= SQUAD_RULES.maxTeamSize) {
      setSquadNotice({ tone: 'warn', text: `Squads are capped at ${SQUAD_RULES.maxTeamSize} hunters.` });
      return;
    }
    setScannerTargetTeam(team === 'A' ? 'teamA' : 'teamB');
    setScannerMode('pass');
    setShowQrScanner(true);
  };

  const handleRemoveSquadMember = (team: 'A' | 'B', id: string) => {
    if (team === 'A') {
      setSquadTeamA(prev => prev.filter(m => m.id !== id || m.isHost));
    } else {
      setSquadTeamB(prev => prev.filter(m => m.id !== id));
    }
    setSquadClashResult(null);
  };

  const handleExecuteSquadClash = () => {
    if (!squadReadiness.ready) {
      setSquadNotice({ tone: 'warn', text: squadReadiness.reason });
      return;
    }
    const statsA = pvpService.calculateSquadStats(squadTeamA);
    const statsB = pvpService.calculateSquadStats(squadTeamB);

    const teamA: SquadTeam = {
      id: 'alpha',
      name: `[${currentTeam.tag}] ${currentTeam.name}`,
      members: squadTeamA,
      totalPoints: statsA.totalPoints,
      averagePoints: statsA.averagePoints,
    };

    const rivalFaction = squadTeamB[0]?.teamTag || 'RIV';
    const teamB: SquadTeam = {
      id: 'omega',
      name: `[${rivalFaction}] Rival Coalition`,
      members: squadTeamB,
      totalPoints: statsB.totalPoints,
      averagePoints: statsB.averagePoints,
    };

    const result = pvpService.resolveSquadClash(teamA, teamB, effectiveScoringMode);
    setSquadClashResult(result);
    setHistory(pvpService.getMatchHistory());
    setStats(pvpService.getPvpStats());
  };

  const handlePassScanned = (passData: {
    hunter: string;
    points: number;
    specimens: number;
    legends: number;
    rank?: string;
    team?: string;
    teamTag?: string;
    checksum?: string;
    deviceId?: string;
  }) => {
    setShowQrScanner(false);

    // If scanning for Multi-Hunter Squad Clash: every hunter must be a real, unique QR pass.
    if (scannerTargetTeam) {
      const isAlpha = scannerTargetTeam === 'teamA';
      const fingerprint = pvpService.passFingerprint(passData.hunter, passData.checksum);
      const duplicateIn = pvpService.findDuplicateHunter(squadTeamA, squadTeamB, passData.hunter, fingerprint, passData.deviceId);
      setScannerTargetTeam(null);
      setActiveTab('team');
      setSquadSubTab('battle');

      if (duplicateIn) {
        setSquadNotice({ tone: 'warn', text: `${passData.hunter} is already on ${duplicateIn}. Each hunter can only scan in once.` });
        return;
      }

      const fallbackTag = isAlpha
        ? currentTeam.tag
        : (PRESET_TEAMS.find(t => t.id !== currentTeam.id) || PRESET_TEAMS[1]).tag;
      const newMember = pvpService.createSquadMember({
        nickname: passData.hunter,
        points: passData.points,
        specimens: passData.specimens,
        legends: passData.legends,
        teamTag: passData.teamTag || fallbackTag,
        passFingerprint: fingerprint,
        verified: true,
        deviceId: passData.deviceId,
      });

      const nextA = isAlpha ? [...squadTeamA, newMember] : squadTeamA;
      const nextB = isAlpha ? squadTeamB : [...squadTeamB, newMember];
      if (isAlpha) setSquadTeamA(nextA);
      else setSquadTeamB(nextB);
      setSquadClashResult(null);

      const readiness = pvpService.checkSquadReadiness(nextA, nextB);
      setSquadNotice({
        tone: readiness.ready ? 'ok' : 'warn',
        text: `${passData.hunter} joined ${isAlpha ? 'Team Alpha' : 'Team Omega'} (${passData.points} pts). ${readiness.reason}`,
      });
      return;
    }

    // Default 1v1 Quick Duel handling:
    setActiveTab('duel');
    setCustomOpponentName(passData.hunter);
    setCustomOpponentScore(String(passData.points));

    // Update challenger visualizer with scanned rival info
    setChallenger({
      opponentName: passData.hunter,
      opponentTeam: {
        id: 'scanned',
        name: passData.team || 'Rival Curators',
        tag: passData.teamTag || (passData.hunter.slice(0, 3) || 'RIV').toUpperCase(),
        motto: 'Optical Peer Challenger',
        badgeBg: '#282722',
        badgeText: '#E8B92D',
      },
      opponentScore: passData.points,
      opponentSpecimens: passData.specimens,
      opponentLegends: passData.legends,
    });

    // Execute duel immediately against the scanned player!
    const result = pvpService.resolveDuel(
      nickname,
      totalPoints,
      specimenCount,
      legendCount,
      passData.hunter,
      passData.team || 'Rival Curators',
      passData.points
    );
    setDuelResult(result);
    setHistory(pvpService.getMatchHistory());
    setStats(pvpService.getPvpStats());
  };

  const manualScore = parseInt(customOpponentScore, 10);
  const hasManualRival = customOpponentName.trim().length > 0 && Number.isFinite(manualScore) && manualScore >= 0;
  const canDuel = !!challenger || hasManualRival;

  const handleExecuteDuel = () => {
    if (!canDuel) return;
    const oppName = customOpponentName.trim() || challenger!.opponentName;
    const oppTeam = challenger?.opponentTeam.name || 'Friend';
    const oppScore = hasManualRival ? manualScore : challenger!.opponentScore;

    const result = pvpService.resolveDuel(
      nickname,
      totalPoints,
      specimenCount,
      legendCount,
      oppName,
      oppTeam,
      oppScore
    );

    setDuelResult(result);
    setHistory(pvpService.getMatchHistory());
    setStats(pvpService.getPvpStats());
  };

  const handleShareVictoryPlacard = async (match: PvpMatchRecord) => {
    setSharingPlacard(true);
    try {
      const blob = await generatePvpVictoryCardBlob(match);
      await shareOrDownloadBlob(
        blob,
        `typo-hunter-pvp-${match.outcome.toLowerCase()}-${match.id}.jpg`,
        `Typo Hunter PvP Battle: ${match.playerNickname} vs ${match.opponentName}`,
        `Curatorial PvP Match: ${match.playerNickname} scored ${match.playerScore} pts vs ${match.opponentName} (${match.opponentScore} pts)!`
      );
    } catch (err) {
      console.error('Failed to export PvP victory placard', err);
    } finally {
      setSharingPlacard(false);
    }
  };

  const handleSelectTeam = (team: CuratorTeam) => {
    pvpService.setCurrentTeam(team.id);
    setCurrentTeam(team);
    handleGenerateBlitzQr(huntDuration);
  };

  const handleClearHistory = () => {
    pvpService.clearHistory();
    setHistory([]);
    setStats(pvpService.getPvpStats());
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs select-none"
        ref={dialogRef}
      role="dialog"
        aria-modal="true"
        aria-label="P2P Multiplayer Arena"
      >
        <div className="editorial-card bg-[#F4EBDD] p-4 sm:p-5 rounded-3xl w-full max-w-[calc(100vw-1.5rem)] sm:max-w-lg relative shadow-brutal border-3 border-black flex flex-col max-h-[92vh] overflow-hidden box-border">
          {/* Arena Header */}
          <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-3.5 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-mono font-bold tracking-widest text-[#D66A4A] uppercase block">
                  Offline P2P Multiplayer
                </span>
                <span
                  className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border border-black uppercase shadow-xs"
                  style={{ backgroundColor: currentTeam.badgeBg, color: currentTeam.badgeText }}
                >
                  [{currentTeam.tag}] {currentTeam.name}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold font-heading text-black leading-tight flex items-center gap-2">
                <IconSwords size={22} className="text-[#D66A4A]" />
                Curator Battle Arena
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full border-2 border-black bg-white flex items-center justify-center hover:bg-gray-100 cursor-pointer shadow-brutal-sm"
              aria-label="Close Arena"
            >
              <IconClose size={12} />
            </button>
          </div>

          {/* 4-Tab Navigation (Responsive Grid, Never Overflows) */}
          <div className="grid grid-cols-4 bg-[#FFFDF9] border-2 border-black rounded-xl p-1 mb-3.5 shadow-brutal-sm text-[11px] sm:text-xs font-mono font-bold flex-shrink-0 gap-1">
            <button
              onClick={() => setActiveTab('timer')}
              className={`py-1.5 px-0.5 rounded-lg text-center cursor-pointer transition-colors flex items-center justify-center gap-1 min-w-0 ${
                activeTab === 'timer' ? 'bg-black text-[#E8B92D]' : 'text-gray-600 hover:text-black'
              }`}
              title="Speed Blitz"
            >
              <IconTimer size={12} className="flex-shrink-0" />
              <span className="truncate">Blitz</span>
            </button>
            <button
              onClick={() => setActiveTab('duel')}
              className={`py-1.5 px-0.5 rounded-lg text-center cursor-pointer transition-colors flex items-center justify-center gap-1 min-w-0 ${
                activeTab === 'duel' ? 'bg-black text-[#E8B92D]' : 'text-gray-600 hover:text-black'
              }`}
              title="Quick Duel"
            >
              <IconSwords size={12} className="flex-shrink-0" />
              <span className="truncate">Duel</span>
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`py-1.5 px-0.5 rounded-lg text-center cursor-pointer transition-colors flex items-center justify-center gap-1 min-w-0 ${
                activeTab === 'team' ? 'bg-black text-[#E8B92D]' : 'text-gray-600 hover:text-black'
              }`}
              title="Curator Squads"
            >
              <IconUsers size={12} className="flex-shrink-0" />
              <span className="truncate">Squad</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-1.5 px-0.5 rounded-lg text-center cursor-pointer transition-colors flex items-center justify-center gap-1 min-w-0 ${
                activeTab === 'history' ? 'bg-black text-[#E8B92D]' : 'text-gray-600 hover:text-black'
              }`}
              title="Past Wins & History"
            >
              <IconTrophy size={12} className="flex-shrink-0" />
              <span className="truncate">Wins ({stats.wins})</span>
            </button>
          </div>

          {/* Scrollable Tab Content Container */}
          <div className="overflow-y-auto px-1 pb-2 flex-1 space-y-4">
            {/* TAB 1: SPEED BLITZ QR BATTLES */}
            {activeTab === 'timer' && (
              <div className="space-y-4">
                {/* Mode Selector: Host vs Scan */}
                <div className="flex bg-[#FAF6EE] border-2 border-black rounded-xl p-1 text-xs font-mono font-bold">
                  <button
                    onClick={() => setBlitzSubTab('host')}
                    className={`flex-1 py-2 rounded-lg text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                      blitzSubTab === 'host' ? 'bg-black text-[#E8B92D] shadow-sm' : 'text-gray-600'
                    }`}
                  >
                    <IconQrCode size={13} />
                    <span>Host with QR</span>
                  </button>
                  <button
                    onClick={() => setBlitzSubTab('scan')}
                    className={`flex-1 py-2 rounded-lg text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                      blitzSubTab === 'scan' ? 'bg-black text-[#E8B92D] shadow-sm' : 'text-gray-600'
                    }`}
                  >
                    <IconCamera size={13} />
                    <span>Scan Friend's QR</span>
                  </button>
                </div>

                {/* HOST MODE: SHOW BATTLE QR */}
                {blitzSubTab === 'host' && (
                  <div className="bg-[#FFFDF9] border-2 border-black rounded-2xl p-4 shadow-brutal-sm text-center">
                    <span className="text-[10px] font-mono font-bold tracking-widest text-[#D66A4A] uppercase block mb-1">
                      Step 1 · Host Battle Screen
                    </span>
                    <h3 className="font-heading font-extrabold text-lg text-black">
                      Speed Blitz Battle QR
                    </h3>
                    <p className="text-[11px] font-mono text-gray-600 mt-0.5 max-w-xs mx-auto">
                      Your rival scans this QR, then you both tap start. Each of you starts at 0, and only photos taken during the round count. When time's up, swap result QRs to see who won.
                    </p>

                    {/* Duration Buttons */}
                    <div className="flex justify-center gap-1.5 my-3">
                      {([3, 5, 10] as const).map((duration) => (
                        <button
                          key={duration}
                          onClick={() => handleGenerateBlitzQr(duration)}
                          className={`px-3 py-1 rounded-lg border-2 border-black text-xs font-mono font-bold cursor-pointer ${
                            huntDuration === duration
                              ? 'bg-black text-[#E8B92D] shadow-brutal-sm'
                              : 'bg-white text-gray-700'
                          }`}
                        >
                          {duration} Mins
                        </button>
                      ))}
                    </div>

                    {/* QR Code Graphic Frame */}
                    <div className="inline-block bg-white p-3 rounded-2xl border-2 border-black shadow-brutal mb-3">
                      {hostedBlitzQr ? (
                        <img
                          src={hostedBlitzQr}
                          alt="Speed Blitz QR Code"
                          className="w-44 h-44 object-contain mx-auto"
                        />
                      ) : (
                        <div className="w-44 h-44 flex items-center justify-center text-xs font-mono text-gray-400">
                          Generating QR…
                        </div>
                      )}
                      <span className="text-[10px] font-mono font-bold uppercase text-gray-700 block mt-1">
                        [{currentTeam.tag}] {nickname} · {huntDuration} min · both start at 0
                      </span>
                    </div>

                    {/* Host Action: Start Hunt */}
                    <button
                      onClick={handleHostStartBlitz}
                      className="w-full btn-primary py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-brutal flex items-center justify-center gap-2"
                    >
                      <IconCamera size={14} />
                      <span>Start My Blitz & Go to Camera →</span>
                    </button>
                  </div>
                )}

                {/* SCAN MODE: JOIN RIVAL'S QR */}
                {blitzSubTab === 'scan' && (
                  <div className="bg-[#FFFDF9] border-2 border-black rounded-2xl p-5 shadow-brutal-sm text-center space-y-3">
                    <span className="text-[10px] font-mono font-bold tracking-widest text-[#D66A4A] uppercase block">
                      Step 2 · Scan Friend's Screen
                    </span>
                    <h3 className="font-heading font-extrabold text-xl text-black">
                      Join Rival's Speed Blitz
                    </h3>
                    <p className="text-xs font-mono text-gray-600 max-w-xs mx-auto leading-relaxed">
                      Scan the host's Speed Blitz QR. Your timer starts right away and you go straight to the camera. When time's up, swap result QRs to settle it.
                    </p>

                    <div className="p-4 bg-[#FAF6EE] rounded-2xl border-2 border-dashed border-black my-2 flex flex-col items-center justify-center gap-2">
                      <div className="w-14 h-14 bg-[#E8B92D] border-2 border-black rounded-full flex items-center justify-center shadow-brutal-sm">
                        <IconCamera size={26} className="text-black" />
                      </div>
                      <span className="text-xs font-mono font-bold text-black">
                        Point at friend's Speed Blitz QR
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setScannerMode('blitz');
                        setShowQrScanner(true);
                      }}
                      className="w-full btn-primary py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-brutal flex items-center justify-center gap-2"
                    >
                      <IconQrCode size={15} />
                      <span>Open Camera QR Scanner</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: QUICK DUEL */}
            {activeTab === 'duel' && (
              <div className="space-y-4">
                {/* Scan Friend's Pass & Battle Button */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setScannerMode('pass');
                      setShowQrScanner(true);
                    }}
                    className="flex-1 btn-primary py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 shadow-brutal-sm"
                  >
                    <IconQrCode size={14} className="text-[#D66A4A]" />
                    <span>Scan Rival Pass & Battle</span>
                  </button>
                </div>

                {/* VS Battle Visualizer Card */}
                <div className="bg-[#FFFDF9] border-2 border-black rounded-2xl p-4 shadow-brutal-sm">
                  <div className="grid grid-cols-5 items-center text-center">
                    {/* Player Side */}
                    <div className="col-span-2 bg-[#FAF6EE] p-2.5 rounded-xl border border-black/20">
                      <span
                        className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-black block mb-1 truncate"
                        style={{ backgroundColor: currentTeam.badgeBg, color: currentTeam.badgeText }}
                      >
                        [{currentTeam.tag}] {currentTeam.name}
                      </span>
                      <h3 className="font-heading font-extrabold text-sm text-black truncate">
                        {nickname || 'Hunter'}
                      </h3>
                      <div className="mt-1 font-heading font-extrabold text-2xl text-black leading-none">
                        {totalPoints}
                      </div>
                      <span className="text-[10px] font-mono uppercase text-gray-500 font-bold block mt-0.5">
                        {specimenCount} Specs · {legendCount} Legends
                      </span>
                    </div>

                    {/* VS Emblem */}
                    <div className="col-span-1 flex flex-col items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-[#D66A4A] text-white border-2 border-black font-extrabold text-xs flex items-center justify-center shadow-brutal-sm">
                        VS
                      </div>
                    </div>

                    {/* Opponent Side */}
                    {challenger || hasManualRival ? (
                    <div className="col-span-2 bg-[#FAF6EE] p-2.5 rounded-xl border border-black/20">
                      <span
                        className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-black block mb-1 truncate"
                        style={{
                          backgroundColor: challenger?.opponentTeam.badgeBg || '#282722',
                          color: challenger?.opponentTeam.badgeText || '#E8B92D',
                        }}
                      >
                        [{challenger?.opponentTeam.tag || 'FRND'}] {challenger?.opponentTeam.name || 'Friend'}
                      </span>
                      <h3 className="font-heading font-extrabold text-sm text-black truncate">
                        {customOpponentName.trim() || challenger?.opponentName}
                      </h3>
                      <div className="mt-1 font-heading font-extrabold text-2xl text-black leading-none">
                        {hasManualRival ? manualScore : challenger?.opponentScore}
                      </div>
                      <span className="text-[10px] font-mono uppercase text-gray-500 font-bold block mt-0.5">
                        {challenger ? `${challenger.opponentSpecimens} Specs · ${challenger.opponentLegends} Legends` : 'Manual entry'}
                      </span>
                    </div>
                    ) : (
                      <div className="col-span-2 p-2.5 rounded-xl border-2 border-dashed border-black/30 text-[10px] font-mono text-gray-500">
                        Waiting for a rival. Scan their Curator Pass QR.
                      </div>
                    )}
                  </div>

                  {/* Duel Outcome Banner */}
                  {duelResult && (
                    <div
                      className={`mt-3 p-3 rounded-xl border-2 border-black text-center font-mono ${
                        duelResult.outcome === 'VICTORY'
                          ? 'bg-[#EBF3E8] text-[#2D5A27]'
                          : duelResult.outcome === 'DEFEAT'
                          ? 'bg-[#FDF2F0] text-[#D66A4A]'
                          : 'bg-[#FFF9EC] text-black'
                      }`}
                    >
                      <div className="font-extrabold font-heading text-lg">
                        {duelResult.outcome === 'VICTORY' && 'VICTORY! SQUAD TRIUMPH'}
                        {duelResult.outcome === 'DEFEAT' && 'DEFEAT! CHALLENGER PREVAILED'}
                        {duelResult.outcome === 'DRAW' && 'HONORS EVEN! EXACT TIE'}
                      </div>
                      <p className="text-xs font-bold mt-0.5">
                        {duelResult.outcome === 'VICTORY'
                          ? `You defeated ${duelResult.opponentName} by +${duelResult.pointsDelta} curatorial points!`
                          : duelResult.outcome === 'DEFEAT'
                          ? `You trailed by ${Math.abs(duelResult.pointsDelta)} points. Enshrine more legends to win.`
                          : `Tied at ${duelResult.playerScore} points!`}
                      </p>
                      <span className="text-[10px] text-gray-500 block mt-1">
                        Verification Hash: <code>{duelResult.verificationHash}</code>
                      </span>

                      {/* Export / Share Victory Placard Button */}
                      <div className="mt-3 pt-2 border-t border-black/15 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleShareVictoryPlacard(duelResult)}
                          disabled={sharingPlacard}
                          className="flex-1 btn-primary py-2 px-3 rounded-lg text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <IconDownload size={13} />
                          <span>{sharingPlacard ? 'Rendering Placard…' : 'Share Battle Placard'}</span>
                        </button>
                      </div>

                      {/* Tie: settle it with a real two-player Speed Blitz */}
                      {duelResult.outcome === 'DRAW' && (
                        <div className="mt-3 pt-2.5 border-t-2 border-black/20 text-center space-y-1.5">
                          <span className="text-[10px] font-mono font-bold uppercase text-[#D66A4A] tracking-wider block">
                            Tied! Break it with a Speed Blitz
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('timer');
                              setBlitzSubTab('host');
                            }}
                            className="w-full bg-[#D66A4A] text-white py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer border-2 border-black shadow-brutal flex items-center justify-center gap-1.5 hover:bg-[#c25a3c]"
                          >
                            <IconSwords size={14} />
                            <span>Host a Tie-Break Blitz</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Execute Battle Button */}
                <button
                  onClick={handleExecuteDuel}
                  disabled={!canDuel}
                  className="w-full btn-primary py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-brutal flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <IconSwords size={14} />
                  <span>Execute PvP Battle</span>
                </button>

                {/* Manual Score Input */}
                <div className="bg-white border-2 border-black rounded-xl p-3 text-xs font-mono">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                    Or Enter Rival's Score Manually:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={customOpponentName}
                      onChange={(e) => setCustomOpponentName(e.target.value)}
                      placeholder="Friend's Name"
                      className="p-2 border border-black rounded-lg text-xs font-bold"
                    />
                    <input
                      type="number"
                      value={customOpponentScore}
                      onChange={(e) => setCustomOpponentScore(e.target.value)}
                      placeholder="Friend's Points"
                      className="p-2 border border-black rounded-lg text-xs font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: MULTI-HUNTER SQUAD CLASH & FACTIONS */}
            {activeTab === 'team' && (
              <div className="space-y-3 font-mono text-xs">
                {/* Sub-Tab Navigation */}
                <div className="flex bg-white border border-black rounded-lg p-0.5 gap-1">
                  <button
                    type="button"
                    onClick={() => setSquadSubTab('battle')}
                    className={`flex-1 py-1.5 px-2 rounded-md font-bold text-[10px] uppercase tracking-wider cursor-pointer transition-colors flex items-center justify-center gap-1 ${
                      squadSubTab === 'battle' ? 'bg-[#D66A4A] text-white shadow-xs' : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    <IconSwords size={12} />
                    <span>Squad Clash ({squadTeamA.length}v{squadTeamB.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSquadSubTab('allegiance')}
                    className={`flex-1 py-1.5 px-2 rounded-md font-bold text-[10px] uppercase tracking-wider cursor-pointer transition-colors flex items-center justify-center gap-1 ${
                      squadSubTab === 'allegiance' ? 'bg-black text-[#E8B92D] shadow-xs' : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    <IconUsers size={12} />
                    <span>Faction Allegiance</span>
                  </button>
                </div>

                {squadSubTab === 'battle' ? (
                  /* SUB-VIEW 1: MULTI-HUNTER SQUAD BATTLE ARENA (3v3, 3v2, 4v1) */
                  <div className="space-y-3">
                    {/* Scoring Mode Toggle */}
                    <div className="bg-white border-2 border-black rounded-xl p-2.5 space-y-1.5 shadow-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase text-gray-500">
                          Handicap & Scoring Rule:
                        </span>
                        <span className="text-[10px] font-bold text-[#D66A4A]">
                          {squadsUneven
                            ? 'UNEVEN SQUADS · AVERAGE LOCKED'
                            : effectiveScoringMode === 'average' ? 'FAIR HANDICAP ACTIVE' : 'UNSCALED SUM'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSquadScoringMode('average')}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer border ${
                            effectiveScoringMode === 'average'
                              ? 'bg-[#82917B] text-white border-black shadow-xs'
                              : 'bg-gray-50 text-gray-600 border-gray-300'
                          }`}
                        >
                          Squad Average (3v2 Fair)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSquadScoringMode('total')}
                          disabled={squadsUneven}
                          title={squadsUneven ? 'Total scoring needs equal squad sizes' : undefined}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                            effectiveScoringMode === 'total'
                              ? 'bg-black text-[#E8B92D] border-black shadow-xs'
                              : 'bg-gray-50 text-gray-600 border-gray-300'
                          }`}
                        >
                          Cumulative Total (Sum)
                        </button>
                      </div>
                    </div>

                    {/* Team Alpha vs Team Omega Head-to-Head */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* TEAM ALPHA (ALLIED SQUAD) */}
                      <div className="bg-[#FFFDF9] p-3 rounded-2xl border-2 border-black shadow-brutal-sm space-y-2">
                        <div className="flex justify-between items-center border-b border-black/10 pb-1.5">
                          <span
                            className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border border-black"
                            style={{ backgroundColor: currentTeam.badgeBg, color: currentTeam.badgeText }}
                          >
                            [{currentTeam.tag}] Team Alpha
                          </span>
                          <span className="text-[10px] font-bold text-black">
                            {squadTeamA.length} {squadTeamA.length === 1 ? 'Hunter' : 'Hunters'}
                          </span>
                        </div>

                        {/* Member Roster */}
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {squadTeamA.map((member) => (
                            <div
                              key={member.id}
                              className="bg-[#FAF6EE] p-1.5 rounded-lg border border-black/15 flex justify-between items-center text-[11px]"
                            >
                              <div className="truncate mr-1">
                                <span className="font-bold text-black">{member.nickname}</span>
                                {member.isHost && (
                                  <span className="text-[10px] ml-1 bg-black text-[#E8B92D] px-1 rounded font-bold">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="font-bold text-[#D66A4A]">{member.points} pts</span>
                                {!member.isHost && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSquadMember('A', member.id)}
                                    className="text-gray-400 hover:text-black cursor-pointer"
                                    aria-label="Remove teammate"
                                  >
                                    <IconTrash size={10} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Team A Stats */}
                        <div className="pt-1 border-t border-black/10 flex justify-between text-[10px] text-gray-600 font-bold">
                          <span>Total: {pvpService.calculateSquadStats(squadTeamA).totalPoints} pts</span>
                          <span className="text-black">
                            Avg: {pvpService.calculateSquadStats(squadTeamA).averagePoints} pts
                          </span>
                        </div>

                        {/* Add Teammate Actions */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => handleScanSquadMember('A')}
                            disabled={squadTeamA.length >= SQUAD_RULES.maxTeamSize}
                            className="w-full btn-primary py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                          >
                            <IconCamera size={10} />
                            <span>Scan Teammate's QR Pass</span>
                          </button>
                        </div>
                      </div>

                      {/* TEAM OMEGA (RIVAL SQUAD) */}
                      <div className="bg-[#FFFDF9] p-3 rounded-2xl border-2 border-black shadow-brutal-sm space-y-2">
                        <div className="flex justify-between items-center border-b border-black/10 pb-1.5">
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border border-black bg-[#282722] text-[#E8B92D]">
                            [{squadTeamB[0]?.teamTag || 'RIV'}] Team Omega
                          </span>
                          <span className="text-[10px] font-bold text-black">
                            {squadTeamB.length} {squadTeamB.length === 1 ? 'Hunter' : 'Hunters'}
                          </span>
                        </div>

                        {/* Member Roster */}
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {squadTeamB.length === 0 && (
                            <p className="text-[10px] text-gray-500 italic text-center py-3">
                              No rivals yet. Each rival shows their Curator Pass QR and you scan it.
                            </p>
                          )}
                          {squadTeamB.map((member) => (
                            <div
                              key={member.id}
                              className="bg-[#FAF6EE] p-1.5 rounded-lg border border-black/15 flex justify-between items-center text-[11px]"
                            >
                              <div className="truncate mr-1">
                                <span className="font-bold text-black">{member.nickname}</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="font-bold text-black">{member.points} pts</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSquadMember('B', member.id)}
                                  className="text-gray-400 hover:text-black cursor-pointer"
                                  aria-label="Remove rival"
                                >
                                  <IconTrash size={10} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Team B Stats */}
                        <div className="pt-1 border-t border-black/10 flex justify-between text-[10px] text-gray-600 font-bold">
                          <span>Total: {pvpService.calculateSquadStats(squadTeamB).totalPoints} pts</span>
                          <span className="text-black">
                            Avg: {pvpService.calculateSquadStats(squadTeamB).averagePoints} pts
                          </span>
                        </div>

                        {/* Add Rival Actions */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => handleScanSquadMember('B')}
                            disabled={squadTeamB.length >= SQUAD_RULES.maxTeamSize}
                            className="w-full btn-primary py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                          >
                            <IconCamera size={10} />
                            <span>Scan Rival's QR Pass</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Roster Rules & Readiness */}
                    <div
                      className={`p-2.5 rounded-xl border-2 text-[10px] leading-relaxed ${
                        squadReadiness.ready ? 'bg-[#EBF3E8] border-[#82917B] text-[#2D5A27]' : 'bg-[#FFF9EC] border-black/30 text-gray-700'
                      }`}
                      role="status"
                    >
                      <span className="font-bold uppercase block">
                        {squadReadiness.ready ? 'Ready to battle' : 'Squad rules'}
                      </span>
                      <span className="block">
                        Every hunter scans in with their own QR pass. One squad needs {SQUAD_RULES.minLargerTeam}+ hunters; the other can have {SQUAD_RULES.minSmallerTeam}–{SQUAD_RULES.maxTeamSize} (3v3, 3v2, 3v1, 4v2…).
                      </span>
                      {!squadReadiness.ready && <span className="block font-bold mt-0.5">{squadReadiness.reason}</span>}
                    </div>

                    {squadNotice && (
                      <div
                        className={`p-2 rounded-lg border text-[10px] font-bold ${
                          squadNotice.tone === 'ok' ? 'bg-white border-[#82917B] text-[#2D5A27]' : 'bg-[#FDF2F0] border-[#D66A4A] text-[#D66A4A]'
                        }`}
                        role="alert"
                      >
                        {squadNotice.text}
                      </div>
                    )}

                    {/* Clash Verdict Banner */}
                    {squadClashResult && (
                      <div
                        className={`p-3.5 rounded-2xl border-2 border-black text-center space-y-1.5 shadow-brutal-sm ${
                          squadClashResult.winner === 'alpha'
                            ? 'bg-[#EBF3E8] text-[#2D5A27]'
                            : squadClashResult.winner === 'omega'
                            ? 'bg-[#FDF2F0] text-[#D66A4A]'
                            : 'bg-[#FFF9EC] text-black'
                        }`}
                      >
                        <div className="font-heading font-extrabold text-base">
                          {squadClashResult.winner === 'alpha' && 'VICTORY! ALLIED SQUAD TRIUMPH'}
                          {squadClashResult.winner === 'omega' && 'DEFEAT! RIVAL SQUAD PREVAILED'}
                          {squadClashResult.winner === 'DRAW' && 'HONORS EVEN! SQUAD TIE'}
                        </div>
                        <p className="text-xs font-bold">
                          {squadClashResult.winner === 'alpha'
                            ? `Team Alpha won by +${Math.abs(squadClashResult.pointsDelta)} pts using ${
                                squadClashResult.scoringMode === 'average' ? 'Squad Average' : 'Total Points'
                              }!`
                            : squadClashResult.winner === 'omega'
                            ? `Team Omega led by +${Math.abs(squadClashResult.pointsDelta)} pts.`
                            : `Exact tie across ${squadTeamA.length} vs ${squadTeamB.length} hunters!`}
                        </p>
                        <span className="text-[10px] text-gray-500 block">
                          Ledger Hash: <code>{squadClashResult.verificationHash}</code>
                        </span>
                      </div>
                    )}

                    {/* Execute Squad Battle Button */}
                    <button
                      type="button"
                      onClick={handleExecuteSquadClash}
                      disabled={!squadReadiness.ready}
                      className="w-full btn-primary py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-brutal flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <IconSwords size={16} />
                      <span>
                        Battle Squads ({squadTeamA.length} vs {squadTeamB.length} Clash)
                      </span>
                    </button>
                  </div>
                ) : (
                  /* SUB-VIEW 2: SQUAD ALLEGIANCE SELECTOR */
                  <div className="space-y-2.5">
                    <div className="bg-white border-2 border-black rounded-xl p-3 font-mono text-xs">
                      <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">
                        Active Allegiance:
                      </span>
                      <p className="font-extrabold text-sm text-black">
                        [{currentTeam.tag}] {currentTeam.name}
                      </p>
                      <p className="text-[11px] text-gray-600 mt-0.5 italic">{currentTeam.motto}</p>
                    </div>

                    <div className="space-y-2 px-0.5">
                      {PRESET_TEAMS.map((team) => {
                        const isSelected = currentTeam.id === team.id;
                        return (
                          <div
                            key={team.id}
                            onClick={() => handleSelectTeam(team)}
                            className={`p-3 rounded-2xl border-2 border-black cursor-pointer transition-all flex items-center justify-between box-border ${
                              isSelected
                                ? 'bg-[#FFF9EC] shadow-brutal'
                                : 'bg-white hover:bg-[#FAF6EE] shadow-brutal-sm'
                            }`}
                          >
                            <div className="pr-2 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-black uppercase flex-shrink-0"
                                  style={{ backgroundColor: team.badgeBg, color: team.badgeText }}
                                >
                                  {team.tag}
                                </span>
                                <h4 className="font-heading font-extrabold text-sm text-black truncate">
                                  {team.name}
                                </h4>
                                {isSelected && (
                                  <span className="text-[10px] font-mono font-bold uppercase bg-[#E8B92D] text-black px-1.5 py-0.2 rounded border border-black flex-shrink-0">
                                    ACTIVE SQUAD
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-mono text-gray-600 mt-1 line-clamp-2">{team.motto}</p>
                            </div>

                            <div className="flex-shrink-0 ml-2">
                              {isSelected ? (
                                <span className="w-6 h-6 rounded-full bg-black text-[#E8B92D] border border-black flex items-center justify-center shadow-xs">
                                  <IconCheck size={12} />
                                </span>
                              ) : (
                                <span className="w-6 h-6 rounded-full border-2 border-gray-300 bg-white block" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: PAST WINS & HISTORY */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                {/* Stats Bar */}
                <div className="grid grid-cols-4 gap-2 text-center font-mono">
                  <div className="bg-white p-2 rounded-xl border border-black/20">
                    <span className="text-xl font-bold font-heading block">{stats.total}</span>
                    <span className="text-[10px] uppercase text-gray-500 font-bold block">Battles</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-black/20">
                    <span className="text-xl font-bold font-heading text-[#82917B] block">{stats.wins}</span>
                    <span className="text-[10px] uppercase text-gray-500 font-bold block">Wins</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-black/20">
                    <span className="text-xl font-bold font-heading text-black block">{stats.winRate}%</span>
                    <span className="text-[10px] uppercase text-gray-500 font-bold block">Win Rate</span>
                  </div>
                  <div className="bg-[#FFF9EC] p-2 rounded-xl border border-black/20">
                    <span className="text-xl font-bold font-heading text-[#D66A4A] block">{stats.streak}</span>
                    <span className="text-[10px] uppercase text-gray-500 font-bold block">Streak</span>
                  </div>
                </div>

                {/* Match Ledger */}
                {history.length > 0 ? (
                  <div className="space-y-2.5">
                    {history.map((match) => (
                      <div
                        key={match.id}
                        className="bg-white p-3.5 rounded-2xl border-2 border-black text-xs font-mono shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border border-black ${
                                match.outcome === 'VICTORY'
                                  ? 'bg-[#82917B] text-white'
                                  : match.outcome === 'DEFEAT'
                                  ? 'bg-[#D66A4A] text-white'
                                  : 'bg-[#E8B92D] text-black'
                              }`}
                            >
                              {match.outcome}
                            </span>
                            <span className="font-bold text-black text-sm">
                              vs {match.opponentName}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {new Date(match.timestamp).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-gray-600 border-t border-black/10 pt-1.5">
                          <span>
                            {match.battleType === 'timed_hunt' ? 'Speed Blitz' : 'Quick Duel'}:{' '}
                            <strong>{match.playerScore} pts</strong> vs {match.opponentScore} pts
                          </span>
                          <span className="font-bold text-black">
                            {match.pointsDelta >= 0 ? `+${match.pointsDelta}` : match.pointsDelta} pts
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleShareVictoryPlacard(match)}
                          className="w-full btn-secondary py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <IconDownload size={11} />
                          <span>Export Placard</span>
                        </button>
                      </div>
                    ))}

                    <div className="pt-2 text-center">
                      <button
                        onClick={handleClearHistory}
                        className="text-[10px] font-mono text-gray-400 hover:text-black underline cursor-pointer"
                      >
                        Clear Match History Ledger
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-7 rounded-2xl border-2 border-black text-center font-mono space-y-3 shadow-brutal-sm">
                    <div className="w-14 h-14 bg-[#F4EBDD] border-2 border-black rounded-full flex items-center justify-center mx-auto shadow-brutal-sm">
                      <IconSwords size={24} className="text-[#D66A4A]" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-black bg-[#E8B92D] px-2 py-0.5 rounded border border-black inline-block mb-1.5">
                        Battle Ledger Clean
                      </span>
                      <h4 className="font-heading font-extrabold text-base text-black mb-1">
                        No PvP Matches Recorded Yet
                      </h4>
                      <p className="text-xs text-gray-600 max-w-xs mx-auto leading-relaxed">
                        Challenge rival curators to timed Speed Blitz hunts or scan their Curator Pass QR to initiate a Quick Duel and write to this ledger.
                      </p>
                    </div>
                    <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                      <button
                        type="button"
                        onClick={() => setActiveTab('duel')}
                        className="btn-primary py-2 px-4 rounded-xl text-xs uppercase font-extrabold tracking-wider cursor-pointer shadow-brutal-sm flex items-center justify-center gap-1.5"
                      >
                        <IconSwords size={12} />
                        <span>Enter Quick Duel</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('timer')}
                        className="btn-secondary py-2 px-4 rounded-xl text-xs uppercase font-bold tracking-wider cursor-pointer"
                      >
                        Create Speed Blitz
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Optical QR Camera Scanner Modal */}
      <BattleQrScannerModal
        isOpen={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onBlitzJoined={handleBlitzJoined}
        onPassScanned={scannerMode === 'pass' ? handlePassScanned : undefined}
      />
    </>
  );
};
