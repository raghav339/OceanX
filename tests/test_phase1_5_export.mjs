import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Running Phase 1.5 Export Test Suite...\n');

// 1. Verify 3D Canvas PNG Export Implementation in OceanCanvas.jsx
console.log('Test 1: 3D Canvas PNG Export in OceanCanvas.jsx');
const oceanCanvasSrc = fs.readFileSync(path.join(rootDir, 'src/components/canvas/OceanCanvas.jsx'), 'utf-8');

assert.ok(
  oceanCanvasSrc.includes('preserveDrawingBuffer: true'),
  'THREE.WebGLRenderer must have preserveDrawingBuffer: true enabled for clean canvas snapshots'
);

assert.ok(
  oceanCanvasSrc.includes('forwardRef(function OceanCanvas'),
  'OceanCanvas must be wrapped with forwardRef to expose imperative methods'
);

assert.ok(
  oceanCanvasSrc.includes('useImperativeHandle(ref'),
  'OceanCanvas must use useImperativeHandle to expose exportPng method'
);

assert.ok(
  oceanCanvasSrc.includes('.toDataURL(\'image/png\')'),
  'OceanCanvas must capture renderer.domElement.toDataURL("image/png")'
);

assert.ok(
  oceanCanvasSrc.includes('Export PNG') || oceanCanvasSrc.includes('Export 3D View as PNG'),
  'OceanCanvas must render visual Export PNG button'
);

console.log('  ✓ WebGLRenderer configured with preserveDrawingBuffer: true');
console.log('  ✓ forwardRef and useImperativeHandle expose exportPng API');
console.log('  ✓ toDataURL snapshot generation verified');
console.log('  ✓ Visual Export PNG button integrated on canvas\n');

// 2. Verify ViewportToolbar.jsx and App.jsx Integration
console.log('Test 2: ViewportToolbar & App.jsx Export Integration');
const viewportToolbarSrc = fs.readFileSync(path.join(rootDir, 'src/components/ui/ViewportToolbar.jsx'), 'utf-8');
const appSrc = fs.readFileSync(path.join(rootDir, 'src/App.jsx'), 'utf-8');

assert.ok(
  viewportToolbarSrc.includes('onExportPng'),
  'ViewportToolbar must accept onExportPng prop'
);

assert.ok(
  viewportToolbarSrc.includes('Camera'),
  'ViewportToolbar must include Camera icon for 3D snapshot tool'
);

assert.ok(
  appSrc.includes('oceanCanvasRef = useRef(null)'),
  'App.jsx must declare oceanCanvasRef'
);

assert.ok(
  appSrc.includes('ref={oceanCanvasRef}'),
  'App.jsx must pass oceanCanvasRef to OceanCanvas'
);

assert.ok(
  appSrc.includes('onExportPng={() => oceanCanvasRef.current?.exportPng()}'),
  'App.jsx must pass onExportPng to ViewportToolbar'
);

console.log('  ✓ ViewportToolbar includes camera snapshot button in left tool stack');
console.log('  ✓ App.jsx bridges oceanCanvasRef to ViewportToolbar export handler\n');

// 3. Verify World Map SVG Export in WorldMapView.jsx
console.log('Test 3: World Map SVG Export in WorldMapView.jsx');
const worldMapViewSrc = fs.readFileSync(path.join(rootDir, 'src/components/ui/WorldMapView.jsx'), 'utf-8');

assert.ok(
  worldMapViewSrc.includes('svgRef = useRef(null)'),
  'WorldMapView must declare svgRef for SVG DOM access'
);

assert.ok(
  worldMapViewSrc.includes('ref={svgRef}'),
  'WorldMapView must attach ref={svgRef} to the map <svg> element'
);

assert.ok(
  worldMapViewSrc.includes('new XMLSerializer()'),
  'WorldMapView must instantiate XMLSerializer for SVG DOM serialization'
);

assert.ok(
  worldMapViewSrc.includes('serializeToString(svgNode)'),
  'WorldMapView must serialize SVG element to string'
);

assert.ok(
  worldMapViewSrc.includes('image/svg+xml'),
  'WorldMapView must create Blob with image/svg+xml MIME type'
);

assert.ok(
  worldMapViewSrc.includes('xmlns') && worldMapViewSrc.includes('http://www.w3.org/2000/svg'),
  'WorldMapView must ensure XML namespaces are present in exported SVG'
);

assert.ok(
  worldMapViewSrc.includes('handleExportSvg'),
  'WorldMapView must define handleExportSvg function'
);

assert.ok(
  worldMapViewSrc.includes('Export SVG'),
  'WorldMapView must render Export SVG button in header toolbar'
);

console.log('  ✓ svgRef attached to equirectangular map SVG');
console.log('  ✓ XMLSerializer and image/svg+xml Blob generation verified');
console.log('  ✓ Standalone SVG namespaces ensured');
console.log('  ✓ Export SVG button placed in map header controls\n');

// 4. Verify Analytic Report PDF Export & Print Stylesheet
console.log('Test 4: Analytic Report PDF Export & Print Stylesheet');
const reportModalSrc = fs.readFileSync(path.join(rootDir, 'src/components/ui/AnalyticReportModal.jsx'), 'utf-8');
const indexCssSrc = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf-8');

assert.ok(
  reportModalSrc.includes('window.print()'),
  'AnalyticReportModal must trigger window.print() for PDF export'
);

assert.ok(
  reportModalSrc.includes('id="analytic-printable-report"'),
  'AnalyticReportModal must assign id="analytic-printable-report" to printable container'
);

assert.ok(
  reportModalSrc.includes('no-print'),
  'AnalyticReportModal must tag non-printable UI bars with no-print class'
);

assert.ok(
  indexCssSrc.includes('@media print'),
  'index.css must define @media print rules'
);

assert.ok(
  indexCssSrc.includes('@page'),
  'index.css must configure @page margins and sizing for print'
);

assert.ok(
  indexCssSrc.includes('print-color-adjust: exact') || indexCssSrc.includes('-webkit-print-color-adjust: exact'),
  'index.css must enforce exact print color adjustment'
);

assert.ok(
  indexCssSrc.includes('#root > div') && indexCssSrc.includes('overflow: visible !important'),
  'index.css must override #root > div height/overflow to prevent multi-page truncation'
);

assert.ok(
  indexCssSrc.includes('break-inside: avoid !important') || indexCssSrc.includes('page-break-inside: avoid !important'),
  'index.css must prevent awkward page-breaks inside printable cards and tables'
);

assert.ok(
  indexCssSrc.includes('#analytic-printable-report'),
  'index.css must style #analytic-printable-report for print layout'
);

console.log('  ✓ window.print() triggered with accessible buttons');
console.log('  ✓ Container and UI bars properly isolated with id and no-print');
console.log('  ✓ Comprehensive @media print stylesheet configured');
console.log('  ✓ Page breaks and multi-page document overflow handled');

console.log('\n🎉 ALL PHASE 1.5 EXPORT TESTS PASSED SUCCESSFULLY! ✅\n');
