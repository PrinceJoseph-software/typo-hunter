/**
 * @file pvpService.ts
 * @description Peer-to-Peer Multiplayer Battle Engine, Team Allocator,
 * Multi-Hunter Squad Battles, and Time-Based Speed Hunt Tracker for TYPO HUNTER.
 *
 * ARCHITECTURAL DESIGN:
 * Operates under the sovereign offline-first paradigm:
 *   - Zero-Backend Matching: Battles are calculated deterministically on-device
 *     using standardized Curatorial Point algorithms and optical Proof-of-Sighting hashes.
 *   - Squad / Guild Identity: Curators can enlist in competitive factions
 *     (Red Pen Syndicate, Sign Raiders, Syntax Squad, The Proofreaders).
 *   - Multi-Curator Squad Battles: Pits 3v3, 3v2, 3v1 or N vs M teams together.
 *     Every hunter must join by scanning their own QR pass (no simulated players);
 *     one side needs 3+ hunters, the other 1+. Uneven squads use Average scoring.
 *   - Time-Based Hunt Mode: Tracks timed expeditions (5m / 15m / 30m) with live countdowns.
 *   - Immutable Battle Ledger: Past PvP matches, win rates, and streaks are logged
 *     into localStorage with cryptographic verification stamps.
 */

export interface CuratorTeam {
  id: string;
  name: string;
  tag: string;
  badgeBg: string;
  badgeText: string;
  motto: string;
}

export const PRESET_TEAMS: CuratorTeam[] = [
  {
    id: 'red-pen',
    name: 'Red Pen Syndicate',
    tag: 'RPS',
    badgeBg: '#D66A4A',
    badgeText: '#FFFFFF',
    motto: 'Zero tolerance for spelling transgressions & rogue punctuation.',
  },
  {
    id: 'sign-raiders',
    name: 'Sign Raiders',
    tag: 'RAID',
    badgeBg: '#E8B92D',
    badgeText: '#282722',
    motto: 'Fast-moving urban scavengers capturing signs before they get painted over.',
  },
  {
    id: 'syntax-squad',
    name: 'Syntax Squad',
    tag: 'SYN',
    badgeBg: '#82917B',
    badgeText: '#FFFFFF',
    motto: 'Grammar tacticians analyzing sentence structure in commercial wild.',
  },
  {
    id: 'proofreaders',
    name: 'The Proofreaders',
    tag: 'PROOF',
    badgeBg: '#282722',
    badgeText: '#E8B92D',
    motto: 'Elite academic perfectionists curating museum-grade typographical gold.',
  },
];

export interface SpeedBlitzPayload {
  app: 'TYPO_HUNTER_PVP';
  action: 'SPEED_BLITZ_CHALLENGE';
  battleId: string;
  hostName: string;
  hostTeam: string;
  hostTeamTag: string;
  hostDeviceId?: string;
  /** Legacy field from older versions (host's lifetime total). Ignored: both players start at 0. */
  hostScore?: number;
  durationMinutes: number;
  timestamp: string;
  signature: string;
}

/** Shown by each player when a Speed Blitz ends; the rival scans it to settle the match. */
export interface BlitzResultPayload {
  app: 'TYPO_HUNTER_PVP';
  action: 'BLITZ_RESULT';
  battleId: string;
  deviceId: string;
  hunter: string;
  teamTag: string;
  score: number;
  specimens: number;
  finishedAt: string;
}

export interface PvpMatchRecord {
  id: string;
  timestamp: string;
  battleType: 'quick_duel' | 'timed_hunt';
  durationMinutes?: number;
  playerNickname: string;
  playerTeam: string;
  playerScore: number;
  playerSpecimens: number;
  playerLegends: number;
  opponentName: string;
  opponentTeam: string;
  opponentScore: number;
  outcome: 'VICTORY' | 'DEFEAT' | 'DRAW';
  pointsDelta: number;
  verificationHash: string;
}

export interface SquadMember {
  id: string;
  nickname: string;
  teamTag: string;
  teamName: string;
  points: number;
  specimens: number;
  legends: number;
  isHost?: boolean;
  /** Fingerprint of the scanned QR pass (checksum or derived) used to block duplicate scans. */
  passFingerprint?: string;
  /** True when this hunter joined by scanning a real QR pass (or is the host device). */
  verified?: boolean;
  /** Install id from the hunter's pass; the reliable way to spot the same person twice. */
  deviceId?: string;
}

