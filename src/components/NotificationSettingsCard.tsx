/**
 * @file NotificationSettingsCard.tsx
 * @description Customizable notification dispatches and interactive Duolingo-style
 * dynamic favicon previewer.
 *
 * ARCHITECTURAL DESIGN:
 * - 100% Client-Side: Zero cloud dependencies, zero external push servers.
 * - Dynamic Favicon Sandbox: Curators can click any of the 3 mascot states
 *   (Pristine, Pleading, Melting) to physically mutate the browser tab favicon.
 * - Duolingo Persona Switcher: Choose between "Unhinged Duolingo", "Stern Proofreader",
 *   and "Urban Safari Scout" tones with immediate live dispatch testing.
 */

import React, { useState, useEffect } from 'react';
import {
  NotificationSettings,
  NOTIFICATION_PERSONAS,
  getNotificationSettings,
  saveNotificationSettings,
  requestNotificationPermission,
  getNotificationPermissionStatus,
  sendTestNotification,
} from '../utils/notificationService';
import {
  FaviconStage,
  getInactivityDetails,
  setManualFaviconPreview,
  InactivityDetails,
} from '../utils/dynamicFavicon';
import { IconBell, IconFlame, IconCheck, IconAlert } from './Icons';

export const NotificationSettingsCard: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSettings>(() => getNotificationSettings());
  const [permission, setPermission] = useState<NotificationPermission>(() => getNotificationPermissionStatus());
  const [inactivity, setInactivity] = useState<InactivityDetails>(() => getInactivityDetails());
  const [previewStage, setPreviewStage] = useState<FaviconStage | 'auto'>('auto');
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    setInactivity(getInactivityDetails());
    const interval = setInterval(() => {
      setInactivity(getInactivityDetails());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateSettings = (updates: Partial<NotificationSettings>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    saveNotificationSettings(next);
  };

  const handleEnablePermissions = async () => {
    const perm = await requestNotificationPermission();
    setPermission(perm);
    if (perm === 'granted') {
      handleUpdateSettings({ enabled: true });
      setTestResult({
        type: 'success',
        message: 'Browser notifications authorized! You will receive field dispatches.',
      });
    } else {
      setTestResult({
        type: 'error',
        message: 'Permission was declined or blocked by your browser settings.',
      });
    }
  };

  const handleSelectFavicon = (stage: FaviconStage) => {
    setPreviewStage(stage);
    setManualFaviconPreview(stage);
    setTestResult({
      type: 'success',
      message: `Browser tab favicon morphed to [${stage.toUpperCase()}]! Look at your browser tab.`,
    });
  };

  const handleResetFaviconAuto = () => {
    setPreviewStage('auto');
    setManualFaviconPreview('auto');
    setInactivity(getInactivityDetails());
    setTestResult({
      type: 'success',
      message: 'Browser tab favicon restored to automatic inactivity sync.',
    });
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    setTestResult({ type: null, message: '' });
    try {
      const res = await sendTestNotification(settings.tone);
      setTestResult({
        type: res.success ? 'success' : 'error',
        message: res.message,
      });
    } catch {
      setTestResult({
        type: 'error',
        message: 'Could not trigger test notification. Check system settings.',
      });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="editorial-card p-5 rounded-2xl bg-white mb-6 space-y-5 border-2 border-black shadow-brutal box-border">
      {/* Section Header */}
      <div className="border-b-2 border-black pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono font-bold tracking-widest text-[#D66A4A] uppercase block">
            Dispatches & Adaptive Identity
          </span>
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded border border-black bg-[#FAF6EE] text-black">
            Duolingo System
          </span>
        </div>
        <h2 className="text-lg font-extrabold font-heading text-black flex items-center gap-2">
          <IconBell size={18} className="text-[#D66A4A]" />
          Field Dispatches & Mascot Favicons
        </h2>
        <p className="text-xs font-mono text-gray-600 mt-0.5">
          Customizable notifications and adaptive browser favicons that evolve if you abandon your hunt.
        </p>
      </div>

      {/* PART 1: DYNAMIC MASCOT FAVICON (DUOLINGO INACTIVITY PROGRESSION) */}
      <div className="bg-[#FFFDF9] border-2 border-black rounded-xl p-4 shadow-brutal-sm space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-heading font-extrabold text-sm text-black flex items-center gap-1.5">
              <IconFlame size={15} className="text-[#E8B92D]" />
              Inactivity Mascot Favicon
            </h3>
            <p className="text-[11px] font-mono text-gray-600">
              Just like Duolingo, your browser tab icon degrades if you don't document typos!
            </p>
          </div>
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-black bg-black text-[#E8B92D]">
            {previewStage === 'auto' ? 'AUTO SYNC' : 'MANUAL PREVIEW'}
          </span>
        </div>

        {/* Current Inactivity Status Pill */}
        <div className="bg-[#FAF6EE] border border-black/20 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono">
          <div>
            <span className="text-[9px] text-gray-500 uppercase font-bold block">Current Status:</span>
            <span className="font-bold text-black">{inactivity.stageLabel}</span>
            <span className="text-[10px] text-gray-500 block">
              {inactivity.hoursInactive === 0
                ? 'Active today · Full streak'
                : `${inactivity.hoursInactive} hours inactive`}
            </span>
          </div>
          <div className="text-right">
            <span
              className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border border-black uppercase ${
                inactivity.stage === 'melting'
                  ? 'bg-[#D66A4A] text-white'
                  : inactivity.stage === 'pleading'
                  ? 'bg-[#E8B92D] text-black'
                  : 'bg-[#82917B] text-white'
              }`}
            >
              Stage: {inactivity.stage}
            </span>
          </div>
        </div>

        {/* 3 Live Interactive Favicon Preview Cards */}
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500 block mb-2">
            Click to Test Browser Tab Favicon:
          </span>
          <div className="grid grid-cols-3 gap-2">
            {/* 1. Pristine */}
            <button
              type="button"
              onClick={() => handleSelectFavicon('pristine')}
              className={`p-2.5 rounded-xl border-2 border-black text-center cursor-pointer transition-all flex flex-col items-center justify-between ${
                previewStage === 'pristine'
                  ? 'bg-[#FFF9EC] shadow-brutal'
                  : 'bg-white hover:bg-gray-50 shadow-brutal-sm'
              }`}
            >
              <div className="w-10 h-10 mb-1 flex items-center justify-center">
                <svg viewBox="0 0 64 64" className="w-10 h-10">
                  <rect x="6" y="6" width="50" height="50" rx="12" fill="#E8B92D" stroke="#282722" strokeWidth="4" />
                  <circle cx="31" cy="31" r="17" fill="#F4EBDD" stroke="#282722" strokeWidth="3" />
                  <line x1="31" y1="9" x2="31" y2="14" stroke="#282722" strokeWidth="3" strokeLinecap="round" />
                  <line x1="31" y1="48" x2="31" y2="53" stroke="#282722" strokeWidth="3" strokeLinecap="round" />
                  <line x1="9" y1="31" x2="14" y2="31" stroke="#282722" strokeWidth="3" strokeLinecap="round" />
                  <line x1="48" y1="31" x2="53" y2="31" stroke="#282722" strokeWidth="3" strokeLinecap="round" />
                  <path d="M22 23 H40 V28 H33.5 V41 H28.5 V28 H22 Z" fill="#282722" />
                  <circle cx="43" cy="19" r="3.5" fill="#D66A4A" stroke="#282722" strokeWidth="1.5" />
                </svg>
              </div>
              <span className="font-heading font-extrabold text-[11px] text-black">Pristine</span>
              <span className="text-[8px] font-mono text-gray-500 uppercase">&lt;24h Active</span>
            </button>

            {/* 2. Pleading */}
            <button
              type="button"
              onClick={() => handleSelectFavicon('pleading')}
              className={`p-2.5 rounded-xl border-2 border-black text-center cursor-pointer transition-all flex flex-col items-center justify-between ${
                previewStage === 'pleading'
                  ? 'bg-[#FFF9EC] shadow-brutal'
                  : 'bg-white hover:bg-gray-50 shadow-brutal-sm'
              }`}
            >
              <div className="w-10 h-10 mb-1 flex items-center justify-center">
                <svg viewBox="0 0 64 64" className="w-10 h-10">
                  <g transform="rotate(-3 31 31)">
                    <rect x="6" y="6" width="50" height="50" rx="12" fill="#E8B92D" stroke="#282722" strokeWidth="4" />
                    <circle cx="31" cy="33" r="17" fill="#F4EBDD" stroke="#282722" strokeWidth="3" />
                    <line x1="18" y1="19" x2="26" y2="23" stroke="#282722" strokeWidth="3.5" strokeLinecap="round" />
                    <line x1="44" y1="19" x2="36" y2="23" stroke="#282722" strokeWidth="3.5" strokeLinecap="round" />
                    <path d="M23 27 H39 V31 H33.5 V43 H28.5 V31 H23 Z" fill="#282722" transform="rotate(5 31 35)" />
                    <path d="M43 35 C43 35 48 41 46 44 C44 46 41 44 41 41 Z" fill="#6AA4B4" stroke="#282722" strokeWidth="1.2" />
                    <circle cx="48" cy="14" r="6.5" fill="#FFFDF9" stroke="#282722" strokeWidth="2" />
                    <text x="48" y="18.5" fontSize="10" fontWeight="900" fill="#D66A4A" textAnchor="middle" fontFamily="monospace">?</text>
                  </g>
                </svg>
              </div>
              <span className="font-heading font-extrabold text-[11px] text-black">Pleading</span>
              <span className="text-[8px] font-mono text-gray-500 uppercase">24h–72h Away</span>
            </button>

            {/* 3. Melting Meltdown */}
            <button
              type="button"
              onClick={() => handleSelectFavicon('melting')}
              className={`p-2.5 rounded-xl border-2 border-black text-center cursor-pointer transition-all flex flex-col items-center justify-between ${
                previewStage === 'melting'
                  ? 'bg-[#FFF9EC] shadow-brutal'
                  : 'bg-white hover:bg-gray-50 shadow-brutal-sm'
              }`}
            >
              <div className="w-10 h-10 mb-1 flex items-center justify-center">
                <svg viewBox="0 0 64 64" className="w-10 h-10">
                  <path d="M6 18 C6 10 12 6 20 6 H42 C50 6 56 10 56 18 V40 C56 40 53 58 47 58 C43 58 42 49 38 49 C34 49 33 62 28 62 C23 62 22 50 18 50 C15 50 14 59 10 59 C7 59 6 48 6 40 Z" fill="#EDA338" stroke="#282722" strokeWidth="4" />
                  <ellipse cx="31" cy="31" rx="16" ry="13" fill="#F4EBDD" stroke="#282722" strokeWidth="3" />
                  <line x1="20" y1="26" x2="26" y2="28" stroke="#282722" strokeWidth="3.5" strokeLinecap="round" />
                  <line x1="42" y1="26" x2="36" y2="28" stroke="#282722" strokeWidth="3.5" strokeLinecap="round" />
                  <path d="M24 28 H38 V32 H33 V42 C33 46 31 48 29 48 C27 48 27 44 29 42 V32 H24 Z" fill="#282722" />
                  <path d="M28 50 C28 50 29 57 27 57 C25 57 25 52 26 50 Z" fill="#D66A4A" stroke="#282722" strokeWidth="1" />
                  <circle cx="49" cy="13" r="7.5" fill="#D66A4A" stroke="#282722" strokeWidth="2" />
                  <text x="49" y="17.5" fontSize="11" fontWeight="900" fill="#FFFFFF" textAnchor="middle" fontFamily="monospace">!</text>
                </svg>
              </div>
              <span className="font-heading font-extrabold text-[11px] text-[#D66A4A]">Melting!</span>
              <span className="text-[8px] font-mono text-gray-500 uppercase">&gt;72h Meltdown</span>
            </button>
          </div>

          {previewStage !== 'auto' && (
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={handleResetFaviconAuto}
                className="text-[10px] font-mono font-bold text-[#D66A4A] hover:underline cursor-pointer"
              >
                ← Reset to Automatic Inactivity Sync
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PART 2: NOTIFICATION DISPATCH CUSTOMIZATION */}
      <div className="space-y-4">
        {/* Permission Banner */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-black/20 bg-[#FAF6EE]">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full border border-black ${
                permission === 'granted' && settings.enabled
                  ? 'bg-[#82917B]'
                  : permission === 'denied'
                  ? 'bg-[#D66A4A]'
                  : 'bg-[#E8B92D]'
              }`}
            />
            <div className="text-xs font-mono">
              <span className="font-bold text-black block">
                {permission === 'granted' && settings.enabled
                  ? 'Browser Dispatches Enabled'
                  : permission === 'denied'
                  ? 'Browser Permissions Blocked'
                  : 'Notifications Not Configured'}
              </span>
              <span className="text-[10px] text-gray-500">
                {permission === 'granted'
                  ? 'Ready to receive inactivity & streak alerts'
                  : 'Requires browser alert permission'}
              </span>
            </div>
          </div>

          {permission !== 'granted' ? (
            <button
              type="button"
              onClick={handleEnablePermissions}
              className="btn-primary py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer shadow-xs"
            >
              Enable
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleUpdateSettings({ enabled: !settings.enabled })}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer border border-black ${
                settings.enabled ? 'bg-white text-black' : 'btn-primary'
              }`}
            >
              {settings.enabled ? 'Pause' : 'Activate'}
            </button>
          )}
        </div>

        {/* Persona Tone Selector */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider font-heading text-black block mb-2">
            Notification Tone & Persona:
          </label>
          <div className="space-y-2">
            {NOTIFICATION_PERSONAS.map((persona) => {
              const isSelected = settings.tone === persona.id;
              return (
                <div
                  key={persona.id}
                  onClick={() => handleUpdateSettings({ tone: persona.id })}
                  className={`p-3 rounded-xl border-2 border-black cursor-pointer transition-all flex items-start justify-between ${
                    isSelected ? 'bg-[#FFF9EC] shadow-brutal' : 'bg-white hover:bg-gray-50 shadow-brutal-sm'
                  }`}
                >
                  <div className="pr-2 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border border-black uppercase"
                        style={{ backgroundColor: persona.badgeBg, color: persona.badgeText }}
                      >
                        {persona.badge}
                      </span>
                      <h4 className="font-heading font-extrabold text-sm text-black">{persona.name}</h4>
                    </div>
                    <p className="text-[11px] font-mono text-gray-600 mb-1">{persona.tagline}</p>
                    <p className="text-[11px] font-mono text-gray-800 italic bg-[#FAF6EE] p-1.5 rounded border border-black/10">
                      {persona.sample}
                    </p>
                  </div>

                  <div className="flex-shrink-0 mt-1">
                    {isSelected ? (
                      <span className="w-5 h-5 rounded-full bg-black text-[#E8B92D] border border-black flex items-center justify-center">
                        <IconCheck size={11} />
                      </span>
                    ) : (
                      <span className="w-5 h-5 rounded-full border-2 border-gray-300 block" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Inactivity Threshold & Daily Time Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Threshold */}
          <div className="bg-[#FAF6EE] border border-black/20 rounded-xl p-3">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-600 block mb-1">
              Inactivity Nudge Trigger:
            </label>
            <select
              value={settings.inactivityHoursThreshold}
              onChange={(e) =>
                handleUpdateSettings({
                  inactivityHoursThreshold: parseInt(e.target.value, 10) as 24 | 48 | 72,
                })
              }
              className="w-full p-2 bg-white border border-black rounded-lg text-xs font-bold font-mono"
            >
              <option value={24}>After 24 Hours (Pleading Nudge)</option>
              <option value={48}>After 48 Hours (Serious Guilt)</option>
              <option value={72}>After 72 Hours (Favicon Meltdown!)</option>
            </select>
          </div>

          {/* Daily Safari Time */}
          <div className="bg-[#FAF6EE] border border-black/20 rounded-xl p-3">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-600 block mb-1">
              Daily Safari Prompt:
            </label>
            <select
              value={settings.dailySafariTime}
              onChange={(e) =>
                handleUpdateSettings({
                  dailySafariTime: e.target.value as '09:00' | '13:00' | '18:00' | 'off',
                })
              }
              className="w-full p-2 bg-white border border-black rounded-lg text-xs font-bold font-mono"
            >
              <option value="off">Off (Only Inactivity Alerts)</option>
              <option value="09:00">Morning Safari (09:00)</option>
              <option value="13:00">Lunch Break Hunt (13:00)</option>
              <option value="18:00">Evening Commute (18:00)</option>
            </select>
          </div>
        </div>

        {/* Feedback / Result Banner */}
        {testResult.message && (
          <div
            className={`p-3 rounded-xl border-2 border-black font-mono text-xs flex items-center gap-2 ${
              testResult.type === 'success'
                ? 'bg-[#EBF3E8] text-[#2D5A27]'
                : 'bg-[#FDF2F0] text-[#D66A4A]'
            }`}
          >
            {testResult.type === 'success' ? (
              <IconCheck size={14} className="flex-shrink-0" />
            ) : (
              <IconAlert size={14} className="flex-shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Test Dispatch Button */}
        <button
          type="button"
          onClick={handleSendTest}
          disabled={sendingTest}
          className="w-full btn-secondary py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer border-2 border-black shadow-brutal flex items-center justify-center gap-2"
        >
          <IconBell size={14} />
          <span>{sendingTest ? 'Sending Dispatch…' : `Send Test Dispatch (${settings.tone.toUpperCase()})`}</span>
        </button>
      </div>
    </div>
  );
};
