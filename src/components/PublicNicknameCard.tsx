/** Claim a unique public nickname for posts on the typo feed (optional; posting is anonymous without one). */
import React, { useEffect, useState } from 'react';
import { ApiError, publicApi } from '../utils/publicApi';
import { nicknameProblem } from '../../server/validate';

export const PublicNicknameCard: React.FC = () => {
  const [current, setCurrent] = useState<string | null>(() => publicApi.getCachedNickname());
  const [changeAllowedAt, setChangeAllowedAt] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    // Only ask the server if this phone has already used public features (no key is created just by looking).
    if (!localStorage.getItem('typo_hunter_public_key')) return;
    publicApi
      .me()
      .then(me => {
        setCurrent(me.nickname);
        setChangeAllowedAt(me.nicknameChangeAllowedAt);
      })
      .catch(err => {
        if ((err as ApiError).status === 503) setAvailable(false);
      });
  }, []);

  if (!available) return null;

  const localProblem = draft ? nicknameProblem(draft.trim()) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name || localProblem) return;
    setBusy(true);
    setMessage(null);
    try {
      const saved = await publicApi.setNickname(name);
      setCurrent(saved);
      setDraft('');
      setMessage({ ok: true, text: `"${saved}" is yours. Nobody else can post under it, or under a look-alike spelling.` });
      const me = await publicApi.me().catch(() => null);
      if (me) setChangeAllowedAt(me.nicknameChangeAllowedAt);
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.status === 503) setAvailable(false);
      setMessage({ ok: false, text: e2.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="editorial-card p-5 rounded-2xl bg-white mb-6 space-y-3">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest font-heading text-gray-500">Public nickname</h2>
        <p className="text-xs text-gray-600 font-mono leading-relaxed mt-1">
          Optional. Used only when you choose to show your name on a public typo post. It's unique: nobody else can take it or a
          look-alike (like swapping "o" for "0"). Your display name above stays private to this phone and QR games.
        </p>
      </div>
      {current && (
        <p className="font-mono text-sm">
          Your public nickname: <strong>{current}</strong>
        </p>
      )}
      {changeAllowedAt ? (
        <p className="font-mono text-xs text-gray-600">You can change it again on {new Date(changeAllowedAt).toLocaleDateString()}.</p>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <label htmlFor="public-nickname" className="block text-xs font-bold uppercase tracking-wider font-heading">
            {current ? 'Change nickname (once every 30 days)' : 'Claim a nickname'}
          </label>
          <div className="flex gap-2">
            <input
              id="public-nickname"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              maxLength={20}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="e.g. SignSpotter"
              className="flex-1 min-w-0 p-2.5 border-2 border-black rounded-xl text-sm font-bold"
              aria-describedby="public-nickname-help"
            />
            <button type="submit" disabled={busy || !draft.trim() || !!localProblem} className="btn-primary px-4 rounded-xl text-xs font-bold uppercase cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              {busy ? 'Checking…' : 'Claim'}
            </button>
          </div>
          <p id="public-nickname-help" className="font-mono text-[11px] text-gray-600">
            {localProblem || '3–20 letters, numbers or underscores, starting with a letter.'}
          </p>
        </form>
      )}
      {message && (
        <p className={`font-mono text-xs font-bold ${message.ok ? 'text-[#2D4A27]' : 'text-[#D66A4A]'}`} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}
    </div>
  );
};
