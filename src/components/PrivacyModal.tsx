/**
 * @file PrivacyModal.tsx
 * @description Editorial Privacy Policy, Zero-Cookie Disclosure, and Local Data Rights modal.
 */

import React from 'react';
import { IconClose } from './Icons';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs" 
      role="dialog" 
      aria-modal="true" 
      aria-label="Privacy Policy & Cookies Disclosure"
    >
      <div className="editorial-card bg-[#F4EBDD] p-5 sm:p-6 rounded-2xl max-w-lg w-full relative shadow-brutal-lg border-2 border-black max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4 flex-shrink-0">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-[#D66A4A] uppercase block">
              Curatorial Trust Agreement
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold font-heading text-black leading-tight">
              Privacy & Zero-Cookie Policy
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full border-2 border-black bg-white flex items-center justify-center font-bold text-xs shadow-brutal-sm hover:bg-gray-100 cursor-pointer flex-shrink-0"
            aria-label="Close Privacy Policy"
          >
            <IconClose size={12} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto pr-1 space-y-4 font-mono text-xs text-gray-800 leading-relaxed flex-1">
          {/* Section 1: Zero Cookies */}
          <div className="bg-[#FFFDF9] p-4 rounded-xl border-2 border-black shadow-brutal-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-[#82917B] text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                Zero Trackers
              </span>
              <h3 className="font-heading font-extrabold text-sm text-black">
                1. No Cookies. Period.
              </h3>
            </div>
            <p className="text-gray-700">
              TYPO HUNTER sets <strong>zero HTTP cookies</strong>, zero advertising beacons, and zero third-party tracking scripts.
              Unlike commercial web applications that track user sessions across websites, our application requires no session tokens, no identity graph, and no cookie consent popups.
            </p>
          </div>

          {/* Section 2: Local Storage Only */}
          <div className="bg-[#FFFDF9] p-4 rounded-xl border-2 border-black shadow-brutal-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-[#E8B92D] text-black text-[9px] font-bold px-2 py-0.5 rounded uppercase border border-black">
                100% Offline
              </span>
              <h3 className="font-heading font-extrabold text-sm text-black">
                2. On-Device Sovereign Storage
              </h3>
            </div>
            <p className="text-gray-700">
              Every photograph you capture, title you author, location note you record, and Hall of Fame nomination you cast is saved strictly into your browser's local <strong>IndexedDB</strong> and <strong>localStorage</strong>. 
              Data never travels over the network to any remote server or cloud database.
            </p>
          </div>

          {/* Section 3: Hardware & Camera Permissions */}
          <div className="bg-[#FFFDF9] p-4 rounded-xl border-2 border-black shadow-brutal-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-[#D66A4A] text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                Hardware
              </span>
              <h3 className="font-heading font-extrabold text-sm text-black">
                3. Camera & Gallery Access
              </h3>
            </div>
            <p className="text-gray-700">
              When capturing a specimen, browser camera permissions are requested solely to stream frames to an HTML5 Canvas for local compression and cropping. Photographs are immediately serialized into compressed data payloads directly in local storage. Photos are never transmitted outside your physical device.
            </p>
          </div>

          {/* Section 4: Peer-to-Peer QR Transmission */}
          <div className="bg-[#FFFDF9] p-4 rounded-xl border-2 border-black shadow-brutal-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-black text-[#E8B92D] text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                Optical P2P
              </span>
              <h3 className="font-heading font-extrabold text-sm text-black">
                4. Peer-to-Peer QR Code Privacy
              </h3>
            </div>
            <p className="text-gray-700">
              The <strong>Offline Curator Pass</strong> converts your rank, specimen count, and top typo into an optical 2D barcode on your physical screen. Scanning is optical (camera lens to display screen). No Bluetooth, local Wi-Fi pairing, or cloud mediator is involved.
            </p>
          </div>

          {/* Section 5: Data Ownership & Portability */}
          <div className="bg-[#FFFDF9] p-4 rounded-xl border-2 border-black shadow-brutal-sm">
            <h3 className="font-heading font-extrabold text-sm text-black mb-1">
              5. Total Data Ownership & Export
            </h3>
            <p className="text-gray-700">
              You own all intellectual property documented in your personal museum. You can export your full museum archive as a cryptographically signed JSON file at any time from the Curator Profile, or wipe all records with a single click.
            </p>
          </div>

          {/* Section 6: Notification & Inactivity Favicon Privacy */}
          <div className="bg-[#FFFDF9] p-4 rounded-xl border-2 border-black shadow-brutal-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-[#E8B92D] text-black text-[9px] font-bold px-2 py-0.5 rounded uppercase border border-black">
                Local Push Only
              </span>
              <h3 className="font-heading font-extrabold text-sm text-black">
                6. Notifications & Inactivity Mascots
              </h3>
            </div>
            <p className="text-gray-700">
              Browser alerts and Duolingo-style mascot dispatches are generated <strong>100% on-device</strong> using the browser's native Web Notifications API and Service Worker. Typo Hunter does not register device push tokens (FCM, APNs, or WebPush relays) with any third-party server. Inactivity timestamps and mascot favicon states reside strictly inside your local browser storage.
            </p>
          </div>

          {/* Section 7: Anti-Cheat Cryptographic Privacy */}
          <div className="bg-[#FFFDF9] p-4 rounded-xl border-2 border-black shadow-brutal-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-[#82917B] text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                Web Crypto
              </span>
              <h3 className="font-heading font-extrabold text-sm text-black">
                7. Client-Side Cryptographic Signatures
              </h3>
            </div>
            <p className="text-gray-700">
              All SHA-256 archive integrity signatures and FNV-1a perceptual Proof-of-Sighting hashes are computed locally via the hardware-accelerated Web Crypto API (<code className="font-bold">crypto.subtle</code>). Zero cryptographic private keys, passphrases, or archive payloads are ever transmitted over the internet.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-black/10 flex justify-between items-center flex-shrink-0 mt-3">
          <span className="text-[10px] text-gray-500 font-mono">Effective: Always & Forever</span>
          <button
            onClick={onClose}
            className="btn-primary py-2.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
