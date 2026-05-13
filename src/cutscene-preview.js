// Standalone preview for the "new-store" cutscene experiment.
//
// Loads public/new-store/Models/Shop_VHS.fbx with its textures, sets up
// lighting that matches the reference renders (warm ceiling fluorescents,
// neon storefront sign), and runs a scripted camera path:
//
//   waypoint 0 — parking lot, looking at the storefront
//   waypoint 1 — approaching the doorway, slight pan up to the neon sign
//   waypoint 2 — just inside the entrance, looking down the central aisle
//   waypoint 3 — close on one of the shelves (Shelf_01)
//
// The cutscene is on a manual trigger button so we can iterate without
// reloading. There's also a "free orbit" toggle so we can hand-fly the
// camera and find better waypoints.
//
// This is intentionally a self-contained PoC — it does NOT touch the
// existing game scene. If/when we integrate, the camera path + lighting
// recipe ports over; the FBX loader call stays the same.

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const canvas = document.getElementById('cv');
const statusEl = document.getElementById('status');
const infoEl = document.getElementById('info');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x05060a);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x05060a, 12, 60);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 4, 18);
camera.lookAt(0, 2, 0);

// Optional hand-fly camera while iterating on waypoints.
const orbit = new OrbitControls(camera, canvas);
orbit.enabled = false;
orbit.target.set(0, 1.5, 0);

// Lighting recipe — chosen to roughly match the reference renders:
//  - low ambient so interior contrast pops
//  - warm directional sun-from-above for shelf falloff
//  - magenta/cyan accent on the storefront sign
const ambient = new THREE.AmbientLight(0xfff5e6, 0.35);
scene.add(ambient);

const overhead = new THREE.DirectionalLight(0xfff0d4, 0.9);
overhead.position.set(2, 12, 6);
overhead.castShadow = false; // skip shadows on PoC — adds cost, FBX uses baked materials anyway
scene.add(overhead);

// Storefront neon (pink) — sits roughly where "VHS Video" is in the render
const signLight = new THREE.PointLight(0xff5fb8, 1.6, 14);
signLight.position.set(0, 5.5, 6);
scene.add(signLight);

// Storefront neon (cyan) — fill on the other half of the sign
const signLight2 = new THREE.PointLight(0x5fb8ff, 1.0, 12);
signLight2.position.set(-3.0, 5.0, 6);
scene.add(signLight2);

// ---- FBX load ---------------------------------------------------------

const fbxLoader = new FBXLoader();
// The FBX has Windows absolute texture paths embedded. FBXLoader strips
// the dir and looks up by filename in resourcePath.
fbxLoader.setResourcePath('/new-store/Textures/');

let shopRoot = null;
let bbox = null;
let namedNodes = {};

fbxLoader.load(
  '/new-store/Models/Shop_VHS.fbx',
  (object) => {
    shopRoot = object;

    // The FBX is in centimeters (default Maya/Blender export). Scale down
    // to meters so it plays nicely with our existing scene units.
    shopRoot.scale.setScalar(0.01);
    scene.add(shopRoot);

    // Catalog named nodes so we can anchor camera waypoints to them.
    shopRoot.traverse((n) => {
      if (n.name) namedNodes[n.name] = n;
      // Ensure all materials use sRGB color textures
      if (n.isMesh && n.material) {
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        for (const m of mats) {
          if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
          // Lights_Emisor texture is the FBX's emissive — keep it bright
          if (m.name && /emis|light/i.test(m.name)) {
            m.emissiveMap = m.map;
            m.emissive = new THREE.Color(0xffffff);
            m.emissiveIntensity = 1.2;
          }
        }
      }
    });

    // Compute world bounds so the camera waypoints can be relative to the
    // actual model size (the .scale.setScalar call above may not have
    // committed by the time we measure, so update matrices first).
    shopRoot.updateMatrixWorld(true);
    bbox = new THREE.Box3().setFromObject(shopRoot);
    const size = new THREE.Vector3(); bbox.getSize(size);
    const center = new THREE.Vector3(); bbox.getCenter(center);

    statusEl.textContent = `loaded — size ${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)}m, ${Object.keys(namedNodes).length} named nodes`;
    infoEl.textContent = ` | shelves: ${Object.keys(namedNodes).filter(n => /^Shelf/.test(n)).length}`;

    // Park the camera at the start position
    setCameraToWaypoint(0);
  },
  (xhr) => {
    if (xhr.lengthComputable) {
      statusEl.textContent = `loading FBX… ${Math.round((xhr.loaded / xhr.total) * 100)}%`;
    }
  },
  (err) => {
    statusEl.textContent = `FBX load failed: ${err.message || err}`;
    console.error(err);
  },
);

