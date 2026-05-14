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
          // Storefront windows + mirrors — make them semi-transparent so
          // the interior shows through. Disabling depthWrite prevents the
          // glass from occluding shelves behind it in the depth pass; the
          // tradeoff is a small risk of sort glitches at oblique angles.
          if (m.name && /glass|window|mirror/i.test(m.name)) {
            m.transparent = true;
            m.opacity = 0.18;
            m.depthWrite = false;
            // Cool blue tint, low specular bump — feels like real plate glass
            if (m.color) m.color.set(0xb8d0e0);
            if ('shininess' in m) m.shininess = 80;
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

    // We used to overwrite WAYPOINTS with bbox-derived defaults here, but
    // now that we have a hand-tuned path in the const above we want those
    // to be the source of truth. (The waypoint picker still works on top
    // of either — see playFromUserWaypointsIfAny.)

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

// Hand-tuned waypoints captured via the picker. Pos + look in FBX units
// (~mm). WP4 was originally pos===look (degenerate, breaks orbit zoom);
// look was nudged forward by ~150 units along the camera direction so the
// camera has a real look axis to dolly along.
const WAYPOINTS = [
  { pos: [-456.5, 622.0, -3440.0], look: [-311.6, 15.8,  22.6],  fov: 55.0 },
  { pos: [-957.7, 340.7, -1087.7], look: [-956.4, 71.6,  53.7],  fov: 55.0 },
  { pos: [-897.2, 175.4,   -47.7], look: [-898.1, 160.6, 76.8],  fov: 55.0 },
  { pos: [-898.0, 160.8,    76.9], look: [-898.0, 160.8, 226.9], fov: 55.0 },
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

// Catmull-Rom splines for position + look. Building once at the start of
// each cutscene means the path is C¹-continuous through every waypoint —
// no deceleration at each beat the way the old per-leg lerp had. One
// global easeInOutCubic on `t` keeps the run cinematic (slow start, slow
// stop) without per-waypoint pauses.
let posCurve = null;
let lookCurve = null;
let fovKeys = [];

function rebuildSplines() {
  const posPts = WAYPOINTS.map((w) => new THREE.Vector3(...w.pos));
  const lookPts = WAYPOINTS.map((w) => new THREE.Vector3(...w.look));
  // `centripetal` parameterization avoids the cusps/overshoot that the
  // default `centripetal` (no wait, the default is `centripetal` since
  // r122) can introduce on unevenly-spaced waypoints. Setting tension low
  // for a relaxed dolly feel.
  posCurve = new THREE.CatmullRomCurve3(posPts, false, 'centripetal', 0.3);
  lookCurve = new THREE.CatmullRomCurve3(lookPts, false, 'centripetal', 0.3);
  fovKeys = WAYPOINTS.map((w) => w.fov);
}

function sampleFov(t) {
  // Piecewise-linear over the same parameter so fov keys match positions.
  const legs = fovKeys.length - 1;
  if (legs <= 0) return fovKeys[0] || 50;
  const legT = t * legs;
  const i = Math.min(Math.floor(legT), legs - 1);
  const localT = legT - i;
  return fovKeys[i] + (fovKeys[i + 1] - fovKeys[i]) * localT;
}

let cutsceneStart = null;
let cutsceneActive = false;

function tickCutscene(now) {
  if (!cutsceneActive || !posCurve) return;
  const elapsed = now - cutsceneStart;
  const rawT = Math.min(1, elapsed / TOTAL_DURATION_MS);
  // Global ease so the run starts gentle and lands gentle, but the
  // middle plays at near-uniform speed — no mid-path pauses.
  const t = easeInOutCubic(rawT);

  const pos = posCurve.getPoint(t);
  const look = lookCurve.getPoint(t);

  camera.position.copy(pos);
  camera.lookAt(look);
  camera.fov = sampleFov(t);
  camera.updateProjectionMatrix();

  statusEl.textContent = `cutscene ${(rawT * 100).toFixed(0)}%`;

  if (rawT >= 1) {
    cutsceneActive = false;
    statusEl.textContent = `cutscene complete (handoff to game would happen now)`;
  }
}

document.getElementById('play').addEventListener('click', () => {
  if (!shopRoot) return;
  orbit.enabled = false;
  playFromUserWaypointsIfAny();
  rebuildSplines();
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

// ---- Waypoint picker -------------------------------------------------
//
// Let the user fly around (free orbit) and save the camera's current
// position + look target as a waypoint. The cutscene then interpolates
// through the saved list. Waypoints persist in localStorage so the user
// can iterate without losing them on reload.

const LS_KEY = 'cutscene-preview:waypoints:v1';
const userWaypoints = loadUserWaypoints();
const wpListEl = document.getElementById('wp-list');
const exportBoxEl = document.getElementById('export-box');

function loadUserWaypoints() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUserWaypoints() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(userWaypoints));
  } catch {}
}

function captureCurrentWaypoint() {
  // OrbitControls.target is the camera's lookAt point — perfect for waypoints.
  // If orbit isn't enabled, project forward from the camera direction so
  // the user still gets a sensible look target.
  let look;
  if (orbit.enabled) {
    look = orbit.target.clone();
  } else {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const dist = bbox ? bbox.getSize(new THREE.Vector3()).length() * 0.05 : 100;
    look = camera.position.clone().add(dir.multiplyScalar(dist));
  }

  // Guard against a degenerate position==look pair. If the user zoomed
  // all the way to the orbit target, pos and target collapse — the saved
  // waypoint then has zero look-axis, which (a) breaks OrbitControls zoom
  // on subsequent edits and (b) makes the spline tangent undefined. Push
  // the look point forward along the camera's facing by a small fraction
  // of the model diagonal.
  const MIN_LOOK_DIST = bbox ? bbox.getSize(new THREE.Vector3()).length() * 0.01 : 50;
  if (camera.position.distanceTo(look) < MIN_LOOK_DIST) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir); // already normalized
    look = camera.position.clone().add(dir.multiplyScalar(MIN_LOOK_DIST));
  }

  return {
    pos: camera.position.toArray(),
    look: look.toArray(),
    fov: camera.fov,
  };
}

