import type { N8nData } from './types';

export const CACHE_KEY_PREFIX = 'defenz_dashboard_';
export const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

export const getCachedData = (range: string): N8nData | null => {
  if (typeof window === 'undefined') return null;
  try {
    const key = CACHE_KEY_PREFIX + range;
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

export const setCachedData = (range: string, data: N8nData): void => {
  if (typeof window === 'undefined') return;
  try {
    const key = CACHE_KEY_PREFIX + range;
    sessionStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch {
    // Ignore storage errors
  }
};
