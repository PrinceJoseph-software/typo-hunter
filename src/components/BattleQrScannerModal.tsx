/**
 * @file BattleQrScannerModal.tsx
 * @description Real-time camera viewfinder QR scanner for joining peer-to-peer
 * Speed Blitz PvP battles and scanning friend passes offline.
 *
 * ARCHITECTURAL DESIGN:
 *   - Zero Cloud / 100% Offline: Uses `jsQR` running against client HTML5 Canvas frames.
 *   - Native Video Stream: Accesses environment back-facing camera with fallback.
 *   - Offline File Upload: Accepts image snapshots/screenshots if camera access is restricted.
 *   - Instant Haptic Feedback: Vibrates device upon successful optical verification.
 */

import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { pvpService, SpeedBlitzPayload } from '../utils/pvpService';
import { ClassExpeditionPayload, StudentSubmissionPayload } from '../utils/teacherService';
import { IconClose, IconCamera, IconAlert, IconCheck } from './Icons';

interface BattleQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBlitzJoined: (payload: SpeedBlitzPayload) => void;
  onPassScanned?: (passData: {
    hunter: string;
    points: number;
    specimens: number;
    legends: number;
    rank?: string;
    team?: string;
    teamTag?: string;
    checksum?: string;
  }) => void;
  onClassJoined?: (classPayload: ClassExpeditionPayload) => void;
  onStudentSubmissionScanned?: (submission: StudentSubmissionPayload) => void;
}

