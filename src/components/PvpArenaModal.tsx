/**
 * @file PvpArenaModal.tsx
 * @description Peer-to-Peer Multiplayer Battle Arena, QR-Activated Speed Blitz Battles,
 * Sudden-Death Tie-Breakers, Squad Selector, and Shareable Victory Placards.
 *
 * ARCHITECTURAL DESIGN:
 * Operates offline with zero server dependencies:
 *   - Optical Battle Scan: Scan a rival's pass to retrieve their live metrics and battle.
 *   - Sudden Death on Draw: If scores are tied, launches an immediate 2-min sudden death sprint.
 *   - Real-Time Opponent Score Tracking: Opponent's baseline score is transmitted via QR.
 *   - Shareable Victory Placards: Exports 1080x1350 JPEG placards via HTML5 Canvas.
 */

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Discovery } from '../db/database';
import { calculateTotalCuratorPoints } from '../utils/proofOfSighting';
import {
  pvpService,
  CuratorTeam,
  PRESET_TEAMS,
  PvpMatchRecord,
  SpeedBlitzPayload,
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
  IconRefresh,
  IconQrCode,
  IconCamera,
  IconDownload,
} from './Icons';

interface PvpArenaModalProps {
  isOpen: boolean;
  onClose: () => void;
  nickname: string;
  discoveries: Discovery[];
  onStartSpeedBlitz: (blitz: {
    opponentName: string;
    opponentTeam: string;
    opponentTeamTag: string;
    opponentScore: number;
    durationMinutes: number;
  }) => void;
}

