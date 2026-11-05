/**
 * @file teacherService.ts
 * @description Sovereign Classroom Overseer Engine & Academic Gradebook Terminal.
 *
 * ARCHITECTURAL DESIGN:
 * Built for schools, universities, field camps, and linguistics workshops:
 *   - Zero Cloud Sovereignty: Operates 100% peer-to-peer using high-density QR optical
 *     codes and client-side SHA-256 cryptographic verification.
 *   - Synchronized Class Expeditions: Instructors generate a "Master Expedition QR"
 *     that activates a synchronized countdown and field assignment HUD on all student devices.
 *   - Optical Gradebook & Roster Audit: Teachers can scan any student's pass/submission
 *     to instantly import their scores, specimens, anti-cheat hashes, and allocate grades.
 *   - CSV Gradebook Export: 1-click export of the full class ledger for school SIS integration.
 */

import { Discovery } from '../db/database';
import { calculateSpecimenScore, sumSpecimenPoints } from './proofOfSighting';
import { getDeviceId } from './identity';
import { pvpService, SquadMember, SquadTeam, SquadBattleResult } from './pvpService';

export interface ClassExpedition {
  classId: string;
  className: string;
  instructorName: string;
  durationMinutes: number;
  targetPoints: number;
  objective: string;
  timestamp: string;
  signature: string;
}

export interface ClassExpeditionPayload {
  app: 'TYPO_HUNTER_CLASS';
  action: 'JOIN_CLASS_EXPEDITION';
  classId: string;
  className: string;
  instructorName: string;
  durationMinutes: number;
  targetPoints: number;
  objective: string;
  timestamp: string;
  signature: string;
}

export interface StudentSubmission {
  id: string;
  studentName: string;
  squadFaction: string;
  classId: string;
  points: number;
  specimensCataloged: number;
  legendsEnshrined: number;
  grade: string;
  status: 'HONORS' | 'PASSED' | 'PENDING';
  tamperVerified: boolean;
  antiCheatHash: string;
  submittedAt: string;
  teacherCommendation?: string;
  /** How the student reached the roster (always a real scan or signed archive). */
  source?: 'qr_submission' | 'qr_pass' | 'archive';
  /** False when the student submitted for a different class than the one being hosted. */
  classMatch?: boolean;
  /** Specimen titles (legacy; replaced by `evidence`). */
  specimenTitles?: string[];
  /** Random install id of the student's device. Rows are keyed on it so equal names never collide. */
  deviceId?: string;
  /** 'reviewed' = points come from photos the teacher approved; otherwise a self-reported number. */
  reviewStatus?: 'self_reported' | 'reviewed';
  /** Photos from the student's class review file, each approved or rejected by the teacher. */
  evidence?: EvidenceItem[];
}

export interface EvidenceItem {
  id: string;
  title: string;
  originalWording?: string;
  intendedWording?: string;
  category: string;
  createdAt: string;
  thumbnail: string;
  points: number;
  capturedFresh: boolean;
  /** The student's phone read this wording from the photo (helpful signal, not proof). */
  readByApp?: boolean;
  /** null = not reviewed yet */
  approved: boolean | null;
  /** Why it was auto-flagged (outside class time, old gallery photo, …). */
  flag?: string;
}

/** File a student hands to the teacher: the photos taken during the class, for review. */
export interface ClassReviewFile {
  app: 'TYPO_HUNTER_CLASS_REVIEW';
  formatVersion: 1;
  classId: string;
  className: string;
  deviceId: string;
  studentName: string;
  squadFaction: string;
  createdAt: string;
  entries: Array<Omit<EvidenceItem, 'approved' | 'flag'>>;
}

export interface ClassSquadAssignments {
  alpha: string[];
  omega: string[];
}

export interface StudentSubmissionPayload {
  app: 'TYPO_HUNTER_SUBMISSION';
  action: 'SUBMIT_ASSIGNMENT';
  classId?: string;
  deviceId?: string;
  studentName: string;
  squadFaction: string;
  points: number;
  specimens: number;
  legends: number;
  checksum: string;
  timestamp: string;
}

const STORAGE_ACTIVE_CLASS = 'typo_hunter_active_class_expedition';
const STORAGE_GRADEBOOK = 'typo_hunter_teacher_gradebook';
const STORAGE_TEACHER_PROFILE = 'typo_hunter_teacher_profile';
const STORAGE_HOSTED_CLASS = 'typo_hunter_teacher_hosted_class';
const STORAGE_CLASS_SQUADS = 'typo_hunter_teacher_class_squads';
const STORAGE_CLASS_BATTLES = 'typo_hunter_teacher_class_battles';

