/**
 * @file OnboardingModal.tsx
 * @description Android-style feature discovery and interactive spotlight magnifier
 * for first-time Typo Hunter curators.
 *
 * ARCHITECTURAL DESIGN:
 * Rather than a detached static popup dialog, this component implements an
 * Android-inspired Feature Discovery / TapTarget pattern:
 *   1. Magnified Spotlight Lens: Physically isolates, magnifies, and illuminates
 *      each primary capability with animated radar ripple waves.
 *   2. Unified Visual Elements: Eliminates double box-shadow collisions by integrating
 *      icons, captions, and badges into unified focal cards.
 *   3. Favicon Identity: Step 1 showcases the official brutalist camera-aperture logo.
 *   4. Interactive Tap Target: Tapping either the magnified target lens or the
 *      primary button advances the tour.
 */

import React, { useState } from 'react';
import {
  TypoHunterLogo,
  IconCamera,
  IconTrophy,
  IconStar,
  IconShield,
  IconGrid,
  IconClose
} from './Icons';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Step {
  stepNumber: number;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  description: string;
  capabilityLabel: string;
  capabilityText: string;
  targetCallout: string;
  renderMagnifierLens: (onAdvance: () => void) => React.ReactNode;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const STEPS: Step[] = [
    {
      stepNumber: 1,
      badge: "MISSION 01 · IDENTITY & ARCHIVE",
      badgeColor: "#D66A4A",
      title: "Welcome to Typo Hunter",
      subtitle: "A Sovereign Visual Museum in Your Pocket",
      description: "Every day, signs, menus, and billboards suffer from accidental linguistic genius. Document and archive them before they get corrected or erased.",
      capabilityLabel: "Zero Cloud, 100% On-Device",
      capabilityText: "All photos and specimens live permanently inside your device browser local IndexedDB. Works on airplanes, subways, and off-grid with zero tracking.",
      targetCallout: "TAP LOGO OR BUTTON TO BEGIN",
      renderMagnifierLens: (onAdvance) => (
        <div
          onClick={onAdvance}
          className="relative group cursor-pointer flex flex-col items-center justify-center p-2 transition-transform active:scale-95"
          title="Tap to continue"
        >
          {/* Radar Ripple Halos */}
          <div className="absolute w-28 h-28 rounded-full border-2 border-[#E8B92D]/40 animate-ping pointer-events-none" />

          {/* Dribbble-level Favicon Emblem */}
          <div className="relative z-10 group-hover:scale-105 transition-transform flex flex-col items-center">
            <TypoHunterLogo size={76} />
            <span className="mt-2 text-[9px] font-mono font-bold uppercase tracking-widest text-black bg-[#E8B92D] px-2 py-0.5 rounded border border-black shadow-xs">
              Curatorial Seal #001
            </span>
          </div>
        </div>
      ),
    },
    {
      stepNumber: 2,
      badge: "FEATURE 02 · FIELD CAPTURE & OCR",
      badgeColor: "#E8B92D",
      title: "One-Tap Camera & Offline OCR",
      subtitle: "Document Linguistic Chaos in the Wild",
      description: "Whenever you spot an unintentional blunder, tap the elevated center shutter. Snap with your camera or select from your gallery.",
      capabilityLabel: "Offline OCR & Dual Wording",
      capabilityText: "Built-in optical character recognition extracts the text on the sign, and prompts you to record 'What it said' vs 'What they meant'.",
      targetCallout: "MAGNIFIED: CENTER BOTTOM SHUTTER",
      renderMagnifierLens: (onAdvance) => (
        <div
          onClick={onAdvance}
          className="relative group cursor-pointer flex flex-col items-center justify-center p-2 transition-transform active:scale-95"
          title="Tap shutter to continue"
        >
          {/* Pulsing Radar Ring */}
          <div className="absolute w-28 h-28 rounded-full border-2 border-[#E8B92D] animate-ping pointer-events-none" />

          {/* Single Unified Floating Shutter Button Replica */}
          <div className="w-22 h-22 rounded-full bg-[#E8B92D] border-3 border-black shadow-brutal flex flex-col items-center justify-center relative z-10 group-hover:scale-105 transition-transform">
            <div className="relative">
              <IconCamera size={34} className="text-black" />
              <div className="absolute -bottom-1 -right-1 bg-black text-[#E8B92D] w-5 h-5 rounded-full border border-white flex items-center justify-center text-xs font-extrabold">
                +
              </div>
            </div>
            <span className="mt-1 text-[8px] font-mono font-bold uppercase tracking-wider text-black bg-white px-1.5 py-0.2 rounded border border-black leading-none">
              Shutter
            </span>
          </div>
        </div>
      ),
    },
    {
      stepNumber: 3,
      badge: "FEATURE 03 · THE EXHIBITION",
      badgeColor: "#82917B",
      title: "Enshrine The Absolute Legends",
      subtitle: "Curate 5-Star Typographical Masterpieces",
      description: "Not all typos are equal. Some are historical gems of absurdity that deserve permanent enshrinement.",
      capabilityLabel: "Hall of Fame & Funniness Meter",
      capabilityText: "Score specimens from 1 to 5 stars for comedy. Induct top discoveries with the trophy icon into 'THE ABSOLUTE LEGENDS' gallery.",
      targetCallout: "MAGNIFIED: HALL OF FAME TROPHY",
      renderMagnifierLens: (onAdvance) => (
        <div
          onClick={onAdvance}
          className="relative group cursor-pointer flex flex-col items-center justify-center p-2 transition-transform active:scale-95"
          title="Tap trophy to continue"
        >
          {/* Pulsing Glow Ring */}
          <div className="absolute w-28 h-28 rounded-2xl border-2 border-[#E8B92D] animate-pulse pointer-events-none" />

          {/* Single Unified Magnified Trophy Card with Single Shadow */}
          <div className="w-24 h-24 rounded-2xl bg-[#FFFDF9] border-3 border-black shadow-brutal flex flex-col items-center justify-center relative z-10 group-hover:scale-105 transition-transform p-2">
            <IconTrophy size={32} filled={true} className="text-[#E8B92D]" />
            <div className="flex gap-0.5 my-1">
              {[...Array(5)].map((_, i) => (
                <IconStar key={i} size={8} filled={true} className="text-[#E8B92D]" />
              ))}
            </div>
            <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-black bg-[#E8B92D] px-1.5 py-0.5 rounded border border-black leading-none">
              Inductions
            </span>
          </div>
        </div>
      ),
    },
    {
      stepNumber: 4,
      badge: "FEATURE 04 · OFFLINE P2P BATTLES",
      badgeColor: "#282722",
      title: "Offline P2P Battles & QR Passes",
      subtitle: "Screen-to-Screen Competition Without Internet",
      description: "Ready to challenge a friend? Compare ranks and collection scores screen-to-screen with zero Wi-Fi or Bluetooth pairing.",
      capabilityLabel: "Tamper-Proof Proof-of-Sighting",
      capabilityText: "Generates high-density dynamic QR passes verified with SHA-256 integrity signatures to prevent forged scores in school competitions.",
      targetCallout: "MAGNIFIED: CURATOR FIELD PASS",
      renderMagnifierLens: (onAdvance) => (
        <div
          onClick={onAdvance}
          className="relative group cursor-pointer flex flex-col items-center justify-center p-2 transition-transform active:scale-95"
          title="Tap pass to finish"
        >
          {/* Viewfinder Halo */}
          <div className="absolute w-28 h-28 rounded-2xl border-2 border-black/20 animate-pulse pointer-events-none" />

          {/* Single Unified Magnified QR Pass Card with Single Shadow */}
          <div className="w-24 h-24 rounded-2xl bg-[#FFF9EC] border-3 border-black shadow-brutal flex flex-col items-center justify-center relative z-10 group-hover:scale-105 transition-transform p-2">
            <IconGrid size={30} filled={true} className="text-black mb-1" />
            <div className="flex items-center gap-1 mb-1 text-[8px] font-mono font-bold uppercase text-[#82917B]">
              <IconShield size={9} />
              <span>Verified</span>
            </div>
            <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-white bg-[#D66A4A] px-1.5 py-0.5 rounded border border-black leading-none">
              Optical Pass
            </span>
          </div>
        </div>
      ),
    },
  ];

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentStep(s => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome tour"
    >
      <div className="editorial-card bg-[#F4EBDD] p-5 sm:p-6 rounded-3xl max-w-md w-full relative shadow-brutal-lg border-3 border-black flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Top Bar: Progress Indicator & Close Button */}
        <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-black/15">
          <span
            className="text-[10px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded border border-black shadow-brutal-sm text-white"
            style={{ backgroundColor: step.badgeColor }}
          >
            {step.badge}
          </span>

          <div className="flex items-center gap-3">
            {/* Step Dots */}
            <div className="flex gap-1.5" aria-label={`Step ${step.stepNumber} of 4`}>
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === currentStep ? 'w-6 bg-[#D66A4A]' : 'w-2 bg-black/25'
                  }`}
                />
              ))}
            </div>

            {/* Quick Dismiss Button */}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full border-2 border-black bg-white flex items-center justify-center hover:bg-gray-100 cursor-pointer shadow-brutal-sm"
              aria-label="Close tour"
            >
              <IconClose size={12} />
            </button>
          </div>
        </div>

        {/* Android-Style Magnified Feature Spotlight Lens Container */}
        <div className="bg-[#FFFDF9] border-2 border-black rounded-2xl p-4 mb-4 shadow-brutal-sm flex flex-col items-center justify-center relative overflow-hidden">
          {/* Target Spotlight Header Bar */}
          <div className="w-full flex justify-between items-center text-[9px] font-mono font-bold text-gray-500 uppercase mb-2 border-b border-black/10 pb-1">
            <span>Feature Discovery</span>
            <span className="text-[#D66A4A]">{step.targetCallout}</span>
          </div>

          {/* Render Magnified Lens */}
          <div className="py-2 flex items-center justify-center">
            {step.renderMagnifierLens(handleNext)}
          </div>
        </div>

        {/* Title & Copy */}
        <div className="text-center mb-4">
          <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-black tracking-tight leading-tight">
            {step.title}
          </h2>
          <p className="text-xs font-mono font-bold text-[#D66A4A] mt-0.5 uppercase tracking-wide">
            {step.subtitle}
          </p>
          <p className="text-xs text-gray-700 leading-relaxed font-medium mt-2 px-1">
            {step.description}
          </p>
        </div>

        {/* Highlighted Key Capability Callout */}
        <div className="bg-white border-2 border-black rounded-xl p-3 mb-5 shadow-brutal-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D66A4A]" />
            <h4 className="text-[11px] font-mono font-extrabold uppercase tracking-wider text-black">
              {step.capabilityLabel}
            </h4>
          </div>
          <p className="text-xs text-gray-600 font-mono leading-snug">
            {step.capabilityText}
          </p>
        </div>

        {/* Navigation Action Buttons */}
        <div className="flex gap-2">
          {currentStep > 0 && (
            <button
              onClick={handleBack}
              className="btn-secondary py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 btn-primary py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider text-center cursor-pointer shadow-brutal"
          >
            {isLast ? 'Enter The Museum →' : 'Next Feature →'}
          </button>
        </div>

        {/* Skip Tour Link */}
        {!isLast && (
          <div className="text-center mt-3">
            <button
              onClick={onClose}
              className="text-[10px] font-mono text-gray-500 hover:text-black uppercase font-bold tracking-wider cursor-pointer underline"
            >
              Skip Onboarding Tour
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
