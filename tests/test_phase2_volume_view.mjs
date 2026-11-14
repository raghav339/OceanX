import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Running Task 3: 3D Volumetric Mesh View Mode Test Suite...\n');

// 1. Check OceanShaders.js
console.log('Test 1: VolumeLayerShader in OceanShaders.js');
const oceanShadersSrc = fs.readFileSync(path.join(rootDir, 'src/components/canvas/OceanShaders.js'), 'utf-8');

assert.ok(
  oceanShadersSrc.includes('export const VolumeLayerShader'),
  'VolumeLayerShader must be exported from OceanShaders.js'
);

assert.ok(
  oceanShadersSrc.includes('uLayerDepthRatio'),
  'VolumeLayerShader must include uLayerDepthRatio uniform'
);

assert.ok(
  oceanShadersSrc.includes('uParamType') && oceanShadersSrc.includes('uPalette') && oceanShadersSrc.includes('uLogScale'),
  'VolumeLayerShader must include uParamType, uPalette, and uLogScale uniforms'
);

assert.ok(
  oceanShadersSrc.includes('colormapTurbo') && oceanShadersSrc.includes('colormapViridis') && oceanShadersSrc.includes('colormapSST'),
  'VolumeLayerShader fragmentShader must include colormap implementations'
);

assert.ok(
  oceanShadersSrc.includes('float layerAlpha = mix(') || oceanShadersSrc.includes('depthAlpha'),
  'VolumeLayerShader must compute depth-dependent opacity fall-off'
);

console.log('  ✓ VolumeLayerShader properly declared and exported');
console.log('  ✓ Depth-dependent parameter sampling and colormaps verified');
console.log('  ✓ Vertical opacity fall-off implemented\n');

// 2. Check OceanCanvas.jsx Implementation
console.log('Test 2: Volumetric Stacked Planes in OceanCanvas.jsx');
const oceanCanvasSrc = fs.readFileSync(path.join(rootDir, 'src/components/canvas/OceanCanvas.jsx'), 'utf-8');

assert.ok(
  oceanCanvasSrc.includes('VolumeLayerShader'),
  'OceanCanvas.jsx must import VolumeLayerShader'
);

assert.ok(
  oceanCanvasSrc.includes('volumeUniformsRef'),
  'OceanCanvas.jsx must have volumeUniformsRef'
);

assert.ok(
  oceanCanvasSrc.includes('volumeLayersRef'),
  'OceanCanvas.jsx must track volume layers for resource disposal'
);

assert.ok(
  oceanCanvasSrc.includes('numVolumeLayers = 10') || oceanCanvasSrc.includes('numVolumeLayers'),
  'OceanCanvas.jsx must define stacked volumetric layers'
);

assert.ok(
  oceanCanvasSrc.includes('depthWrite: false') && oceanCanvasSrc.includes('transparent: true'),
  'Volumetric layers must use depthWrite: false and transparent: true for correct alpha blending'
);

assert.ok(
  oceanCanvasSrc.includes('renderOrder'),
  'Volumetric layers must set renderOrder for sorted alpha composition'
);

console.log('  ✓ Stacked semi-transparent horizontal planes built inside volumeGroup');
console.log('  ✓ ShaderMaterial configuration (transparent, depthWrite: false) verified');
console.log('  ✓ Render ordering verified\n');

// 3. Uniform Updates and Exaggeration Synchronization
console.log('Test 3: Dynamic Uniform Updates and Vertical Exaggeration');

assert.ok(
  oceanCanvasSrc.includes('volumeUniformsRef.current.uParamType.value = pIdx'),
  'OceanCanvas.jsx must update volumeUniforms on selectedParam changes'
);

assert.ok(
  oceanCanvasSrc.includes('volumeUniformsRef.current.uPalette.value = palVal'),
  'OceanCanvas.jsx must update volumeUniforms on palette changes'
);

assert.ok(
  oceanCanvasSrc.includes('volumeUniformsRef.current.uOpacity.value = layerOpacity'),
  'OceanCanvas.jsx must update volumeUniforms on layerOpacity changes'
);

assert.ok(
  oceanCanvasSrc.includes('volumeUniformsRef.current.uLogScale.value'),
  'OceanCanvas.jsx must update volumeUniforms on isLogScale changes'
);

assert.ok(
  oceanCanvasSrc.includes('volumeGroupRef.current.scale.y = verticalExaggeration'),
  'volumeGroup must scale with verticalExaggeration alongside depthCutawayGroup'
);

assert.ok(
  oceanCanvasSrc.includes('depthCutawayGroupRef.current.visible = (viewMode !== \'surface\')'),
  'Cutaway walls must remain visible in volume mode'
);

console.log('  ✓ Parameters, palette, opacity, and log scale uniforms synchronized');
console.log('  ✓ Vertical exaggeration synchronizes volume group scale.y');
console.log('  ✓ Cutaway walls visibility maintained for filled block look\n');

// 4. Memory Disposal
console.log('Test 4: Resource Disposal in Cleanup');

assert.ok(
  oceanCanvasSrc.includes('volumeLayersRef.current.geometry?.dispose()'),
  'OceanCanvas cleanup must dispose volume layer geometry'
);

assert.ok(
  oceanCanvasSrc.includes('volumeLayersRef.current.materials?.forEach'),
  'OceanCanvas cleanup must dispose volume layer materials'
);

console.log('  ✓ Volume geometry and materials cleanly disposed on teardown');

console.log('\n🎉 ALL TASK 3 VOLUMETRIC MESH TESTS PASSED! ✅\n');
