/**
 * @file TeacherModeModal.tsx
 * @description Sovereign Academic Terminal for Instructors, Professors, and Teachers.
 *
 * ARCHITECTURAL DESIGN:
 *   - Zero Cloud Sovereignty: 100% peer-to-peer classroom management without cloud dependencies.
 *   - Synchronized Master QR: Displays the master assignment QR for class projection.
 *   - Gradebook Ledger: Complete student roster with point tallies, verified anti-cheat hashes,
 *     letter grade allocation, and CSV export.
 *   - Multi-Channel Ingestion: Scans student submission QRs or imports signed `.json` student archives.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import QRCode from 'qrcode';
import { Discovery } from '../db/database';
import {
  teacherService,
  ClassExpedition,
  ClassExpeditionPayload,
  ClassSquadAssignments,
  StudentSubmission,
  StudentSubmissionPayload,
} from '../utils/teacherService';
import { pvpService, SquadBattleResult, SQUAD_RULES } from '../utils/pvpService';
import { BattleQrScannerModal } from './BattleQrScannerModal';
import { downloadBlob } from '../utils/archiveSecurity';
import { useHunterPoints } from '../hooks/useHunterPoints';
import { isDefaultNickname } from '../utils/identity';
import { calculateSpecimenScore } from '../utils/proofOfSighting';
import {
  IconClose,
  IconGraduationCap,
  IconCheck,
  IconDownload,
  IconCamera,
  IconShield,
  IconTrash,
  IconStar,
  IconQrCode,
  IconSwords,
  IconUsers,
} from './Icons';

interface TeacherModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  nickname: string;
  discoveries: Discovery[];
  /** Called on a STUDENT device after scanning the teacher's Master QR. */
  onClassJoined?: (expedition: ClassExpedition) => void;
  /** Students must set a real name before joining a class. */
  onUpdateNickname?: (name: string) => void;
}

