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
// Fog ranges and light distances are configured AFTER FBX load (we don't
// know the model's scale until we measure its bounding box).

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 100000);
camera.position.set(0, 1000, 12000);
camera.lookAt(0, 0, 0);

const orbit = new OrbitControls(camera, canvas);
orbit.enabled = false;

// Lighting — these are placeholders; intensities and positions are rescaled
// to the FBX's actual bounding box in the loader callback (the model turned
// out to be ~12000 units across, so point lights need huge ranges).
const hemi = new THREE.HemisphereLight(0xffe9c2, 0x202028, 0.55);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff0d4, 1.2);
sun.position.set(2000, 8000, 6000);
scene.add(sun);

// Storefront sign accents (pink + cyan). Positions set in onLoad once we
// know where the sign actually is.
const signLight = new THREE.PointLight(0xff5fb8, 4.0, 0);
scene.add(signLight);
const signLight2 = new THREE.PointLight(0x5fb8ff, 2.5, 0);
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
    scene.add(shopRoot);

    // Catalog named nodes (for camera waypoints) AND hide collision proxies.
    // The FBX ships with seven *_Collision meshes (Floor_Collision, Wall_
    // Collision, etc.) — they're meant to be invisible physics volumes in
    // the host engine but render as opaque black walls in three.js, which is
    // what made the whole scene look unlit at first. Hiding them is enough.
    shopRoot.traverse((n) => {
      if (n.name) namedNodes[n.name] = n;
      if (n.isMesh && /collision/i.test(n.name || '')) {
        n.visible = false;
        return;
      }
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

    // Compute world bounds and use them to derive the camera path. The FBX
    // turned out to be ~118 units wide (mostly parking lot + building) so
    // we can't hardcode meter-scale waypoints — they have to scale with
    // whatever the model's native units are.
    shopRoot.updateMatrixWorld(true);
    bbox = new THREE.Box3().setFromObject(shopRoot);
    const size = new THREE.Vector3(); bbox.getSize(size);
    const center = new THREE.Vector3(); bbox.getCenter(center);

    const diag = size.length();

    // Stretch the camera far plane to fit. Model is ~13k units diagonal so
    // the default near/far range was clipping everything.
    camera.near = Math.max(1, diag / 10000);
    camera.far = diag * 4;
    camera.updateProjectionMatrix();

    // Scale the sun + sign lights to the model's actual size. With a
    // ~12000-unit model, light distance values of "10" do literally nothing.
    sun.position.set(center.x + size.x * 0.3, bbox.max.y + size.y * 0.5, center.z + size.z * 0.6);
    signLight.position.set(center.x + size.x * 0.05, bbox.max.y * 0.85, bbox.max.z * 0.95);
    signLight.distance = diag * 0.3;
    signLight2.position.set(center.x - size.x * 0.15, bbox.max.y * 0.8, bbox.max.z * 0.95);
    signLight2.distance = diag * 0.25;

    // Build waypoints from the bounding box. Z+ is "in front of the store"
    // by inspection of the screenshots; we'll confirm once it renders and
    // flip the sign if needed.
    const cx = center.x, cy = bbox.min.y, cz = center.z;
    const halfW = size.x / 2, halfD = size.z / 2;
    const eye = cy + size.y * 0.18; // ~human eye height above floor
    const ceil = cy + size.y * 0.55;

    WAYPOINTS.length = 0;
    WAYPOINTS.push(
      // 0 — wide parking lot establishing shot
      { pos: [cx,             eye + 1.5,  cz + halfD + size.z * 0.5], look: [cx, ceil, cz], fov: 55 },
      // 1 — closer, sign should fill the upper third
      { pos: [cx,             eye + 0.8,  cz + halfD * 0.6],          look: [cx, ceil * 0.85, cz], fov: 45 },
      // 2 — eye-level just past the storefront, looking deeper in
      { pos: [cx,             eye,        cz + halfD * 0.1],          look: [cx, eye * 0.9, cz - halfD * 0.5], fov: 55 },
      // 3 — close on a shelf area
      { pos: [cx - halfW * 0.15, eye - 0.2, cz - halfD * 0.2],        look: [cx - halfW * 0.25, eye - 0.3, cz - halfD * 0.6], fov: 45 },
    );

    // If a Shelf_01 node exists, retarget the final waypoint at its world
    // position — beats my guesses every time.
    const shelf = namedNodes['Shelf_01'] || namedNodes['Shelf'];
    if (shelf) {
      const sw = new THREE.Vector3();
      shelf.getWorldPosition(sw);
      const final = WAYPOINTS[WAYPOINTS.length - 1];
      // sit one shelf-length away on the same Z axis, look at the shelf
      final.look = [sw.x, sw.y, sw.z];
      final.pos = [sw.x + size.x * 0.05, sw.y + 0.5, sw.z + size.z * 0.1];
    }

    statusEl.textContent = `loaded — size ${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)} units, ${Object.keys(namedNodes).length} named nodes`;
    infoEl.textContent = ` | shelves: ${Object.keys(namedNodes).filter(n => /^Shelf/.test(n)).length}`;

    // Expose for live debugging in the preview tool
    window.__cutscene = { scene, camera, renderer, shopRoot, bbox, namedNodes, WAYPOINTS, THREE, setCameraToWaypoint };

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

// Populated from the bounding box at load time — see the FBX onLoad
// callback above. Hardcoded fallback values match the OLD assumed scale
// so a missing-FBX scenario doesn't NaN the camera.
const WAYPOINTS = [
  { pos: [0, 3.0, 14],  look: [0, 2.5, 0],   fov: 50 },
  { pos: [0, 2.5, 8],   look: [0, 2.8, 0],   fov: 45 },
  { pos: [0, 1.7, 2],   look: [0, 1.6, -6],  fov: 55 },
  { pos: [-1.0, 1.5, -3], look: [-2.5, 1.4, -6], fov: 45 },
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