export const BattleQrScannerModal: React.FC<BattleQrScannerModalProps> = ({
  isOpen,
  onClose,
  onBlitzJoined,
  onPassScanned,
  onClassJoined,
  onStudentSubmissionScanned,
}) => {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const stopStream = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const processDecodedString = (decodedText: string): boolean => {
    // 1. Try parsing as Speed Blitz challenge
    const blitzPayload = pvpService.parseSpeedBlitzPayload(decodedText);
    if (blitzPayload) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(200);
      }
      if (onPassScanned) {
        setFeedback(`Retrieved Rival Info: [${blitzPayload.hostTeamTag}] ${blitzPayload.hostName} (${blitzPayload.hostScore} pts)! Battling...`);
        setTimeout(() => {
          stopStream();
          onPassScanned({
            hunter: blitzPayload.hostName,
            points: blitzPayload.hostScore,
            specimens: Math.max(1, Math.round(blitzPayload.hostScore / 50)),
            legends: 0,
            rank: 'Challenger',
            team: `[${blitzPayload.hostTeamTag}] ${blitzPayload.hostTeam}`,
            teamTag: blitzPayload.hostTeamTag,
            checksum: blitzPayload.signature,
          });
        }, 600);
        return true;
      }

      setFeedback(`Connected to rival: [${blitzPayload.hostTeamTag}] ${blitzPayload.hostName} (${blitzPayload.hostScore} pts)! Starting Blitz...`);
      setTimeout(() => {
        stopStream();
        onBlitzJoined(blitzPayload);
      }, 700);
      return true;
    }

    // 2. Try parsing as generic Typo Hunter Pass or Classroom Expedition
    try {
      const parsed = JSON.parse(decodedText);

      // A. Classroom Master QR scanned by student
      if (onClassJoined && parsed && parsed.app === 'TYPO_HUNTER_CLASS' && parsed.action === 'JOIN_CLASS_EXPEDITION') {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
        setFeedback(`Joined Class Hunt: ${parsed.className} (${parsed.instructorName})! Starting...`);
        setTimeout(() => {
          stopStream();
          if (onClassJoined) {
            onClassJoined(parsed as ClassExpeditionPayload);
          }
        }, 700);
        return true;
      }

      // B. Student Assignment Submission scanned by teacher
      if (onStudentSubmissionScanned && parsed && parsed.app === 'TYPO_HUNTER_SUBMISSION' && parsed.action === 'SUBMIT_ASSIGNMENT') {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(200);
        }
        setFeedback(`Student submission received: ${parsed.studentName} (${parsed.points} pts)! Auditing...`);
        setTimeout(() => {
          stopStream();
          if (onStudentSubmissionScanned) {
            onStudentSubmissionScanned(parsed as StudentSubmissionPayload);
          }
        }, 600);
        return true;
      }

      // C. Standard Curator Pass
      if (parsed && parsed.app === 'TYPO_HUNTER' && parsed.hunter) {
        if (onPassScanned) {
          setFeedback(`Retrieved Rival Info: ${parsed.hunter} (${parsed.points || 0} pts)! Battling...`);
          setTimeout(() => {
            stopStream();
            onPassScanned({
              hunter: parsed.hunter,
              points: parsed.points || 0,
              specimens: parsed.specimens || 1,
              legends: parsed.legends || 0,
              rank: parsed.rank,
              team: parsed.team,
              teamTag: typeof parsed.teamTag === 'string' ? parsed.teamTag : undefined,
              checksum: typeof parsed.checksum === 'string' ? parsed.checksum : undefined,
            });
          }, 600);
          return true;
        }

        const syntheticBlitz: SpeedBlitzPayload = {
          app: 'TYPO_HUNTER_PVP',
          action: 'SPEED_BLITZ_CHALLENGE',
          battleId: `pass_${Date.now()}`,
          hostName: parsed.hunter,
          hostTeam: parsed.team || 'Rival Curators',
          hostTeamTag: (parsed.hunter.slice(0, 3) || 'RIV').toUpperCase(),
          hostScore: parsed.points || 150,
          durationMinutes: 5,
          timestamp: new Date().toISOString(),
          signature: parsed.checksum || 'PASS-VERIFIED',
        };
        setFeedback(`Connected to rival: ${parsed.hunter} (${parsed.points || 150} pts)! Entering 5-min Blitz...`);
        setTimeout(() => {
          stopStream();
          onBlitzJoined(syntheticBlitz);
        }, 700);
        return true;
      }
    } catch {
      // not JSON
    }

    return false;
  };

  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      const success = processDecodedString(code.data);
      if (success) {
        return; // stop scanning loop on successful match
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  const startCamera = async () => {
    setCameraError(null);
    setFeedback(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setScanning(true);
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: any) {
      console.warn('Camera stream failed or permission denied', err);
      setCameraError('Camera access unavailable. Select a photo or paste friend battle code below.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          const success = processDecodedString(code.data);
          if (!success) {
            setCameraError('Scanned QR is not an authentic Typo Hunter battle challenge.');
          }
        } else {
          setCameraError('No QR code detected in the selected image.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    const success = processDecodedString(manualInput.trim());
    if (!success) {
      setCameraError('Invalid battle code or pass data.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Scan Friend's Battle QR"
    >
      <div className="editorial-card bg-[#F4EBDD] p-5 sm:p-6 rounded-3xl max-w-sm w-full relative shadow-brutal-lg border-3 border-black flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center pb-2 mb-3 border-b-2 border-black/15">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-[#D66A4A] uppercase block">
              Optical P2P Scanner
            </span>
            <h3 className="font-heading font-extrabold text-lg text-black leading-tight">
              Scan Friend's Battle QR
            </h3>
          </div>
          <button
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="w-7 h-7 rounded-full border-2 border-black bg-white flex items-center justify-center hover:bg-gray-100 cursor-pointer shadow-brutal-sm"
            aria-label="Close scanner"
          >
            <IconClose size={12} />
          </button>
        </div>

        {/* Viewfinder Video Area */}
        <div className="relative w-full h-56 bg-black rounded-2xl border-2 border-black overflow-hidden flex items-center justify-center mb-3">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Viewfinder Target Reticle */}
          {scanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-36 h-36 border-2 border-[#E8B92D] rounded-xl relative">
                {/* Viewfinder corners */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-[#E8B92D]" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-[#E8B92D]" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-[#E8B92D]" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-[#E8B92D]" />

                {/* Animated Scan Beam */}
                <div className="w-full h-0.5 bg-[#D66A4A] absolute top-1/2 -translate-y-1/2 animate-pulse shadow-[0_0_8px_#D66A4A]" />
              </div>
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 bg-black/80 p-4 flex flex-col items-center justify-center text-center text-white font-mono text-xs gap-2">
              <IconAlert size={24} className="text-[#E8B92D]" />
              <span>{cameraError}</span>
            </div>
          )}
        </div>

        {feedback && (
          <div className="mb-3 p-2.5 rounded-xl border-2 border-[#82917B] bg-[#f4f7f2] text-[#2D5A27] font-mono text-xs font-bold flex items-center gap-2">
            <IconCheck size={14} />
            <span>{feedback}</span>
          </div>
        )}

        <p className="text-[11px] font-mono text-gray-600 text-center mb-3 leading-snug">
          Point your camera at your friend's <strong>Speed Blitz Battle QR</strong> screen. It will decode their squad & launch the blitz camera instantly.
        </p>

        {/* Fallback Action Buttons */}
        <div className="space-y-2">
          <label className="w-full btn-secondary py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-center cursor-pointer block select-none">
            <span className="flex items-center justify-center gap-1.5">
              <IconCamera size={14} />
              <span>Scan QR From Photo File</span>
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Manual paste toggle */}
          <form onSubmit={handleManualSubmit} className="pt-1">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Or paste QR payload string…"
                className="flex-1 p-2 border border-black rounded-lg text-xs font-mono"
              />
              <button
                type="submit"
                className="btn-primary px-3 py-2 rounded-lg text-[11px] font-extrabold uppercase tracking-wider cursor-pointer"
              >
                Join
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
