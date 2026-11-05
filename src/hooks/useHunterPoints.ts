import { useEffect, useState } from 'react';
import { pointsLedger } from '../utils/pointsLedger';

/** Locked lifetime points; re-renders whenever the ledger changes. */
export function useHunterPoints(): number {
  const [total, setTotal] = useState(() => pointsLedger.getTotal());
  useEffect(() => {
    setTotal(pointsLedger.getTotal());
    return pointsLedger.subscribe(() => setTotal(pointsLedger.getTotal()));
  }, []);
  return total;
}
