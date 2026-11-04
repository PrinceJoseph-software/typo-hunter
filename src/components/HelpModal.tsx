import React from 'react';
import { IconClose, IconRefresh } from './Icons';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplayTour: () => void;
  onOpenPrivacy?: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, onReplayTour, onOpenPrivacy }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs" 
      role="dialog" 
      aria-modal="true" 
      aria-label="Field Guide"
    >
      <div className="editorial-card bg-[#F4EBDD] p-5 sm:p-6 rounded-2xl max-w-lg w-full max-h-[88vh] overflow-y-auto border-2 border-black shadow-brutal-lg flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4 flex-shrink-0">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-[#D66A4A] uppercase block">
              Curator Handbook
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold font-heading text-black">
              Field Guide & FAQ
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full border-2 border-black bg-white flex items-center justify-center font-bold text-xs shadow-brutal-sm hover:bg-gray-100 cursor-pointer flex-shrink-0"
            aria-label="Close Guide"
          >
            <IconClose size={12} />
          </button>
        </div>

        {/* Guide Sections */}
        <div className="space-y-4 text-xs font-mono text-gray-800 leading-relaxed overflow-y-auto pr-1 flex-1">
          {/* Section 1 */}
          <div className="bg-white p-3.5 rounded-xl border-2 border-black shadow-brutal-sm">
            <h3 className="font-heading font-extrabold text-sm text-black uppercase tracking-wider mb-1">
              1. What is Typo Hunter?
            </h3>
            <p className="text-gray-700">
              Typo Hunter is a photography-led visual museum designed to document, classify, and enshrine real-world language anomalies found on signs, menus, price tags, and billboards before they get erased.
            </p>
          </div>

          {/* Section 2 */}
          <div className="bg-white p-3.5 rounded-xl border-2 border-black shadow-brutal-sm">
            <h3 className="font-heading font-extrabold text-sm text-black uppercase tracking-wider mb-1 text-[#D66A4A]">
              2. How Does Wording Analysis Work?
            </h3>
            <p className="text-gray-700">
              When capturing a photo, record two fields:
              <br />• <strong className="text-[#D66A4A]">As Written:</strong> The exact verbatim text on the sign (e.g. <em>"Trespassers will be composted"</em>).
              <br />• <strong className="text-[#82917B]">Intended:</strong> What they likely meant to write (e.g. <em>"Trespassers will be prosecuted"</em>).
            </p>
          </div>

          {/* Section 3 */}
          <div className="bg-white p-3.5 rounded-xl border-2 border-black shadow-brutal-sm">
            <h3 className="font-heading font-extrabold text-sm text-black uppercase tracking-wider mb-1 text-[#E8B92D]">
              3. The Hall of Fame ("The Absolute Legends")
            </h3>
            <p className="text-gray-700">
              Rate your specimens from 1 to 5 stars based on sheer comedic value. Tap the Trophy icon on any discovery detail view to induct it into the curated <strong>Hall of Fame</strong> exhibition.
            </p>
          </div>

          {/* Section 4: Offline P2P */}
          <div className="bg-white p-3.5 rounded-xl border-2 border-black shadow-brutal-sm">
            <h3 className="font-heading font-extrabold text-sm text-black uppercase tracking-wider mb-1 text-black">
              4. How Do Friends Compete Offline?
            </h3>
            <p className="text-gray-700 mb-2">
              You don't need internet, cloud servers, or cellular signal to compare collections:
            </p>
            <ul className="space-y-1 list-disc list-inside text-gray-700">
              <li><strong>Shareable Placards:</strong> Tap <em>"Export Share Card"</em> on any specimen to generate an editorial 1080×1350 JPEG card for messaging or stories.</li>
              <li><strong>Offline QR Passports:</strong> Open your Curator Profile to show your instant offline QR Pass so friends can scan and compare total finds and milestone badges camera-to-screen.</li>
              <li><strong>JSON Backups:</strong> Export your archive to a file and air-drop or send it to a friend to view your discoveries in their app.</li>
            </ul>
          </div>

          {/* Section 5: Privacy */}
          <div className="bg-[#FFF9EC] p-3.5 rounded-xl border-2 border-black shadow-brutal-sm">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-heading font-extrabold text-sm text-black uppercase tracking-wider">
                5. Privacy & Zero Cookies
              </h3>
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
              Everything lives strictly on your device in IndexedDB. No cookies, no user accounts, no tracking scripts, no cloud image uploads.
            </p>
          </div>
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