export const PvpArenaModal: React.FC<PvpArenaModalProps> = ({
  isOpen,
  onClose,
  nickname,
  discoveries,
  onStartSpeedBlitz,
}) => {
  const [activeTab, setActiveTab] = useState<'timer' | 'duel' | 'team' | 'history'>('timer');
  const [currentTeam, setCurrentTeam] = useState<CuratorTeam>(() => pvpService.getCurrentTeam());
  const [history, setHistory] = useState<PvpMatchRecord[]>([]);
  const [stats, setStats] = useState(pvpService.getPvpStats());

  // Quick Duel State
  const totalPoints = calculateTotalCuratorPoints(discoveries);
  const specimenCount = discoveries.length;
  const legendCount = discoveries.filter(d => d.isHallOfFame).length;

  const [challenger, setChallenger] = useState(() => {
    return pvpService.generateChallenger(totalPoints, currentTeam.id);
  });
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

  useEffect(() => {
    if (isOpen) {
      setCurrentTeam(pvpService.getCurrentTeam());
      setHistory(pvpService.getMatchHistory());
      setStats(pvpService.getPvpStats());
    }
  }, [isOpen]);

  // Generate Speed Blitz QR for host
  const handleGenerateBlitzQr = (duration: 3 | 5 | 10) => {
    setHuntDuration(duration);
    const payload = pvpService.createSpeedBlitzPayload(nickname, duration, totalPoints);
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
  }, [isOpen, activeTab, blitzSubTab, nickname, totalPoints]);

  const handleHostStartBlitz = () => {
    if (!hostedBlitzPayload) return;
    onClose();
    onStartSpeedBlitz({
      opponentName: 'Challenger in Field',
      opponentTeam: 'Rival Squad',
      opponentTeamTag: 'VS',
      opponentScore: totalPoints,
      durationMinutes: hostedBlitzPayload.durationMinutes,
    });
  };

  const handleBlitzJoined = (payload: SpeedBlitzPayload) => {
    setShowQrScanner(false);
    onClose();
    onStartSpeedBlitz({
      opponentName: payload.hostName,
      opponentTeam: payload.hostTeam,
      opponentTeamTag: payload.hostTeamTag,
      opponentScore: payload.hostScore,
      durationMinutes: payload.durationMinutes,
    });
  };

  const handlePassScanned = (passData: {
    hunter: string;
    points: number;
    specimens: number;
    legends: number;
    rank?: string;
    team?: string;
  }) => {
    setShowQrScanner(false);
    setActiveTab('duel');
    setCustomOpponentName(passData.hunter);
    setCustomOpponentScore(String(passData.points));

    // Update challenger visualizer with scanned rival info
    setChallenger({
      opponentName: passData.hunter,
      opponentTeam: {
        id: 'scanned',
        name: passData.team || 'Rival Curators',
        tag: (passData.hunter.slice(0, 3) || 'RIV').toUpperCase(),
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

  const handleRerollChallenger = () => {
    setChallenger(pvpService.generateChallenger(totalPoints, currentTeam.id));
    setDuelResult(null);
  };

  const handleExecuteDuel = () => {
    const oppName = customOpponentName.trim() || challenger.opponentName;
    const oppTeam = challenger.opponentTeam.name;
    const oppScore = customOpponentScore.trim()
      ? parseInt(customOpponentScore, 10) || challenger.opponentScore
      : challenger.opponentScore;

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
                  className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border border-black uppercase shadow-xs"
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
                      Have your rival scan this QR. The scan transmits your name & score target, and routes both of you to the Capture screen to hunt!
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
                      <span className="text-[9px] font-mono font-bold uppercase text-gray-700 block mt-1">
                        [{currentTeam.tag}] {nickname} · Target: {totalPoints} pts · {huntDuration}m
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
                      Scan your friend's screen. The scanner instantly decodes their name, team, and score target, activates the live timer, and jumps directly to your camera!
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
                    className="flex-1 btn-secondary py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 shadow-brutal-sm"
                  >
                    <IconQrCode size={14} className="text-[#D66A4A]" />
                    <span>Scan Rival Pass & Battle</span>
                  </button>
                  <button
                    onClick={handleRerollChallenger}
                    className="btn-secondary py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
                    title="Find random simulated challenger"
                  >
                    <IconRefresh size={14} />
                  </button>
                </div>

                {/* VS Battle Visualizer Card */}
                <div className="bg-[#FFFDF9] border-2 border-black rounded-2xl p-4 shadow-brutal-sm">
                  <div className="grid grid-cols-5 items-center text-center">
                    {/* Player Side */}
                    <div className="col-span-2 bg-[#FAF6EE] p-2.5 rounded-xl border border-black/20">
                      <span
                        className="text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-black block mb-1 truncate"
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
                      <span className="text-[8px] font-mono uppercase text-gray-500 font-bold block mt-0.5">
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
                    <div className="col-span-2 bg-[#FAF6EE] p-2.5 rounded-xl border border-black/20">
                      <span
                        className="text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-black block mb-1 truncate"
                        style={{
                          backgroundColor: challenger.opponentTeam.badgeBg,
                          color: challenger.opponentTeam.badgeText,
                        }}
                      >
                        [{challenger.opponentTeam.tag}] {challenger.opponentTeam.name}
                      </span>
                      <h3 className="font-heading font-extrabold text-sm text-black truncate">
                        {customOpponentName.trim() || challenger.opponentName}
                      </h3>
                      <div className="mt-1 font-heading font-extrabold text-2xl text-black leading-none">
                        {customOpponentScore.trim() ? customOpponentScore : challenger.opponentScore}
                      </div>
                      <span className="text-[8px] font-mono uppercase text-gray-500 font-bold block mt-0.5">
                        {challenger.opponentSpecimens} Specs · {challenger.opponentLegends} Legends
                      </span>
                    </div>
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
                          : `Tied at ${duelResult.playerScore} points! Initiate Sudden-Death to break the tie.`}
                      </p>
                      <span className="text-[9px] text-gray-500 block mt-1">
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

                      {/* Sudden Death Tie-Breaker if DRAW */}
                      {duelResult.outcome === 'DRAW' && (
                        <div className="mt-3 pt-2.5 border-t-2 border-black/20 text-center space-y-1.5">
                          <span className="text-[10px] font-mono font-bold uppercase text-[#D66A4A] tracking-wider block">
                            TIED SCORE DETECTED · INITIATE QUICK DUEL TIE-BREAKER
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onStartSpeedBlitz({
                                opponentName: duelResult.opponentName,
                                opponentTeam: duelResult.opponentTeam,
                                opponentTeamTag: 'TIE',
                                opponentScore: duelResult.opponentScore,
                                durationMinutes: 2, // 2-min sudden death sprint!
                              });
                            }}
                            className="w-full bg-[#D66A4A] text-white py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer border-2 border-black shadow-brutal flex items-center justify-center gap-1.5 hover:bg-[#c25a3c]"
                          >
                            <IconSwords size={14} />
                            <span>Launch 2-Min Sudden Death Duel!</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Execute Battle Button */}
                <button
                  onClick={handleExecuteDuel}
                  className="w-full btn-primary py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-brutal flex items-center justify-center gap-1.5"
                >
                  <IconSwords size={14} />
                  <span>Execute PvP Battle</span>
                </button>

                {/* Manual Score Input */}
                <div className="bg-white border-2 border-black rounded-xl p-3 text-xs font-mono">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
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

            {/* TAB 3: CURATOR TEAM */}
            {activeTab === 'team' && (
              <div className="space-y-3">
                <div className="bg-white border-2 border-black rounded-xl p-3 mb-2 font-mono text-xs">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                    Active Allegiance:
                  </span>
                  <p className="font-extrabold text-sm text-black">
                    [{currentTeam.tag}] {currentTeam.name}
                  </p>
                  <p className="text-[11px] text-gray-600 mt-0.5 italic">{currentTeam.motto}</p>
                </div>

                {/* Squad List with No Cutoff */}
                <div className="space-y-2.5 px-1 py-1">
                  {PRESET_TEAMS.map((team) => {
                    const isSelected = currentTeam.id === team.id;
                    return (
                      <div
                        key={team.id}
                        onClick={() => handleSelectTeam(team)}
                        className={`p-3 sm:p-3.5 rounded-2xl border-2 border-black cursor-pointer transition-all flex items-center justify-between box-border ${
                          isSelected
                            ? 'bg-[#FFF9EC] shadow-brutal'
                            : 'bg-white hover:bg-[#FAF6EE] shadow-brutal-sm'
                        }`}
                      >
                        <div className="pr-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-[9px] font-mono font-bold px-2 py-0.5 rounded border border-black uppercase flex-shrink-0"
                              style={{ backgroundColor: team.badgeBg, color: team.badgeText }}
                            >
                              {team.tag}
                            </span>
                            <h4 className="font-heading font-extrabold text-sm text-black truncate">
                              {team.name}
                            </h4>
                            {isSelected && (
                              <span className="text-[8px] font-mono font-bold uppercase bg-[#E8B92D] text-black px-1.5 py-0.2 rounded border border-black flex-shrink-0">
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

            {/* TAB 4: PAST WINS & HISTORY */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                {/* Stats Bar */}
                <div className="grid grid-cols-4 gap-2 text-center font-mono">
                  <div className="bg-white p-2 rounded-xl border border-black/20">
                    <span className="text-xl font-bold font-heading block">{stats.total}</span>
                    <span className="text-[8px] uppercase text-gray-500 font-bold block">Battles</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-black/20">
                    <span className="text-xl font-bold font-heading text-[#82917B] block">{stats.wins}</span>
                    <span className="text-[8px] uppercase text-gray-500 font-bold block">Wins</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-black/20">
                    <span className="text-xl font-bold font-heading text-black block">{stats.winRate}%</span>
                    <span className="text-[8px] uppercase text-gray-500 font-bold block">Win Rate</span>
                  </div>
                  <div className="bg-[#FFF9EC] p-2 rounded-xl border border-black/20">
                    <span className="text-xl font-bold font-heading text-[#D66A4A] block">{stats.streak}</span>
                    <span className="text-[8px] uppercase text-gray-500 font-bold block">Streak</span>
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
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border border-black ${
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
                  <div className="bg-white p-6 rounded-2xl border-2 border-black text-center font-mono text-xs text-gray-500">
                    <IconTrophy size={28} className="mx-auto mb-2 text-gray-300" />
                    <p className="font-bold text-black mb-1">No PvP Battles Recorded Yet</p>
                    <p className="text-[11px]">
                      Challenge a friend with a Speed Blitz QR or execute a Quick Duel to start your competitive record.
                    </p>
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
