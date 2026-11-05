/**
 * @file PrivacyModal.tsx
 * @description In-app privacy policy. Mirrors PRIVACY.md in the repository;
 * keep both (and PRIVACY_POLICY_EFFECTIVE_DATE) in sync when either changes.
 */

import React, { useRef } from 'react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { IconClose } from './Icons';
import { PROJECT_LINKS, PRIVACY_POLICY_EFFECTIVE_DATE } from '../utils/constants';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const Section: React.FC<{ title: string; badge?: string; children: React.ReactNode }> = ({ title, badge, children }) => (
  <section className="bg-[#FFFDF9] p-4 rounded-xl border-2 border-black shadow-brutal-sm">
    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
      {badge && (
        <span className="bg-[#E8B92D] text-black text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-black">
          {badge}
        </span>
      )}
      <h3 className="font-heading font-extrabold text-sm text-black">{title}</h3>
    </div>
    <div className="text-gray-700 space-y-1.5">{children}</div>
  </section>
);

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Privacy policy"
    >
      <div className="editorial-card bg-[#F4EBDD] p-5 sm:p-6 rounded-2xl max-w-lg w-full relative shadow-brutal-lg border-2 border-black max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4 flex-shrink-0">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-[#D66A4A] uppercase block">
              Effective {PRIVACY_POLICY_EFFECTIVE_DATE}
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold font-heading text-black leading-tight">
              Privacy Policy
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border-2 border-black bg-white flex items-center justify-center font-bold text-xs shadow-brutal-sm hover:bg-gray-100 cursor-pointer flex-shrink-0"
            aria-label="Close privacy policy"
          >
            <IconClose size={12} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto pr-1 space-y-4 font-mono text-xs text-gray-800 leading-relaxed flex-1">
          <Section title="The short version" badge="On your device">
            <ul className="list-disc pl-4 space-y-1">
              <li>No accounts, no sign-up, no passwords.</li>
              <li>No analytics, no advertising, no tracking cookies.</li>
              <li>Your photos, notes and scores are stored only in this browser on this device.</li>
              <li>Nothing is shared unless <strong>you</strong> show a QR code or send a file.</li>
            </ul>
          </Section>

          <Section title="What is stored on your device">
            <p>
              Your photos (full size and a small thumbnail), what you type (titles, wording, corrections, locations,
              notes), your ratings and Legends picks, locked points, display name and squad, battle history, settings,
              the time of your last capture, a class list if you use Teacher Mode, and a random device ID that tells
              players apart when names are the same.
            </p>
            <p>None of this is sent to us or to any server we run. We have no copy of it.</p>
            <p>
              Typo Hunter never reads your GPS location. The location field is text you type yourself.
            </p>
          </Section>

          <Section title="What leaves your device, and when">
            <ol className="list-decimal pl-4 space-y-1.5">
              <li>
                <strong>QR codes you show.</strong> Your Curator Pass contains your display name, squad, rank, points,
                number of finds, the title and rating of your best find, and your device ID. Speed Blitz and class
                codes contain your name, score and device ID. Anyone who scans your screen can read them.
              </li>
              <li>
                <strong>Files you send.</strong> A backup contains your whole collection, including photos. A class
                review file contains the photos you took during that class. You choose where they go.
              </li>
              <li>
                <strong>Share cards.</strong> If you share a find, the image goes wherever you send it.
              </li>
              <li>
                <strong>Opening the app online.</strong> Like any website, our hosting provider receives standard
                technical information (such as your IP address and browser type). Fonts load from Google Fonts, so
                Google receives a similar request. Neither includes your photos or collection.
              </li>
            </ol>
          </Section>

          <Section title="Camera and notifications">
            <p>
              The camera is used only when you take a photo or scan a QR code, and images are processed on your device.
            </p>
            <p>
              Notifications are off unless you turn them on. Reminders are created on your device; on some browsers
              your browser schedules them in the background. No push service or notification server is used.
            </p>
          </Section>

          <Section title="Children and classrooms">
            <p>
              Students' work stays on their own devices until they show a QR code or hand in a review file. A teacher's
              class list stays on the teacher's device. Schools are responsible for their own rules about the files
              students hand in.
            </p>
          </Section>

          <Section title="Keeping and deleting your data">
            <p>
              Your data stays until you delete it. Delete single finds in the app, or everything by clearing this
              site's data in your browser settings.
            </p>
            <p>
              <strong>Clearing site data or losing your device deletes your collection permanently</strong> unless you
              exported a backup. We can't recover it, because we never had it.
            </p>
          </Section>

          <Section title="Backups and checksums">
            <p>
              Backup files include a checksum that catches accidental damage. It is not a security seal: a determined
              person can edit a file. Scores shown in QR codes work on the honour system; teachers grade by reviewing
              the photos students hand in.
            </p>
          </Section>

          <Section title="Questions or problems">
            <p>
              If something looks wrong, or you have a privacy question, report it on the project's GitHub page.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href={PROJECT_LINKS.reportProblem}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary py-1.5 px-3 rounded-lg text-[11px] font-bold uppercase"
              >
                Report a problem ↗
              </a>
              <a
                href={PROJECT_LINKS.privacyPolicy}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary py-1.5 px-3 rounded-lg text-[11px] font-bold uppercase"
              >
                Full policy online ↗
              </a>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-black/10 flex justify-end items-center flex-shrink-0 mt-3">
          <button
            onClick={onClose}
            className="btn-primary py-2.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
