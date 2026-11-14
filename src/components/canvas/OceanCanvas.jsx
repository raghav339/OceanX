import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { Camera, Check } from 'lucide-react';
import { generateEarthTopographyTexture, generateBathymetryTexture } from './proceduralTextures';
import { OceanSurfaceShader, DepthWallShader, VolumeLayerShader } from './OceanShaders';

// ---------------------------------------------------------------------------
// VECTOR FIELD HELPERS
// ---------------------------------------------------------------------------

/**
 * Cheap, stable, region-seeded pseudo-random number generator.
 * Produces a deterministic float in [0, 1) from a string seed + index.
 */
function seededRand(seed, idx) {
  let h = idx * 2654435761;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 2246822519);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 0xffffffff;
}

/**
 * Derive a smooth, plausible ocean-current direction field on a 12×10 grid.
 * Direction is a base gyre angle (seeded by region.id) plus a spatially-
 * varying perturbation so arrows form convincing swirling structures.
 *
 * Returns array of { x, z, angle, speed } objects.
 */
function deriveVectorField(region) {
  const cols = 12;
  const rows = 10;
  const oceanWidth = 3.6;
  const oceanDepth = 3.2;
  const baseSpeed = Math.min(2.2, Math.max(0.1, region?.currentSpeed ?? 0.85));
  const seed = region?.id ?? 'default';

  // Base gyre direction – stable per-region (radians)
  const gyreAngle = seededRand(seed, 0) * Math.PI * 2;
  // Gyre centre offset – stable per-region
  const gyreCx = (seededRand(seed, 1) - 0.5) * oceanWidth * 0.5;
  const gyreCz = (seededRand(seed, 2) - 0.5) * oceanDepth * 0.5;

  const arrows = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = -oceanWidth * 0.45 + col * (oceanWidth * 0.9 / (cols - 1));
      const z = -oceanDepth * 0.44 + row * (oceanDepth * 0.88 / (rows - 1));

      // Distance from gyre centre → speed falls off towards edges
      const dx = x - gyreCx;
      const dz = z - gyreCz;
      const dist = Math.sqrt(dx * dx + dz * dz) + 0.3;

      // Tangential direction around gyre centre
      const tangAngle = Math.atan2(dx, dz) + gyreAngle;

      // Small local perturbation seeded per cell
      const cellSeed = row * cols + col;
      const perturb = (seededRand(seed, cellSeed + 10) - 0.5) * 0.9;

      const angle = tangAngle + perturb;
      // Speed: strongest near gyre centre, fades outward, clamped
      const speedNorm = Math.min(1, (1.4 / (dist + 0.6)) + seededRand(seed, cellSeed + 200) * 0.15);
      const speed = baseSpeed * speedNorm;

      arrows.push({ x, z, angle, speed });
    }
  }
  return arrows;
}

/**
 * Map a normalised [0,1] speed value to a THREE.Color using the active palette.
 */
function speedToColor(t, paletteId) {
  t = Math.max(0, Math.min(1, t));
  switch (paletteId) {
    case 'viridis': {
      const r = 0.267 + t * (0.993 - 0.267);
      const g = 0.005 + t * (0.906 - 0.005);
      const b = 0.329 + (1 - t) * (0.329);
      return new THREE.Color(r, Math.max(0, g - t * 0.3), Math.max(0, b));
    }
    case 'thermal': {
      return new THREE.Color(t, 0.3 * (1 - t), 1 - t);
    }
    case 'coolwarm': {
      return t < 0.5
        ? new THREE.Color(0.17 + t * 0.66, 0.51, 0.73 - t * 0.26)
        : new THREE.Color(0.70 + (t - 0.5) * 0.59, 0.09 - (t - 0.5) * 0.09, 0.09 - (t - 0.5) * 0.09);
    }
    case 'jet': {
      const r = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 3)));
      const g = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 2)));
      const b = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 1)));
      return new THREE.Color(r, g, b);
    }
    case 'turbo':
    default: {
      // Approximate turbo: deep blue → cyan → green → yellow → red
      const r = Math.min(1, Math.max(0, 0.1 + t * 1.8 - Math.pow(t, 2) * 1.5));
      const g = Math.min(1, Math.max(0, 0.9 * Math.sin(t * Math.PI)));
      const b = Math.min(1, Math.max(0, 1 - t * 2.0));
      return new THREE.Color(r, g, b);
    }
  }
}

/**
 * Build an InstancedMesh of arrow cones for the vector field.
 * Returns { mesh, geometry, material } for later disposal.
 */
function buildVectorArrows(region, paletteId) {
  const arrows = deriveVectorField(region);
  const count = arrows.length;

  // Slim cone: tip points +Y. radiusBottom=0 gives a sharp tip.
  const geo = new THREE.ConeGeometry(0.028, 0.14, 7, 1);
  // Pivot: shift geometry so the base (not centre) sits at origin → arrow grows upward from surface
  geo.translate(0, 0.07, 0);

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.4,
    metalness: 0.3,
    transparent: true,
    opacity: 0.92,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // Per-instance colour buffer
  const colors = new Float32Array(count * 3);

  const maxSpeed = Math.min(2.2, Math.max(0.1, (region?.currentSpeed ?? 0.85) * 1.6));
  const dummy = new THREE.Object3D();

  arrows.forEach(({ x, z, angle, speed }, i) => {
    // Position: just above ocean surface (y = 0.08)
    dummy.position.set(x, 0.08, z);
    // The cone tip is +Y; rotate around Y to face the flow direction (XZ plane),
    // then tilt slightly forward so it's readable from the top camera angle.
    dummy.rotation.set(0, -angle, 0);
    // Scale: length proportional to speed
    const s = 0.4 + (speed / maxSpeed) * 1.0;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    const t = speed / maxSpeed;
    const col = speedToColor(t, paletteId);
    colors[i * 3 + 0] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  });

  geo.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));
  mesh.instanceMatrix.needsUpdate = true;

  return { mesh, geometry: geo, material: mat };
}

// ---------------------------------------------------------------------------
// Helper to create text sprite for 3D depth ticks (0m, 100m, 500m, etc.)
function createDepthLabelSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 10, 24);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.4, 0.15, 1);
  return sprite;
}

// Helper to create floating circular buoy badge icon sprite
function createBuoyBadgeSprite(type = 'mooredBuoy') {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  let fillCol = '#0284c7';
  let strokeCol = '#38bdf8';
  let label = '';

  if (type === 'gliderProfile') {
    fillCol = '#0891b2';
    strokeCol = '#22d3ee';
    label = 'GL';
  } else if (type === 'bgcArgo') {
    fillCol = '#9333ea';
    strokeCol = '#c084fc';
    label = 'BGC';
  } else if (type === 'adcpMooring') {
    fillCol = '#ea580c';
    strokeCol = '#fb923c';
    label = 'ADCP';
  }

  ctx.fillStyle = fillCol;
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = strokeCol;
  ctx.stroke();

  if (label) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 32, 33);
  } else {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(32, 32, 12, -Math.PI * 0.7, Math.PI * 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(32, 32, 6, -Math.PI * 0.7, Math.PI * 0.7);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.22, 0.22, 1);
  return sprite;
}

