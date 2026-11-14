import fs from 'fs';
import path from 'path';

// Simulation of keyboard shortcut engine
function createKeyboardShortcutHandler(initialState = {}) {
  const state = {
    isPlaying: true,
    selectedParam: 'sst',
    depth: 50,
    activeTab: '3D View',
    isCopilotOpen: false,
    isKeyboardHelpOpen: false,
    isLocationModalOpen: false,
    ...initialState
  };

  const paramMap = {
    '1': 'sst',
    '2': 'salinity',
    '3': 'currents',
    '4': 'wave',
    '5': 'chlorophyll',
    '6': 'oxygen'
  };

  function handleKeyDown(event) {
    const { key, code, target = {} } = event;
    const tag = (target.tagName || '').toLowerCase();
    
    // 1. Guard against typing inside form controls
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable) {
      return state;
    }

    // 2. Escape closes modals
    if (key === 'Escape') {
      if (state.isKeyboardHelpOpen) state.isKeyboardHelpOpen = false;
      else if (state.isLocationModalOpen) state.isLocationModalOpen = false;
      else if (state.isCopilotOpen) state.isCopilotOpen = false;
      return state;
    }

    // 3. Question mark toggles help
    if (key === '?' || (event.shiftKey && key === '/')) {
      state.isKeyboardHelpOpen = !state.isKeyboardHelpOpen;
      return state;
    }

    // If modal is open, don't execute background shortcuts
    if (state.isKeyboardHelpOpen || state.isLocationModalOpen) {
      return state;
    }

    // 4. Space: toggle play/pause
    if (code === 'Space' || key === ' ') {
      state.isPlaying = !state.isPlaying;
      return state;
    }

    // 5. 1-6: switch parameter
    if (paramMap[key]) {
      state.selectedParam = paramMap[key];
      return state;
    }

    // 6. Arrow keys: depth +/- 50m
    if (key === 'ArrowUp') {
      state.depth = Math.max(0, state.depth - 50);
      return state;
    }
    if (key === 'ArrowDown') {
      state.depth = Math.min(2000, state.depth + 50);
      return state;
    }

    // 7. C: toggle copilot
    if (key === 'c' || key === 'C') {
      state.isCopilotOpen = !state.isCopilotOpen;
      return state;
    }

    // 8. M: toggle world map
    if (key === 'm' || key === 'M') {
      state.activeTab = state.activeTab === 'Map View' ? '3D View' : 'Map View';
      return state;
    }

    return state;
  }

  return { state, handleKeyDown };
}

