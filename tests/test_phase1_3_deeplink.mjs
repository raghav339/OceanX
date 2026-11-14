import { encodeUrlHash, parseUrlState, getShareableUrl, updateUrlHash } from '../src/utils/deepLink.js';

// Setup mock window & location
globalThis.window = {
  location: {
    origin: 'http://localhost:5173',
    pathname: '/',
    search: '',
    hash: '',
    get href() {
      return `${this.origin}${this.pathname}${this.search}${this.hash}`;
    }
  },
  history: {
    replaceState: (_state, _title, url) => {
      if (url.includes('#')) {
        const [pathAndSearch, hash] = url.split('#');
        window.location.hash = `#${hash}`;
        if (pathAndSearch.includes('?')) {
          const [, search] = pathAndSearch.split('?');
          window.location.search = `?${search}`;
        }
      } else if (url.includes('?')) {
        const [, search] = url.split('?');
        window.location.search = `?${search}`;
        window.location.hash = '';
      }
    }
  }
};

async function runTests() {
  console.log('=== TEST Phase 1.3: Shareable URL Deep-Links ===\n');

  // Test 1: encodeUrlHash produces standard hash query string
  const state = {
    region: 'bay_of_bengal',
    param: 'sst',
    depth: 100,
    tab: '3D View'
  };
  const encodedHash = encodeUrlHash(state);
  console.log('Generated hash:', encodedHash);

  if (encodedHash !== '#?region=bay_of_bengal&param=sst&depth=100&tab=3D+View') {
    throw new Error(`Test 1 Failed: Expected '#?region=bay_of_bengal&param=sst&depth=100&tab=3D+View', got '${encodedHash}'`);
  }
  console.log('✓ Test 1 Passed: encodeUrlHash accurately formatted #?region=...&param=...&depth=...&tab=...');

  // Test 2: parseUrlState parses hash with #?
  window.location.hash = '#?region=bay_of_bengal&param=sst&depth=100&tab=3D+View';
  window.location.search = '';
  const parsed = parseUrlState();
  if (!parsed || parsed.region !== 'bay_of_bengal' || parsed.param !== 'sst' || parsed.depth !== 100 || parsed.tab !== '3D View') {
    throw new Error(`Test 2 Failed: Parsed state does not match input: ${JSON.stringify(parsed)}`);
  }
  console.log('✓ Test 2 Passed: parseUrlState accurately decodes hash query parameters:', parsed);

  // Test 3: parseUrlState handles # without ? and space-separated tabs
  window.location.hash = '#region=arabian_sea&param=salinity&depth=250&tab=Map+View';
  const parsedArabian = parseUrlState();
  if (parsedArabian?.region !== 'arabian_sea' || parsedArabian?.param !== 'salinity' || parsedArabian?.depth !== 250 || parsedArabian?.tab !== 'Map View') {
    throw new Error(`Test 3 Failed: ${JSON.stringify(parsedArabian)}`);
  }
  console.log('✓ Test 3 Passed: parseUrlState decodes direct hash format (#region=...)');

  // Test 4: Validation against invalid or malicious parameters
  window.location.hash = '#?region=bay_of_bengal&param=invalid_param&depth=-999&tab=InvalidTab';
  const parsedInvalid = parseUrlState();
  if (parsedInvalid.param !== undefined) {
    throw new Error('Test 4 Failed: Invalid param was not discarded');
  }
  if (parsedInvalid.depth !== undefined) {
    throw new Error('Test 4 Failed: Negative depth was not discarded');
  }
  if (parsedInvalid.tab !== undefined) {
    throw new Error('Test 4 Failed: Invalid tab was not discarded');
  }
  console.log('✓ Test 4 Passed: Input validation filters out unsupported parameters, out-of-bounds depths, and invalid tabs');

  // Test 5: getShareableUrl returns full share link
  const shareUrl = getShareableUrl({
    region: 'equatorial_pacific',
    param: 'chlorophyll',
    depth: 35,
    tab: '3D View'
  });
  if (!shareUrl.startsWith('http://localhost:5173/?region=equatorial_pacific') && !shareUrl.startsWith('http://localhost:5173/#?region=equatorial_pacific')) {
    throw new Error(`Test 5 Failed: Expected share URL with origin and path, got: ${shareUrl}`);
  }
  console.log('✓ Test 5 Passed: getShareableUrl generates complete link:', shareUrl);

  // Test 6: updateUrlHash calls history.replaceState safely
  updateUrlHash({
    region: 'indian_ocean',
    param: 'wave',
    depth: 0,
    tab: 'Dashboard'
  });
  if (!window.location.hash.includes('region=indian_ocean') || !window.location.hash.includes('tab=Dashboard')) {
    throw new Error(`Test 6 Failed: window.location.hash was not updated: ${window.location.hash}`);
  }
  console.log('✓ Test 6 Passed: updateUrlHash synchronizes location hash via replaceState:', window.location.hash);

  console.log('\nALL PHASE 1.3 DEEP-LINK TESTS PASSED! 🎉');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