/** Squad battle roster rules: every hunter must join via QR; one side needs 3+. */
export const SQUAD_RULES = {
  minLargerTeam: 3,
  minSmallerTeam: 1,
  maxTeamSize: 8,
};

export interface SquadReadiness {
  ready: boolean;
  reason: string;
}

export interface SquadTeam {
  id: 'alpha' | 'omega';
  name: string;
  members: SquadMember[];
  totalPoints: number;
  averagePoints: number;
}

export interface SquadBattleResult {
  id: string;
  timestamp: string;
  winner: 'alpha' | 'omega' | 'DRAW';
  winnerTeamName: string;
  teamA: SquadTeam;
  teamB: SquadTeam;
  scoringMode: 'total' | 'average';
  pointsDelta: number;
  verificationHash: string;
}

const STORAGE_KEY_TEAM = 'typo_hunter_team';
const STORAGE_KEY_SETTLED_BLITZ = 'typo_hunter_settled_blitz_ids';
const STORAGE_KEY_MATCHES = 'typo_hunter_pvp_matches';

export const pvpService = {
  getCurrentTeam(): CuratorTeam {
    const savedId = localStorage.getItem(STORAGE_KEY_TEAM);
    return PRESET_TEAMS.find(t => t.id === savedId) || PRESET_TEAMS[0];
  },

  setCurrentTeam(teamId: string): void {
    localStorage.setItem(STORAGE_KEY_TEAM, teamId);
  },

  getMatchHistory(): PvpMatchRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_MATCHES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveMatch(record: PvpMatchRecord): void {
    try {
      const history = this.getMatchHistory();
      history.unshift(record);
      // Keep up to 50 most recent battles
      localStorage.setItem(STORAGE_KEY_MATCHES, JSON.stringify(history.slice(0, 50)));
    } catch (err) {
      console.error('Failed to save PvP match record', err);
    }
  },

  clearHistory(): void {
    localStorage.removeItem(STORAGE_KEY_MATCHES);
  },

  getPvpStats(): {
    total: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    streak: number;
  } {
    const matches = this.getMatchHistory();
    const total = matches.length;
    const wins = matches.filter(m => m.outcome === 'VICTORY').length;
    const losses = matches.filter(m => m.outcome === 'DEFEAT').length;
    const draws = matches.filter(m => m.outcome === 'DRAW').length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    // Calculate current win streak
    let streak = 0;
    for (const match of matches) {
      if (match.outcome === 'VICTORY') {
        streak++;
      } else {
        break;
      }
    }

    return { total, wins, losses, draws, winRate, streak };
  },

  /**
   * Evaluates a battle and records the outcome.
   */
  resolveDuel(
    playerNickname: string,
    playerPoints: number,
    playerSpecimens: number,
    playerLegends: number,
    opponentName: string,
    opponentTeamName: string,
    opponentScore: number
  ): PvpMatchRecord {
    const currentTeam = this.getCurrentTeam();
    let outcome: 'VICTORY' | 'DEFEAT' | 'DRAW' = 'DRAW';
    if (playerPoints > opponentScore) outcome = 'VICTORY';
    else if (playerPoints < opponentScore) outcome = 'DEFEAT';

    const pointsDelta = playerPoints - opponentScore;
    const timestamp = new Date().toISOString();
    const verificationHash = `PVP-${Date.now().toString(36).toUpperCase()}-${Math.abs(pointsDelta)}`;

    const match: PvpMatchRecord = {
      id: `match_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp,
      battleType: 'quick_duel',
      playerNickname: playerNickname || 'Hunter',
      playerTeam: currentTeam.name,
      playerScore: playerPoints,
      playerSpecimens,
      playerLegends,
      opponentName,
      opponentTeam: opponentTeamName,
      opponentScore,
      outcome,
      pointsDelta,
      verificationHash,
    };

    this.saveMatch(match);
    return match;
  },

  createSpeedBlitzPayload(hostName: string, durationMinutes: number, hostDeviceId: string): SpeedBlitzPayload {
    const team = this.getCurrentTeam();
    const timestamp = new Date().toISOString();
    const battleId = `blitz_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const signature = `BLITZ-${durationMinutes}M-${Date.now().toString(36).toUpperCase()}`;

    return {
      app: 'TYPO_HUNTER_PVP',
      action: 'SPEED_BLITZ_CHALLENGE',
      battleId,
      hostName: hostName.trim() || 'Hunter',
      hostTeam: team.name,
      hostTeamTag: team.tag,
      hostDeviceId,
      durationMinutes,
      timestamp,
      signature,
    };
  },

  parseSpeedBlitzPayload(rawString: string): SpeedBlitzPayload | null {
    try {
      const parsed = JSON.parse(rawString);
      if (
        parsed &&
        parsed.app === 'TYPO_HUNTER_PVP' &&
        parsed.action === 'SPEED_BLITZ_CHALLENGE' &&
        typeof parsed.hostName === 'string' &&
        typeof parsed.durationMinutes === 'number'
      ) {
        return parsed as SpeedBlitzPayload;
      }
      return null;
    } catch {
      return null;
    }
  },

  createBlitzResultPayload(battleId: string, deviceId: string, hunter: string, score: number, specimens: number): BlitzResultPayload {
    return {
      app: 'TYPO_HUNTER_PVP',
      action: 'BLITZ_RESULT',
      battleId,
      deviceId,
      hunter: hunter.trim() || 'Hunter',
      teamTag: this.getCurrentTeam().tag,
      score: Math.max(0, Math.round(score)),
      specimens: Math.max(0, Math.round(specimens)),
      finishedAt: new Date().toISOString(),
    };
  },

  parseBlitzResultPayload(raw: string): BlitzResultPayload | null {
    try {
      const p = JSON.parse(raw);
      if (
        p && p.app === 'TYPO_HUNTER_PVP' && p.action === 'BLITZ_RESULT' &&
        typeof p.battleId === 'string' && typeof p.deviceId === 'string' &&
        typeof p.hunter === 'string' && typeof p.score === 'number'
      ) {
        return p as BlitzResultPayload;
      }
    } catch {
      // not JSON
    }
    return null;
  },

  isBlitzSettled(battleId: string): boolean {
    try {
      const ids: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTLED_BLITZ) || '[]');
      return ids.includes(battleId);
    } catch {
      return false;
    }
  },

  /**
   * Settles a Speed Blitz from both players' result QRs. Both started at 0 and only
   * counted photos taken during their round. Each battle can be recorded once.
   */
  settleBlitz(mine: BlitzResultPayload, rival: BlitzResultPayload): { record?: PvpMatchRecord; error?: string } {
    if (mine.battleId !== rival.battleId) {
      return { error: "That result is from a different Speed Blitz. Ask your rival to show the result from this round." };
    }
    if (mine.deviceId === rival.deviceId) {
      return { error: "That's your own result. Scan your rival's screen." };
    }
    if (this.isBlitzSettled(mine.battleId)) {
      return { error: 'This Speed Blitz was already settled.' };
    }
    const record = this.resolveDuel(mine.hunter, mine.score, mine.specimens, 0, rival.hunter, `[${rival.teamTag}]`, rival.score);
    const updated: PvpMatchRecord = { ...record, battleType: 'timed_hunt' };
    const history = this.getMatchHistory();
    if (history[0]?.id === record.id) {
      history[0] = updated;
      localStorage.setItem(STORAGE_KEY_MATCHES, JSON.stringify(history));
    }
    try {
      const ids: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTLED_BLITZ) || '[]');
      ids.unshift(mine.battleId);
      localStorage.setItem(STORAGE_KEY_SETTLED_BLITZ, JSON.stringify(ids.slice(0, 100)));
    } catch {
      // ignore
    }
    return { record: updated };
  },

  createSquadMember(data: Partial<SquadMember>): SquadMember {
    const id = data.id || `member_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const team = data.teamTag 
      ? PRESET_TEAMS.find(t => t.tag === data.teamTag) || PRESET_TEAMS[0]
      : this.getCurrentTeam();
    return {
      id,
      nickname: data.nickname || 'Hunter',
      teamTag: team.tag,
      teamName: team.name,
      points: typeof data.points === 'number' ? data.points : 0,
      specimens: typeof data.specimens === 'number' ? data.specimens : 0,
      legends: typeof data.legends === 'number' ? data.legends : 0,
      isHost: !!data.isHost,
      passFingerprint: data.passFingerprint,
      verified: !!data.verified || !!data.isHost,
      deviceId: data.deviceId,
    };
  },

  /**
   * Checks whether two rosters can battle: N vs M where the larger side has at
   * least 3 hunters, the smaller side has at least 1, and every hunter is QR-verified.
   */
  checkSquadReadiness(teamA: SquadMember[], teamB: SquadMember[]): SquadReadiness {
    const unverified = [...teamA, ...teamB].filter(m => !m.verified && !m.isHost);
    if (unverified.length > 0) {
      return { ready: false, reason: `${unverified.length} hunter(s) not QR-verified. Every hunter must scan in.` };
    }
    if (teamA.length < SQUAD_RULES.minSmallerTeam || teamB.length < SQUAD_RULES.minSmallerTeam) {
      return { ready: false, reason: 'Both squads need at least 1 hunter.' };
    }
    if (Math.max(teamA.length, teamB.length) < SQUAD_RULES.minLargerTeam) {
      const larger = teamA.length >= teamB.length ? 'Team Alpha' : 'Team Omega';
      const needed = SQUAD_RULES.minLargerTeam - Math.max(teamA.length, teamB.length);
      return { ready: false, reason: `${larger} needs ${needed} more scanned hunter(s) — one squad must have 3+.` };
    }
    if (teamA.length > SQUAD_RULES.maxTeamSize || teamB.length > SQUAD_RULES.maxTeamSize) {
      return { ready: false, reason: `Squads are capped at ${SQUAD_RULES.maxTeamSize} hunters.` };
    }
    return { ready: true, reason: `${teamA.length} vs ${teamB.length} squad clash ready.` };
  },

  /** Builds a stable fingerprint for a scanned pass so the same QR can't be added twice. */
  passFingerprint(hunter: string, checksum?: string): string {
    return `${hunter.trim().toLowerCase()}::${checksum || 'nochecksum'}`;
  },

  /**
   * Returns the roster that already contains this hunter, or null. Matches on device id
   * (names aren't unique: two different players called "Hunter" may both join). Passes from
   * older app versions without a device id fall back to the exact pass fingerprint.
   */
  findDuplicateHunter(
    teamA: SquadMember[],
    teamB: SquadMember[],
    _hunter: string,
    fingerprint: string,
    deviceId?: string
  ): 'Team Alpha' | 'Team Omega' | null {
    const match = (m: SquadMember) =>
      deviceId && m.deviceId ? m.deviceId === deviceId : !!m.passFingerprint && m.passFingerprint === fingerprint;
    if (teamA.some(match)) return 'Team Alpha';
    if (teamB.some(match)) return 'Team Omega';
    return null;
  },

  calculateSquadStats(members: SquadMember[]): { totalPoints: number; averagePoints: number } {
    const totalPoints = members.reduce((sum, m) => sum + (m.points || 0), 0);
    const averagePoints = members.length > 0 ? Math.round(totalPoints / members.length) : 0;
    return { totalPoints, averagePoints };
  },

  resolveSquadClash(
    teamA: SquadTeam,
    teamB: SquadTeam,
    scoringMode: 'total' | 'average',
    logToLedger = true
  ): SquadBattleResult {
    const scoreA = scoringMode === 'total' ? teamA.totalPoints : teamA.averagePoints;
    const scoreB = scoringMode === 'total' ? teamB.totalPoints : teamB.averagePoints;
    let winner: 'alpha' | 'omega' | 'DRAW' = 'DRAW';
    let winnerTeamName = 'Honors Even (Draw)';

    if (scoreA > scoreB) {
      winner = 'alpha';
      winnerTeamName = teamA.name;
    } else if (scoreB > scoreA) {
      winner = 'omega';
      winnerTeamName = teamB.name;
    }

    const pointsDelta = scoreA - scoreB;
    const timestamp = new Date().toISOString();
    const verificationHash = `SQUAD-${scoringMode.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${Math.abs(pointsDelta)}`;

    const result: SquadBattleResult = {
      id: `squad_clash_${Date.now()}`,
      timestamp,
      winner,
      winnerTeamName,
      teamA,
      teamB,
      scoringMode,
      pointsDelta,
      verificationHash,
    };

    if (!logToLedger) return result;

    // Log to standard match history
    const matchRecord: PvpMatchRecord = {
      id: result.id,
      timestamp,
      battleType: 'quick_duel',
      playerNickname: `${teamA.name} (${teamA.members.length} Hunters)`,
      playerTeam: teamA.members[0]?.teamName || 'Allied Squad',
      playerScore: scoreA,
      playerSpecimens: teamA.members.reduce((sum, m) => sum + m.specimens, 0),
      playerLegends: teamA.members.reduce((sum, m) => sum + m.legends, 0),
      opponentName: `${teamB.name} (${teamB.members.length} Hunters)`,
      opponentTeam: teamB.members[0]?.teamName || 'Rival Squad',
      opponentScore: scoreB,
      outcome: winner === 'alpha' ? 'VICTORY' : winner === 'omega' ? 'DEFEAT' : 'DRAW',
      pointsDelta,
      verificationHash,
    };
    this.saveMatch(matchRecord);

    return result;
  },
};
