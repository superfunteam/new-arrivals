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

  // Auto-fit: adjust camera Z so the shelf fills the viewport
  // Shelf is 4.2 wide, ~6.0 tall (with padding). We want ~10% margin.
  const shelfVisibleW = 4.8; // shelf width + a little margin
  const shelfVisibleH = 6.5; // shelf height + margin for HUD
  const fovRad = (camera.fov * Math.PI) / 180;

  // Distance needed to fit height
  const distForHeight = (shelfVisibleH / 2) / Math.tan(fovRad / 2);
  // Distance needed to fit width
  const distForWidth = (shelfVisibleW / 2) / (Math.tan(fovRad / 2) * aspect);
  // Use the larger (further) distance so nothing clips
  const camZ = Math.max(distForHeight, distForWidth);

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
  const rowSpacing = 1.35;
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

export function resizeScene(camera, renderer) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;

  // Re-fit shelf to new viewport
  const shelfVisibleW = 4.8;
  const shelfVisibleH = 6.5;
  const fovRad = (camera.fov * Math.PI) / 180;
  const distForHeight = (shelfVisibleH / 2) / Math.tan(fovRad / 2);
  const distForWidth = (shelfVisibleW / 2) / (Math.tan(fovRad / 2) * camera.aspect);
  camera.position.z = Math.max(distForHeight, distForWidth);

  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

export function getRowPositions(shelfGroup) {
  return shelfGroup.userData.rowPositions;
}

export function getShelfWidth(shelfGroup) {
  return shelfGroup.userData.shelfWidth;
}
