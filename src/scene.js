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
  camera.position.set(0, 0.5, 9);
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

  // Back wall
  const wallGeo = new THREE.PlaneGeometry(20, 15);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x12121f, roughness: 0.9 });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(0, 0, -1.5);
  wall.receiveShadow = true;
  scene.add(wall);

  // Floor
  const floorGeo = new THREE.PlaneGeometry(20, 10);
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

  // Store row Y positions
  group.userData.rowPositions = [];
  for (let i = 0; i < numRows; i++) {
    group.userData.rowPositions.push(bottomY + i * rowSpacing + plankThickness / 2 + 0.55);
  }
  group.userData.shelfWidth = shelfWidth;
  group.userData.rowSpacing = rowSpacing;

  return group;
}

export function resizeScene(camera, renderer) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

export function getRowPositions(shelfGroup) {
  return shelfGroup.userData.rowPositions;
}

export function getShelfWidth(shelfGroup) {
  return shelfGroup.userData.shelfWidth;
}
