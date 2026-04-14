import * as THREE from 'three';

const SHELF_COLOR = 0x8B6914;
const SHELF_DARK = 0x5C4411;
const BG_COLOR = 0x1A1A2E;

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(BG_COLOR);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG_COLOR, 15, 25);

  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 50);

  // Auto-fit: compute camera Z so tapes fill the usable viewport
  const camZ = computeCameraZ(camera.fov, aspect);
  camera.position.set(0, 0.5, camZ);
  camera.lookAt(0, 0, 0);

  // Ambient light
  const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.4);
  scene.add(ambientLight);

  // Directional light (overhead fluorescent)
  const mainLight = new THREE.DirectionalLight(0xfff0d4, 0.8);
  mainLight.position.set(0, 6, 4);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.set(1024, 1024);
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 20;
  mainLight.shadow.camera.left = -5;
  mainLight.shadow.camera.right = 5;
  mainLight.shadow.camera.top = 5;
  mainLight.shadow.camera.bottom = -5;
  scene.add(mainLight);

  // Fill light from below
  const fillLight = new THREE.PointLight(0xffcc88, 0.2, 10);
  fillLight.position.set(0, -2, 3);
  scene.add(fillLight);

  // Neon "OPEN" sign glow
  const neonLight = new THREE.PointLight(0xFF6B9D, 0.3, 8);
  neonLight.position.set(3.5, 3.5, 1);
  scene.add(neonLight);

  // Build shelf
  const shelfGroup = buildShelf();
  scene.add(shelfGroup);

  // Neighbor shelves (left and right) with dark dummy cases
  const leftShelf = buildShelf();
  leftShelf.position.set(-5.0, 0, -1.5);
  scene.add(leftShelf);
  addDummyCases(leftShelf, scene);

  const rightShelf = buildShelf();
  rightShelf.position.set(5.0, 0, -1.5);
  scene.add(rightShelf);
  addDummyCases(rightShelf, scene);

  // Back wall (wider to cover neighbor shelves)
  const wallGeo = new THREE.PlaneGeometry(30, 15);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x12121f, roughness: 0.9 });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(0, 0, -2.5);
  wall.receiveShadow = true;
  scene.add(wall);

  // Floor (wider)
  const floorGeo = new THREE.PlaneGeometry(30, 10);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0a0a15, roughness: 1 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -4.5, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  return { scene, camera, renderer, shelfGroup };
}

function buildShelf() {
  const group = new THREE.Group();
  const woodMaterial = new THREE.MeshStandardMaterial({
    color: SHELF_COLOR,
    roughness: 0.8,
    metalness: 0.05,
  });
  const darkWoodMaterial = new THREE.MeshStandardMaterial({
    color: SHELF_DARK,
    roughness: 0.85,
    metalness: 0.05,
  });

  const shelfWidth = 4.2;
  const plankThickness = 0.08;
  const plankDepth = 0.8;
  const sideThickness = 0.1;
  const numRows = 4;
  const rowSpacing = 1.15;
  const bottomY = -2.2;

  // 5 horizontal planks
  for (let i = 0; i <= numRows; i++) {
    const y = bottomY + i * rowSpacing;
    const plankGeo = new THREE.BoxGeometry(shelfWidth, plankThickness, plankDepth);
    const plank = new THREE.Mesh(plankGeo, woodMaterial);
    plank.position.set(0, y, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  }

  // Side panels
  const sideHeight = numRows * rowSpacing + plankThickness;
  const sideGeo = new THREE.BoxGeometry(sideThickness, sideHeight, plankDepth);
  const leftSide = new THREE.Mesh(sideGeo, darkWoodMaterial);
  leftSide.position.set(-shelfWidth / 2, bottomY + sideHeight / 2, 0);
  leftSide.castShadow = true;
  group.add(leftSide);

  const rightSide = new THREE.Mesh(sideGeo, darkWoodMaterial);
  rightSide.position.set(shelfWidth / 2, bottomY + sideHeight / 2, 0);
  rightSide.castShadow = true;
  group.add(rightSide);

  // Store row Y positions (index 0 = top row, index 3 = bottom row)
  // Spec: rows fill top (easiest) to bottom (hardest)
  group.userData.rowPositions = [];
  for (let i = numRows - 1; i >= 0; i--) {
    group.userData.rowPositions.push(bottomY + i * rowSpacing + plankThickness / 2 + 0.55);
  }
  group.userData.shelfWidth = shelfWidth;
  group.userData.rowSpacing = rowSpacing;

  return group;
}

// Add dark/empty dummy VHS cases to a neighbor shelf
function addDummyCases(shelfGroup, scene) {
  const caseMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.9,
  });
  const caseGeo = new THREE.BoxGeometry(0.5, 0.8, 0.2);
  const rowPositions = shelfGroup.userData.rowPositions;
  const cols = 4;
  const gap = 0.12;
  const totalW = cols * 0.5 + (cols - 1) * gap;
  const startX = -totalW / 2 + 0.25;

  for (let row = 0; row < rowPositions.length; row++) {
    for (let col = 0; col < cols; col++) {
      // Skip some randomly for variety
      if (Math.random() < 0.2) continue;
      const caseMesh = new THREE.Mesh(caseGeo, caseMat.clone());
      // Slight color variation
      caseMesh.material.color.setHex(0x1a1a1a + Math.floor(Math.random() * 0x101010));
      const x = shelfGroup.position.x + startX + col * (0.5 + gap);
      const y = rowPositions[row];
      const z = shelfGroup.position.z + 0.15;
      caseMesh.position.set(x, y, z);
      caseMesh.castShadow = true;
      scene.add(caseMesh);
    }
  }
}