// ---- Camera waypoints + path animation -------------------------------
//
// Numbers were chosen empirically against the FBX's apparent size; the
// "free orbit" button lets us refine them by hand. Each waypoint is
// { pos, look, fov }. We tween between them with cubic easing.

const WAYPOINTS = [
  // Parking lot — far back, slight elevation, looking at the storefront
  { pos: [0, 3.0, 14],  look: [0, 2.5, 0],   fov: 50,  dwell: 0.8 },
  // Approach — lower, closer, sign fills the upper third
  { pos: [0, 2.5, 8],   look: [0, 2.8, 0],   fov: 45,  dwell: 0.6 },
  // Through the doorway — eye level, looking down the central aisle
  { pos: [0, 1.7, 2],   look: [0, 1.6, -6],  fov: 55,  dwell: 0.6 },
  // Close on a shelf — slight angle, fills frame
  { pos: [-1.0, 1.5, -3], look: [-2.5, 1.4, -6], fov: 45, dwell: 1.0 },
];

const TOTAL_DURATION_MS = 7000; // total cutscene length

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function setCameraToWaypoint(i) {
  const w = WAYPOINTS[i];
  camera.position.set(...w.pos);
  camera.lookAt(...w.look);
  camera.fov = w.fov;
  camera.updateProjectionMatrix();
}

let cutsceneStart = null;
let cutsceneActive = false;

function tickCutscene(now) {
  if (!cutsceneActive) return;
  const elapsed = now - cutsceneStart;
  const t = Math.min(1, elapsed / TOTAL_DURATION_MS);

  // Map normalized t (0..1) onto the waypoint list. Each leg gets an
  // equal slice; within a leg, easeInOutCubic.
  const legs = WAYPOINTS.length - 1;
  const legT = t * legs;
  const legIdx = Math.min(Math.floor(legT), legs - 1);
  const localT = easeInOutCubic(legT - legIdx);

  const a = WAYPOINTS[legIdx];
  const b = WAYPOINTS[legIdx + 1];

  camera.position.set(
    a.pos[0] + (b.pos[0] - a.pos[0]) * localT,
    a.pos[1] + (b.pos[1] - a.pos[1]) * localT,
    a.pos[2] + (b.pos[2] - a.pos[2]) * localT,
  );
  const lookX = a.look[0] + (b.look[0] - a.look[0]) * localT;
  const lookY = a.look[1] + (b.look[1] - a.look[1]) * localT;
  const lookZ = a.look[2] + (b.look[2] - a.look[2]) * localT;
  camera.lookAt(lookX, lookY, lookZ);
  camera.fov = a.fov + (b.fov - a.fov) * localT;
  camera.updateProjectionMatrix();

  statusEl.textContent = `cutscene ${(t * 100).toFixed(0)}% — leg ${legIdx + 1}/${legs}`;

  if (t >= 1) {
    cutsceneActive = false;
    statusEl.textContent = `cutscene complete (handoff to game would happen now)`;
  }
}

document.getElementById('play').addEventListener('click', () => {
  if (!shopRoot) return;
  orbit.enabled = false;
  cutsceneActive = true;
  cutsceneStart = performance.now();
});

document.getElementById('orbit').addEventListener('click', () => {
  orbit.enabled = !orbit.enabled;
  cutsceneActive = false;
  statusEl.textContent = orbit.enabled
    ? 'free orbit — drag to rotate, wheel to zoom, right-drag to pan'
    : 'free orbit off';
});

// ---- render loop ------------------------------------------------------

function animate(now) {
  requestAnimationFrame(animate);
  tickCutscene(now);
  if (orbit.enabled) orbit.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