// Builds specialized 3D geometries for each in-situ instrument type
function buildInstrumentMesh(buoy) {
  const buoyObj = new THREE.Group();
  buoyObj.position.set(buoy.x * 1.6, 0.03, buoy.z * 1.3);
  buoyObj.userData = buoy;

  if (buoy.type === 'gliderProfile') {
    // Slocum Underwater Glider: Streamlined torpedo fuselage + swept delta wings + tail rudder
    const fuseGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.22, 16);
    fuseGeo.rotateX(Math.PI * 0.5);
    const fuseMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.5, roughness: 0.25 });
    const fuse = new THREE.Mesh(fuseGeo, fuseMat);
    fuse.position.y = 0.015;
    buoyObj.add(fuse);

    const wingGeo = new THREE.BoxGeometry(0.26, 0.005, 0.045);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.3, roughness: 0.3 });
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.position.set(0, 0.015, -0.01);
    buoyObj.add(wing);

    const finGeo = new THREE.BoxGeometry(0.006, 0.04, 0.03);
    const fin = new THREE.Mesh(finGeo, wingMat);
    fin.position.set(0, 0.035, -0.08);
    buoyObj.add(fin);
  } else if (buoy.type === 'bgcArgo') {
    // BGC Argo Float: Slender profiler hull with bio-optical sensor cap
    const bodyGeo = new THREE.CylinderGeometry(0.028, 0.03, 0.18, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, metalness: 0.4, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.06;
    buoyObj.add(body);

    const headGeo = new THREE.SphereGeometry(0.028, 12, 12);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, metalness: 0.7, roughness: 0.2 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.15;
    buoyObj.add(head);
  } else if (buoy.type === 'adcpMooring') {
    // ADCP Acoustic Profiler: Subsurface float sphere & 4-beam upward transducer
    const sphereGeo = new THREE.SphereGeometry(0.048, 16, 16);
    const sphereMat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.3, roughness: 0.4 });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.y = -0.02;
    buoyObj.add(sphere);

    const coneGeo = new THREE.ConeGeometry(0.032, 0.045, 4);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = 0.035;
    buoyObj.add(cone);
  } else {
    // Moored Buoy & Core Argo
    const hullGeo = new THREE.CylinderGeometry(0.055, 0.06, 0.045, 16);
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.35, roughness: 0.3 });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 0.022;
    buoyObj.add(hull);

    const mastGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.14, 8);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.y = 0.09;
    buoyObj.add(mast);
  }

  // Floating telemetry badge
  const badge = createBuoyBadgeSprite(buoy.type);
  badge.position.set(0, 0.26, 0);
  buoyObj.add(badge);

  // Surface pulse ring
  const ringGeo = new THREE.RingGeometry(0.07, 0.14, 16);
  ringGeo.rotateX(-Math.PI * 0.5);
  const ringColor = buoy.type === 'gliderProfile' ? 0x06b6d4 : (buoy.type === 'bgcArgo' ? 0xa855f7 : (buoy.type === 'adcpMooring' ? 0xf97316 : 0x00f0ff));
  const ringMat = new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.01;
  buoyObj.add(ring);

  return buoyObj;
}

