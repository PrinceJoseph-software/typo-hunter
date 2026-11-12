/**
 * The choices needed to share a find publicly: city (found on the phone or searched),
 * whether to show the public nickname, and the 13+ confirmation.
 */
import React, { useEffect, useState } from 'react';
import { CityOption, getPosition, nearestCities, searchCities } from '../utils/cityLookup';
import { publicApi, SavedCity, ShareChoice } from '../utils/publicApi';

interface Props {
  value: ShareChoice;
  onChange: (next: ShareChoice) => void;
  idPrefix: string;
}

export const emptyShareChoice = (): ShareChoice => ({
  city: publicApi.getSavedCity(),
  showName: false,
  age13: publicApi.hasConfirmedAge(),
});

export const PublicShareFields: React.FC<Props> = ({ value, onChange, idPrefix }) => {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<CityOption[]>([]);
  const [picking, setPicking] = useState(!value.city);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const nickname = publicApi.getCachedNickname();

  useEffect(() => {
    if (!picking || query.trim().length < 2) return;
    let cancelled = false;
    searchCities(query)
      .then(found => {
        if (!cancelled) setOptions(found);
      })
      .catch(() => {
        if (!cancelled) setMessage('The city list couldn\'t be loaded. Check your connection and try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [query, picking]);

  const useLocation = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const pos = await getPosition();
      const near = await nearestCities(pos.lat, pos.lng);
      setOptions(near);
      setMessage(near.length ? 'Pick your city. Your exact location stays on this phone.' : 'No city found nearby. Search by name instead.');
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const choose = (c: SavedCity) => {
    onChange({ ...value, city: { id: c.id, name: c.name, country: c.country } });
    setPicking(false);
    setOptions([]);
    setQuery('');
    setMessage(null);
  };

  return (
    <div className="space-y-3 font-mono text-xs">
      <div>
        <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">City shown on the post</span>
        {value.city && !picking ? (
          <div className="flex items-center justify-between gap-2 bg-white border-2 border-black rounded-xl px-3 py-2">
            <span className="font-bold text-black">
              {value.city.name}, {value.city.country}
            </span>
            <button type="button" onClick={() => setPicking(true)} className="underline text-[#D66A4A] font-bold cursor-pointer">
              Change
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <label htmlFor={`${idPrefix}-city`} className="sr-only">
                Search for your city
              </label>
              <input
                id={`${idPrefix}-city`}
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Type your city…"
                autoComplete="off"
                className="flex-1 min-w-0 p-2 border-2 border-black rounded-xl text-xs font-bold bg-white"
              />
              <button type="button" onClick={useLocation} disabled={busy} className="btn-secondary px-3 rounded-xl text-[11px] font-bold uppercase cursor-pointer whitespace-nowrap">
                {busy ? 'Finding…' : 'Use my location'}
              </button>
            </div>
            {options.length > 0 && (
              <ul className="bg-white border-2 border-black rounded-xl divide-y divide-black/10 max-h-44 overflow-y-auto" aria-label="Cities">
                {options.map(c => (
                  <li key={c.id}>
                    <button type="button" onClick={() => choose(c)} className="w-full text-left px-3 py-2 hover:bg-[#FFF9EC] cursor-pointer">
                      <span className="font-bold text-black">{c.name}</span>, {c.country}
                      {typeof c.distanceKm === 'number' && <span className="text-gray-500"> · about {Math.max(1, Math.round(c.distanceKm))} km away</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {message && <p className="text-gray-700" role="status">{message}</p>}
          </div>
        )}
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.showName && !!nickname}
          disabled={!nickname}
          onChange={e => onChange({ ...value, showName: e.target.checked })}
          className="mt-0.5"
        />
        <span>
          {nickname ? (
            <>Show my public nickname <strong>{nickname}</strong> on the post</>
          ) : (
            <span className="text-gray-600">Posting anonymously. Claim a public nickname in your Curator Profile if you want your name on posts.</span>
          )}
        </span>
      </label>

      {!publicApi.hasConfirmedAge() && (
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={value.age13} onChange={e => onChange({ ...value, age13: e.target.checked })} className="mt-0.5" />
          <span>I'm 13 or older.</span>
        </label>
      )}

      <p className="text-[11px] text-gray-600 leading-relaxed">
        Everyone will see: the words, the correction, the category and the city. Never your photo, exact location or device.
        Don't share names or private details. You can remove the post at any time.
      </p>
    </div>
  );
};
