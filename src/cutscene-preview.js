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
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';

const canvas = document.getElementById('cv');
const statusEl = document.getElementById('status');
const infoEl = document.getElementById('info');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
// OutputPass at the end of the composer handles tone mapping + color
// space, so the renderer itself stays linear / no-tonemapping — passing
// through both would double-correct and wash the image out. Exposure is
// applied via the renderer.toneMappingExposure value which OutputPass
// reads at run time, so we still control it here.
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1.8; // OutputPass picks this up
renderer.setClearColor(0x05060a);

const scene = new THREE.Scene();
// Fog ranges and light distances are configured AFTER FBX load (we don't
// know the model's scale until we measure its bounding box).

// Procedural starry night skybox. Generated once on a 2D canvas, wrapped
// to a cubemap-equivalent via Scene.background = Texture. Much cheaper
// than 6 image files and gives us a deep blue gradient + speckle stars
// without external assets.
function buildStarryNightTexture(width = 2048, height = 1024) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  // Deep navy → near-black gradient top→bottom
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#0a0e1e');
  grad.addColorStop(0.55, '#050810');
  grad.addColorStop(1, '#020308');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  // Stars — small bright pixels with slight color variation
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height * 0.7; // bias toward upper sky
    const r = Math.random();
    const size = r < 0.85 ? 1 : r < 0.97 ? 2 : 3;
    const alpha = 0.5 + Math.random() * 0.5;
    // slight color tint: pure white, slight blue, slight yellow
    const tint = Math.random();
    const color = tint < 0.7 ? '255,255,255' : tint < 0.9 ? '180,200,255' : '255,240,200';
    ctx.fillStyle = `rgba(${color},${alpha})`;
    ctx.fillRect(x, y, size, size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}
scene.background = buildStarryNightTexture();

// Image-based-lighting environment. Three.js ships a RoomEnvironment that
// approximates an indoor light box (bright top, dim sides) — perfect for
// faking the "yellow walls bouncing onto everything" feel of the
// reference renders. Standard materials sample this for ambient fill
// without us having to position a dozen extra PointLights.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
// envMap intensity defaults to 1 per material; we crank it scene-wide
// later by overriding when we promote Phong → Standard.

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 100000);
camera.position.set(0, 1000, 12000);
camera.lookAt(0, 0, 0);

const orbit = new OrbitControls(camera, canvas);
orbit.enabled = false;

// ---- Postprocessing stack -------------------------------------------
//
// Roughly matches the reference renders' "PS1 vibe":
//   bloom     — soft glow on the emissive ceiling fluorescents + sign
//   rgb shift — subtle chromatic aberration on the frame edges
//   film      — grain + faint scanlines, no greyscale
//   vignette  — gentle frame darkening
//   output    — final tone mapping + sRGB encoding (replaces the
//                renderer's own pass — see comment in renderer setup)
//
// Sizes are based on innerWidth/Height; rebuilt on resize.

const composer = new EffectComposer(renderer);
composer.setSize(window.innerWidth, window.innerHeight);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// UnrealBloomPass(resolution, strength, radius, threshold)
// Threshold > 1.0 only blooms HDR values (i.e. surfaces whose lit color
// exceeds normal SDR range). With Standard materials sampling IBL +
// emissive intensity, anything we INTEND to glow has emissive >= 1.5,
// so threshold 1.5 cleanly isolates fluorescents and the sign. Bright
// diffuse pixels in VHS covers / carpet patches stay under threshold
// and don't blow out.
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.6,  // strength — bumped slightly since fewer pixels qualify now
  0.5,  // radius
  1.5,  // threshold (was 0.85)
);
composer.addPass(bloomPass);

const rgbShift = new ShaderPass(RGBShiftShader);
rgbShift.uniforms.amount.value = 0.0018;  // ~3px channel split at 1080p
composer.addPass(rgbShift);

// FilmPass(intensity, grayscale). Newer three.js versions drop the
// scanline parameters — we use intensity ~0.25 for visible-but-not-
// distracting grain, grayscale=false to keep colors.
const filmPass = new FilmPass(0.25, false);
composer.addPass(filmPass);

const vignette = new ShaderPass(VignetteShader);
vignette.uniforms.offset.value = 1.05;
vignette.uniforms.darkness.value = 1.15;
composer.addPass(vignette);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// Lighting — placeholder intensities/positions; rescaled in onLoad. The
// reference renders were lit in Blender with global illumination, which
// three.js can't do real-time, so we fake it with a strong ambient floor
// (hemisphere) + sun + a clutch of fill points inside the building.
const hemi = new THREE.HemisphereLight(0xfff0d4, 0x282030, 2.2);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff0d4, 2.0);
sun.position.set(2000, 8000, 6000);
scene.add(sun);

