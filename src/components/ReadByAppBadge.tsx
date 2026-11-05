import React from 'react';

/**
 * Shown on finds whose wording matches the text the app read from the photo on this phone.
 * Deliberately modest: it says the app read it, not that it is proven or verified.
 */
export const ReadByAppBadge: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <span
    className={`inline-flex items-center gap-1 rounded border border-[#2D4A27] bg-[#E3ECDF] text-[#2D4A27] font-mono font-bold ${
      compact ? 'text-[10px] px-1 py-0' : 'text-[11px] px-2 py-0.5'
    }`}
    title="The app read this wording from the photo, on this phone"
  >
    <span aria-hidden="true">✓</span> Read by app
  </span>
);
