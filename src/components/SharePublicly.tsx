/** Share / unshare one saved find on the public feed (shown on the find's page). */
import React, { useState } from 'react';
import { Discovery } from '../db/database';
import { ApiError, publicApi, ShareChoice } from '../utils/publicApi';
import { textProblem } from '../../server/validate';
import { emptyShareChoice, PublicShareFields } from './PublicShareFields';

interface Props {
  discovery: Discovery;
  onChanged: () => void;
}

export const SharePublicly: React.FC<Props> = ({ discovery, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<ShareChoice>(emptyShareChoice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = discovery.publicPost;

  if (discovery.origin === 'imported') return null;

  const said = discovery.originalWording || '';
  const meant = discovery.intendedWording || '';
  const problem = !said || !meant
    ? 'Add both "What it said" and "What they meant" (tap Edit) before sharing.'
    : textProblem(said) || textProblem(meant);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setOpen(false);
      onChanged();
    } catch (err) {
      setError((err as ApiError).message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white p-3.5 rounded-xl border-2 border-black shadow-brutal-sm space-y-2.5 font-mono text-xs" aria-label="Public sharing">
      <div className="flex justify-between items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider bg-black text-[#E8B92D] px-2 py-0.5 rounded">Public typo feed</span>
        {state?.status === 'posted' && <span className="font-bold text-[#2D4A27]">Shared · {state.cityName}</span>}
        {state?.status === 'queued' && <span className="font-bold text-gray-600">Waiting to send</span>}
        {state?.status === 'failed' && <span className="font-bold text-[#D66A4A]">Not shared</span>}
      </div>

      {state ? (
        <>
          {state.status === 'posted' && (
            <p className="text-gray-700">
              The words of this find are public in {state.cityName}
              {state.showName ? ' with your nickname' : ', anonymously'}.{' '}
              {state.citySlug && (
                <a href={`/city/${state.citySlug}`} className="underline font-bold text-[#D66A4A]">
                  See the city page
                </a>
              )}
            </p>
          )}
          {state.status === 'queued' && <p className="text-gray-700">{state.error || 'It will be sent when you\'re back online.'}</p>}
          {state.status === 'failed' && <p className="text-[#D66A4A] font-bold">{state.error || 'The post was not accepted.'}</p>}
          <div className="flex flex-wrap gap-2">
            {state.status !== 'posted' && (
              <button type="button" disabled={busy} onClick={() => run(() => publicApi.send({ ...discovery, publicPost: { ...state, status: 'queued' } }))} className="btn-secondary py-1.5 px-3 rounded-lg text-[11px] font-bold uppercase cursor-pointer">
                Try again
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => run(() => publicApi.unshare(discovery))} className="py-1.5 px-3 rounded-lg text-[11px] font-bold uppercase cursor-pointer border-2 border-[#D66A4A] text-[#D66A4A]">
              {state.status === 'posted' ? 'Remove public post' : 'Cancel sharing'}
            </button>
          </div>
        </>
      ) : open ? (
        <>
          {problem ? (
            <p className="text-[#D66A4A] font-bold">{problem}</p>
          ) : (
            <>
              <PublicShareFields value={choice} onChange={setChoice} idPrefix="detail-share" />
              <div className="flex gap-2">
                <button type="button" disabled={busy || !choice.city || !choice.age13} onClick={() => run(() => publicApi.share(discovery, choice))} className="flex-1 btn-primary py-2.5 rounded-xl text-[11px] font-extrabold uppercase cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  {busy ? 'Sharing…' : 'Share the words publicly'}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-3 rounded-xl text-[11px] font-bold uppercase cursor-pointer">
                  Cancel
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <p className="text-gray-700">Let everyone see this typo in your city's feed. Only the words are shared, never the photo.</p>
          <button type="button" onClick={() => setOpen(true)} className="btn-secondary py-2 px-3 rounded-xl text-[11px] font-bold uppercase cursor-pointer">
            Share publicly…
          </button>
        </>
      )}
      {error && <p className="text-[#D66A4A] font-bold" role="alert">{error}</p>}
    </section>
  );
};
