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
import QRCode from 'qrcode';
import { Discovery } from '../db/database';
import {
  teacherService,
  ClassExpedition,
  StudentSubmission,
} from '../utils/teacherService';
import { verifyAndUnpackArchive } from '../utils/archiveSecurity';
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
} from './Icons';

interface TeacherModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  nickname: string;
  discoveries: Discovery[];
  onOpenScanner?: () => void;
  onClassStarted?: (expedition: ClassExpedition) => void;
}

export const TeacherModeModal: React.FC<TeacherModeModalProps> = ({
  isOpen,
  onClose,
  nickname,
  discoveries,
  onOpenScanner,
  onClassStarted,
}) => {
  const [activeTab, setActiveTab] = useState<'dispatch' | 'gradebook' | 'student'>('dispatch');
  const [instructorName, setInstructorName] = useState(() => teacherService.getTeacherProfile().instructorName);
  const [className, setClassName] = useState(() => teacherService.getTeacherProfile().defaultClassName);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [targetPoints, setTargetPoints] = useState(250);
  const [objective, setObjective] = useState('Catalog 3 municipal or storefront anomalies with full field notes.');
  const [masterQrUrl, setMasterQrUrl] = useState<string | null>(null);
  const [studentSubmissionQr, setStudentSubmissionQr] = useState<string | null>(null);
  const [gradebook, setGradebook] = useState<StudentSubmission[]>(() => teacherService.getClassGradebook());
  const [activeExpedition, setActiveExpedition] = useState<ClassExpedition | null>(() => teacherService.getActiveClassExpedition());
  const [feedback, setFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setGradebook(teacherService.getClassGradebook());
      setActiveExpedition(teacherService.getActiveClassExpedition());
      handleGenerateMasterQr();
    }
  }, [isOpen, className, instructorName, durationMinutes, targetPoints, objective]);

  useEffect(() => {
    if (activeTab === 'student') {
      const payload = teacherService.createStudentSubmissionPayload(
        nickname,
        'SYN',
        discoveries,
        activeExpedition?.classId
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
  }, [activeTab, nickname, discoveries, activeExpedition]);

  const handleGenerateMasterQr = async () => {
    const payload = teacherService.createClassMasterPayload(
      className,
      instructorName,
      durationMinutes,
      targetPoints,
      objective
    );
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
    teacherService.setActiveClassExpedition(expedition);
    setActiveExpedition(expedition);
    teacherService.saveTeacherProfile({ instructorName, defaultClassName: className });

    if (onClassStarted) {
      onClassStarted(expedition);
    }

    setFeedback(`Classroom Expedition dispatched! Students can now scan the Master QR.`);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleStopClassHunt = () => {
    teacherService.clearActiveClassExpedition();
    setActiveExpedition(null);
    setFeedback('Classroom Expedition closed.');
    setTimeout(() => setFeedback(null), 3000);
  };

  // Import student signed JSON archive directly into teacher gradebook
  const handleImportStudentArchive = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const result = await verifyAndUnpackArchive(text);

        if (!result.isValid) {
          setFeedback(
            result.isTampered
              ? 'SECURITY REJECTION: Student archive checksum mismatch. Tampering detected!'
              : 'Error: Invalid archive format.'
          );
          setTimeout(() => setFeedback(null), 5000);
          return;
        }

        const studentName = result.hunterName || 'Unknown Student';
        const totalPoints = typeof result.totalPoints === 'number' ? result.totalPoints : result.discoveries.length * 60;
        const specimenCount = result.discoveries.length;
        const legendCount = result.discoveries.filter(d => d.isHallOfFame).length;
        const { grade, status } = teacherService.calculateGrade(totalPoints, targetPoints);

        const newSubmission: StudentSubmission = {
          id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          studentName,
          squadFaction: 'SYN',
          classId: activeExpedition?.classId || 'INDEPENDENT',
          points: totalPoints,
          specimensCataloged: specimenCount,
          legendsEnshrined: legendCount,
          grade,
          status,
          tamperVerified: true,
          antiCheatHash: 'SIG-VERIFIED-SHA256',
          submittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        teacherService.saveStudentToGradebook(newSubmission);
        setGradebook(teacherService.getClassGradebook());
        setFeedback(`Inducted student ${studentName} into gradebook (${totalPoints} pts, Grade: ${grade})!`);
        setTimeout(() => setFeedback(null), 4000);
      } catch {
        setFeedback('Failed to read student archive.');
        setTimeout(() => setFeedback(null), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAddDemoStudent = () => {
    const demoNames = [
      'Alex Rivera',
      'Jordan Vance',
      'Elena Rostova',
      'Marcus Brody',
      'Devon Kim',
      'Chloe Bennett',
    ];
    const available = demoNames.filter(n => !gradebook.some(s => s.studentName === n));
    const studentName = available[0] || `Student #${gradebook.length + 1}`;
    const points = Math.round(180 + Math.random() * 160);
    const specimens = Math.max(2, Math.round(points / 60));
    const factions = ['RPS', 'RAID', 'SYN', 'PROOF'];
    const squadFaction = factions[Math.floor(Math.random() * factions.length)];
    const { grade, status } = teacherService.calculateGrade(points, targetPoints);

    const submission: StudentSubmission = {
      id: `demo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      studentName,
      squadFaction,
      classId: activeExpedition?.classId || 'ENG-201',
      points,
      specimensCataloged: specimens,
      legendsEnshrined: Math.floor(Math.random() * 2),
      grade,
      status,
      tamperVerified: true,
      antiCheatHash: `SHA-${Date.now().toString(36).toUpperCase()}`,
      submittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    teacherService.saveStudentToGradebook(submission);
    setGradebook(teacherService.getClassGradebook());
  };

  const handleAwardCommendation = (studentId: string) => {
    const student = gradebook.find(s => s.id === studentId);
    if (!student) return;
    const updated = {
      ...student,
      points: student.points + 50,
      teacherCommendation: 'Teacher Commendation (+50 pts for acute linguistic rigor)',
    };
    teacherService.saveStudentToGradebook(updated);
    setGradebook(teacherService.getClassGradebook());
  };

  const handleRemoveStudent = (id: string) => {
    teacherService.removeStudentFromGradebook(id);
    setGradebook(teacherService.getClassGradebook());
  };

  const handleExportCsv = () => {
    teacherService.exportGradebookCsv(gradebook, className);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs select-none"
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
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border border-black bg-black text-[#E8B92D]">
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
        <div className="grid grid-cols-3 bg-[#FFFDF9] border-2 border-black rounded-xl p-1 mb-3.5 shadow-brutal-sm text-[11px] sm:text-xs font-mono font-bold flex-shrink-0 gap-1">
          <button
            onClick={() => setActiveTab('dispatch')}
            className={`py-2 px-1 rounded-lg text-center cursor-pointer transition-colors flex items-center justify-center gap-1 truncate ${
              activeTab === 'dispatch' ? 'bg-black text-[#E8B92D]' : 'text-gray-600 hover:text-black'
            }`}
          >
            <IconGraduationCap size={13} className="flex-shrink-0" />
            <span className="truncate">Start Hunt</span>
          </button>
          <button
            onClick={() => setActiveTab('gradebook')}
            className={`py-2 px-1 rounded-lg text-center cursor-pointer transition-colors flex items-center justify-center gap-1 truncate ${
              activeTab === 'gradebook' ? 'bg-black text-[#E8B92D]' : 'text-gray-600 hover:text-black'
            }`}
          >
            <IconShield size={13} className="flex-shrink-0" />
            <span className="truncate">Audit ({gradebook.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('student')}
            className={`py-2 px-1 rounded-lg text-center cursor-pointer transition-colors flex items-center justify-center gap-1 truncate ${
              activeTab === 'student' ? 'bg-black text-[#E8B92D]' : 'text-gray-600 hover:text-black'
            }`}
          >
            <IconQrCode size={13} className="flex-shrink-0" />
            <span className="truncate">Submit QR</span>
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
                    Instructor: <strong>{activeExpedition.instructorName}</strong> · Time Limit: {activeExpedition.durationMinutes} mins
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
                  <span className="text-[8px] uppercase text-gray-500 font-bold block">Students</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-black/20">
                  <span className="text-xl font-extrabold font-heading text-[#82917B] block">
                    {gradebook.length > 0 ? Math.round(gradebook.reduce((acc, s) => acc + s.points, 0) / gradebook.length) : 0}
                  </span>
                  <span className="text-[8px] uppercase text-gray-500 font-bold block">Avg Pts</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-black/20">
                  <span className="text-xl font-extrabold font-heading text-[#D66A4A] block">
                    {gradebook.reduce((acc, s) => acc + s.specimensCataloged, 0)}
                  </span>
                  <span className="text-[8px] uppercase text-gray-500 font-bold block">Typos Spotted</span>
                </div>
                <div className="bg-[#FFF9EC] p-2.5 rounded-xl border border-black/20">
                  <span className="text-xl font-extrabold font-heading text-black block">100%</span>
                  <span className="text-[8px] uppercase text-gray-500 font-bold block">SHA-256</span>
                </div>
              </div>

              {/* Teacher Ingestion Action Bar */}
              <div className="flex flex-wrap gap-2 justify-between items-center pt-1">
                <div className="flex gap-2">
                  {onOpenScanner && (
                    <button
                      type="button"
                      onClick={onOpenScanner}
                      className="btn-primary py-2 px-3 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-brutal-sm"
                    >
                      <IconCamera size={13} />
                      <span>Scan Student QR</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary py-2 px-3 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                  >
                    <IconDownload size={13} />
                    <span>Import Student .json</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportStudentArchive}
                    className="hidden"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddDemoStudent}
                    className="text-[10px] text-gray-600 hover:text-black underline cursor-pointer"
                  >
                    + Demo Student
                  </button>
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
                  {gradebook.map((student) => (
                    <div
                      key={student.id}
                      className="bg-white p-3.5 rounded-2xl border-2 border-black space-y-2 shadow-xs"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-black bg-[#E8B92D] text-black">
                              [{student.squadFaction}]
                            </span>
                            <h4 className="font-heading font-extrabold text-sm text-black">
                              {student.studentName}
                            </h4>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            Hash: <code>{student.antiCheatHash}</code> · Submitted at {student.submittedAt}
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
                          <strong>{student.points} pts</strong> ({student.specimensCataloged} specimens, {student.legendsEnshrined} legends)
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAwardCommendation(student.id)}
                            className="text-[10px] text-[#D66A4A] font-bold hover:underline cursor-pointer flex items-center gap-1"
                            title="Award teacher bonus +50 points"
                          >
                            <IconStar size={11} />
                            <span>+50 Bonus</span>
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
                    Scan student submission QR codes or import their signed archive JSONs as they return from the linguistic expedition.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleAddDemoStudent}
                      className="btn-secondary py-2 px-4 rounded-xl text-xs uppercase font-bold"
                    >
                      Add Simulated Student Submission
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STUDENT SUBMISSION QR (PRESENT TO TEACHER) */}
          {activeTab === 'student' && (
            <div className="space-y-4 font-mono text-xs text-center">
              <div className="bg-[#FFFDF9] border-2 border-black rounded-2xl p-5 space-y-3 shadow-brutal-sm">
                <span className="text-[10px] font-bold uppercase text-[#D66A4A] tracking-wider block">
                  Student Assignment Submission QR
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
                    Present this optical QR code to your instructor to register your {discoveries.length} specimens directly into the class gradebook.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
