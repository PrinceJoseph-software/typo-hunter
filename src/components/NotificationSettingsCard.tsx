/**
 * @file NotificationSettingsCard.tsx
 * @description User-facing reminder settings: turn reminders on, pick a tone,
 * choose an optional daily prompt, send a test.
 *
 * Internal behaviour is deliberately NOT exposed here: the mascot favicon and the
 * inactivity reminders follow fixed stages (24h / 48h / 72h without a new typo)
 * automatically. See src/utils/dynamicFavicon.ts and public/sw.js.
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
  getReminderSupport,
} from '../utils/notificationService';
import { IconBell, IconCheck, IconAlert } from './Icons';

export const NotificationSettingsCard: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSettings>(() => getNotificationSettings());
  const [permission, setPermission] = useState<NotificationPermission>(() => getNotificationPermissionStatus());
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });
  const [sendingTest, setSendingTest] = useState(false);
  const [reminderSupport, setReminderSupport] = useState<'background' | 'needs-install' | 'unsupported' | 'checking'>('checking');

  useEffect(() => {
    let cancelled = false;
    getReminderSupport().then(r => {
      if (!cancelled) setReminderSupport(r);
    });
    return () => {
      cancelled = true;
    };
  }, [permission, settings.enabled]);



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
            Reminders
          </span>
        </div>
        <h2 className="text-lg font-extrabold font-heading text-black flex items-center gap-2">
          <IconBell size={18} className="text-[#D66A4A]" />
          Field Dispatches
        </h2>
        <p className="text-xs font-mono text-gray-600 mt-0.5">
          Get a nudge when you haven't spotted a typo for a while, in the voice you like.
        </p>
      </div>

      {/* Reminder settings */}
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
              <span className="text-[10px] text-gray-500 block">
                {permission !== 'granted'
                  ? 'Requires browser alert permission'
                  : reminderSupport === 'background'
                  ? 'Reminders can arrive while the app is closed (the browser picks the exact time).'
                  : reminderSupport === 'needs-install'
                  ? 'Install the app (Add to Home Screen) to get reminders while it is closed.'
                  : reminderSupport === 'checking'
                  ? 'Checking background support…'
                  : "This browser can't deliver reminders while the app is closed; the mascot and welcome-back banner still work."}
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
                        className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border border-black uppercase"
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

        <div className="pt-1">
          {/* Daily Safari Time */}
          <div className="bg-[#FAF6EE] border border-black/20 rounded-xl p-3">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-600 block mb-1">
              Daily hunt prompt:
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
              <option value="off">Off</option>
              <option value="09:00">Morning (09:00)</option>
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
