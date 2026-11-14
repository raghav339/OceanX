/**
 * Ocean Vision 3D Deep Linking & Shareable URL Module
 * Encodes and decodes state into URL hash: #?region=...&param=...&depth=...&tab=...
 */

export const VALID_PARAMS = ['sst', 'salinity', 'currents', 'wave', 'chlorophyll', 'oxygen'];

export const VALID_TABS = [
  'Story View',
  '3D View',
  'Dashboard',
  'Map View',
  'El Niño Simulation',
  'Data Explorer',
  'About'
];

/**
 * Extracts and decodes URL search/hash parameters safely.
 * Supports:
 * - #?region=bay_of_bengal&param=sst&depth=100&tab=3D+View
 * - #region=bay_of_bengal&param=sst&depth=100&tab=3D+View
 * - ?region=bay_of_bengal&param=sst&depth=100&tab=3D+View
 * 
 * @returns {{
 *   region?: string,
 *   param?: string,
 *   depth?: number,
 *   tab?: string
 * } | null}
 */
export function parseUrlState() {
  if (typeof window === 'undefined') return null;

  try {
    let rawQuery = '';
    const hash = window.location.hash || '';
    const search = window.location.search || '';

    if (hash.startsWith('#?')) {
      rawQuery = hash.slice(2);
    } else if (hash.startsWith('#')) {
      rawQuery = hash.slice(1);
    } else if (search.startsWith('?')) {
      rawQuery = search.slice(1);
    }

    if (!rawQuery && search.startsWith('?')) {
      rawQuery = search.slice(1);
    }

    if (!rawQuery) return null;

    const params = new URLSearchParams(rawQuery);
    const result = {};

    const region = params.get('region');
    if (region && region.trim()) {
      result.region = region.trim();
    }

    const param = params.get('param');
    if (param && VALID_PARAMS.includes(param)) {
      result.param = param;
    }

    const depthStr = params.get('depth');
    if (depthStr !== null && depthStr !== '') {
      const parsedDepth = parseFloat(depthStr);
      if (!isNaN(parsedDepth) && parsedDepth >= 0 && parsedDepth <= 6000) {
        result.depth = parsedDepth;
      }
    }

    const tab = params.get('tab');
    if (tab && VALID_TABS.includes(tab)) {
      result.tab = tab;
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (err) {
    console.warn('[deepLink] Failed to parse URL state:', err);
    return null;
  }
}

/**
 * Encodes application state into a standard URL hash string.
 * Format: #?region=bay_of_bengal&param=sst&depth=100&tab=3D+View
 * 
 * @param {{
 *   region?: string,
 *   param?: string,
 *   depth?: number,
 *   tab?: string
 * }} state
 * @returns {string}
 */
export function encodeUrlHash(state = {}) {
  const params = new URLSearchParams();

  if (state.region) params.set('region', state.region);
  if (state.param) params.set('param', state.param);
  if (state.depth !== undefined && state.depth !== null && !isNaN(state.depth)) {
    params.set('depth', state.depth);
  }
  if (state.tab) params.set('tab', state.tab);

  const queryStr = params.toString();
  return queryStr ? `#?${queryStr}` : '';
}

/**
 * Synchronizes the browser address bar with current state without reloading or pushing new history.
 * 
 * @param {{
 *   region?: string,
 *   param?: string,
 *   depth?: number,
 *   tab?: string
 * }} state
 */
export function updateUrlHash(state = {}) {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  try {
    const hash = encodeUrlHash(state);
    const newUrl = `${window.location.pathname}${window.location.search}${hash}`;
    window.history.replaceState(null, '', newUrl);
  } catch (err) {
    console.warn('[deepLink] Failed to update URL hash:', err);
  }
}

/**
 * Builds the full absolute URL for sharing.
 * 
 * @param {{
 *   region?: string,
 *   param?: string,
 *   depth?: number,
 *   tab?: string
 * }} state
 * @returns {string}
 */
export function getShareableUrl(state = {}) {
  if (typeof window === 'undefined') return '';
  const hash = encodeUrlHash(state);
  return `${window.location.origin}${window.location.pathname}${hash}`;
}