// Front fill — a soft directional aimed at the storefront so the brick
// wall reads in the establishing shot. Without this the building is back-
// lit by the sun and reads as a silhouette from the parking-lot waypoint.
const frontFill = new THREE.DirectionalLight(0xfff4dc, 1.4);
frontFill.position.set(0, 1500, -5000); // negative-z = "out from store"
frontFill.target.position.set(0, 0, 0);
scene.add(frontFill);
scene.add(frontFill.target);

// Storefront sign accents (pink + cyan).
const signLight = new THREE.PointLight(0xff5fb8, 8.0, 0, 1.6);
scene.add(signLight);
const signLight2 = new THREE.PointLight(0x5fb8ff, 5.0, 0, 1.6);
scene.add(signLight2);

// Interior fill — populated after FBX load by parking warm point lights
// at every ceiling fixture (Lamp_*) world position. Stored at module scope
// so the lights can be rescaled if needed.
const interiorLights = [];

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
        for (let i = 0; i < mats.length; i++) {
          const phong = mats[i];
          // Promote Phong → Standard so the material samples scene.environment
          // (IBL fill). FBXLoader gives us MeshPhongMaterial by default, which
          // ignores scene.environment entirely — that's why textured walls
          // looked monochrome despite the diffuse maps being loaded. We
          // preserve diffuse map + emissive but reset color to white so the
          // texture isn't dimmed by Phong's default 0xcccccc base.
          let std;
          if (phong.isMeshPhongMaterial || phong.isMeshLambertMaterial) {
            std = new THREE.MeshStandardMaterial({
              name: phong.name,
              map: phong.map || null,
              color: 0xffffff,         // was 0xcccccc — let the texture speak
              transparent: phong.transparent,
              opacity: phong.opacity,
              alphaTest: phong.alphaTest,
              side: phong.side,
              roughness: 0.95,         // very matte — kills specular highlights
                                       // on the floor + VHS covers that were
                                       // catching the env map and blooming
              metalness: 0.0,
              envMapIntensity: 0.6,    // was 1.2 — IBL was lifting bright
                                       // diffuse pixels into bloom range
            });
            // Replace in place
            if (Array.isArray(n.material)) n.material[i] = std;
            else n.material = std;
            // Free the old material's GL resources eventually
            phong.dispose?.();
          } else {
            std = phong;
          }
          if (std.map) std.map.colorSpace = THREE.SRGBColorSpace;

          // Per-material overrides (re-applied after promotion).
          if (std.name && /emis|^light/i.test(std.name)) {
            std.emissiveMap = std.map;
            std.emissive = new THREE.Color(0xfff4d8);
            std.emissiveIntensity = 1.5;
            std.envMapIntensity = 0.3; // don't double-bright the glowing parts
          }
          if (std.name && /glass|window|mirror/i.test(std.name)) {
            std.transparent = true;
            std.opacity = 0.18;
            std.depthWrite = false;
            std.color.set(0xb8d0e0);
            std.roughness = 0.1;
            std.metalness = 0.0;
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

    // Constrain orbit dolly to a sensible range. Without bounds, the
    // multiplicative zoom asymptotes toward 0 as you approach the target —
    // each scroll moves the camera by less and less, which reads as a
    // "stuck" feeling even though it's still technically zooming. Floor it
    // at ~2.5% of diagonal so each scroll always produces visible motion.
    orbit.minDistance = diag * 0.025;
    orbit.maxDistance = diag * 2.0;

    // Plant a warm point light at every Lamp_* fixture so the interior is
    // actually lit (not just visually emissive-but-dark). Without these,
    // the bloom pass made the fixtures glow but the rest of the inside
    // stayed pitch black, because emissive surfaces don't illuminate
    // other surfaces in three.js (only actual lights do).
    const lampNames = Object.keys(namedNodes).filter((n) => /^Lamp/i.test(n));
    const lampRange = diag * 0.18;
    const lampIntensity = (diag * diag) / 220000; // was /90000 — overlapping
                                                   // fixtures stacked light
                                                   // hard near the camera
    for (const name of lampNames) {
      const node = namedNodes[name];
      const wp = new THREE.Vector3();
      node.getWorldPosition(wp);
      const pt = new THREE.PointLight(0xfff0c8, lampIntensity, lampRange, 1.8);
      pt.position.copy(wp);
      scene.add(pt);
      interiorLights.push(pt);
    }

    // We used to overwrite WAYPOINTS with bbox-derived defaults here, but
    // now that we have a hand-tuned path in the const above we want those
    // to be the source of truth. (The waypoint picker still works on top
    // of either — see playFromUserWaypointsIfAny.)

    statusEl.textContent = `loaded — size ${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)} units, ${Object.keys(namedNodes).length} named nodes`;
    infoEl.textContent = ` | shelves: ${Object.keys(namedNodes).filter(n => /^Shelf/.test(n)).length}`;

    // Expose for live debugging in the preview tool
    window.__cutscene = { scene, camera, renderer, shopRoot, bbox, namedNodes, WAYPOINTS, THREE, setCameraToWaypoint, orbit };

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
// (~mm). Replace these with the latest export from the picker UI when
// the path changes — that's the workflow.
const WAYPOINTS = [
  { pos: [584.4,   605.6, -3137.2], look: [-731.7,  141.9, 126.1], fov: 55.0 },
  { pos: [-754.6,  174.5,   -22.6], look: [-804.2,  157.0, 100.3], fov: 55.0 },
  { pos: [-1000.9, 165.3,    22.2], look: [-1050.4, 147.9, 145.1], fov: 55.0 },
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
  if (orbit.enabled) {
    // Push the orbit target ~10% of diagonal in front of the camera. This
    // gives the dolly a comfortable range regardless of whatever tight
    // close-up the camera was sitting in (a saved waypoint with look near
    // pos would otherwise leave us with almost no dolly headroom — the
    // "plateau" symptom).
    const diag = bbox ? bbox.getSize(new THREE.Vector3()).length() : 1000;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    orbit.target.copy(camera.position).add(dir.multiplyScalar(diag * 0.1));
    orbit.update();
  }
  statusEl.textContent = orbit.enabled
    ? `free orbit — drag to rotate, wheel to zoom (range ${Math.round(orbit.minDistance)}–${Math.round(orbit.maxDistance)})`
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

// ---- Live tweak sliders ---------------------------------------------
//
// Bind each visible slider to the matching three.js / composer
// property so it updates without a reload. Per-material values
// (envMapIntensity, emissiveIntensity, lamp light intensity) require
// walking the scene to fan out — the FBX has 540+ materials so we do
// the walk once per slider event, not per frame.

const DEFAULTS = {
  exposure: 1.8,
  bloomStrength: 0.6,
  bloomThreshold: 1.5,
  bloomRadius: 0.5,
  hemi: 2.2,
  sun: 2.0,
  fill: 1.4,
  lamps: 1.0,
  env: 0.6,
  emis: 1.5,
  rgb: 0.0018,
  film: 0.25,
  vig: 1.15,
};
const tweaks = { ...DEFAULTS };

function fanOutEnvIntensity(v) {
  if (!shopRoot) return;
  shopRoot.traverse((n) => {
    if (n.isMesh && n.material) {
      const arr = Array.isArray(n.material) ? n.material : [n.material];
      for (const m of arr) {
        if (m.isMeshStandardMaterial) {
          if (m.name && /emis|^light/i.test(m.name)) continue;
          m.envMapIntensity = v;
        }
      }
    }
  });
}

function fanOutEmissive(v) {
  if (!shopRoot) return;
  shopRoot.traverse((n) => {
    if (n.isMesh && n.material) {
      const arr = Array.isArray(n.material) ? n.material : [n.material];
      for (const m of arr) {
        if (m.name && /emis|^light/i.test(m.name)) {
          m.emissiveIntensity = v;
        }
      }
    }
  });
}

function fanOutLampIntensity(scale) {
  const base = bbox ? bbox.getSize(new THREE.Vector3()).length() : 1000;
  const baseIntensity = (base * base) / 220000;
  for (const pt of interiorLights) pt.intensity = baseIntensity * scale;
}

function bindSlider(id, valId, getter, setter) {
  const s = document.getElementById(id);
  const v = document.getElementById(valId);
  if (!s || !v) return;
  const cur = getter();
  s.value = cur;
  v.textContent = (typeof cur === 'number' && cur < 0.01) ? cur.toFixed(4) : cur.toFixed(2);
  s.addEventListener('input', () => {
    const n = parseFloat(s.value);
    setter(n);
    v.textContent = (n < 0.01) ? n.toFixed(4) : n.toFixed(2);
  });
}

function initTweakSliders() {
  bindSlider('s-exposure', 'v-exposure',
    () => renderer.toneMappingExposure,
    (n) => { renderer.toneMappingExposure = n; tweaks.exposure = n; });

  bindSlider('s-bloom-strength', 'v-bloom-strength',
    () => bloomPass.strength,
    (n) => { bloomPass.strength = n; tweaks.bloomStrength = n; });
  bindSlider('s-bloom-threshold', 'v-bloom-threshold',
    () => bloomPass.threshold,
    (n) => { bloomPass.threshold = n; tweaks.bloomThreshold = n; });
  bindSlider('s-bloom-radius', 'v-bloom-radius',
    () => bloomPass.radius,
    (n) => { bloomPass.radius = n; tweaks.bloomRadius = n; });

  bindSlider('s-hemi', 'v-hemi',
    () => hemi.intensity,
    (n) => { hemi.intensity = n; tweaks.hemi = n; });
  bindSlider('s-sun', 'v-sun',
    () => sun.intensity,
    (n) => { sun.intensity = n; tweaks.sun = n; });
  bindSlider('s-fill', 'v-fill',
    () => frontFill.intensity,
    (n) => { frontFill.intensity = n; tweaks.fill = n; });
  bindSlider('s-lamps', 'v-lamps',
    () => tweaks.lamps,
    (n) => { fanOutLampIntensity(n); tweaks.lamps = n; });

  bindSlider('s-env', 'v-env',
    () => tweaks.env,
    (n) => { fanOutEnvIntensity(n); tweaks.env = n; });
  bindSlider('s-emis', 'v-emis',
    () => tweaks.emis,
    (n) => { fanOutEmissive(n); tweaks.emis = n; });

  bindSlider('s-rgb', 'v-rgb',
    () => rgbShift.uniforms.amount.value,
    (n) => { rgbShift.uniforms.amount.value = n; tweaks.rgb = n; });
  bindSlider('s-film', 'v-film',
    () => filmPass.uniforms?.intensity?.value ?? tweaks.film,
    (n) => {
      if (filmPass.uniforms?.intensity) filmPass.uniforms.intensity.value = n;
      tweaks.film = n;
    });
  bindSlider('s-vig', 'v-vig',
    () => vignette.uniforms.darkness.value,
    (n) => { vignette.uniforms.darkness.value = n; tweaks.vig = n; });

  document.getElementById('tweaks-reset').addEventListener('click', () => {
    Object.assign(tweaks, DEFAULTS);
    renderer.toneMappingExposure = DEFAULTS.exposure;
    bloomPass.strength = DEFAULTS.bloomStrength;
    bloomPass.threshold = DEFAULTS.bloomThreshold;
    bloomPass.radius = DEFAULTS.bloomRadius;
    hemi.intensity = DEFAULTS.hemi;
    sun.intensity = DEFAULTS.sun;
    frontFill.intensity = DEFAULTS.fill;
    fanOutLampIntensity(DEFAULTS.lamps);
    fanOutEnvIntensity(DEFAULTS.env);
    fanOutEmissive(DEFAULTS.emis);
    rgbShift.uniforms.amount.value = DEFAULTS.rgb;
    if (filmPass.uniforms?.intensity) filmPass.uniforms.intensity.value = DEFAULTS.film;
    vignette.uniforms.darkness.value = DEFAULTS.vig;
    // Re-sync slider DOM positions
    for (const [sliderId, defaultKey] of [
      ['s-exposure', 'exposure'], ['s-bloom-strength', 'bloomStrength'],
      ['s-bloom-threshold', 'bloomThreshold'], ['s-bloom-radius', 'bloomRadius'],
      ['s-hemi', 'hemi'], ['s-sun', 'sun'], ['s-fill', 'fill'], ['s-lamps', 'lamps'],
      ['s-env', 'env'], ['s-emis', 'emis'],
      ['s-rgb', 'rgb'], ['s-film', 'film'], ['s-vig', 'vig'],
    ]) {
      const el = document.getElementById(sliderId);
      if (!el) continue;
      el.value = DEFAULTS[defaultKey];
      const valEl = document.getElementById('v-' + sliderId.slice(2));
      if (valEl) {
        const n = DEFAULTS[defaultKey];
        valEl.textContent = (n < 0.01) ? n.toFixed(4) : n.toFixed(2);
      }
    }
  });

  document.getElementById('tweaks-export').addEventListener('click', () => {
    const box = document.getElementById('tweaks-export-box');
    box.value = `const TWEAKS = ${JSON.stringify(tweaks, null, 2)};`;
    box.style.display = 'block';
    box.select();
  });
}

// Wait for the FBX so per-material fanOut calls have something to walk.
const tweakInitTimer = setInterval(() => {
  if (shopRoot) {
    clearInterval(tweakInitTimer);
    initTweakSliders();
  }
}, 200);

// ---- render loop ------------------------------------------------------

function animate(now) {
  requestAnimationFrame(animate);
  tickCutscene(now);
  if (orbit.enabled) orbit.update();
  composer.render();
}
requestAnimationFrame(animate);

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.setSize(w, h);
});
