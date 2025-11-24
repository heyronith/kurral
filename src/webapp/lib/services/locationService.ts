const LOCATION_CACHE_KEY = 'dumbfeed:country-code';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

type CountryCache = {
  countryCode: string;
  expiresAt: number;
};

const isLocalStorageAvailable = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

const readCachedCountryCode = (): string | null => {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    const payload = window.localStorage.getItem(LOCATION_CACHE_KEY);
    if (!payload) return null;
    const parsed: CountryCache = JSON.parse(payload);
    if (parsed.expiresAt > Date.now() && parsed.countryCode) {
      return parsed.countryCode;
    }
    window.localStorage.removeItem(LOCATION_CACHE_KEY);
  } catch (error) {
    console.warn('[LocationService] Failed to read cached country code', error);
    window.localStorage.removeItem(LOCATION_CACHE_KEY);
  }
  return null;
};

const cacheCountryCode = (countryCode: string) => {
  if (!isLocalStorageAvailable()) return;
  const payload: CountryCache = {
    countryCode,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  try {
    window.localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[LocationService] Failed to cache country code', error);
  }
};

const fetchCountryCode = async (): Promise<string | null> => {
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5_000);
    const response = await fetch('/api/detect-country', {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    window.clearTimeout(timeout);
    
    // Handle 204 No Content (no country code available)
    if (response.status === 204) {
      console.log('[LocationService] No country code available (204)');
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`Unexpected response (${response.status})`);
    }
    
    const data = await response.json();
    const countryCode = typeof data?.countryCode === 'string' ? data.countryCode.trim() : '';
    if (!countryCode) {
      return null;
    }
    const normalized = countryCode.toUpperCase();
    cacheCountryCode(normalized);
    console.log('[LocationService] Successfully fetched country code:', normalized);
    return normalized;
  } catch (error) {
    console.warn('[LocationService] Failed to fetch country code', error);
    return null;
  }
};

export const resolveCountryCode = async (): Promise<string | null> => {
  const cached = readCachedCountryCode();
  if (cached) {
    return cached;
  }
  if (typeof window === 'undefined') {
    return null;
  }
  return fetchCountryCode();
};

let countryNameFormatter: Intl.DisplayNames | null = null;

const getCountryNameFormatter = (): Intl.DisplayNames | null => {
  if (countryNameFormatter) {
    return countryNameFormatter;
  }
  if (typeof Intl === 'undefined' || typeof Intl.DisplayNames === 'undefined') {
    return null;
  }
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en';
  countryNameFormatter = new Intl.DisplayNames([locale], { type: 'region' });
  return countryNameFormatter;
};

export const getCountryLabel = (countryCode?: string): string | undefined => {
  if (!countryCode) return undefined;
  const normalized = countryCode.toUpperCase();
  const formatter = getCountryNameFormatter();
  const label = formatter?.of(normalized);
  return label || normalized;
};

export const getCachedCountryCode = (): string | null => {
  return readCachedCountryCode();
};

