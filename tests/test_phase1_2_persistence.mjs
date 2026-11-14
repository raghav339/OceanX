import { getPersistedValue, setPersistedValue, removePersistedValue } from '../src/hooks/usePersistedState.js';
import { REGIONS, createLocationData } from '../src/data/oceanData.js';
import { getFormattedCurrentDate } from '../src/utils/dateUtils.js';

// Setup mock window.localStorage for Node environment
const mockStorage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => mockStorage.has(key) ? mockStorage.get(key) : null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key),
    clear: () => mockStorage.clear()
  }
};

async function runTests() {
  console.log('=== TEST Phase 1.2: Persistent User Preferences (localStorage) ===\n');

  // Test 1: getPersistedValue returns fallback when missing
  const defaultParam = getPersistedValue('test_missing_key', 'sst');
  if (defaultParam !== 'sst') {
    throw new Error('Test 1 Failed: Missing key did not return fallback value');
  }
  console.log('✓ Test 1 Passed: Safely returns default fallback on missing key');

  // Test 2: setPersistedValue & getPersistedValue round-trip
  setPersistedValue('oceanx_pref_param', 'salinity');
  const storedParam = getPersistedValue('oceanx_pref_param', 'sst');
  if (storedParam !== 'salinity') {
    throw new Error(`Test 2 Failed: Expected 'salinity', got '${storedParam}'`);
  }
  console.log('✓ Test 2 Passed: setPersistedValue / getPersistedValue round-trip succeeded');

  // Test 3: Numeric depth persistence & validation
  setPersistedValue('oceanx_pref_depth', 250);
  const storedDepth = getPersistedValue('oceanx_pref_depth', 50, (v) => typeof v === 'number' && v >= 0 && v <= 6000);
  if (storedDepth !== 250) {
    throw new Error(`Test 3 Failed: Expected depth 250, got ${storedDepth}`);
  }

  // Corrupted depth value should trigger validator fallback
  setPersistedValue('oceanx_pref_depth', -999);
  const validatedDepth = getPersistedValue('oceanx_pref_depth', 50, (v) => typeof v === 'number' && v >= 0 && v <= 6000);
  if (validatedDepth !== 50) {
    throw new Error(`Test 3.1 Failed: Validator should have rejected -999 and returned 50, got ${validatedDepth}`);
  }
  console.log('✓ Test 3 Passed: Number persistence & depth bounds validation work accurately');

  // Test 4: Palette persistence
  setPersistedValue('oceanx_pref_palette', 'viridis');
  const storedPalette = getPersistedValue('oceanx_pref_palette', 'turbo', (v) => typeof v === 'string' && v.length > 0);
  if (storedPalette !== 'viridis') {
    throw new Error(`Test 4 Failed: Expected 'viridis', got '${storedPalette}'`);
  }
  console.log('✓ Test 4 Passed: Color palette persistence verified');

  // Test 5: Sim speed persistence
  setPersistedValue('oceanx_pref_sim_speed', 2);
  const storedSpeed = getPersistedValue('oceanx_pref_sim_speed', 1, (v) => typeof v === 'number' && v > 0);
  if (storedSpeed !== 2) {
    throw new Error(`Test 5 Failed: Expected simSpeed 2, got ${storedSpeed}`);
  }
  console.log('✓ Test 5 Passed: Simulation speed persistence verified');

  // Test 6: Malformed JSON recovery
  window.localStorage.setItem('oceanx_corrupt_key', '{not_json:::');
  const safeRecovered = getPersistedValue('oceanx_corrupt_key', 'safe_fallback');
  if (safeRecovered !== 'safe_fallback') {
    throw new Error('Test 6 Failed: Failed to gracefully recover from malformed JSON');
  }
  console.log('✓ Test 6 Passed: Malformed JSON handled gracefully without crashing');

  // Test 7: Region rehydration (predefined ID)
  setPersistedValue('oceanx_pref_region', 'arabian_sea');
  const savedRegionId = getPersistedValue('oceanx_pref_region', 'bay_of_bengal');
  const rehydratedPredefined = REGIONS[savedRegionId] || REGIONS.bay_of_bengal;
  if (rehydratedPredefined.id !== 'arabian_sea' || rehydratedPredefined.name !== 'Arabian Sea') {
    throw new Error(`Test 7 Failed: Expected 'arabian_sea', got ${rehydratedPredefined?.id}`);
  }
  console.log('✓ Test 7 Passed: Predefined region rehydration verified for Arabian Sea');

  // Test 8: Region rehydration (custom coordinates)
  const customCoordObj = { id: 'custom', lat: 10.5, lon: 74.8, name: 'Lakshadweep Basin' };
  setPersistedValue('oceanx_pref_region', customCoordObj);
  const savedCustom = getPersistedValue('oceanx_pref_region', 'bay_of_bengal');
  let rehydratedCustom;
  if (typeof savedCustom === 'object' && savedCustom.lat && savedCustom.lon) {
    rehydratedCustom = createLocationData(savedCustom.lat, savedCustom.lon, savedCustom.name, getFormattedCurrentDate());
  }
  if (!rehydratedCustom || Math.abs(rehydratedCustom.lat - 10.5) > 0.01) {
    throw new Error('Test 8 Failed: Custom coordinates region rehydration failed');
  }
  console.log(`✓ Test 8 Passed: Custom coordinates region rehydration verified (${rehydratedCustom.name} @ ${rehydratedCustom.lat}, ${rehydratedCustom.lon})`);

  // Test 9: removePersistedValue removes key
  removePersistedValue('oceanx_pref_param');
  const afterRemove = getPersistedValue('oceanx_pref_param', 'default_sst');
  if (afterRemove !== 'default_sst') {
    throw new Error('Test 9 Failed: Key was not removed');
  }
  console.log('✓ Test 9 Passed: removePersistedValue cleanly clears preference from storage');

  console.log('\nALL PHASE 1.2 PREFERENCE PERSISTENCE TESTS PASSED! 🎉');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