export const TeacherModeModal: React.FC<TeacherModeModalProps> = ({
  isOpen,
  onClose,
  nickname,
  discoveries,
  onClassJoined,
  onUpdateNickname,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, isOpen, onClose);

  const lifetimePoints = useHunterPoints();
  const [nameDraft, setNameDraft] = useState('');
  const needsName = isDefaultNickname(nickname);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [isOpen]);
  const [activeTab, setActiveTab] = useState<'dispatch' | 'gradebook' | 'squads' | 'student'>('dispatch');
  const [instructorName, setInstructorName] = useState(() => teacherService.getTeacherProfile().instructorName);
  const [className, setClassName] = useState(() => teacherService.getTeacherProfile().defaultClassName);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [targetPoints, setTargetPoints] = useState(250);
  const [objective, setObjective] = useState('Catalog 3 municipal or storefront anomalies with full field notes.');
  const [masterQrUrl, setMasterQrUrl] = useState<string | null>(null);
  const [studentSubmissionQr, setStudentSubmissionQr] = useState<string | null>(null);
  const [gradebook, setGradebook] = useState<StudentSubmission[]>(() => teacherService.getClassGradebook());
  // Class this device is hosting (teacher) vs. class this device joined (student).
  const [activeExpedition, setActiveExpedition] = useState<ClassExpedition | null>(() => teacherService.getHostedClass());
  const [joinedClass, setJoinedClass] = useState<ClassExpedition | null>(() => teacherService.getActiveClassExpedition());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [scannerPurpose, setScannerPurpose] = useState<'student' | 'join' | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [classSquads, setClassSquads] = useState<ClassSquadAssignments>(() => teacherService.getClassSquads());
  const [classScoringMode, setClassScoringMode] = useState<'total' | 'average'>('average');
  const [classBattleResult, setClassBattleResult] = useState<SquadBattleResult | null>(null);

  const flash = (message: string, ms = 4000) => {
    setFeedback(message);
    setTimeout(() => setFeedback(null), ms);
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setGradebook(teacherService.getClassGradebook());
      setClassSquads(teacherService.getClassSquads());
      const joined = teacherService.getActiveClassExpedition();
      const hosted = teacherService.getHostedClass();
      setJoinedClass(joined);
      setActiveExpedition(hosted);
      // A student who joined a class lands on their own tab; teachers land on Start Hunt.
      if (joined && !hosted) setActiveTab('student');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      handleGenerateMasterQr();
    }
  }, [isOpen, activeExpedition, className, instructorName, durationMinutes, targetPoints, objective]);

  useEffect(() => {
    if (activeTab === 'student') {
      const payload = teacherService.createStudentSubmissionPayload(
        nickname,
        pvpService.getCurrentTeam().tag,
        discoveries,
        joinedClass,
        lifetimePoints
      );
      QRCode.toDataURL(JSON.stringify(payload), {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 260,
        color: { dark: '#282722', light: '#FFFDF9' },
      })
        .then(url => setStudentSubmissionQr(url))
        .catch(() => {});
    }
  }, [activeTab, nickname, discoveries, joinedClass, lifetimePoints]);

  const sessionEntries = joinedClass ? teacherService.selectSessionEntries(discoveries, joinedClass) : [];
  const sessionPoints = sessionEntries.reduce((sum, d) => sum + calculateSpecimenScore(d).totalPoints, 0);
  const minutesLeft = (exp: ClassExpedition | null) => {
    if (!exp) return null;
    return Math.ceil((teacherService.getClassWindow(exp).end - now) / 60000);
  };

  const handleSaveReviewFile = async () => {
    if (!joinedClass) return;
    const file = teacherService.createClassReviewFile(nickname, pvpService.getCurrentTeam().tag, discoveries, joinedClass);
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    const filename = `typo-hunter-review-${file.studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${joinedClass.classId}.json`;
    try {
      const shareFile = new File([blob], filename, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
        await navigator.share({ files: [shareFile], title: `Typo Hunter review: ${file.studentName}` });
        return;
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
    }
    downloadBlob(blob, filename);
    flash(`Saved your review file (${file.entries.length} photo${file.entries.length === 1 ? '' : 's'}). Send it to your teacher.`);
  };

  // Once a class is live the QR encodes THAT class (stable classId), so every
  // student who scans joins the same session the teacher is grading.
  const handleGenerateMasterQr = async () => {
    const payload = activeExpedition
      ? teacherService.expeditionToPayload(activeExpedition)
      : teacherService.createClassMasterPayload(className, instructorName, durationMinutes, targetPoints, objective);
    try {
      const url = await QRCode.toDataURL(JSON.stringify(payload), {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
        color: {
          dark: '#282722',
          light: '#FFFDF9',
        },
      });
      setMasterQrUrl(url);
    } catch (err) {
      console.error('Failed to generate teacher master QR', err);
    }
  };

  const handleStartClassHunt = () => {
    const payload = teacherService.createClassMasterPayload(
      className,
      instructorName,
      durationMinutes,
      targetPoints,
      objective
    );
    const expedition: ClassExpedition = {
      classId: payload.classId,
      className: payload.className,
      instructorName: payload.instructorName,
      durationMinutes: payload.durationMinutes,
      targetPoints: payload.targetPoints,
      objective: payload.objective,
      timestamp: payload.timestamp,
      signature: payload.signature,
    };
    teacherService.setHostedClass(expedition);
    setActiveExpedition(expedition);
    teacherService.saveTeacherProfile({ instructorName, defaultClassName: className });

    flash(`Class is live (${expedition.classId}). Every student scans the Master QR to start at the same time.`);
  };

  const handleStopClassHunt = () => {
    teacherService.clearHostedClass();
    setActiveExpedition(null);
    flash('Classroom Expedition closed.', 3000);
  };

  // ---- Teacher: scan student QRs into the roster ----
  const ingestScannedStudent = (entry: StudentSubmission) => {
    const { keptReview } = teacherService.saveStudentToGradebook(entry);
    setGradebook(teacherService.getClassGradebook());
    setActiveTab('gradebook');
    if (keptReview) {
      flash(`${entry.studentName}'s photos were already reviewed, so their reviewed score was kept.`);
      return;
    }
    const warnings = [
      entry.classMatch === false ? 'submitted for a different class' : null,
      !entry.deviceId ? 'older app version: ask them to update' : null,
    ].filter(Boolean);
    flash(
      `${entry.studentName} added: ${entry.points} pts (self-reported). For a trustworthy grade, import their review file${warnings.length ? `. Note: ${warnings.join(', ')}` : ''}.`,
      6000
    );
  };

  const handleStudentSubmissionScanned = (payload: StudentSubmissionPayload) => {
    setScannerPurpose(null);
    ingestScannedStudent(
      teacherService.submissionFromScan(
        {
          studentName: payload.studentName,
          squadFaction: payload.squadFaction,
          points: payload.points,
          specimens: payload.specimens,
          legends: payload.legends,
          checksum: payload.checksum,
          classId: payload.classId,
          deviceId: payload.deviceId,
          kind: 'qr_submission',
        },
        activeExpedition
      )
    );
  };

  const handleCuratorPassScanned = (pass: {
    hunter: string;
    points: number;
    specimens: number;
    legends: number;
    teamTag?: string;
    checksum?: string;
    deviceId?: string;
  }) => {
    setScannerPurpose(null);
    ingestScannedStudent(
      teacherService.submissionFromScan(
        {
          studentName: pass.hunter,
          squadFaction: pass.teamTag,
          points: pass.points,
          specimens: pass.specimens,
          legends: pass.legends,
          checksum: pass.checksum,
          deviceId: pass.deviceId,
          kind: 'qr_pass',
        },
        activeExpedition
      )
    );
  };

  // ---- Student: scan the teacher's Master QR to join ----
  const handleJoinClassScanned = (payload: ClassExpeditionPayload) => {
    setScannerPurpose(null);
    const expedition = teacherService.payloadToExpedition(payload);
    teacherService.setActiveClassExpedition(expedition);
    setJoinedClass(expedition);
    if (onClassJoined) {
      onClassJoined(expedition);
    } else {
      flash(`Joined ${expedition.className}!`);
    }
  };

  const handleLeaveJoinedClass = () => {
    teacherService.clearActiveClassExpedition();
    setJoinedClass(null);
    flash('Left the class expedition.', 3000);
  };

  // ---- Teacher: class squads (built from QR-verified roster) ----
  const studentById = (id: string) => gradebook.find(s => s.id === id);
  const alphaStudents = classSquads.alpha.map(studentById).filter((s): s is StudentSubmission => !!s);
  const omegaStudents = classSquads.omega.map(studentById).filter((s): s is StudentSubmission => !!s);
  const alphaMembers = alphaStudents.map(st => teacherService.studentToSquadMember(st));
  const omegaMembers = omegaStudents.map(st => teacherService.studentToSquadMember(st));
  const classReadiness = pvpService.checkSquadReadiness(alphaMembers, omegaMembers);
  const classSquadsUneven = alphaMembers.length !== omegaMembers.length;
  const classEffectiveMode: 'total' | 'average' = classSquadsUneven ? 'average' : classScoringMode;

  const assignStudent = (id: string, side: 'alpha' | 'omega' | 'bench') => {
    const next: ClassSquadAssignments = {
      alpha: classSquads.alpha.filter(x => x !== id),
      omega: classSquads.omega.filter(x => x !== id),
    };
    if (side !== 'bench') {
      if (next[side].length >= SQUAD_RULES.maxTeamSize) {
        flash(`Squads are capped at ${SQUAD_RULES.maxTeamSize} students.`, 3000);
        return;
      }
      next[side] = [...next[side], id];
    }
    setClassSquads(next);
    teacherService.saveClassSquads(next);
    setClassBattleResult(null);
  };

  const handleAutoSplitSquads = () => {
    // Snake draft by points so both squads end up balanced.
    const eligible = gradebook
      .filter(st => teacherService.isSquadEligible(st))
      .sort((a, b) => b.points - a.points)
      .slice(0, SQUAD_RULES.maxTeamSize * 2);
    const next: ClassSquadAssignments = { alpha: [], omega: [] };
    eligible.forEach((st, i) => {
      const side = i % 4 === 0 || i % 4 === 3 ? 'alpha' : 'omega';
      next[side].push(st.id);
    });
    setClassSquads(next);
    teacherService.saveClassSquads(next);
    setClassBattleResult(null);
  };

  const handleRunClassBattle = () => {
    if (!classReadiness.ready) {
      flash(classReadiness.reason, 3500);
      return;
    }
    const result = teacherService.runClassSquadBattle(alphaMembers, omegaMembers, classEffectiveMode);
    setClassBattleResult(result);
  };

  // Import a student's class review file: their photos from this class, for approval.
  const handleImportReviewFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const review = teacherService.parseClassReviewFile(String(reader.result || ''));
      if (!review) {
        flash("That isn't a Typo Hunter class review file. Ask the student to use 'Save review file' in the Student tab.", 5000);
        return;
      }
      const submission = teacherService.submissionFromReviewFile(review, activeExpedition);
      teacherService.saveStudentToGradebook(submission);
      setGradebook(teacherService.getClassGradebook());
      setActiveTab('gradebook');
      const saved = teacherService.getClassGradebook().find(st => st.deviceId === submission.deviceId);
      if (saved) setExpandedStudentId(saved.id);
      const flagged = submission.evidence?.filter(ev => ev.flag).length || 0;
      flash(
        `${review.studentName}: ${review.entries.length} photo${review.entries.length === 1 ? '' : 's'} to review${flagged ? ` (${flagged} auto-flagged)` : ''}.` +
          (submission.classMatch === false ? ' This file is from a different class.' : ''),
        5000
      );
    };
    reader.onerror = () => flash('Could not read that file.', 3000);
    reader.readAsText(file);
  };

  const updateStudent = (student: StudentSubmission) => {
    const target = activeExpedition?.targetPoints || targetPoints;
    teacherService.saveStudentToGradebook(teacherService.recomputeReviewedScore(student, target));
    setGradebook(teacherService.getClassGradebook());
  };

  const setEvidenceApproval = (student: StudentSubmission, evidenceId: string | 'ALL', approved: boolean) => {
    updateStudent({
      ...student,
      evidence: (student.evidence || []).map(ev =>
        evidenceId === 'ALL' ? (ev.flag && approved ? ev : { ...ev, approved }) : ev.id === evidenceId ? { ...ev, approved } : ev
      ),
    });
  };

  // One teacher bonus per student (+50), toggled, not stackable.
  const handleAwardCommendation = (studentId: string) => {
    const student = gradebook.find(st => st.id === studentId);
    if (!student) return;
    const giving = !student.teacherCommendation;
    const base = { ...student, teacherCommendation: giving ? 'Teacher bonus (+50)' : undefined };
    if (student.reviewStatus === 'reviewed') {
      updateStudent(base);
    } else {
      const points = student.points + (giving ? 50 : -50);
      const { grade, status } = teacherService.calculateGrade(points, activeExpedition?.targetPoints || targetPoints);
      teacherService.saveStudentToGradebook({ ...base, points, grade, status });
      setGradebook(teacherService.getClassGradebook());
    }
  };

  const handleRemoveStudent = (id: string) => {
    teacherService.removeStudentFromGradebook(id);
    setGradebook(teacherService.getClassGradebook());
    setClassSquads(teacherService.getClassSquads());
  };

  const handleExportCsv = () => {
    teacherService.exportGradebookCsv(gradebook, className);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs select-none"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Teacher Mode Terminal"
    >
      <div className="editorial-card bg-[#F4EBDD] p-4 sm:p-5 rounded-3xl w-full max-w-[calc(100vw-1.5rem)] sm:max-w-xl relative shadow-brutal border-3 border-black flex flex-col max-h-[92vh] overflow-hidden box-border">
        {/* Terminal Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-3.5 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#D66A4A] uppercase block">
                Classroom Overseer Suite
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border border-black bg-black text-[#E8B92D]">
                TEACHER MODE
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold font-heading text-black leading-tight flex items-center gap-2">
              <IconGraduationCap size={24} className="text-[#D66A4A]" />
              <span>Academic Terminal</span>
            </h2>
            <p className="text-[11px] font-mono text-gray-600 mt-0.5">
              Synchronized class expeditions, student system audits, and peer grading.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border-2 border-black bg-white flex items-center justify-center hover:bg-gray-100 cursor-pointer shadow-brutal-sm flex-shrink-0"
            aria-label="Close Teacher Mode"
          >
            <IconClose size={14} />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="grid grid-cols-4 bg-[#FFFDF9] border-2 border-black rounded-xl p-1 mb-3.5 shadow-brutal-sm text-[11px] sm:text-xs font-mono font-bold flex-shrink-0 gap-1">
          <button
            onClick={() => setActiveTab('dispatch')}
            className={`py-2 px-1 rounded-lg text-center cursor-pointer transition-colors flex items-center justify-center gap-1 truncate ${
              activeTab === 'dispatch' ? 'bg-black text-[#E8B92D]' : 'text-gray-600 hover:text-black'
            }`}
          >
            <IconGraduationCap size={13} className="flex-shrink-0" />
            <span className="truncate">Start</span>
          </button>
          <button
            onClick={() => setActiveTab('gradebook')}
            className={`py-2 px-1 rounded-lg text-center cursor-pointer transition-colors flex items-center justify-center gap-1 truncate ${
              activeTab === 'gradebook' ? 'bg-black text-[#E8B92D]' : 'text-gray-600 hover:text-black'
            }`}
          >
            <IconShield size={13} className="flex-shrink-0" />
            <span className="truncate">Class {gradebook.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('squads')}
            className={`py-2 px-1 rounded-lg text-center cursor-pointer transition-colors flex items-center justify-center gap-1 truncate ${
              activeTab === 'squads' ? 'bg-black text-[#E8B92D]' : 'text-gray-600 hover:text-black'
            }`}
          >
            <IconSwords size={13} className="flex-shrink-0" />
            <span className="truncate">Squads</span>
          </button>
          <button
            onClick={() => setActiveTab('student')}
            className={`py-2 px-1 rounded-lg text-center cursor-pointer transition-colors flex items-center justify-center gap-1 truncate ${
              activeTab === 'student' ? 'bg-black text-[#E8B92D]' : 'text-gray-600 hover:text-black'
            }`}
          >
            <IconQrCode size={13} className="flex-shrink-0" />
            <span className="truncate">Student</span>
          </button>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div className="bg-[#82917B] text-white p-2.5 rounded-xl text-xs font-mono font-bold mb-3 border-2 border-black shadow-xs flex items-center gap-2">
            <IconCheck size={14} />
            <span>{feedback}</span>
          </div>
        )}

        {/* Tab Content Container */}
        <div className="overflow-y-auto px-1 pb-2 flex-1 space-y-4">
          {/* TAB 1: DISPATCH CLASS EXPEDITION */}
          {activeTab === 'dispatch' && (
            <div className="space-y-4 font-mono text-xs">
              {/* Active Expedition Status Banner */}
              {activeExpedition ? (
                <div className="bg-[#282722] text-white p-4 rounded-2xl border-2 border-black shadow-brutal space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold text-[#E8B92D] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                      Class Hunt In Session
                    </span>
                    <span className="text-[10px] text-gray-300">
                      Target: {activeExpedition.targetPoints} pts
                    </span>
                  </div>
                  <h3 className="font-heading font-extrabold text-base text-white">
                    {activeExpedition.className}
                  </h3>
                  <p className="text-[11px] text-gray-300">
                    Instructor: <strong>{activeExpedition.instructorName}</strong> · {(() => {
                      const left = minutesLeft(activeExpedition);
                      return left !== null && left > 0 ? `${left} min left` : 'Time is up: only photos taken during the class count';
                    })()}
                  </p>
                  <p className="text-[11px] text-[#E8B92D] italic">
                    "{activeExpedition.objective}"
                  </p>
                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={handleStopClassHunt}
                      className="btn-secondary py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider text-red-600 border border-red-500 cursor-pointer"
                    >
                      End Class Hunt
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#FFF9EC] p-3 rounded-xl border border-black/20 text-gray-700 space-y-1">
                  <span className="font-bold text-black uppercase text-[10px] block">
                    Teacher Whistle & Master QR:
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    Set your class parameters below. Project or show the <strong>Master QR Code</strong> so every student can scan it and start the synchronized field assignment simultaneously.
                  </p>
                </div>
              )}

              {/* Form Controls */}
              <div className="bg-white p-4 rounded-2xl border-2 border-black space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                      Course / Class Title
                    </label>
                    <input
                      type="text"
                      value={className}
                      onChange={e => setClassName(e.target.value)}
                      placeholder="e.g. ENG-201: Urban Linguistics"
                      className="w-full p-2 border-2 border-black rounded-xl font-bold font-heading text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                      Instructor Name
                    </label>
                    <input
                      type="text"
                      value={instructorName}
                      onChange={e => setInstructorName(e.target.value)}
                      placeholder="e.g. Professor Sterling"
                      className="w-full p-2 border-2 border-black rounded-xl font-bold font-heading text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                      Duration (Minutes)
                    </label>
                    <select
                      value={durationMinutes}
                      onChange={e => setDurationMinutes(Number(e.target.value))}
                      className="w-full p-2 border-2 border-black rounded-xl font-bold font-heading text-xs bg-white"
                    >
                      <option value={15}>15 Minutes Sprint</option>
                      <option value={30}>30 Minutes Standard</option>
                      <option value={45}>45 Minutes Extended</option>
                      <option value={60}>60 Minutes Full Class</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                      Target Points
                    </label>
                    <input
                      type="number"
                      value={targetPoints}
                      onChange={e => setTargetPoints(Number(e.target.value))}
                      step={25}
                      min={50}
                      className="w-full p-2 border-2 border-black rounded-xl font-bold font-heading text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                    Assignment Prompt / Field Objective
                  </label>
                  <textarea
                    value={objective}
                    onChange={e => setObjective(e.target.value)}
                    rows={2}
                    className="w-full p-2 border-2 border-black rounded-xl text-xs font-mono resize-none"
                  />
                </div>
              </div>

              {/* Master QR Code Display */}
              <div className="bg-[#FFFDF9] border-2 border-black rounded-2xl p-4 text-center space-y-3">
                <span className="text-[10px] font-bold uppercase text-[#D66A4A] tracking-wider block">
                  Projector Screen · Student Optical Join QR
                </span>
                {masterQrUrl && (
                  <div className="inline-block p-3 bg-white border-2 border-black rounded-2xl shadow-brutal-sm">
                    <img src={masterQrUrl} alt="Class Master QR" className="w-56 h-56 mx-auto object-contain" />
                  </div>
                )}
                <p className="text-[11px] text-gray-600 max-w-xs mx-auto">
                  Tell students to open their <strong>Typo Hunter Camera Scanner</strong> and aim at this code to join.
                </p>

                <button
                  type="button"
                  onClick={handleStartClassHunt}
                  className="w-full btn-primary py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-brutal flex items-center justify-center gap-2"
                >
                  <IconGraduationCap size={16} />
                  <span>{activeExpedition ? 'Re-Dispatch / Update Master QR' : 'Start Class Expedition Now!'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: AUDIT GRADEBOOK ROSTER */}
          {activeTab === 'gradebook' && (
            <div className="space-y-4 font-mono text-xs">
              {/* Summary Metrics */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-white p-2.5 rounded-xl border border-black/20">
                  <span className="text-xl font-extrabold font-heading text-black block">{gradebook.length}</span>
                  <span className="text-[10px] uppercase text-gray-500 font-bold block">Students</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-black/20">
                  <span className="text-xl font-extrabold font-heading text-[#82917B] block">
                    {gradebook.length > 0 ? Math.round(gradebook.reduce((acc, s) => acc + s.points, 0) / gradebook.length) : 0}
                  </span>
                  <span className="text-[10px] uppercase text-gray-500 font-bold block">Avg Pts</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-black/20">
                  <span className="text-xl font-extrabold font-heading text-[#D66A4A] block">
                    {gradebook.reduce((acc, s) => acc + s.specimensCataloged, 0)}
                  </span>
                  <span className="text-[10px] uppercase text-gray-500 font-bold block">Typos Spotted</span>
                </div>
                <div className="bg-[#FFF9EC] p-2.5 rounded-xl border border-black/20">
                  <span className="text-xl font-extrabold font-heading text-black block">
                    {gradebook.filter(s => s.reviewStatus === 'reviewed').length}/{gradebook.length}
                  </span>
                  <span className="text-[10px] uppercase text-gray-500 font-bold block">Photos reviewed</span>
                </div>
              </div>

              {/* Teacher Ingestion Action Bar */}
              <div className="flex flex-wrap gap-2 justify-between items-center pt-1">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setScannerPurpose('student')}
                    className="btn-primary py-2 px-3 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-brutal-sm"
                  >
                    <IconCamera size={13} />
                    <span>Scan Student QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary py-2 px-3 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                  >
                    <IconDownload size={13} />
                    <span>Import Review File</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportReviewFile}
                    className="hidden"
                  />
                </div>

                <div className="flex gap-2">
                  {gradebook.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="btn-secondary py-1.5 px-2.5 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <IconDownload size={11} />
                      <span>Export CSV</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Roster Table */}
              {gradebook.length > 0 ? (
                <div className="space-y-2.5">
                  {[...gradebook].sort((a, b) => b.points - a.points).map((student, rankIndex) => (
                    <div
                      key={student.id}
                      className="bg-white p-3.5 rounded-2xl border-2 border-black space-y-2 shadow-xs"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-black bg-[#E8B92D] text-black">
                              [{student.squadFaction}]
                            </span>
                            <h4 className="font-heading font-extrabold text-sm text-black">
                              <span className="text-gray-400 mr-1">#{rankIndex + 1}</span>
                              {student.studentName}
                            </h4>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {student.reviewStatus === 'reviewed' ? (
                              <span className="text-[10px] font-bold px-1 rounded border border-[#82917B] text-[#2D5A27]">
                                PHOTOS REVIEWED{(student.evidence || []).some(ev => ev.approved === null) ? ' · PENDING' : ''}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-1 rounded border border-[#D66A4A] text-[#D66A4A]">SELF-REPORTED</span>
                            )}
                            {student.classMatch === false && (
                              <span className="text-[10px] font-bold px-1 rounded border border-[#D66A4A] text-[#D66A4A]">OTHER CLASS</span>
                            )}
                            {classSquads.alpha.includes(student.id) && (
                              <span className="text-[10px] font-bold px-1 rounded bg-[#D66A4A] text-white">ALPHA</span>
                            )}
                            {classSquads.omega.includes(student.id) && (
                              <span className="text-[10px] font-bold px-1 rounded bg-black text-[#E8B92D]">OMEGA</span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {student.deviceId ? `Device #${student.deviceId.slice(0, 4)} · ` : ''}Submitted at {student.submittedAt}
                          </p>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border border-black block ${
                              student.status === 'HONORS'
                                ? 'bg-[#82917B] text-white'
                                : student.status === 'PASSED'
                                ? 'bg-[#E8B92D] text-black'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {student.grade}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-1.5 border-t border-black/10 text-gray-700">
                        <div>
                          <strong>{student.points} pts</strong> ({student.specimensCataloged} {student.reviewStatus === 'reviewed' ? 'approved photo' : 'photo'}{student.specimensCataloged === 1 ? '' : 's'})
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAwardCommendation(student.id)}
                            className="text-[10px] text-[#D66A4A] font-bold hover:underline cursor-pointer flex items-center gap-1"
                            title="Award teacher bonus +50 points"
                          >
                            <IconStar size={11} />
                            <span>{student.teacherCommendation ? 'Remove bonus' : '+50 Bonus'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveStudent(student.id)}
                            className="text-gray-400 hover:text-black cursor-pointer"
                            aria-label="Remove student"
                          >
                            <IconTrash size={12} />
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedStudentId(expandedStudentId === student.id ? null : student.id)}
                        className="text-[10px] text-gray-600 hover:text-black underline cursor-pointer"
                        aria-expanded={expandedStudentId === student.id}
                      >
                        {expandedStudentId === student.id ? 'Hide details' : 'View full record'}
                      </button>

                      {expandedStudentId === student.id && (
                        <div className="bg-[#FAF6EE] p-2 rounded-lg border border-black/10 text-[10px] text-gray-700 space-y-2">
                          <div>
                            Class: <code>{student.classId}</code> · Device: <code>{student.deviceId ? `#${student.deviceId.slice(0, 4)}` : 'unknown (older app)'}</code>
                          </div>
                          <div>
                            Source: {student.source === 'qr_submission' ? 'Submission QR (self-reported)' : student.source === 'qr_pass' ? 'Curator Pass QR (self-reported)' : 'Class review file'}
                          </div>
                          {student.evidence && student.evidence.length > 0 ? (
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center">
                                <span className="font-bold">
                                  Photos ({student.evidence.filter(ev => ev.approved).length}/{student.evidence.length} approved)
                                </span>
                                <span className="flex gap-1">
                                  <button type="button" onClick={() => setEvidenceApproval(student, 'ALL', true)} className="px-1.5 py-0.5 rounded border border-[#82917B] text-[#2D5A27] font-bold cursor-pointer">
                                    Approve all unflagged
                                  </button>
                                </span>
                              </div>
                              <ul className="grid grid-cols-2 gap-1.5">
                                {student.evidence.map(ev => (
                                  <li key={ev.id} className="bg-white rounded-lg border border-black/15 p-1 text-left">
                                    <img src={ev.thumbnail} alt={ev.title} className="w-full h-20 object-cover rounded" />
                                    <div className="font-bold text-black truncate mt-0.5">{ev.title}</div>
                                    {ev.originalWording && <div className="truncate">"{ev.originalWording}"</div>}
                                    <div className="text-gray-500">
                                      {new Date(ev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {ev.points} pts
                                    </div>
                                    {ev.flag && <div className="text-[#D66A4A] font-bold">{ev.flag}</div>}
                                    <div className="flex gap-1 mt-1">
                                      <button
                                        type="button"
                                        aria-pressed={ev.approved === true}
                                        onClick={() => setEvidenceApproval(student, ev.id, true)}
                                        className={`flex-1 rounded border text-[10px] font-bold py-0.5 cursor-pointer ${ev.approved === true ? 'bg-[#82917B] text-white border-black' : 'border-gray-300'}`}
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        aria-pressed={ev.approved === false}
                                        onClick={() => setEvidenceApproval(student, ev.id, false)}
                                        className={`flex-1 rounded border text-[10px] font-bold py-0.5 cursor-pointer ${ev.approved === false ? 'bg-[#D66A4A] text-white border-black' : 'border-gray-300'}`}
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : student.reviewStatus === 'reviewed' ? (
                            <div className="italic text-gray-500">The review file had no photos from this class.</div>
                          ) : (
                            <div className="italic text-gray-500">
                              This score is self-reported and can't be checked. Ask the student for their review file (Student tab → Save review file) to see and approve each photo.
                            </div>
                          )}
                        </div>
                      )}

                      {student.teacherCommendation && (
                        <div className="text-[10px] text-[#82917B] italic bg-[#FAF6EE] p-1.5 rounded border border-black/10">
                          {student.teacherCommendation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white p-8 rounded-2xl border-2 border-black text-center font-mono space-y-2 shadow-brutal-sm">
                  <div className="w-12 h-12 bg-[#F4EBDD] border-2 border-black rounded-full flex items-center justify-center mx-auto shadow-brutal-sm">
                    <IconGraduationCap size={24} className="text-[#D66A4A]" />
                  </div>
                  <h4 className="font-heading font-extrabold text-base text-black">
                    Class Roster Empty
                  </h4>
                  <p className="text-xs text-gray-600 max-w-xs mx-auto leading-relaxed">
                    Scan students' QR codes for a quick tally, or import their review files to see and approve the actual photos.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setScannerPurpose('student')}
                      className="btn-primary py-2 px-4 rounded-xl text-xs uppercase font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <IconCamera size={13} />
                      <span>Scan First Student</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLASS SQUAD BATTLES (QR-VERIFIED STUDENTS ONLY) */}
          {activeTab === 'squads' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="bg-[#FFF9EC] p-3 rounded-xl border border-black/20 text-gray-700 space-y-1">
                <span className="font-bold text-black uppercase text-[10px] block">Class Squad Battle</span>
                <p className="text-[11px] leading-relaxed">
                  Put scanned students into two squads and referee the battle. Only students who scanned in (QR or signed archive) can play. One squad needs {SQUAD_RULES.minLargerTeam}+ students, the other {SQUAD_RULES.minSmallerTeam}+. Uneven squads always use Average scoring.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 justify-between items-center">
                <button
                  type="button"
                  onClick={handleAutoSplitSquads}
                  className="btn-secondary py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase cursor-pointer flex items-center gap-1"
                >
                  <IconUsers size={11} />
                  <span>Auto-balance squads</span>
                </button>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setClassScoringMode('average')}
                    className={`py-1 px-2 rounded-md text-[10px] font-bold uppercase border cursor-pointer ${
                      classEffectiveMode === 'average' ? 'bg-[#82917B] text-white border-black' : 'bg-white text-gray-600 border-gray-300'
                    }`}
                  >
                    Average
                  </button>
                  <button
                    type="button"
                    onClick={() => setClassScoringMode('total')}
                    disabled={classSquadsUneven}
                    title={classSquadsUneven ? 'Total scoring needs equal squad sizes' : undefined}
                    className={`py-1 px-2 rounded-md text-[10px] font-bold uppercase border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      classEffectiveMode === 'total' ? 'bg-black text-[#E8B92D] border-black' : 'bg-white text-gray-600 border-gray-300'
                    }`}
                  >
                    Total
                  </button>
                </div>
              </div>

              {gradebook.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border-2 border-black text-center space-y-2">
                  <p className="text-xs text-gray-600">No students yet. Scan student QRs in the Roster tab first.</p>
                  <button
                    type="button"
                    onClick={() => setScannerPurpose('student')}
                    className="btn-primary py-2 px-3 rounded-xl text-[11px] font-bold uppercase inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <IconCamera size={13} />
                    <span>Scan Student QR</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {[...gradebook].sort((a, b) => b.points - a.points).map(student => {
                    const eligible = teacherService.isSquadEligible(student);
                    const side = classSquads.alpha.includes(student.id)
                      ? 'alpha'
                      : classSquads.omega.includes(student.id)
                      ? 'omega'
                      : 'bench';
                    return (
                      <div
                        key={student.id}
                        className="bg-white p-2 rounded-xl border border-black/20 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-black">{student.studentName}</span>
                          <span className="text-gray-500 ml-1">· {student.points} pts</span>
                        </div>
                        <div className="flex gap-1" role="group" aria-label={`Squad for ${student.studentName}`}>
                          {(['alpha', 'bench', 'omega'] as const).map(opt => (
                            <button
                              key={opt}
                              type="button"
                              disabled={!eligible}
                              onClick={() => assignStudent(student.id, opt)}
                              aria-pressed={side === opt}
                              className={`py-1 px-2 rounded-md text-[10px] font-bold uppercase border cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                                side === opt
                                  ? opt === 'alpha'
                                    ? 'bg-[#D66A4A] text-white border-black'
                                    : opt === 'omega'
                                    ? 'bg-black text-[#E8B92D] border-black'
                                    : 'bg-gray-200 text-black border-black'
                                  : 'bg-white text-gray-500 border-gray-300'
                              }`}
                            >
                              {opt === 'bench' ? 'Bench' : opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-[#FFFDF9] p-2.5 rounded-xl border-2 border-black">
                  <span className="text-[10px] font-bold uppercase text-[#D66A4A] block">Squad Alpha</span>
                  <span className="font-heading font-extrabold text-lg text-black block">{alphaMembers.length} students</span>
                  <span className="text-[10px] text-gray-600">
                    {pvpService.calculateSquadStats(alphaMembers).totalPoints} total · {pvpService.calculateSquadStats(alphaMembers).averagePoints} avg
                  </span>
                </div>
                <div className="bg-[#FFFDF9] p-2.5 rounded-xl border-2 border-black">
                  <span className="text-[10px] font-bold uppercase text-black block">Squad Omega</span>
                  <span className="font-heading font-extrabold text-lg text-black block">{omegaMembers.length} students</span>
                  <span className="text-[10px] text-gray-600">
                    {pvpService.calculateSquadStats(omegaMembers).totalPoints} total · {pvpService.calculateSquadStats(omegaMembers).averagePoints} avg
                  </span>
                </div>
              </div>

              <p
                className={`text-[10px] font-bold text-center ${classReadiness.ready ? 'text-[#2D5A27]' : 'text-[#D66A4A]'}`}
                role="status"
              >
                {classReadiness.reason}
              </p>

              {classBattleResult && (
                <div className="p-3 rounded-2xl border-2 border-black text-center bg-[#FFF9EC] space-y-1 shadow-brutal-sm">
                  <div className="font-heading font-extrabold text-base text-black">
                    {classBattleResult.winner === 'DRAW' ? 'DRAW — HONORS EVEN' : `${classBattleResult.winnerTeamName} WINS`}
                  </div>
                  <p className="text-[11px] text-gray-700">
                    {classBattleResult.teamA.members.length} vs {classBattleResult.teamB.members.length} ·{' '}
                    {classBattleResult.scoringMode === 'average' ? 'Average' : 'Total'} scoring · margin {Math.abs(classBattleResult.pointsDelta)} pts
                  </p>
                  <span className="text-[10px] text-gray-500 block">Ledger: <code>{classBattleResult.verificationHash}</code></span>
                </div>
              )}

              <button
                type="button"
                onClick={handleRunClassBattle}
                disabled={!classReadiness.ready}
                className="w-full btn-primary py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-brutal flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <IconSwords size={16} />
                <span>Start Class Battle ({alphaMembers.length} vs {omegaMembers.length})</span>
              </button>
            </div>
          )}

          {/* TAB 4: STUDENT SIDE — JOIN CLASS + SUBMISSION QR */}
          {activeTab === 'student' && (
            <div className="space-y-4 font-mono text-xs text-center">
              {needsName && (
                <form
                  className="bg-white border-2 border-[#D66A4A] rounded-2xl p-4 space-y-2 text-left"
                  onSubmit={e => {
                    e.preventDefault();
                    const name = nameDraft.trim();
                    if (!name || isDefaultNickname(name)) return;
                    localStorage.setItem('typo_hunter_nickname', name);
                    onUpdateNickname?.(name);
                    setNameDraft('');
                  }}
                >
                  <label htmlFor="student-name" className="text-[11px] font-bold uppercase text-[#D66A4A] block">
                    First, enter your real name
                  </label>
                  <p className="text-[11px] text-gray-600">Your teacher needs it to tell you apart from classmates.</p>
                  <div className="flex gap-2">
                    <input
                      id="student-name"
                      value={nameDraft}
                      onChange={e => setNameDraft(e.target.value)}
                      maxLength={30}
                      placeholder="e.g. Ada O."
                      className="flex-1 p-2 border-2 border-black rounded-xl text-xs font-bold"
                    />
                    <button type="submit" className="btn-primary px-3 rounded-xl text-[11px] font-bold uppercase cursor-pointer" disabled={!nameDraft.trim() || isDefaultNickname(nameDraft)}>
                      Save
                    </button>
                  </div>
                </form>
              )}

              {joinedClass ? (
                <div className="bg-[#282722] text-white p-3.5 rounded-2xl border-2 border-black text-left space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#E8B92D] block">You're in class</span>
                  <h4 className="font-heading font-extrabold text-sm">{joinedClass.className}</h4>
                  <p className="text-[11px] text-gray-300">
                    {joinedClass.instructorName} · Target {joinedClass.targetPoints} pts ·{' '}
                    {(() => {
                      const left = minutesLeft(joinedClass);
                      return left !== null && left > 0 ? `${left} min left` : 'time is up';
                    })()}
                  </p>
                  <p className="text-[11px] text-[#E8B92D]">
                    This class so far: {sessionEntries.length} photo{sessionEntries.length === 1 ? '' : 's'} · {sessionPoints} pts. Only photos you take during the class count.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setScannerPurpose('join')}
                      className="btn-secondary py-1 px-2 rounded-lg text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Re-scan class QR
                    </button>
                    <button
                      type="button"
                      onClick={handleLeaveJoinedClass}
                      className="py-1 px-2 rounded-lg text-[10px] font-bold uppercase text-red-300 border border-red-400 cursor-pointer"
                    >
                      Leave class
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white border-2 border-black rounded-2xl p-4 space-y-2 shadow-brutal-sm">
                  <span className="text-[10px] font-bold uppercase text-[#D66A4A] tracking-wider block">Step 1 · Join your class</span>
                  <p className="text-[11px] text-gray-600">Scan the Master QR your teacher is projecting. Your hunt starts right away.</p>
                  <button
                    type="button"
                    onClick={() => setScannerPurpose('join')}
                    disabled={needsName}
                    className="w-full btn-primary py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <IconCamera size={14} />
                    <span>Scan Teacher's Class QR</span>
                  </button>
                </div>
              )}

              <div className="bg-[#FFFDF9] border-2 border-black rounded-2xl p-5 space-y-3 shadow-brutal-sm">
                <span className="text-[10px] font-bold uppercase text-[#D66A4A] tracking-wider block">
                  Step 2 · Hand in your work
                </span>
                {studentSubmissionQr ? (
                  <div className="inline-block p-3 bg-white border-2 border-black rounded-2xl shadow-brutal-sm">
                    <img src={studentSubmissionQr} alt="Student Submission QR" className="w-52 h-52 mx-auto object-contain" />
                  </div>
                ) : (
                  <div className="w-52 h-52 bg-gray-100 rounded-xl flex items-center justify-center mx-auto text-gray-400">
                    Generating Submission Pass…
                  </div>
                )}
                <div>
                  <h4 className="font-heading font-extrabold text-base text-black">
                    {nickname || 'Hunter'} · Submission Pass
                  </h4>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    {joinedClass
                      ? `Quick tally: ${sessionEntries.length} photos, ${sessionPoints} pts from this class. Your teacher scans it.`
                      : `Quick tally of your ${lifetimePoints} locked points. Your teacher scans it.`}
                  </p>
                </div>
                {joinedClass && (
                  <div className="pt-2 border-t border-black/10 space-y-1.5">
                    <button
                      type="button"
                      onClick={handleSaveReviewFile}
                      className="w-full btn-primary py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
                    >
                      <IconDownload size={14} />
                      <span>Save Review File ({sessionEntries.length} photos)</span>
                    </button>
                    <p className="text-[11px] text-gray-600">
                      Send this file to your teacher (AirDrop, Nearby Share, email, USB…). It contains the photos from this class so your teacher can check and approve them. That's what your grade is based on.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <BattleQrScannerModal
        isOpen={scannerPurpose !== null}
        onClose={() => setScannerPurpose(null)}
        onBlitzJoined={() => {
          setScannerPurpose(null);
          flash(
            scannerPurpose === 'join'
              ? "That's a battle QR, not a class QR. Ask your teacher for the Master QR."
              : "That's a battle QR. Ask the student for their Submission QR or Curator Pass.",
            4000
          );
        }}
        onPassScanned={scannerPurpose === 'student' ? handleCuratorPassScanned : undefined}
        onStudentSubmissionScanned={scannerPurpose === 'student' ? handleStudentSubmissionScanned : undefined}
        onClassJoined={scannerPurpose === 'join' ? handleJoinClassScanned : undefined}
      />
    </div>
  );
};