/**
 * Animate camera from a wide establishing shot to the close-up game position.
 * Call this before the tape entrance animation.
 * @param {THREE.PerspectiveCamera} camera
 * @param {Function} onComplete
 */
export function animateShelfZoomIn(camera, onComplete) {
  // Start pulled back and slightly higher to see neighbor shelves
  const startZ = camera.position.z * 2.2;
  const startY = camera.position.y + 1.5;
  const targetZ = camera.position.z;
  const targetY = camera.position.y;

  camera.position.z = startZ;
  camera.position.y = startY;

  const duration = 2000; // 2 seconds
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    // Smooth ease-out
    const e = 1 - Math.pow(1 - t, 3);

    camera.position.z = startZ + (targetZ - startZ) * e;
    camera.position.y = startY + (targetY - startY) * e;

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      camera.position.z = targetZ;
      camera.position.y = targetY;
      if (onComplete) onComplete();
    }
  }

  requestAnimationFrame(step);
}

/**
 * Compute the optimal camera Z to fit the tape grid in the usable viewport.
 *
 * The shelf is 4.2 units wide. The tape grid spans ~5.6 units vertically
 * (from bottom tape at y≈-1.65 to top tape top at y≈3.4), centered around
 * the camera's y=0.5.
 *
 * On mobile, the HUD eats ~120px (top bar + shelve button). We shrink the
 * effective viewport height accordingly so tapes don't hide behind UI.
 */
function computeCameraZ(fov, aspect) {
  // Tape grid actual dimensions:
  //   Width:  4 * 0.605 + 3 * 0.12 = 2.78 (+ margin = 3.1)
  //   Height: top tape at y=2.31, bottom tape at y=-2.08, camera at y=0.5
  const contentW = 3.25; // tape grid (2.78) + side margin

  const contentAbove = 1.85; // 2.31 - 0.5 + margin
  const contentBelow = 2.60; // 0.5 - (-2.08) + margin
  const contentH = contentAbove + contentBelow; // ~4.45

  // Account for HUD eating into viewport
  const screenH = window.innerHeight;
  const hudPixels = 110;
  const usableRatio = Math.max(0.65, (screenH - hudPixels) / screenH);
  const effectiveH = contentH / usableRatio;

  const fovRad = (fov * Math.PI) / 180;
  const halfTan = Math.tan(fovRad / 2);
  const distForHeight = (effectiveH / 2) / halfTan;
  const distForWidth = (contentW / 2) / (halfTan * aspect);

  return Math.max(distForHeight, distForWidth);
}

export function resizeScene(camera, renderer) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;

  camera.position.z = computeCameraZ(camera.fov, camera.aspect);

  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

