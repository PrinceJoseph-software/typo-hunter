import { useEffect, useState } from 'react';
import { dbService } from '../db/database';

/**
 * Loads one discovery's full-size image on demand and returns an object URL.
 * Shows `fallback` (the thumbnail) until it loads, or if no full image exists.
 * The object URL is revoked when the id changes or the component unmounts.
 */
export function useDiscoveryImage(id: string | undefined, fallback: string): string {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setUrl(null);
    dbService
      .getImage(id)
      .then(blob => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(err => console.warn('[images] Failed to load full image', err));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  return url || fallback;
}