export const teacherService = {
  getTeacherProfile(): { instructorName: string; defaultClassName: string } {
    try {
      const data = localStorage.getItem(STORAGE_TEACHER_PROFILE);
      return data
        ? JSON.parse(data)
        : { instructorName: 'Professor Sterling', defaultClassName: 'ENG-201: Urban Linguistics' };
    } catch {
      return { instructorName: 'Professor Sterling', defaultClassName: 'ENG-201: Urban Linguistics' };
    }
  },

  saveTeacherProfile(profile: { instructorName: string; defaultClassName: string }) {
    localStorage.setItem(STORAGE_TEACHER_PROFILE, JSON.stringify(profile));
  },

  getActiveClassExpedition(): ClassExpedition | null {
    try {
      const data = localStorage.getItem(STORAGE_ACTIVE_CLASS);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setActiveClassExpedition(expedition: ClassExpedition): void {
    localStorage.setItem(STORAGE_ACTIVE_CLASS, JSON.stringify(expedition));
  },

  clearActiveClassExpedition(): void {
    localStorage.removeItem(STORAGE_ACTIVE_CLASS);
  },

  /** The class this device is HOSTING as a teacher (separate from a class a student joined). */
  getHostedClass(): ClassExpedition | null {
    try {
      const data = localStorage.getItem(STORAGE_HOSTED_CLASS);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setHostedClass(expedition: ClassExpedition): void {
    localStorage.setItem(STORAGE_HOSTED_CLASS, JSON.stringify(expedition));
  },

  clearHostedClass(): void {
    localStorage.removeItem(STORAGE_HOSTED_CLASS);
  },

  expeditionToPayload(expedition: ClassExpedition): ClassExpeditionPayload {
    return { app: 'TYPO_HUNTER_CLASS', action: 'JOIN_CLASS_EXPEDITION', ...expedition };
  },

  payloadToExpedition(payload: ClassExpeditionPayload): ClassExpedition {
    return {
      classId: payload.classId,
      className: payload.className,
      instructorName: payload.instructorName,
      durationMinutes: payload.durationMinutes,
      targetPoints: payload.targetPoints,
      objective: payload.objective,
      timestamp: payload.timestamp,
      signature: payload.signature,
    };
  },

  /**
   * Converts a scanned student QR (assignment submission or plain Curator Pass)
   * into a gradebook row, checking its checksum and class.
   */
  submissionFromScan(
    scan: {
      studentName: string;
      squadFaction?: string;
      points: number;
      specimens: number;
      legends: number;
      checksum?: string;
      classId?: string;
      deviceId?: string;
      kind: 'qr_submission' | 'qr_pass';
    },
    hostedClass: ClassExpedition | null
  ): StudentSubmission {
    const target = hostedClass?.targetPoints || 250;
    const { grade, status } = this.calculateGrade(scan.points, target);
    const expectedPrefix =
      scan.kind === 'qr_submission'
        ? `SUBMIT-${scan.points}-${scan.specimens}-`
        : `TPH-${scan.points}-`;
    // Format check only: a QR code can't prove its numbers. Teachers should review photos instead.
    const tamperVerified = !!scan.checksum && scan.checksum.startsWith(expectedPrefix);
    const classMatch = !hostedClass || !scan.classId || scan.classId === hostedClass.classId;

    return {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      studentName: scan.studentName.trim() || 'Student',
      squadFaction: scan.squadFaction || 'SYN',
      classId: scan.classId || hostedClass?.classId || 'INDEPENDENT',
      points: scan.points,
      specimensCataloged: scan.specimens,
      legendsEnshrined: scan.legends,
      grade,
      status,
      tamperVerified,
      antiCheatHash: scan.checksum || 'UNSIGNED',
      submittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: scan.kind,
      classMatch,
      deviceId: typeof scan.deviceId === 'string' ? scan.deviceId.slice(0, 32) : undefined,
      reviewStatus: 'self_reported',
    };
  },

  /** Start and end (ms) of a class hunt. Only photos taken in this window count. */
  getClassWindow(expedition: ClassExpedition): { start: number; end: number } {
    const start = Date.parse(expedition.timestamp) || Date.now();
    return { start, end: start + Math.max(1, expedition.durationMinutes) * 60 * 1000 };
  },

  /** Small allowance either side for clock differences between phones (they're normally synced to seconds). */
  CLOCK_GRACE_MS: 2 * 60 * 1000,

  /** The student's own, point-earning, freshly taken photos from inside the class window. */
  selectSessionEntries(discoveries: Discovery[], expedition: ClassExpedition): Discovery[] {
    const { start, end } = this.getClassWindow(expedition);
    return discoveries.filter(d => {
      const t = Date.parse(d.createdAt);
      return (
        d.origin !== 'imported' &&
        d.capturedFresh === true &&
        calculateSpecimenScore(d).eligible &&
        t >= start - this.CLOCK_GRACE_MS &&
        t <= end + this.CLOCK_GRACE_MS
      );
    });
  },

  createClassReviewFile(
    studentName: string,
    squadFaction: string,
    discoveries: Discovery[],
    expedition: ClassExpedition
  ): ClassReviewFile {
    const entries = this.selectSessionEntries(discoveries, expedition).map(d => ({
      id: d.id,
      title: d.title,
      originalWording: d.originalWording,
      intendedWording: d.intendedWording,
      category: d.category,
      createdAt: d.createdAt,
      thumbnail: d.thumbnail,
      points: calculateSpecimenScore(d).totalPoints,
      capturedFresh: d.capturedFresh === true,
      readByApp: d.readByApp === true ? true : undefined,
    }));
    return {
      app: 'TYPO_HUNTER_CLASS_REVIEW',
      formatVersion: 1,
      classId: expedition.classId,
      className: expedition.className,
      deviceId: getDeviceId(),
      studentName: studentName.trim() || 'Student',
      squadFaction,
      createdAt: new Date().toISOString(),
      entries,
    };
  },

  parseClassReviewFile(text: string): ClassReviewFile | null {
    try {
      const f = JSON.parse(text);
      if (
        f && f.app === 'TYPO_HUNTER_CLASS_REVIEW' && typeof f.studentName === 'string' &&
        typeof f.deviceId === 'string' && Array.isArray(f.entries)
      ) {
        f.entries = f.entries
          .filter((e: Record<string, unknown>) => e && typeof e.title === 'string' && typeof e.thumbnail === 'string' && String(e.thumbnail).startsWith('data:image/'))
          .slice(0, 200);
        return f as ClassReviewFile;
      }
    } catch {
      // not JSON
    }
    return null;
  },

  /**
   * Turns a review file into a roster row. Each photo starts unreviewed, except
   * photos outside the class time or not freshly taken, which start rejected
   * with a reason the teacher can override.
   */
  submissionFromReviewFile(file: ClassReviewFile, hostedClass: ClassExpedition | null): StudentSubmission {
    const window = hostedClass ? this.getClassWindow(hostedClass) : null;
    const evidence: EvidenceItem[] = file.entries.map(e => {
      const t = Date.parse(e.createdAt);
      let flag: string | undefined;
      if (window && (t < window.start - this.CLOCK_GRACE_MS || t > window.end + this.CLOCK_GRACE_MS)) flag = 'Taken outside class time';
      else if (!e.capturedFresh) flag = 'Old photo from the gallery';
      return {
        ...e,
        points: Math.max(0, Math.min(120, Number(e.points) || 0)),
        approved: flag ? false : null,
        flag,
      };
    });
    const sub: StudentSubmission = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      studentName: file.studentName.trim().slice(0, 40) || 'Student',
      squadFaction: String(file.squadFaction || 'SYN').slice(0, 6),
      classId: file.classId || hostedClass?.classId || 'INDEPENDENT',
      points: 0,
      specimensCataloged: evidence.length,
      legendsEnshrined: 0,
      grade: '',
      status: 'PENDING',
      tamperVerified: true,
      antiCheatHash: 'REVIEW-FILE',
      submittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: 'archive',
      classMatch: !hostedClass || file.classId === hostedClass.classId,
      deviceId: file.deviceId.slice(0, 32),
      reviewStatus: 'reviewed',
      evidence,
    };
    return this.recomputeReviewedScore(sub, hostedClass?.targetPoints || 250);
  },

  /** Points for a reviewed student = sum of approved photos. */
  recomputeReviewedScore(sub: StudentSubmission, targetPoints: number): StudentSubmission {
    if (sub.reviewStatus !== 'reviewed' || !sub.evidence) return sub;
    const approved = sub.evidence.filter(e => e.approved === true);
    const points = approved.reduce((sum, e) => sum + e.points, 0) + (sub.teacherCommendation ? 50 : 0);
    const { grade, status } = this.calculateGrade(points, targetPoints);
    return { ...sub, points, specimensCataloged: approved.length, grade, status };
  },

  getClassSquads(): ClassSquadAssignments {
    try {
      const data = localStorage.getItem(STORAGE_CLASS_SQUADS);
      const parsed = data ? JSON.parse(data) : null;
      if (parsed && Array.isArray(parsed.alpha) && Array.isArray(parsed.omega)) return parsed;
    } catch {
      // fall through
    }
    return { alpha: [], omega: [] };
  },

  saveClassSquads(squads: ClassSquadAssignments): void {
    localStorage.setItem(STORAGE_CLASS_SQUADS, JSON.stringify(squads));
  },

  /** Legacy demo rows (from older versions) are never eligible; everyone else got in by a real scan. */
  isSquadEligible(student: StudentSubmission): boolean {
    return !this.isLegacyDemo(student);
  },

  isLegacyDemo(student: StudentSubmission): boolean {
    return (student.source as string) === 'demo' || student.id.startsWith('demo_') || student.antiCheatHash.startsWith('DEMO-');
  },

  studentToSquadMember(student: StudentSubmission): SquadMember {
    return pvpService.createSquadMember({
      id: student.id,
      nickname: student.studentName,
      teamTag: student.squadFaction,
      points: student.points,
      specimens: student.specimensCataloged,
      legends: student.legendsEnshrined,
      passFingerprint: pvpService.passFingerprint(student.studentName, student.antiCheatHash),
      deviceId: student.deviceId,
      verified: this.isSquadEligible(student),
    });
  },

  getClassBattles(): SquadBattleResult[] {
    try {
      const data = localStorage.getItem(STORAGE_CLASS_BATTLES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  /** Runs a teacher-refereed class squad battle and logs it to the class ledger (not the teacher's own PvP stats). */
  runClassSquadBattle(alpha: SquadMember[], omega: SquadMember[], scoringMode: 'total' | 'average'): SquadBattleResult {
    const statsA = pvpService.calculateSquadStats(alpha);
    const statsB = pvpService.calculateSquadStats(omega);
    const teamA: SquadTeam = { id: 'alpha', name: 'Class Squad Alpha', members: alpha, ...statsA };
    const teamB: SquadTeam = { id: 'omega', name: 'Class Squad Omega', members: omega, ...statsB };
    const result = pvpService.resolveSquadClash(teamA, teamB, scoringMode, false);
    try {
      const list = this.getClassBattles();
      list.unshift(result);
      localStorage.setItem(STORAGE_CLASS_BATTLES, JSON.stringify(list.slice(0, 30)));
    } catch (err) {
      console.error('Failed to save class battle', err);
    }
    return result;
  },

  getClassGradebook(): StudentSubmission[] {
    try {
      const data = localStorage.getItem(STORAGE_GRADEBOOK);
      const list: StudentSubmission[] = data ? JSON.parse(data) : [];
      // Purge simulated students saved by older versions of the app.
      const real = list.filter(st => !this.isLegacyDemo(st));
      if (real.length !== list.length) {
        localStorage.setItem(STORAGE_GRADEBOOK, JSON.stringify(real));
      }
      return real;
    } catch {
      return [];
    }
  },

  /**
   * Adds or updates a roster row. Rows match on device id (names are not unique);
   * rows without a device id (older app versions) never merge with anyone.
   * A row whose photos were reviewed is never overwritten by a self-reported QR.
   */
  saveStudentToGradebook(submission: StudentSubmission): { replaced: boolean; keptReview: boolean } {
    const list = this.getClassGradebook();
    const existingIndex = submission.deviceId
      ? list.findIndex(s => s.deviceId === submission.deviceId)
      : list.findIndex(s => s.id === submission.id);
    if (existingIndex >= 0) {
      const existing = list[existingIndex];
      if (existing.reviewStatus === 'reviewed' && submission.reviewStatus !== 'reviewed') {
        list[existingIndex] = { ...existing, studentName: submission.studentName, squadFaction: submission.squadFaction };
        localStorage.setItem(STORAGE_GRADEBOOK, JSON.stringify(list));
        return { replaced: true, keptReview: true };
      }
      // Keep the original id so the student's class-squad assignment survives a re-scan.
      list[existingIndex] = { ...submission, id: existing.id };
      localStorage.setItem(STORAGE_GRADEBOOK, JSON.stringify(list));
      return { replaced: true, keptReview: false };
    }
    list.unshift(submission);
    localStorage.setItem(STORAGE_GRADEBOOK, JSON.stringify(list));
    return { replaced: false, keptReview: false };
  },

  removeStudentFromGradebook(id: string): void {
    const list = this.getClassGradebook().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_GRADEBOOK, JSON.stringify(list));
    const squads = this.getClassSquads();
    this.saveClassSquads({
      alpha: squads.alpha.filter(x => x !== id),
      omega: squads.omega.filter(x => x !== id),
    });
  },

  clearGradebook(): void {
    localStorage.removeItem(STORAGE_GRADEBOOK);
    localStorage.removeItem(STORAGE_CLASS_SQUADS);
  },

  calculateGrade(points: number, targetPoints: number): { grade: string; status: 'HONORS' | 'PASSED' | 'PENDING' } {
    const target = targetPoints > 0 ? targetPoints : 200;
    const ratio = points / target;

    if (ratio >= 1.25) return { grade: 'A+ (High Honors)', status: 'HONORS' };
    if (ratio >= 1.0) return { grade: 'A (Exemplary)', status: 'PASSED' };
    if (ratio >= 0.8) return { grade: 'B (Proficient)', status: 'PASSED' };
    if (ratio >= 0.6) return { grade: 'C (Developing)', status: 'PENDING' };
    return { grade: 'Incomplete / Needs Work', status: 'PENDING' };
  },

  createClassMasterPayload(
    className: string,
    instructorName: string,
    durationMinutes: number,
    targetPoints: number,
    objective: string
  ): ClassExpeditionPayload {
    const classId = `CLS-${Date.now().toString(36).toUpperCase()}`;
    const timestamp = new Date().toISOString();
    const signature = `MASTER-EXP-${durationMinutes}M-${targetPoints}PTS-${Date.now().toString(36).toUpperCase()}`;

    return {
      app: 'TYPO_HUNTER_CLASS',
      action: 'JOIN_CLASS_EXPEDITION',
      classId,
      className: className.trim() || 'Linguistics Field Study',
      instructorName: instructorName.trim() || 'Instructor',
      durationMinutes,
      targetPoints,
      objective: objective.trim() || 'Document linguistic blunders and catalog photographic evidence.',
      timestamp,
      signature,
    };
  },

  /**
   * Quick QR summary for the teacher. Inside a class it counts only photos taken
   * during the class; it is still self-reported (the review file is the evidence).
   */
  createStudentSubmissionPayload(
    studentName: string,
    squadFaction: string,
    discoveries: Discovery[],
    joinedClass: ClassExpedition | null,
    lifetimePoints: number
  ): StudentSubmissionPayload {
    const entries = joinedClass ? this.selectSessionEntries(discoveries, joinedClass) : discoveries.filter(d => d.origin !== 'imported');
    const points = joinedClass ? sumSpecimenPoints(entries) : lifetimePoints;
    const specimens = entries.length;
    const timestamp = new Date().toISOString();
    const checksum = `SUBMIT-${points}-${specimens}-${Date.now().toString(36).toUpperCase()}`;

    return {
      app: 'TYPO_HUNTER_SUBMISSION',
      action: 'SUBMIT_ASSIGNMENT',
      classId: joinedClass?.classId,
      deviceId: getDeviceId(),
      studentName: studentName.trim() || 'Student',
      squadFaction: squadFaction || 'SYN',
      points,
      specimens,
      legends: 0,
      checksum,
      timestamp,
    };
  },

  exportGradebookCsv(submissions: StudentSubmission[], className: string): void {
    const headers = [
      'Student Name',
      'Squad Faction',
      'Curator Points',
      'Specimens Logged',
      'Legends Enshrined',
      'Assigned Grade',
      'Status',
      'Evidence',
      'Submission Timestamp',
      'Teacher Notes',
    ];

    const rows = submissions.map(s => [
      `"${s.studentName.replace(/"/g, '""')}"`,
      `"${s.squadFaction}"`,
      s.points,
      s.specimensCataloged,
      s.legendsEnshrined,
      `"${s.grade}"`,
      `"${s.status}"`,
      `"${s.reviewStatus === 'reviewed' ? `Photos reviewed (${(s.evidence || []).filter(e => e.approved).length} approved)` : 'Self-reported'}"`,
      `"${s.submittedAt}"`,
      `"${(s.teacherCommendation || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `typo-hunter-gradebook-${className.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};