export function getRowPositions(shelfGroup) {
  return shelfGroup.userData.rowPositions;
}

export function getShelfWidth(shelfGroup) {
  return shelfGroup.userData.shelfWidth;
}

// ---------------------------------------------------------------------------
// Vibe Jam 2026 Portal System
// ---------------------------------------------------------------------------

/**
 * Create a canvas texture with a text label for the portal.
 */
function createPortalLabel(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.fillText(text, 128, 32);
  // Double pass for stronger glow
  ctx.fillText(text, 128, 32);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Build a portal group (torus ring + inner disc + particles + label).
 * @param {object} opts
 * @param {number} opts.color - hex color (e.g. 0x00ff00)
 * @param {string} opts.label - text label above the portal
 * @param {THREE.Vector3} opts.position - world position
 * @returns {{ group: THREE.Group, animate: (time: number) => void }}
 */
function buildPortal({ color, label, position }) {
  const group = new THREE.Group();
  group.position.copy(position);

  // -- Torus ring --
  const torusGeo = new THREE.TorusGeometry(0.6, 0.08, 16, 48);
  const torusMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.9,
    roughness: 0.3,
    metalness: 0.6,
  });
  const torus = new THREE.Mesh(torusGeo, torusMat);
  group.add(torus);

  // -- Inner glowing disc --
  const discGeo = new THREE.CircleGeometry(0.5, 32);
  const discMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  group.add(disc);

  // -- Point light for local glow --
  const glow = new THREE.PointLight(color, 0.6, 3);
  glow.position.set(0, 0, 0.2);
  group.add(glow);

  // -- Particles orbiting the ring --
  const particleCount = 200;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 0.5 + Math.random() * 0.25;
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = Math.sin(angle) * r;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({
    color,
    size: 0.03,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  group.add(particles);

  // -- Label above the portal --
  const labelTex = createPortalLabel(label, '#' + new THREE.Color(color).getHexString());
  const labelGeo = new THREE.PlaneGeometry(1.5, 0.25);
  const labelMat = new THREE.MeshBasicMaterial({
    map: labelTex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const labelMesh = new THREE.Mesh(labelGeo, labelMat);
  labelMesh.position.set(0, 0.9, 0);
  group.add(labelMesh);

  // Tag all meshes in the group so raycasting can identify portal clicks
  group.traverse((child) => {
    if (child.isMesh || child.isPoints) {
      child.userData.isPortal = true;
      child.userData.portalGroup = group;
    }
  });

  // -- Animate function (call each frame with elapsed time) --
  function animate(time) {
    torus.rotation.z = time * 0.5;
    torus.rotation.x = Math.sin(time * 0.3) * 0.15;

    // Drift particles
    const posArr = particleGeo.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      const angle = time * 0.4 + i * 0.031;
      const r = 0.5 + Math.sin(time + i) * 0.12;
      posArr[i * 3] = Math.cos(angle) * r;
      posArr[i * 3 + 1] = Math.sin(angle) * r;
    }
    particleGeo.attributes.position.needsUpdate = true;

    // Pulse the inner disc opacity
    discMat.opacity = 0.2 + Math.sin(time * 2) * 0.1;

    // Pulse glow intensity
    glow.intensity = 0.5 + Math.sin(time * 3) * 0.2;
  }

  return { group, animate };
}

/**
 * Create the exit portal (green) near the right neighbor shelf.
 * Always visible. Links to Vibe Jam 2026.
 */
export function createExitPortal(scene) {
  const portal = buildPortal({
    color: 0x00ff00,
    label: 'VIBE JAM PORTAL',
    position: new THREE.Vector3(5.5, 0.5, -0.5),
  });
  scene.add(portal.group);
  return portal;
}

/**
 * Create the return portal (red/pink) near the left neighbor shelf.
 * Only shown when ?ref= is present. Links back to the referring game.
 */
export function createReturnPortal(scene) {
  const portal = buildPortal({
    color: 0xff4488,
    label: 'RETURN PORTAL',
    position: new THREE.Vector3(-5.5, 0.5, -0.5),
  });
  scene.add(portal.group);
  return portal;
}
