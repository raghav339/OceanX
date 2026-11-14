import { useState, useEffect, useCallback } from 'react';

/**
 * Safely retrieve a value from localStorage with fallback and validation.
 * 
 * @template T
 * @param {string} key - localStorage key
 * @param {T | (() => T)} defaultValue - Fallback default value
 * @param {((val: any) => boolean) | null} [validator] - Validation function
 * @returns {T}
 */
export function getPersistedValue(key, defaultValue, validator = null) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null || raw === undefined) {
      return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    }
    const parsed = JSON.parse(raw);
    if (validator && typeof validator === 'function' && !validator(parsed)) {
      console.warn(`[usePersistedState] Invalid persisted value for "${key}", resetting to default:`, parsed);
      return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    }
    return parsed;
  } catch (err) {
    console.warn(`[usePersistedState] Failed to read key "${key}" from localStorage:`, err);
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
  }
}

/**
 * Safely set a value in localStorage.
 * 
 * @param {string} key 
 * @param {any} value 
 */
export function setPersistedValue(key, value) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[usePersistedState] Failed to set key "${key}" in localStorage:`, err);
  }
}

/**
 * Safely remove a value from localStorage.
 * 
 * @param {string} key 
 */
export function removePersistedValue(key) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[usePersistedState] Failed to remove key "${key}" from localStorage:`, err);
  }
}

/**
 * Custom React hook to synchronize state with localStorage.
 * Automatically rehydrates on mount and persists on change.
 * Supports cross-tab storage event synchronization.
 * 
 * @template T
 * @param {string} key - localStorage key
 * @param {T | (() => T)} defaultValue - Default fallback value
 * @param {{
 *   validator?: (val: any) => boolean,
 *   syncAcrossTabs?: boolean
 * }} [options]
 * @returns {[T, (val: T | ((prev: T) => T)) => void, () => void]} [state, setState, clearState]
 */
export function usePersistedState(key, defaultValue, options = {}) {
  const { validator, syncAcrossTabs = true } = options;

  const [state, setState] = useState(() => getPersistedValue(key, defaultValue, validator));

  // Sync state to localStorage on state changes
  useEffect(() => {
    setPersistedValue(key, state);
  }, [key, state]);

  // Sync across browser tabs when storage event fires
  useEffect(() => {
    if (!syncAcrossTabs || typeof window === 'undefined') return;

    const handleStorageChange = (e) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (!validator || validator(parsed)) {
            setState(parsed);
          }
        } catch {
          // ignore corrupted cross-tab storage payload
        }
      } else if (e.key === key && e.newValue === null) {
        setState(typeof defaultValue === 'function' ? defaultValue() : defaultValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, defaultValue, validator, syncAcrossTabs]);

  const clear = useCallback(() => {
    removePersistedValue(key);
    setState(typeof defaultValue === 'function' ? defaultValue() : defaultValue);
  }, [key, defaultValue]);

  return [state, setState, clear];
}

export default usePersistedState;
