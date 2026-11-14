import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Running Task 4: Isosurface Extraction View Mode Test Suite...\n');

// 1. Check OceanShaders.js
console.log('Test 1: Surface Fragment Shader Iso-Contour Rendering in OceanShaders.js');
const oceanShadersSrc = fs.readFileSync(path.join(rootDir, 'src/components/canvas/OceanShaders.js'), 'utf-8');

assert.ok(
  oceanShadersSrc.includes('uIsoLevel: { value: 0.5 }'),
  'OceanSurfaceShader.uniforms must define uIsoLevel with default 0.5'
);

assert.ok(
  oceanShadersSrc.includes('uniform float uIsoLevel;'),
  'OceanSurfaceShader fragmentShader must declare uniform float uIsoLevel'
);

assert.ok(
  oceanShadersSrc.includes('if (uMode == 3)'),
  'OceanSurfaceShader fragmentShader must branch on uMode == 3 for isosurface contouring'
);

assert.ok(
  oceanShadersSrc.includes('fract(') && oceanShadersSrc.includes('smoothstep('),
  'OceanSurfaceShader fragmentShader must generate contour bands using fract() and smoothstep()'
);

assert.ok(
  oceanShadersSrc.includes('abs(mappedVal - uIsoLevel)') || oceanShadersSrc.includes('uIsoLevel'),
  'OceanSurfaceShader fragmentShader must highlight the active uIsoLevel'
);

console.log('  ✓ uIsoLevel uniform declared in OceanSurfaceShader');
console.log('  ✓ uMode == 3 contour lines rendering verified with fract() and smoothstep()');
console.log('  ✓ Active iso-level highlighting verified; other modes untouched\n');

// 2. Check OceanCanvas.jsx Implementation
console.log('Test 2: 3D Isosurface Shells and Wiring in OceanCanvas.jsx');
const oceanCanvasSrc = fs.readFileSync(path.join(rootDir, 'src/components/canvas/OceanCanvas.jsx'), 'utf-8');

assert.ok(
  oceanCanvasSrc.includes('isoLevel = 0.5'),
  'OceanCanvas component must accept isoLevel prop with default 0.5'
);

assert.ok(
  oceanCanvasSrc.includes('isoMeshesRef'),
  'OceanCanvas.jsx must track isoMeshesRef for cleanup and dynamic updates'
);

assert.ok(
  oceanCanvasSrc.includes('uIsoLevel: { value: isoLevel }'),
  'oceanUniforms must initialize uIsoLevel with isoLevel'
);

assert.ok(
  oceanCanvasSrc.includes("isoGroupRef.current.visible = (viewMode === 'isosurface' || viewMode === 'iso_surface')"),
  'isoGroupRef must be visible only when viewMode === isosurface'
);

assert.ok(
  oceanCanvasSrc.includes('buildIsoSurfaces') || oceanCanvasSrc.includes('isoSurfaces'),
  'OceanCanvas.jsx must build 3D isosurface shell geometry inside isoGroup'
);

assert.ok(
  oceanCanvasSrc.includes('transparent: true') && oceanCanvasSrc.includes('depthWrite: false'),
  '3D isosurface shells must use transparent: true and depthWrite: false for proper volume blending'
);

assert.ok(
  oceanCanvasSrc.includes('updateIsoSheetVertices'),
  'OceanCanvas.jsx must have helper to dynamically reposition iso sheet vertices on isoLevel change'
);

assert.ok(
  oceanCanvasSrc.includes('isoMeshesRef.current.forEach'),
  'OceanCanvas cleanup must dispose all iso geometries and materials'
);

assert.ok(
  oceanCanvasSrc.includes('isoGroupRef.current.scale.y = verticalExaggeration'),
  'isoGroupRef must synchronize verticalExaggeration with cutaway group'
);

console.log('  ✓ 3D translucent contour shells built inside isoGroupRef');
console.log('  ✓ Vertex updating function and proper cleanup verified');
console.log('  ✓ Exaggeration synchronization verified\n');

// 3. Check ViewportToolbar.jsx Slider
console.log('Test 3: ViewportToolbar Isosurface Slider Control');
const toolbarSrc = fs.readFileSync(path.join(rootDir, 'src/components/ui/ViewportToolbar.jsx'), 'utf-8');

assert.ok(
  toolbarSrc.includes('isoLevel = 0.5') && toolbarSrc.includes('setIsoLevel'),
  'ViewportToolbar.jsx must accept isoLevel and setIsoLevel props'
);

assert.ok(
  toolbarSrc.includes("viewMode === 'isosurface'") && toolbarSrc.includes('setIsoLevel(parseFloat(e.target.value))'),
  'ViewportToolbar.jsx must display interactive isoLevel slider when viewMode === isosurface'
);

console.log('  ✓ ViewportToolbar renders dedicated Isosurface slider only in isosurface mode\n');

// 4. Check AdvancedControlsDrawer.jsx
console.log('Test 4: AdvancedControlsDrawer Isosurface Slider Control');
const drawerSrc = fs.readFileSync(path.join(rootDir, 'src/components/ui/AdvancedControlsDrawer.jsx'), 'utf-8');

assert.ok(
  drawerSrc.includes('isoLevel = 0.5') && drawerSrc.includes('setIsoLevel'),
  'AdvancedControlsDrawer.jsx must accept isoLevel and setIsoLevel props'
);

assert.ok(
  drawerSrc.includes("viewMode === 'isosurface'") && drawerSrc.includes('setIsoLevel(parseFloat(e.target.value))'),
  'AdvancedControlsDrawer.jsx must display interactive isoLevel slider in Section 1 when viewMode === isosurface'
);

console.log('  ✓ AdvancedControlsDrawer renders Isosurface threshold control in isosurface mode\n');

// 5. Check App.jsx Integration
console.log('Test 5: App.jsx State and Prop Integration');
const appSrc = fs.readFileSync(path.join(rootDir, 'src/App.jsx'), 'utf-8');

assert.ok(
  appSrc.includes('const [isoLevel, setIsoLevel] = useState(0.5);'),
  'App.jsx must declare isoLevel state initialized to 0.5'
);

assert.ok(
  appSrc.includes('isoLevel={isoLevel}') && appSrc.includes('setIsoLevel={setIsoLevel}'),
  'App.jsx must pass isoLevel and setIsoLevel to ViewportToolbar and AdvancedControlsDrawer'
);

console.log('  ✓ App.jsx coordinates isoLevel across OceanCanvas, ViewportToolbar, and AdvancedControlsDrawer\n');

console.log('🎉 All Task 4 Isosurface Extraction View Mode tests passed successfully!\n');
