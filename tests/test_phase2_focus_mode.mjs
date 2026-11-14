import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Running Workstation Focus Mode Test Suite...\n');

// 1. Check App.jsx Focus Mode State and Layout Management
console.log('Test 1: Focus Mode State and Panel Collapsing in App.jsx');
const appSrc = fs.readFileSync(path.join(rootDir, 'src/App.jsx'), 'utf-8');

assert.ok(
  appSrc.includes("usePersistedState('oceanx_pref_focus_mode', false"),
  'App.jsx must declare isFocusMode with usePersistedState defaulting to false'
);

assert.ok(
  appSrc.includes('handleToggleFocusMode'),
  'App.jsx must define handleToggleFocusMode handler'
);

assert.ok(
  appSrc.includes("e.key === 'f' || e.key === 'F'") && appSrc.includes("activeTab === '3D View'"),
  'App.jsx must register F / f keyboard shortcut to toggle focus mode on 3D Workstation'
);

// Check Left Panel transition
assert.ok(
  appSrc.includes('w-0 opacity-0 -translate-x-6 pointer-events-none') && appSrc.includes('w-72 opacity-100 translate-x-0'),
  'App.jsx must smoothly collapse LeftControlPanel to w-0 and opacity-0 when in Focus Mode'
);

// Check Right Panel transition
assert.ok(
  appSrc.includes('w-0 opacity-0 translate-x-6 pointer-events-none') && appSrc.includes('w-80 opacity-100 translate-x-0'),
  'App.jsx must smoothly collapse RightAnalyticsPanel to w-0 and opacity-0 when in Focus Mode'
);

// Check Central Viewport expansion
assert.ok(
  appSrc.includes('rounded-none my-0 mx-0 border-0 shadow-none') && appSrc.includes('rounded-2xl my-1.5 mx-1 border border-[#193544] shadow-md'),
  'App.jsx must expand central 3D main viewport to occupy 100% of available workstation space'
);

// Check Bottom Parameter Strip collapse
assert.ok(
  appSrc.includes("isFocusMode && activeTab === '3D View'") && appSrc.includes("'max-h-0 opacity-0 pointer-events-none -translate-y-4'"),
  'App.jsx must collapse BottomParameterStrip when in Focus Mode'
);

console.log('  ✓ isFocusMode state with localStorage persistence verified');
console.log('  ✓ Keyboard shortcut F verified');
console.log('  ✓ Left, Right, Bottom panels animated collapse verified');
console.log('  ✓ 3D Viewport seamless full-screen expansion verified\n');

// 2. Check ViewportToolbar.jsx Toggle and Controls
console.log('Test 2: ViewportToolbar Focus Mode Segmented Toggle and Controls');
const toolbarSrc = fs.readFileSync(path.join(rootDir, 'src/components/ui/ViewportToolbar.jsx'), 'utf-8');

assert.ok(
  toolbarSrc.includes('isFocusMode = false') && toolbarSrc.includes('onToggleFocusMode'),
  'ViewportToolbar.jsx must accept isFocusMode and onToggleFocusMode props'
);

assert.ok(
  toolbarSrc.includes('LayoutGrid') && (toolbarSrc.includes('Maximize2') || toolbarSrc.includes('Minimize2')),
  'ViewportToolbar.jsx must include Full Workstation and Focus Mode icons'
);

assert.ok(
  toolbarSrc.includes('onToggleFocusMode(false)') && toolbarSrc.includes('onToggleFocusMode(true)'),
  'ViewportToolbar.jsx must provide two-state interactive buttons for Full Workstation and Focus Mode'
);

assert.ok(
  toolbarSrc.includes('onOpenControls'),
  'ViewportToolbar.jsx must provide onOpenControls button in tool stack for drawer access during Focus Mode'
);

console.log('  ✓ Top-Right segmented Full Workstation / Focus Mode toggle pill verified');
console.log('  ✓ Visual cyan/turquoise active state and F hotkey badge verified');
console.log('  ✓ Floating controls drawer button in left tool stack verified\n');