// Helper to create 3D Hurricane Cloud Texture (Soft misty spiral cloud bands)
function createHurricaneVortexTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'transparent';
  ctx.clearRect(0, 0, 512, 512);

  // Soft misty spiral arms using radial cloud puffs
  for (let arm = 0; arm < 3; arm++) {
    const baseAngle = (arm * Math.PI * 2) / 3;
    for (let r = 20; r < 210; r += 7) {
      const angle = baseAngle + Math.pow(r / 65, 1.25);
      const x = 256 + Math.cos(angle) * r;
      const y = 256 + Math.sin(angle) * r;

      const puffRadius = 16 + (r / 210) * 16;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, puffRadius);
      grad.addColorStop(0, 'rgba(235, 243, 255, 0.42)');
      grad.addColorStop(0.5, 'rgba(205, 225, 250, 0.20)');
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, puffRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Central Eye of the Storm (subtle misty ring)
  const eyeGrad = ctx.createRadialGradient(256, 256, 8, 256, 256, 32);
  eyeGrad.addColorStop(0, 'rgba(10, 25, 60, 0.6)');
  eyeGrad.addColorStop(0.5, 'rgba(220, 235, 255, 0.45)');
  eyeGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = eyeGrad;
  ctx.beginPath();
  ctx.arc(256, 256, 32, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// Helper to create subtle, non-intrusive 3D Marine Waterspout Funnel
function createTornadoFunnelMesh(radiusTop = 0.16, radiusBottom = 0.03, height = 0.44, opacity = 0.35) {
  const group = new THREE.Group();

  // 1. Twisted inner core - translucent mist
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 28, 10, true);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const progress = (y + height / 2) / height;
    const angle = progress * Math.PI * 2.8;
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const nx = x * Math.cos(angle) - z * Math.sin(angle);
    const nz = x * Math.sin(angle) + z * Math.cos(angle);
    pos.setX(i, nx + Math.sin(progress * Math.PI) * 0.03);
    pos.setZ(i, nz + Math.cos(progress * Math.PI) * 0.02);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    emissive: 0x64748b,
    emissiveIntensity: 0.12,
    roughness: 0.6,
    metalness: 0.02,
    transparent: true,
    opacity: opacity,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const innerMesh = new THREE.Mesh(geo, mat);
  group.add(innerMesh);

  // 2. Light misty outer sleeve
  const outerGeo = new THREE.CylinderGeometry(radiusTop * 1.12, radiusBottom * 1.25, height, 24, 6, true);
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: opacity * 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const outerMesh = new THREE.Mesh(outerGeo, outerMat);
  group.add(outerMesh);

  return group;
}

// ---------------------------------------------------------------------------
// 3D ISOSURFACE SHELL EXTRACTION HELPERS
// ---------------------------------------------------------------------------
function updateIsoSheetVertices(geo, threshold, oceanWidth = 3.6, oceanDepth = 3.2, depthSliceHeight = 2.4) {
  const pos = geo.attributes.position;
  const baseDepth = (1.0 - threshold) * depthSliceHeight * 0.85 + 0.12;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const px = vx / (oceanWidth * 0.5);
    const pz = vz / (oceanDepth * 0.5);

    const distToWarmCore = Math.hypot(px - 0.28, pz - (-0.05));
    const warmCore = Math.exp(-distToWarmCore * 2.2);
    const coastalShoal = Math.max(0, (-0.2 - px) / 0.65) * 0.22;
    const waves = Math.sin(px * 4.5 + pz * 3.0) * 0.05 + Math.cos(px * 2.5 - pz * 5.0) * 0.04;

    const finalY = -(baseDepth + warmCore * 0.32 - coastalShoal + waves);
    pos.setY(i, finalY);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

function buildIsoSurfaces(currentPalette, activeIsoLevel = 0.5, oceanWidth = 3.6, oceanDepth = 3.2, depthSliceHeight = 2.4) {
  const thresholds = [0.35, activeIsoLevel, 0.65];
  const sheets = [];

  thresholds.forEach((thresh, idx) => {
    const isMain = idx === 1;
    const geo = new THREE.PlaneGeometry(oceanWidth * 0.94, oceanDepth * 0.94, 40, 40);
    geo.rotateX(-Math.PI * 0.5);
    updateIsoSheetVertices(geo, thresh, oceanWidth, oceanDepth, depthSliceHeight);

    const color = speedToColor(thresh, currentPalette);
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.3,
      metalness: 0.15,
      transparent: true,
      opacity: isMain ? 0.58 : 0.40,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0, 0.15);
    mesh.renderOrder = isMain ? 15 : 12;

    const wireGeo = geo.clone();
    const wireMat = new THREE.MeshBasicMaterial({
      color: isMain ? 0xffffff : color,
      wireframe: true,
      transparent: true,
      opacity: isMain ? 0.32 : 0.16,
      depthWrite: false
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    wireMesh.position.set(0, 0, 0.15);
    wireMesh.renderOrder = mesh.renderOrder + 1;

    sheets.push({
      threshold: thresh,
      geo,
      mat,
      mesh,
      wireGeo,
      wireMat,
      wireMesh
    });
  });

  return sheets;
}

const OceanCanvas = forwardRef(function OceanCanvas({
  selectedParam = 'sst',
  depth = 50,
  viewMode = 'depth_slice',
  activeRegion,
  isStormLayerActive = false,
  onSelectBuoy,
  _selectedBuoy = null,
  isPlaying = true,
  simSpeed = 1,
  ensoState = { phase: 'elnino', intensity: 0.75, isPlaying: true },
  palette = 'turbo',
  layerOpacity = 0.95,
  verticalExaggeration = 1.0,
  isLogScale = false,
  showExportButton = true,
  onExportPng,
  isoLevel = 0.5
}, ref) {
  const [isExported, setIsExported] = useState(false);
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const uniformsRef = useRef({});
  const depthWallUniformsRef = useRef({});
  const depthCutawayGroupRef = useRef(null);
  const volumeGroupRef = useRef(null);
  const volumeUniformsRef = useRef({});
  const volumeLayersRef = useRef(null);
  const isoGroupRef = useRef(null);
  const isoMeshesRef = useRef(null);
  const isoLevelRef = useRef(isoLevel);
  const vectorGroupRef = useRef(null);
  const vectorArrowsRef = useRef(null); // { mesh, geometry, material } for the current arrow InstancedMesh
  const paletteRef = useRef(palette);   // kept in sync below so render-loop & activeRegion effect see current palette
  const particlesRef = useRef(null);
  const buoysGroupRef = useRef(null);
  const earthMeshRef = useRef(null);
  const stormGroupRef = useRef(null);
  const cycloneVortexRef = useRef(null);
  const tornadoMeshRef = useRef(null);
  const sprayRingMainRef = useRef(null);
  const rainMeshRef = useRef(null);
  const lightningLightRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  const handleExportPng = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return null;
    try {
      // Force an explicit render to ensure buffer has the fresh frame
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      const canvas = rendererRef.current.domElement;
      const dataUrl = canvas.toDataURL('image/png');
      const regionId = (propsRef.current?.activeRegion?.id || activeRegion?.id || 'ocean').toLowerCase();
      const filename = `oceanx-${regionId}-${selectedParam}-${depth}m-${Date.now()}.png`;

      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsExported(true);
      setTimeout(() => setIsExported(false), 2200);

      if (onExportPng) {
        onExportPng(dataUrl, filename);
      }
      return { dataUrl, filename };
    } catch (err) {
      console.error('Failed to export 3D canvas PNG:', err);
      return null;
    }
  };

  useImperativeHandle(ref, () => ({
    exportPng: handleExportPng,
    getCanvas: () => rendererRef.current?.domElement,
    getRenderer: () => rendererRef.current
  }));

  const propsRef = useRef({
    activeRegion,
    isStormLayerActive,
    onSelectBuoy,
    isPlaying,
    simSpeed,
    ensoState
  });

  useEffect(() => {
    propsRef.current = {
      activeRegion,
      isStormLayerActive,
      onSelectBuoy,
      isPlaying,
      simSpeed,
      ensoState
    };
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.FogExp2(0x06141b, 0.035);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0.1, 3.4, 4.8);
    camera.lookAt(0, -0.35, 0.1);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true, 
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    containerRef.current.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    // Cinematic Ocean Lighting
    const ambientLight = new THREE.AmbientLight(0x0a1720, 2.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff8ee, 3.2);
    sunLight.position.set(3, 9, 4.5);
    sunLight.castShadow = true;
    scene.add(sunLight);

    const atmosphereRim = new THREE.DirectionalLight(0x00f0ff, 2.6);
    atmosphereRim.position.set(-6, -1, -5);
    scene.add(atmosphereRim);

    const abyssBiolum = new THREE.PointLight(0x0284c7, 4.0, 8);
    abyssBiolum.position.set(0, -2.4, 0.2);
    scene.add(abyssBiolum);

    // Lightning Flash Light for Storms
    const lightningLight = new THREE.PointLight(0xdbeafe, 0, 12, 1.5);
    lightningLight.position.set(0.35, 1.2, -0.1);
    scene.add(lightningLight);
    lightningLightRef.current = lightningLight;

    // Earth Globe Regional Cutaway
    const earthTexture = generateEarthTopographyTexture();
    const globeRadius = 6.2;
    const globeGeo = new THREE.SphereGeometry(globeRadius, 96, 96, 0, Math.PI * 2, 0, Math.PI * 0.42);
    const globeMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.65,
      metalness: 0.12,
      bumpMap: earthTexture,
      bumpScale: 0.05,
    });
    const earthMesh = new THREE.Mesh(globeGeo, globeMat);
    earthMesh.rotation.x = Math.PI * 0.58;
    earthMesh.rotation.z = -Math.PI * 0.12;
    earthMesh.position.set(0, -5.1, 0.35);
    earthMesh.receiveShadow = true;
    scene.add(earthMesh);
    earthMeshRef.current = earthMesh;

    // Atmospheric cyan ring
    const atmosGeo = new THREE.RingGeometry(globeRadius * 0.99, globeRadius * 1.08, 96);
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0x00c8ff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    atmosMesh.rotation.x = Math.PI * 0.5;
    atmosMesh.position.set(0, -0.05, 0.1);
    scene.add(atmosMesh);

    // Dynamic Ocean Surface Heatmap Mesh
    const oceanWidth = 3.6;
    const oceanDepth = 3.2;
    const oceanGeo = new THREE.PlaneGeometry(oceanWidth, oceanDepth, 180, 180);
    oceanGeo.rotateX(-Math.PI * 0.5);

    const oceanUniforms = {
      uTime: { value: 0 },
      uParamType: { value: 0 },
      uDepth: { value: 50.0 },
      uMode: { value: 1 },
      uWaveSwell: { value: 1.0 },
      uSunDirection: { value: new THREE.Vector3(0.5, 1.0, 0.5).normalize() },
      uEnsoPhase: { value: 1 },
      uEnsoIntensity: { value: 0.75 },
      uPalette: { value: 1 },
      uOpacity: { value: 0.95 },
      uLogScale: { value: 0 },
      uIsoLevel: { value: isoLevel }
    };
    uniformsRef.current = oceanUniforms;

    const oceanMat = new THREE.ShaderMaterial({
      uniforms: oceanUniforms,
      vertexShader: OceanSurfaceShader.vertexShader,
      fragmentShader: OceanSurfaceShader.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide
    });
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.position.set(0, 0.02, 0.15);
    scene.add(oceanMesh);

    // Group for depth cutaway walls, depth ticks, seabed, and sensor probes for vertical exaggeration
    const depthCutawayGroup = new THREE.Group();
    scene.add(depthCutawayGroup);
    depthCutawayGroupRef.current = depthCutawayGroup;

    // Volumetric Depth Cutaway Walls
    const depthWallUniforms = {
      uTime: { value: 0 },
      uParamType: { value: 0 },
      uMaxDepth: { value: 6000.0 },
      uEnsoPhase: { value: 1 },
      uEnsoIntensity: { value: 0.75 },
      uPalette: { value: 1 },
      uOpacity: { value: 0.95 },
      uLogScale: { value: 0 }
    };
    depthWallUniformsRef.current = depthWallUniforms;

    const depthSliceHeight = 2.4;
    const wallGeoFront = new THREE.PlaneGeometry(oceanWidth, depthSliceHeight);
    const depthWallMat = new THREE.ShaderMaterial({
      uniforms: depthWallUniforms,
      vertexShader: DepthWallShader.vertexShader,
      fragmentShader: DepthWallShader.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide
    });

    const wallFront = new THREE.Mesh(wallGeoFront, depthWallMat);
    wallFront.position.set(0, -depthSliceHeight * 0.5, 0.15 + oceanDepth * 0.5);
    depthCutawayGroup.add(wallFront);

    const wallGeoRight = new THREE.PlaneGeometry(oceanDepth, depthSliceHeight);
    wallGeoRight.rotateY(Math.PI * 0.5);
    const wallRight = new THREE.Mesh(wallGeoRight, depthWallMat);
    wallRight.position.set(oceanWidth * 0.5, -depthSliceHeight * 0.5, 0.15);
    depthCutawayGroup.add(wallRight);

    // 3D Depth Labels on Right Cutaway Wall Edge
    const depthTicks = [
      { text: '0 m', yRatio: 0.005 },
      { text: '100 m', yRatio: 0.06 },
      { text: '500 m', yRatio: 0.18 },
      { text: '1000 m', yRatio: 0.34 },
      { text: '2000 m', yRatio: 0.55 },
      { text: '4000 m', yRatio: 0.80 },
      { text: '6000 m', yRatio: 0.99 }
    ];

    depthTicks.forEach((tick) => {
      const sprite = createDepthLabelSprite(tick.text);
      const yPos = -(tick.yRatio * depthSliceHeight);
      sprite.position.set(oceanWidth * 0.5 + 0.28, yPos, 0.15 + oceanDepth * 0.5);
      depthCutawayGroup.add(sprite);

      const tickLineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(oceanWidth * 0.5, yPos, 0.15 + oceanDepth * 0.5),
        new THREE.Vector3(oceanWidth * 0.5 + 0.08, yPos, 0.15 + oceanDepth * 0.5)
      ]);
      const tickLineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
      const tickLine = new THREE.Line(tickLineGeo, tickLineMat);
      depthCutawayGroup.add(tickLine);
    });

    // Central Deep CTD Sensor Probe Cable & Sensor Beads
    const probeGroup = new THREE.Group();
    probeGroup.position.set(0.05, 0, 0.25);
    depthCutawayGroup.add(probeGroup);

    const cableGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -depthSliceHeight * 0.85, 0)
    ]);
    const cableMat = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.05, gapSize: 0.03 });
    const probeCable = new THREE.Line(cableGeo, cableMat);
    probeCable.computeLineDistances();
    probeGroup.add(probeCable);

    const beadGeo = new THREE.SphereGeometry(0.045, 16, 16);
    const beadMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sensorBead = new THREE.Mesh(beadGeo, beadMat);
    sensorBead.position.set(0, -depthSliceHeight * 0.12, 0);
    probeGroup.add(sensorBead);

    const leg1Geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -depthSliceHeight * 0.85, 0),
      new THREE.Vector3(-0.25, -depthSliceHeight, 0.15)
    ]);
    const leg2Geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -depthSliceHeight * 0.85, 0),
      new THREE.Vector3(0.25, -depthSliceHeight, 0.15)
    ]);
    const legMat = new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 0.04, gapSize: 0.02 });
    const leg1 = new THREE.Line(leg1Geo, legMat);
    leg1.computeLineDistances();
    const leg2 = new THREE.Line(leg2Geo, legMat);
    leg2.computeLineDistances();
    probeGroup.add(leg1);
    probeGroup.add(leg2);

    // Rugged 3D Bathymetry Seabed Mountain Ranges
    const seabedTexture = generateBathymetryTexture();
    const seabedGeo = new THREE.PlaneGeometry(oceanWidth * 1.25, oceanDepth * 1.25, 80, 80);
    seabedGeo.rotateX(-Math.PI * 0.5);

    const posAttr = seabedGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const peak1 = Math.sin(vx * 4.0 + vz * 2.5) * 0.28;
      const peak2 = Math.cos(vx * 7.0 - vz * 3.0) * 0.14;
      const trench = -Math.exp(-(vx * vx + vz * vz) * 0.8) * 0.22;
      posAttr.setY(i, peak1 + peak2 + trench);
    }
    seabedGeo.computeVertexNormals();

    const seabedMat = new THREE.MeshStandardMaterial({
      map: seabedTexture,
      roughness: 0.75,
      metalness: 0.15,
      color: 0x2563eb,
      bumpMap: seabedTexture,
      bumpScale: 0.08
    });
    const seabedMesh = new THREE.Mesh(seabedGeo, seabedMat);
    seabedMesh.position.set(0, -depthSliceHeight, 0.15);
    depthCutawayGroup.add(seabedMesh);

    // ---------------------------------------------------------------------------
    // 3D VOLUMETRIC MESH LAYERS
    // Stacked semi-transparent horizontal planes spaced down through cutaway depth
    // ---------------------------------------------------------------------------
    const volumeGroup = new THREE.Group();
    volumeGroup.visible = false;
    scene.add(volumeGroup);
    volumeGroupRef.current = volumeGroup;

    const initialParamIndices = { sst: 0, salinity: 1, currents: 2, wave: 3, chlorophyll: 4, oxygen: 5 };
    const initialPaletteMap = { default: 0, turbo: 1, viridis: 2, thermal: 3, coolwarm: 4, jet: 5 };

    const volumeUniforms = {
      uTime: { value: 0 },
      uParamType: { value: initialParamIndices[selectedParam] ?? 0 },
      uPalette: { value: initialPaletteMap[palette] ?? 1 },
      uOpacity: { value: layerOpacity },
      uLogScale: { value: isLogScale ? 1 : 0 },
      uEnsoPhase: { value: 1 },
      uEnsoIntensity: { value: 0.75 }
    };
    volumeUniformsRef.current = volumeUniforms;
    volumeGroup.scale.y = verticalExaggeration;

    const numVolumeLayers = 10;
    const volumeSharedGeo = new THREE.PlaneGeometry(oceanWidth, oceanDepth, 32, 32);
    volumeSharedGeo.rotateX(-Math.PI * 0.5);

    const volumeMaterials = [];
    for (let i = 0; i < numVolumeLayers; i++) {
      const depthRatio = (i + 0.6) / (numVolumeLayers + 0.5);
      const layerY = -depthRatio * depthSliceHeight;

      const layerUniforms = {
        uTime: volumeUniforms.uTime,
        uParamType: volumeUniforms.uParamType,
        uPalette: volumeUniforms.uPalette,
        uOpacity: volumeUniforms.uOpacity,
        uLogScale: volumeUniforms.uLogScale,
        uEnsoPhase: volumeUniforms.uEnsoPhase,
        uEnsoIntensity: volumeUniforms.uEnsoIntensity,
        uLayerDepthRatio: { value: depthRatio }
      };

      const layerMat = new THREE.ShaderMaterial({
        uniforms: layerUniforms,
        vertexShader: VolumeLayerShader.vertexShader,
        fragmentShader: VolumeLayerShader.fragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      volumeMaterials.push(layerMat);

      const layerMesh = new THREE.Mesh(volumeSharedGeo, layerMat);
      layerMesh.position.set(0, layerY, 0.15);
      // Deepest drawn first, shallowest drawn last for optimal back-to-front transparency
      layerMesh.renderOrder = (numVolumeLayers - 1) - i;
      volumeGroup.add(layerMesh);
    }

    volumeLayersRef.current = {
      geometry: volumeSharedGeo,
      materials: volumeMaterials
    };

    const isoGroup = new THREE.Group();
    isoGroup.visible = false;
    scene.add(isoGroup);
    isoGroupRef.current = isoGroup;
    isoGroup.scale.y = verticalExaggeration;

    // Build initial 3D isosurface sheets inside cutaway block
    const isoSheets = buildIsoSurfaces(paletteRef.current, isoLevel, oceanWidth, oceanDepth, depthSliceHeight);
    isoSheets.forEach((s) => {
      isoGroup.add(s.mesh);
      isoGroup.add(s.wireMesh);
    });
    isoMeshesRef.current = isoSheets;

    const vectorGroup = new THREE.Group();
    vectorGroup.visible = false;
    scene.add(vectorGroup);
    vectorGroupRef.current = vectorGroup;

    // Build the initial arrow InstancedMesh using the region passed at mount time.
    // (The activeRegion effect will rebuild it whenever the region changes.)
    {
      const arrowData = buildVectorArrows(
        propsRef.current.activeRegion,
        paletteRef.current
      );
      vectorGroup.add(arrowData.mesh);
      vectorArrowsRef.current = arrowData;
    }

    // ---------------------------------------------------------------------------
    // 3D STORM, HURRICANE & TORNADO/WATERSPOUT ENGINE
    // ---------------------------------------------------------------------------
    const stormGroup = new THREE.Group();
    stormGroup.position.set(0.35, 0, -0.1);
    scene.add(stormGroup);
    stormGroupRef.current = stormGroup;

    // 1. Hurricane Rotating Cloud Vortex (Small & Misty)
    const cycloneTex = createHurricaneVortexTexture();
    const cycloneGeo = new THREE.PlaneGeometry(1.25, 1.25);
    cycloneGeo.rotateX(-Math.PI * 0.5);
    const cycloneMat = new THREE.MeshBasicMaterial({
      map: cycloneTex,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const cycloneMesh = new THREE.Mesh(cycloneGeo, cycloneMat);
    cycloneMesh.position.set(0, 0.52, 0);
    stormGroup.add(cycloneMesh);
    cycloneVortexRef.current = cycloneMesh;

    // 2. Single Subtle, Non-Disturbing Marine Waterspout Funnel
    const tornadoMesh = createTornadoFunnelMesh(0.16, 0.035, 0.44, 0.35);
    tornadoMesh.position.set(0, 0.25, 0);
    stormGroup.add(tornadoMesh);
    tornadoMeshRef.current = tornadoMesh;

    // Main Waterspout Spray Ring on Water Surface (Gentle Mist)
    const sprayGeo = new THREE.RingGeometry(0.04, 0.16, 24);
    sprayGeo.rotateX(-Math.PI * 0.5);
    const sprayMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    const sprayRingMain = new THREE.Mesh(sprayGeo, sprayMat);
    sprayRingMain.position.set(0, 0.038, 0);
    stormGroup.add(sprayRingMain);
    sprayRingMainRef.current = sprayRingMain;

    // 5. Rain Squall Particles Falling from Cloud to Sea
    const rainCount = 450;
    const rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 1.6;
      rainPositions[i * 3 + 1] = 0.04 + Math.random() * 0.46;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 1.6;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.035,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const rainMesh = new THREE.Points(rainGeo, rainMat);
    stormGroup.add(rainMesh);
    rainMeshRef.current = { mesh: rainMesh, count: rainCount };

    // Animated White Vector Particle Streamlines (Gyre Flow)
    const particleCount = 950;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities = [];

    for (let i = 0; i < particleCount; i++) {
      const px = (Math.random() - 0.5) * (oceanWidth * 0.88);
      const pz = (Math.random() - 0.5) * (oceanDepth * 0.88);
      const py = 0.04 + Math.random() * 0.015;

      particlePositions[i * 3] = px;
      particlePositions[i * 3 + 1] = py;
      particlePositions[i * 3 + 2] = pz;

      particleVelocities.push({
        x: px,
        z: pz,
        speed: 0.0035 + Math.random() * 0.006,
        angle: Math.atan2(pz + 0.05, px - 0.28) + Math.PI * 0.5
      });
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pCtx = pCanvas.getContext('2d');
    const pGrad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
    pGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    pGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.7)');
    pGrad.addColorStop(1, 'transparent');
    pCtx.fillStyle = pGrad;
    pCtx.beginPath();
    pCtx.arc(16, 16, 16, 0, Math.PI * 2);
    pCtx.fill();
    const particleTex = new THREE.CanvasTexture(pCanvas);

    const particleMat = new THREE.PointsMaterial({
      size: 0.065,
      map: particleTex,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const particlesMesh = new THREE.Points(particleGeo, particleMat);
    scene.add(particlesMesh);
    particlesRef.current = { mesh: particlesMesh, velocities: particleVelocities, count: particleCount };

    // 3D Floating Buoy Fleet
    const buoysGroup = new THREE.Group();
    buoysGroupRef.current = buoysGroup;
    scene.add(buoysGroup);

    const buoysList = activeRegion?.buoys || [];
    buoysList.forEach((buoy) => {
      const buoyObj = buildInstrumentMesh(buoy);
      buoysGroup.add(buoyObj);
    });

    // Orbit Drag & Click
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };
    let spherical = { radius: 5.8, theta: 0.08, phi: 1.05 };

    const updateCamera = () => {
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta) + 0.3;
      camera.lookAt(0, -0.35, 0.1);
    };
    updateCamera();

    const dom = renderer.domElement;
    const onMouseDown = (e) => { isDragging = true; prevMousePos = { x: e.clientX, y: e.clientY }; };
    const onMouseMove = (e) => {
      if (isDragging) {
        const dx = e.clientX - prevMousePos.x;
        const dy = e.clientY - prevMousePos.y;
        spherical.theta -= dx * 0.005;
        spherical.phi = Math.max(0.4, Math.min(Math.PI * 0.46, spherical.phi - dy * 0.005));
        updateCamera();
        prevMousePos = { x: e.clientX, y: e.clientY };
      }
    };
    const onMouseUp = () => { isDragging = false; };
    const onWheel = (e) => {
      e.preventDefault();
      spherical.radius = Math.max(3.2, Math.min(8.0, spherical.radius + e.deltaY * 0.003));
      updateCamera();
    };

    const onClick = (e) => {
      const rect = dom.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(buoysGroup.children, true);

      if (intersects.length > 0) {
        let parent = intersects[0].object;
        while (parent && !parent.userData?.id && parent.parent) {
          parent = parent.parent;
        }
        if (parent && parent.userData?.id && propsRef.current.onSelectBuoy) {
          propsRef.current.onSelectBuoy(parent.userData);
        }
      }
    };

    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('click', onClick);

    // Animation Loop
    let animationFrameId;
    const animationStartTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = (performance.now() - animationStartTime) * 0.001;
      const currentProps = propsRef.current;
      const isPlayingCurrent = currentProps.isPlaying;
      const simSpeedCurrent = currentProps.simSpeed;
      const speedMult = isPlayingCurrent ? simSpeedCurrent : 0;

      if (uniformsRef.current.uTime) uniformsRef.current.uTime.value = elapsed;
      if (depthWallUniformsRef.current.uTime) depthWallUniformsRef.current.uTime.value = elapsed;
      if (volumeUniformsRef.current.uTime) volumeUniformsRef.current.uTime.value = elapsed;

      // Real-time ENSO Phase & Intensity Uniform Updates
      const ensoPhaseVal = currentProps.ensoState?.phase === 'elnino' ? 1 : currentProps.ensoState?.phase === 'lanina' ? 2 : 0;
      const ensoIntensityVal = currentProps.ensoState?.intensity ?? 0.75;
      if (uniformsRef.current.uEnsoPhase) uniformsRef.current.uEnsoPhase.value = ensoPhaseVal;
      if (uniformsRef.current.uEnsoIntensity) uniformsRef.current.uEnsoIntensity.value = ensoIntensityVal;
      if (depthWallUniformsRef.current.uEnsoPhase) depthWallUniformsRef.current.uEnsoPhase.value = ensoPhaseVal;
      if (depthWallUniformsRef.current.uEnsoIntensity) depthWallUniformsRef.current.uEnsoIntensity.value = ensoIntensityVal;
      if (volumeUniformsRef.current.uEnsoPhase) volumeUniformsRef.current.uEnsoPhase.value = ensoPhaseVal;
      if (volumeUniformsRef.current.uEnsoIntensity) volumeUniformsRef.current.uEnsoIntensity.value = ensoIntensityVal;

      // Animate 3D Storm, Hurricane & Tornado Funnels
      if (stormGroupRef.current) {
        const stormProb = currentProps.activeRegion?.stormProbability ?? 30;
        // Visible whenever the Storm Layer is toggled ON (isStormLayerActive)
        const hasStorm = Boolean(currentProps.isStormLayerActive);
        stormGroupRef.current.visible = hasStorm;

        if (hasStorm) {
          // Dynamic intensity scaling: minimum 0.35 so simulation is always clearly visible and animated when active
          const stormIntensity = Math.max(0.35, Math.min(1.0, stormProb / 100));

          // 1. Rotate Hurricane cloud arms (soft & misty)
          if (cycloneVortexRef.current) {
            cycloneVortexRef.current.rotation.z = -elapsed * (0.8 + stormIntensity * 1.0) * speedMult;
            cycloneVortexRef.current.scale.setScalar(0.75 + stormIntensity * 0.2);
          }

          // 2. Spin central subtle waterspout funnel
          if (tornadoMeshRef.current) {
            tornadoMeshRef.current.rotation.y = elapsed * 2.6 * speedMult;
            tornadoMeshRef.current.position.x = Math.sin(elapsed * 0.8) * 0.025;
            tornadoMeshRef.current.position.z = Math.cos(elapsed * 0.6) * 0.025;
          }

          // 3. Pulse gentle water spray ring
          if (sprayRingMainRef.current) {
            const sprayPulse = (elapsed * 2.2) % 1.5;
            sprayRingMainRef.current.scale.set(1 + sprayPulse * 0.4, 1 + sprayPulse * 0.4, 1);
            sprayRingMainRef.current.material.opacity = Math.max(0, 0.6 - sprayPulse * 0.4);
          }

          // 4. Falling rain squalls
          if (rainMeshRef.current) {
            const { mesh, count } = rainMeshRef.current;
            const pos = mesh.geometry.attributes.position;
            for (let i = 0; i < count; i++) {
              let py = pos.getY(i) - (0.015 + stormIntensity * 0.02) * (isPlayingCurrent ? simSpeedCurrent : 1);
              if (py < 0.03) py = 0.52;
              pos.setY(i, py);
            }
            pos.needsUpdate = true;
          }

          // 5. Subtle ambient storm glow (gentle, non-disturbing)
          if (lightningLightRef.current) {
            if (stormProb >= 55 && Math.random() < 0.012 * speedMult) {
              lightningLightRef.current.intensity = 2.2 + Math.random() * 1.8;
            } else {
              lightningLightRef.current.intensity *= 0.82;
            }
          }
        }
      }

      // Streamline particles with ENSO physical flow advection
      if (particlesRef.current) {
        const { mesh, count } = particlesRef.current;
        const pos = mesh.geometry.attributes.position;
        const ensoPhase = currentProps.ensoState?.phase || 'elnino';
        const ensoIntensity = currentProps.ensoState?.intensity ?? 0.75;
        const isEnsoPlaying = currentProps.ensoState?.isPlaying ?? true;
        const activeSpeedMult = isEnsoPlaying ? speedMult : 0;

        for (let i = 0; i < count; i++) {
          if (ensoPhase === 'elnino') {
            // El Niño: Reversal / Eastward Kelvin wave surge (→ → →)
            const speed = (0.007 + ensoIntensity * 0.009 + Math.sin(elapsed * 2.5 + i * 0.1) * 0.001) * activeSpeedMult;
            let nx = pos.getX(i) + speed;
            let nz = pos.getZ(i) + Math.sin(nx * 5.0 + elapsed) * 0.0008;

            if (nx > oceanWidth * 0.44) {
              nx = -oceanWidth * 0.44;
              nz = (Math.random() - 0.5) * (oceanDepth * 0.82);
            }
            pos.setX(i, nx);
            pos.setZ(i, nz);
          } else if (ensoPhase === 'lanina') {
            // La Niña: Supercharged westward trade wind flow (← ← ←)
            const speed = (0.009 + ensoIntensity * 0.009) * activeSpeedMult;
            let nx = pos.getX(i) - speed;
            let nz = pos.getZ(i) + Math.sin(nx * 5.0 + elapsed) * 0.0008;

            if (nx < -oceanWidth * 0.44) {
              nx = oceanWidth * 0.44;
              nz = (Math.random() - 0.5) * (oceanDepth * 0.82);
            }
            pos.setX(i, nx);
            pos.setZ(i, nz);
          } else {
            // Normal: Standard Subtropical Gyre Circulation
            const dx = pos.getX(i) - 0.28;
            const dz = pos.getZ(i) + 0.05;
            const dist = Math.sqrt(dx * dx + dz * dz) + 0.06;

            const speed = (0.0045 + (1.0 / dist) * 0.0012) * speedMult;
            const nx = pos.getX(i) - (dz / dist) * speed;
            const nz = pos.getZ(i) + (dx / dist) * speed;

            if (Math.abs(nx) > oceanWidth * 0.44 || Math.abs(nz) > oceanDepth * 0.44) {
              pos.setX(i, (Math.random() - 0.5) * (oceanWidth * 0.75));
              pos.setZ(i, (Math.random() - 0.5) * (oceanDepth * 0.75));
            } else {
              pos.setX(i, nx);
              pos.setZ(i, nz);
            }
          }
        }
        pos.needsUpdate = true;
      }

      // Buoys bobbing animation
      buoysGroup.children.forEach((buoyObj, idx) => {
        const bob = Math.sin(elapsed * 2.2 + idx * 1.6) * 0.012;
        buoyObj.position.y = 0.03 + bob;

        const ring = buoyObj.children.find(c => c instanceof THREE.Mesh && c.geometry instanceof THREE.RingGeometry);
        if (ring) {
          const pulse = (elapsed * 1.6 + idx * 0.8) % 2.0;
          ring.scale.set(1 + pulse * 1.2, 1 + pulse * 1.2, 1);
          ring.material.opacity = Math.max(0, 0.75 - pulse * 0.38);
        }
      });

      // Vector field: gentle vertical pulse so arrows feel alive
      if (vectorArrowsRef.current?.mesh && vectorGroupRef.current?.visible) {
        const pulse = 1.0 + Math.sin(elapsed * 1.4) * 0.055;
        vectorArrowsRef.current.mesh.scale.y = pulse;
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      if (w === 0 || h === 0) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('click', onClick);
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      renderer.dispose();
      // Dispose volume layer resources explicitly
      if (volumeLayersRef.current) {
        volumeLayersRef.current.geometry?.dispose();
        volumeLayersRef.current.materials?.forEach((m) => m.dispose());
        volumeLayersRef.current = null;
      }
      if (volumeGroupRef.current) { volumeGroupRef.current.clear(); }
      // Dispose isosurface shell resources explicitly
      if (isoMeshesRef.current) {
        isoMeshesRef.current.forEach(({ geo, mat, wireGeo, wireMat }) => {
          geo?.dispose();
          mat?.dispose();
          wireGeo?.dispose();
          wireMat?.dispose();
        });
        isoMeshesRef.current = null;
      }
      if (isoGroupRef.current)    { isoGroupRef.current.clear(); }
      if (vectorGroupRef.current) { vectorGroupRef.current.clear(); }
      // Dispose vector arrow resources explicitly
      if (vectorArrowsRef.current) {
        vectorArrowsRef.current.geometry.dispose();
        vectorArrowsRef.current.material.dispose();
        vectorArrowsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Buoys whenever activeRegion changes
  useEffect(() => {
    if (!buoysGroupRef.current) return;
    const group = buoysGroupRef.current;
    group.clear();

    const buoysList = activeRegion?.buoys || [];
    buoysList.forEach((buoy) => {
      const buoyObj = buildInstrumentMesh(buoy);
      group.add(buoyObj);
    });
  }, [activeRegion]);

  // Rebuild vector field arrows whenever activeRegion or palette changes.
  // paletteRef is kept in sync so the render loop always sees the current palette.
  useEffect(() => {
    paletteRef.current = palette;
    if (!vectorGroupRef.current) return;

    const group = vectorGroupRef.current;

    // Dispose old arrows
    if (vectorArrowsRef.current) {
      vectorArrowsRef.current.geometry.dispose();
      vectorArrowsRef.current.material.dispose();
      group.clear();
      vectorArrowsRef.current = null;
    }

    // Build fresh arrows for new region/palette
    const arrowData = buildVectorArrows(activeRegion, palette);
    group.add(arrowData.mesh);
    vectorArrowsRef.current = arrowData;
  }, [activeRegion, palette]);

  // Update Region and Earth Globe rotation & dynamic wave swell when activeRegion changes
  useEffect(() => {
    if (earthMeshRef.current && activeRegion?.earthRotation) {
      earthMeshRef.current.rotation.set(...activeRegion.earthRotation);
    }

    if (uniformsRef.current.uWaveSwell) {
      const waveH = activeRegion?.waveHeight || 1.65;
      const stormProb = activeRegion?.stormProbability || 50;
      const swellMultiplier = 0.7 + (waveH / 2.0) * 0.8 + (stormProb / 100) * 0.5;
      uniformsRef.current.uWaveSwell.value = swellMultiplier;
    }
  }, [activeRegion]);

  useEffect(() => {
    const paramIndices = { sst: 0, salinity: 1, currents: 2, wave: 3, chlorophyll: 4, oxygen: 5 };
    const pIdx = paramIndices[selectedParam] ?? 0;

    if (uniformsRef.current.uParamType) uniformsRef.current.uParamType.value = pIdx;
    if (depthWallUniformsRef.current.uParamType) depthWallUniformsRef.current.uParamType.value = pIdx;
    if (volumeUniformsRef.current.uParamType) volumeUniformsRef.current.uParamType.value = pIdx;
    if (uniformsRef.current.uDepth) uniformsRef.current.uDepth.value = depth;

    const modeIndices = { surface: 0, depth_slice: 1, volume: 2, volume_render: 2, isosurface: 3, iso_surface: 3, vector_field: 4 };
    if (uniformsRef.current.uMode) uniformsRef.current.uMode.value = modeIndices[viewMode] ?? 1;
  }, [selectedParam, depth, viewMode]);

  // Toggle scene-graph group visibility based on viewMode.
  // This runs independently so it never re-triggers the heavy setup effect.
  useEffect(() => {
    // depthCutawayGroup: shown for depth_slice, volume, isosurface, vector_field.
    // Hidden only for 'surface' (pure 2-D heatmap plane look).
    if (depthCutawayGroupRef.current) {
      depthCutawayGroupRef.current.visible = (viewMode !== 'surface');
    }

    // Placeholder groups – each is visible only in its own mode.
    // Later steps will fill these groups; for now they remain empty.
    if (volumeGroupRef.current) {
      volumeGroupRef.current.visible = (viewMode === 'volume' || viewMode === 'volume_render');
    }
    if (isoGroupRef.current) {
      isoGroupRef.current.visible = (viewMode === 'isosurface' || viewMode === 'iso_surface');
    }
    if (vectorGroupRef.current) {
      vectorGroupRef.current.visible = (viewMode === 'vector_field');
    }
  }, [viewMode]);

  // Synchronize Color Palette, Layer Opacity, Vertical Exaggeration & Scale Mode
  useEffect(() => {
    const paletteMap = { default: 0, turbo: 1, viridis: 2, thermal: 3, coolwarm: 4, jet: 5 };
    const palVal = paletteMap[palette] ?? 1;

    if (uniformsRef.current.uPalette) uniformsRef.current.uPalette.value = palVal;
    if (depthWallUniformsRef.current.uPalette) depthWallUniformsRef.current.uPalette.value = palVal;
    if (volumeUniformsRef.current.uPalette) volumeUniformsRef.current.uPalette.value = palVal;

    if (uniformsRef.current.uOpacity) uniformsRef.current.uOpacity.value = layerOpacity;
    if (depthWallUniformsRef.current.uOpacity) depthWallUniformsRef.current.uOpacity.value = layerOpacity;
    if (volumeUniformsRef.current.uOpacity) volumeUniformsRef.current.uOpacity.value = layerOpacity;

    if (uniformsRef.current.uLogScale) uniformsRef.current.uLogScale.value = isLogScale ? 1 : 0;
    if (depthWallUniformsRef.current.uLogScale) depthWallUniformsRef.current.uLogScale.value = isLogScale ? 1 : 0;
    if (volumeUniformsRef.current.uLogScale) volumeUniformsRef.current.uLogScale.value = isLogScale ? 1 : 0;

    if (depthCutawayGroupRef.current) {
      depthCutawayGroupRef.current.scale.y = verticalExaggeration;
    }
    if (volumeGroupRef.current) {
      volumeGroupRef.current.scale.y = verticalExaggeration;
    }
    if (isoGroupRef.current) {
      isoGroupRef.current.scale.y = verticalExaggeration;
    }
  }, [palette, layerOpacity, verticalExaggeration, isLogScale]);

  // Synchronize Isosurface Extraction Threshold & Palette
  useEffect(() => {
    isoLevelRef.current = isoLevel;
    if (uniformsRef.current.uIsoLevel) {
      uniformsRef.current.uIsoLevel.value = isoLevel;
    }
    if (isoMeshesRef.current && isoMeshesRef.current.length === 3) {
      const oceanWidth = 3.6;
      const oceanDepth = 3.2;
      const depthSliceHeight = 2.4;

      // Update middle dynamic shell
      const mid = isoMeshesRef.current[1];
      mid.threshold = isoLevel;
      updateIsoSheetVertices(mid.geo, isoLevel, oceanWidth, oceanDepth, depthSliceHeight);
      updateIsoSheetVertices(mid.wireGeo, isoLevel, oceanWidth, oceanDepth, depthSliceHeight);
      const midCol = speedToColor(isoLevel, palette);
      mid.mat.color.copy(midCol);

      // Update static shells' colors for current palette
      isoMeshesRef.current[0].mat.color.copy(speedToColor(isoMeshesRef.current[0].threshold, palette));
      isoMeshesRef.current[0].wireMat.color.copy(speedToColor(isoMeshesRef.current[0].threshold, palette));
      isoMeshesRef.current[2].mat.color.copy(speedToColor(isoMeshesRef.current[2].threshold, palette));
      isoMeshesRef.current[2].wireMat.color.copy(speedToColor(isoMeshesRef.current[2].threshold, palette));
    }
  }, [isoLevel, palette]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      
      {/* 3D Canvas Visual PNG Export Button */}
      {showExportButton && (
        <div className="absolute bottom-3.5 right-3.5 z-20 pointer-events-auto">
          <button
            onClick={handleExportPng}
            title={isExported ? "PNG Downloaded!" : "Export 3D View as PNG"}
            aria-label="Export 3D View as PNG"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer shadow-lg backdrop-blur-md group ${
              isExported
                ? 'bg-[#0C969C]/25 text-[#00FFC8] border-[#0C969C]/60'
                : 'bg-[#0D202B]/90 hover:bg-[#142D3A] text-[#8FA8B2] hover:text-[#CCD0CF] border-[#193544] hover:border-[#0C969C]/60'
            }`}
          >
            {isExported ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#00FFC8]" />
                <span className="text-[#00FFC8] font-semibold">Saved PNG!</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5 text-[#0C969C] group-hover:scale-110 transition-transform" />
                <span>Export PNG</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
});

export default OceanCanvas;