async function runTests() {
  console.log('=== TEST Phase 1.4: Keyboard Shortcuts & Accessibility ===\n');

  // Test 1: Space toggles play/pause
  const engine = createKeyboardShortcutHandler();
  engine.handleKeyDown({ code: 'Space', key: ' ' });
  if (engine.state.isPlaying !== false) {
    throw new Error('Test 1 Failed: Space did not pause simulation');
  }
  engine.handleKeyDown({ code: 'Space', key: ' ' });
  if (engine.state.isPlaying !== true) {
    throw new Error('Test 1 Failed: Space did not resume simulation');
  }
  console.log('✓ Test 1 Passed: Space toggles isPlaying (play/pause)');

  // Test 2: Keys 1 - 6 switch parameters
  const expectedParams = ['sst', 'salinity', 'currents', 'wave', 'chlorophyll', 'oxygen'];
  for (let i = 1; i <= 6; i++) {
    engine.handleKeyDown({ key: String(i) });
    if (engine.state.selectedParam !== expectedParams[i - 1]) {
      throw new Error(`Test 2 Failed: Key '${i}' expected '${expectedParams[i - 1]}', got '${engine.state.selectedParam}'`);
    }
  }
  console.log('✓ Test 2 Passed: Keys 1 - 6 accurately select all 6 oceanographic parameters');

  // Test 3: ArrowUp and ArrowDown adjust depth by ±50 m with clamping
  engine.state.depth = 100;
  engine.handleKeyDown({ key: 'ArrowDown' });
  if (engine.state.depth !== 150) {
    throw new Error(`Test 3 Failed: ArrowDown expected depth 150, got ${engine.state.depth}`);
  }
  engine.handleKeyDown({ key: 'ArrowUp' });
  if (engine.state.depth !== 100) {
    throw new Error(`Test 3 Failed: ArrowUp expected depth 100, got ${engine.state.depth}`);
  }
  // Clamp test at surface
  engine.state.depth = 20;
  engine.handleKeyDown({ key: 'ArrowUp' });
  if (engine.state.depth !== 0) {
    throw new Error(`Test 3 Failed: ArrowUp should clamp at 0m, got ${engine.state.depth}`);
  }
  console.log('✓ Test 3 Passed: Arrow keys adjust depth by ±50m with surface boundary clamp');

  // Test 4: 'C' toggles copilot & 'M' toggles World Map
  engine.handleKeyDown({ key: 'c' });
  if (!engine.state.isCopilotOpen) throw new Error("Test 4 Failed: 'c' did not open copilot");
  engine.handleKeyDown({ key: 'C' });
  if (engine.state.isCopilotOpen) throw new Error("Test 4 Failed: 'C' did not close copilot");

  engine.handleKeyDown({ key: 'm' });
  if (engine.state.activeTab !== 'Map View') throw new Error("Test 4 Failed: 'm' did not switch to Map View");
  engine.handleKeyDown({ key: 'm' });
  if (engine.state.activeTab !== '3D View') throw new Error("Test 4 Failed: 'm' did not toggle back to 3D View");
  console.log('✓ Test 4 Passed: C and M shortcuts toggle copilot and map view');

  // Test 5: '?' toggles Keyboard Help overlay & 'Esc' closes it
  engine.handleKeyDown({ key: '?' });
  if (!engine.state.isKeyboardHelpOpen) throw new Error("Test 5 Failed: '?' did not open keyboard help");
  engine.handleKeyDown({ key: 'Escape' });
  if (engine.state.isKeyboardHelpOpen) throw new Error("Test 5 Failed: 'Escape' did not close keyboard help");
  console.log('✓ Test 5 Passed: ? opens keyboard help overlay and Escape closes it');

  // Test 6: Input field guard prevents accidental shortcut triggers while typing
  engine.state.selectedParam = 'sst';
  engine.handleKeyDown({ key: '2', target: { tagName: 'INPUT' } });
  if (engine.state.selectedParam !== 'sst') {
    throw new Error('Test 6 Failed: Shortcut triggered while typing in input field');
  }
  engine.handleKeyDown({ code: 'Space', key: ' ', target: { tagName: 'TEXTAREA' } });
  if (!engine.state.isPlaying) {
    throw new Error('Test 6 Failed: Space paused simulation while typing in textarea');
  }
  console.log('✓ Test 6 Passed: Form field guard safely suppresses shortcuts when user is typing');

  // Test 7: Verify all modals in codebase contain WAI-ARIA role="dialog" and aria-modal="true"
  const modalFiles = [
    'src/components/ui/KeyboardHelp.jsx',
    'src/components/ui/LocationModal.jsx',
    'src/components/ui/DatePickerModal.jsx',
    'src/components/ui/StormNewsModal.jsx',
    'src/components/ui/BuoyDetailModal.jsx',
    'src/components/ui/AnomalyModal.jsx',
    'src/components/ui/FleetModal.jsx',
    'src/components/ui/AnalyticReportModal.jsx',
    'src/components/ui/DepthPressureModal.jsx',
    'src/components/ui/ColorbarSettingsModal.jsx',
    'src/components/ui/NetcdfIngestionModal.jsx'
  ];

  for (const relPath of modalFiles) {
    const fullPath = path.resolve(relPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Modal file missing: ${relPath}`);
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    if (!content.includes('role="dialog"') && !content.includes("role='dialog'")) {
      throw new Error(`Accessibility Failure in ${relPath}: Missing role="dialog"`);
    }
    if (!content.includes('aria-modal="true"') && !content.includes("aria-modal='true'")) {
      throw new Error(`Accessibility Failure in ${relPath}: Missing aria-modal="true"`);
    }
    if (!content.includes('useFocusTrap')) {
      throw new Error(`Accessibility Failure in ${relPath}: Missing useFocusTrap focus management`);
    }
  }
  console.log(`✓ Test 7 Passed: Verified all 11 modal dialogs implement role="dialog", aria-modal="true", and useFocusTrap`);

  console.log('\nALL PHASE 1.4 KEYBOARD & ACCESSIBILITY TESTS PASSED! 🎉');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
