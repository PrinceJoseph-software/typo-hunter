/**
 * @file HelpModal.tsx
 * @description Curator Handbook: in-app Field Guide & FAQ.
 * Keep in step with the app's actual behaviour (points rules in proofOfSighting.ts,
 * Speed Blitz / squads in pvpService.ts, class hunts in teacherService.ts).
 */

import React, { useRef } from 'react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { PROJECT_LINKS } from '../utils/constants';
import { IconClose, IconRefresh } from './Icons';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplayTour: () => void;
  onOpenPrivacy?: () => void;
}

const Card: React.FC<{ title: string; accent?: string; tone?: 'white' | 'cream'; children: React.ReactNode }> = ({
  title,
  accent = 'text-black',
  tone = 'white',
  children,
}) => (
  <section className={`${tone === 'cream' ? 'bg-[#FFF9EC]' : 'bg-white'} p-3.5 rounded-xl border-2 border-black shadow-brutal-sm`}>
    <h3 className={`font-heading font-extrabold text-sm uppercase tracking-wider mb-1.5 ${accent}`}>{title}</h3>
    <div className="text-gray-700 space-y-1.5">{children}</div>
  </section>
);

const FAQ: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: 'Why did a photo earn 0 points?',
    a: "Either the same photo (or a near-identical copy) has been scored before, or the entry was imported from someone else's backup. Both are kept in your museum; they just don't add points.",
  },
  {
    q: "If I delete a photo, do I lose its points?",
    a: 'No. Points are locked in when you save. Deleting a photo never removes points you already earned, but uploading that photo again won\'t earn them twice.',
  },
  {
    q: "Why didn't a photo count in Speed Blitz or my class hunt?",
    a: 'Only photos taken during the round or the class count. Old pictures from your gallery still go into your museum and earn normal points, but not in a timed game or class.',
  },
  {
    q: 'Do star ratings or Legends give points?',
    a: "No. They're your personal picks for your museum. Points come only from how fully you document a typo.",
  },
  {
    q: 'Does it work without internet?',
    a: "Yes. After you've opened it once online, everything works offline: capturing, browsing, QR battles and class hunts. Reopen it online now and then to get updates.",
  },
  {
    q: 'I got a new phone. How do I move my collection?',
    a: "On the old phone: Curator Profile → Export Backup, and send the file to yourself. On the new phone, before taking any new photos: Curator Profile → Import Backup, then choose \"Yes, restore my collection\". Your finds, photos and locked points all come back. Restoring on the same phone (for example after clearing your browser) works the same way. Once a phone has finds of its own, backups from other phones can only be added view-only.",
  },
  {
    q: "Can I see a friend's collection?",
    a: "Yes. Import their backup file. Their entries appear in your museum marked as theirs, view-only, and never count toward your points.",
  },
  {
    q: 'Why am I not getting reminders?',
    a: "Turn them on in Curator Profile → Field Dispatches. Reminders while the app is closed need an installed app on a browser that supports background updates (such as Chrome on Android). Elsewhere you'll see the mascot and a welcome-back message when you open the app instead.",
  },
  {
    q: 'How does the app read the text on my photo?',
    a: "It reads it on your phone, so your photo never leaves it. The first time, it downloads the reader (about 7 MB) from this app's own site; after that it works offline. It highlights words that look misspelt and suggests fixes. Mistakes that are real words (like \"Soap of the Day\") or grammar slips can't be spotted automatically, so you add those yourself. If a photo is blurry or at an angle, tap Read Again or type the wording.",
  },
  {
    q: 'What does "Read by app" mean?',
    a: "The wording you saved matches what the app read from your photo, on your phone. It's a helpful sign that the find is real, but it isn't proof, since anything on a phone can be changed.",
  },
  {
    q: 'Two students in my class have the same name. Is that a problem?',
    a: 'No. Every device gets a random ID, so each student gets their own row. A short tag (like #3fa2) helps you tell them apart.',
  },
];

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, onReplayTour, onOpenPrivacy }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Field Guide and FAQ"
    >
      <div className="editorial-card bg-[#F4EBDD] p-5 sm:p-6 rounded-2xl max-w-lg w-full max-h-[88vh] overflow-y-auto border-2 border-black shadow-brutal-lg flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4 flex-shrink-0">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-[#D66A4A] uppercase block">
              Curator Handbook
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold font-heading text-black">Field Guide & FAQ</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border-2 border-black bg-white flex items-center justify-center font-bold text-xs shadow-brutal-sm hover:bg-gray-100 cursor-pointer flex-shrink-0"
            aria-label="Close guide"
          >
            <IconClose size={12} />
          </button>
        </div>

        <div className="space-y-4 text-xs font-mono text-gray-800 leading-relaxed overflow-y-auto pr-1 flex-1">
          <Card title="1. Quick start">
            <p>Typo Hunter is your pocket museum for language mistakes found in the wild: signs, menus, price tags, billboards.</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Spot a typo and tap the yellow <strong>+</strong> (Spot).</li>
              <li>Take the photo. The app reads the text and highlights words that look wrong.</li>
              <li>Check what it filled in, tap the right fix, and pick a category.</li>
              <li>
                Add <strong className="text-[#D66A4A]">What it actually said</strong> and{' '}
                <strong className="text-[#82917B]">What they meant</strong>, for example <em>"Coffe and Trea"</em> →{' '}
                <em>"Coffee and Tea"</em>.
              </li>
              <li>Tap <strong>Archive Specimen</strong>. It's now in your Archive.</li>
            </ol>
          </Card>

          <Card title="2. How points work" accent="text-[#D66A4A]">
            <p>Each find earns up to <strong>120 points</strong> for how fully you document it:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Photo: +50</li>
              <li>What they meant (the correction): +30</li>
              <li>Category: +20 (or +10 for "Other")</li>
              <li>Location: +10 · Notes: +10</li>
            </ul>
            <p>
              <strong>Points are locked in.</strong> Deleting a photo later never takes them away. Repeated photos and
              entries imported from friends earn nothing, so everyone plays fair.
            </p>
          </Card>

          <Card title="3. Your museum" accent="text-[#82917B]">
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Archive:</strong> every find, with search, category filters and grid or list view.</li>
              <li>
                <strong>Legends:</strong> rate finds 1–5 stars and tap the trophy to add your favourites to your Hall of
                Fame. These are personal picks and don't add points.
              </li>
              <li><strong>Share:</strong> open a find and tap <em>Export Share Card</em> for an image ready for chats or stories.</li>
              <li>
                <strong>Mascot:</strong> the little icon in your browser tab gets worried after a day without a new find,
                and melts after three. Spot a typo to cheer it up.
              </li>
            </ul>
          </Card>

          <Card title="4. Play with friends (no internet needed)">
            <p>
              Open the arena with <strong>Enter Arena</strong> on Home or <strong>PvP &amp; Squads</strong> on your Curator
              Profile. Everything works screen-to-screen with QR codes.
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Curator Pass:</strong> your QR code with your name, squad and points (Curator Profile → Show QR Pass).</li>
              <li><strong>Quick Duel:</strong> scan a friend's pass and compare points.</li>
              <li>
                <strong>Speed Blitz:</strong> one player taps <em>Host with QR</em>, the other taps <em>Scan Friend's QR</em>.
                You both start at 0 for 3, 5 or 10 minutes, and only photos taken during the round count. When time's up,
                each of you scans the other's result so both phones show the same winner.
              </li>
              <li>
                <strong>Squad battles:</strong> team against team. Everyone scans their own pass to join, and one side needs
                at least 3 players (3v3, 3v2, 3v1…). Uneven teams are scored by average, so the bigger team doesn't win just by size.
              </li>
            </ul>
            <p>Scores in QR codes work on the honour system: if it really matters, ask to see the photos.</p>
          </Card>

          <Card title="5. Class hunts" accent="text-[#D66A4A]">
            <p>Open <strong>Teacher Mode</strong> from Home or your Curator Profile.</p>
            <p><strong>Teachers:</strong></p>
            <ol className="list-decimal pl-4 space-y-0.5">
              <li>On <em>Start</em>, set the class name, time limit and target, then start the class and show the Master QR.</li>
              <li>After the hunt, use <em>Import Review File</em> for each student and approve or reject each photo. Grades come from approved photos.</li>
              <li><em>Scan Student QR</em> gives a quick tally, marked self-reported.</li>
              <li>Use <em>Squads</em> for a class battle, and export the class list as a CSV spreadsheet.</li>
            </ol>
            <p><strong>Students:</strong></p>
            <ol className="list-decimal pl-4 space-y-0.5">
              <li>Open the <em>Student</em> tab, enter your real name, and scan your teacher's class QR.</li>
              <li>Hunt! Only photos you take during the class count.</li>
              <li>At the end, tap <em>Save Review File</em> and send it to your teacher (AirDrop, Nearby Share, email…).</li>
            </ol>
          </Card>

          <Card title="6. Offline, installing and backups">
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Offline:</strong> once opened online, the whole app works without a connection.</li>
              <li><strong>Install:</strong> use your browser's <em>Add to Home Screen</em> (or <em>Install app</em>) to open it like a normal app.</li>
              <li>
                <strong>Back up regularly:</strong> your museum lives only on this device. Clearing site data or losing the
                phone deletes it. Curator Profile → <em>Export Backup</em> saves your finds, photos and locked points, and
                you can restore them on a new phone.
              </li>
            </ul>
          </Card>

          <Card title="7. Reminders">
            <p>
              Turn on reminders in Curator Profile → <em>Field Dispatches</em> and pick a voice: Dramatic Mascot, Stern
              Proofreader or Urban Safari Scout. You can also choose a daily hunt prompt. You'll get a nudge when you
              haven't spotted a typo for a while.
            </p>
          </Card>

          <Card title="8. FAQ">
            <div className="space-y-1.5">
              {FAQ.map(item => (
                <details key={item.q} className="group bg-[#FAF6EE] rounded-lg border border-black/15 px-2.5 py-1.5">
                  <summary className="cursor-pointer font-bold text-black list-none flex justify-between items-start gap-2">
                    <span>{item.q}</span>
                    <span className="text-[#D66A4A] group-open:rotate-45 transition-transform flex-shrink-0" aria-hidden="true">+</span>
                  </summary>
                  <p className="mt-1.5 text-gray-700">{item.a}</p>
                </details>
              ))}
            </div>
          </Card>

          <section className="bg-[#FFF9EC] p-3.5 rounded-xl border-2 border-black shadow-brutal-sm">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-heading font-extrabold text-sm text-black uppercase tracking-wider">9. Privacy</h3>
              {onOpenPrivacy && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenPrivacy();
                  }}
                  className="text-[10px] font-bold text-[#D66A4A] underline cursor-pointer"
                >
                  View Full Policy →
                </button>
              )}
            </div>
            <p className="text-gray-700">
              Your collection lives only on this device. No accounts, no tracking, no photo uploads, and the app contacts
              no third parties. Nothing is shared unless you show a QR code or send a file.
            </p>
          </section>

          <Card title="10. Something wrong?">
            <p>Found a bug, something confusing, or have an idea? Tell us on GitHub. Please don't include photos of people or private details.</p>
            <a
              href={PROJECT_LINKS.reportProblem}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block btn-secondary py-1.5 px-3 rounded-lg text-[11px] font-bold uppercase"
            >
              Report a problem ↗
            </a>
          </Card>
        </div>

        {/* Bottom Actions */}
        <div className="mt-4 pt-3 border-t-2 border-black flex flex-col sm:flex-row gap-2 flex-shrink-0">
          <button
            onClick={() => {
              onClose();
              onReplayTour();
            }}
            className="flex-1 btn-secondary py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-center cursor-pointer"
          >
            <span className="flex items-center justify-center gap-1.5"><IconRefresh size={12} /> Replay Onboarding Tour</span>
          </button>
          <button
            onClick={onClose}
            className="flex-1 btn-primary py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider text-center cursor-pointer"
          >
            Got It, Close
          </button>
        </div>
      </div>
    </div>
  );
};