function renderWaypointList() {
  wpListEl.innerHTML = '';
  if (userWaypoints.length === 0) {
    wpListEl.innerHTML = '<div style="color:#666;font-style:italic;font-size:11px">no waypoints — using bbox defaults</div>';
    return;
  }
  userWaypoints.forEach((wp, i) => {
    const row = document.createElement('div');
    row.className = 'wp-item';
    const [x, y, z] = wp.pos.map((n) => Math.round(n));
    row.innerHTML = `
      <span class="wp-label">${i + 1}. <span class="wp-coords">[${x},${y},${z}] fov ${Math.round(wp.fov)}</span></span>
      <button data-i="${i}" class="wp-go">go</button>
      <button data-i="${i}" class="wp-up secondary">↑</button>
      <button data-i="${i}" class="wp-down secondary">↓</button>
      <button data-i="${i}" class="wp-del secondary">✕</button>
    `;
    wpListEl.appendChild(row);
  });
  // Wire up per-row buttons
  wpListEl.querySelectorAll('.wp-go').forEach((b) =>
    b.addEventListener('click', (e) => goToWaypoint(parseInt(e.target.dataset.i, 10))),
  );
  wpListEl.querySelectorAll('.wp-del').forEach((b) =>
    b.addEventListener('click', (e) => { userWaypoints.splice(parseInt(e.target.dataset.i, 10), 1); saveUserWaypoints(); renderWaypointList(); }),
  );
  wpListEl.querySelectorAll('.wp-up').forEach((b) =>
    b.addEventListener('click', (e) => {
      const i = parseInt(e.target.dataset.i, 10);
      if (i > 0) { [userWaypoints[i-1], userWaypoints[i]] = [userWaypoints[i], userWaypoints[i-1]]; saveUserWaypoints(); renderWaypointList(); }
    }),
  );
  wpListEl.querySelectorAll('.wp-down').forEach((b) =>
    b.addEventListener('click', (e) => {
      const i = parseInt(e.target.dataset.i, 10);
      if (i < userWaypoints.length - 1) { [userWaypoints[i+1], userWaypoints[i]] = [userWaypoints[i], userWaypoints[i+1]]; saveUserWaypoints(); renderWaypointList(); }
    }),
  );
}

function goToWaypoint(i) {
  const wp = userWaypoints[i];
  if (!wp) return;
  cutsceneActive = false;
  camera.position.fromArray(wp.pos);

  // Sanitize the look target so OrbitControls always has a non-zero
  // axis to dolly along. If pos==look (degenerate, was a real bug),
  // push the look out 1% of the model diagonal in the camera's last
  // facing direction.
  const lookVec = new THREE.Vector3().fromArray(wp.look);
  const minDist = bbox ? bbox.getSize(new THREE.Vector3()).length() * 0.01 : 50;
  if (camera.position.distanceTo(lookVec) < minDist) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    if (dir.lengthSq() < 0.1) dir.set(0, 0, -1);
    lookVec.copy(camera.position).add(dir.multiplyScalar(minDist));
  }

  camera.lookAt(lookVec);
  camera.fov = wp.fov;
  camera.updateProjectionMatrix();
  if (orbit.enabled) {
    orbit.target.copy(lookVec);
    orbit.update();
  }
}

function playFromUserWaypointsIfAny() {
  if (userWaypoints.length >= 2) {
    WAYPOINTS.length = 0;
    for (const wp of userWaypoints) WAYPOINTS.push({ pos: wp.pos.slice(), look: wp.look.slice(), fov: wp.fov });
    statusEl.textContent = `playing ${userWaypoints.length} user waypoints…`;
  } else {
    statusEl.textContent = userWaypoints.length === 1
      ? '1 waypoint — need at least 2 for a path; using defaults'
      : 'playing bbox defaults — save 2+ waypoints to use your own';
  }
}

document.getElementById('wp-save').addEventListener('click', () => {
  userWaypoints.push(captureCurrentWaypoint());
  saveUserWaypoints();
  renderWaypointList();
});

document.getElementById('wp-clear').addEventListener('click', () => {
  if (userWaypoints.length === 0) return;
  if (!confirm(`Clear all ${userWaypoints.length} waypoints?`)) return;
  userWaypoints.length = 0;
  saveUserWaypoints();
  renderWaypointList();
});

document.getElementById('wp-play').addEventListener('click', () => {
  document.getElementById('play').click();
});

document.getElementById('wp-export').addEventListener('click', () => {
  if (userWaypoints.length === 0) { exportBoxEl.style.display = 'none'; return; }
  // Format as something paste-able into source code.
  const lines = userWaypoints.map((wp) => {
    const p = wp.pos.map((n) => n.toFixed(1)).join(', ');
    const l = wp.look.map((n) => n.toFixed(1)).join(', ');
    return `  { pos: [${p}], look: [${l}], fov: ${wp.fov.toFixed(1)} },`;
  });
  exportBoxEl.value = `const WAYPOINTS = [\n${lines.join('\n')}\n];`;
  exportBoxEl.style.display = 'block';
  exportBoxEl.select();
});

renderWaypointList();

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