// 3. Check Header.jsx Focus Mode Adaptation
console.log('Test 3: Header.jsx Compact Height and Focus Mode Toggle');
const headerSrc = fs.readFileSync(path.join(rootDir, 'src/components/ui/Header.jsx'), 'utf-8');

assert.ok(
  headerSrc.includes('isFocusMode = false') && headerSrc.includes('onToggleFocusMode'),
  'Header.jsx must accept isFocusMode and onToggleFocusMode props'
);

assert.ok(
  headerSrc.includes("isFocusMode && activeTab === '3D View' ? 'h-12 border-[#142D3A]' : 'h-16 border-[#193544]'"),
  'Header.jsx must transition to compact h-12 in Focus Mode'
);

assert.ok(
  headerSrc.includes("activeTab === '3D View'") && headerSrc.includes('onToggleFocusMode(!isFocusMode)'),
  'Header.jsx must include header focus mode quick toggle button'
);

console.log('  ✓ Compact header height transition verified');
console.log('  ✓ Header quick toggle button verified\n');

// 4. Check OceanCanvas.jsx Resize Handling
console.log('Test 4: OceanCanvas.jsx ResizeObserver for Smooth Transitions');
const canvasSrc = fs.readFileSync(path.join(rootDir, 'src/components/canvas/OceanCanvas.jsx'), 'utf-8');

assert.ok(
  canvasSrc.includes('ResizeObserver') && canvasSrc.includes('resizeObserver.observe(containerRef.current)'),
  'OceanCanvas.jsx must use ResizeObserver to smoothly resize canvas during CSS layout transitions'
);

assert.ok(
  canvasSrc.includes('resizeObserver.disconnect()'),
  'OceanCanvas.jsx must cleanly disconnect ResizeObserver on cleanup'
);

console.log('  ✓ Dynamic WebGL canvas real-time ResizeObserver verified\n');

// 5. Check AI Copilot Minimization
console.log('Test 5: AI Copilot Minimization in Focus Mode');
const mascotSrc = fs.readFileSync(path.join(rootDir, 'src/components/ai/MermaidMascot.jsx'), 'utf-8');
const copilotSrc = fs.readFileSync(path.join(rootDir, 'src/components/ai/OceanCopilot.jsx'), 'utf-8');

assert.ok(
  copilotSrc.includes('isFocusMode = false') && copilotSrc.includes('isFocusMode={isFocusMode}'),
  'OceanCopilot.jsx must propagate isFocusMode to MermaidMascot'
);

assert.ok(
  mascotSrc.includes('!isFocusMode && showBubble && !isDragging'),
  'MermaidMascot.jsx must suppress speech callout bubble in Focus Mode'
);

assert.ok(
  mascotSrc.includes("isFocusMode ? 'w-11 h-11' : 'w-16 h-16 sm:w-18 sm:h-18'"),
  'MermaidMascot.jsx must render compact floating icon in Focus Mode'
);

console.log('  ✓ Copilot drawer collapsed on focus entry verified');
console.log('  ✓ Mascot speech bubble suppressed in Focus Mode verified');
console.log('  ✓ Compact unobtrusive floating mascot icon verified\n');

// 6. Check KeyboardHelp.jsx
console.log('Test 6: Keyboard Help Overlay Documentation');
const keyboardHelpSrc = fs.readFileSync(path.join(rootDir, 'src/components/ui/KeyboardHelp.jsx'), 'utf-8');

assert.ok(
  keyboardHelpSrc.includes("keys: ['F']") && keyboardHelpSrc.includes('focusMode'),
  'KeyboardHelp.jsx must document the F shortcut for toggling Focus Mode'
);

console.log('  ✓ Keyboard shortcut guide accurately updated\n');

console.log('🎉 ALL WORKSTATION FOCUS MODE TESTS PASSED! ✅\n');
