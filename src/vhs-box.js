import * as THREE from 'three';

// Texture cache keyed by URL
const textureCache = new Map();
const textureLoader = new THREE.TextureLoader();

/**
 * Load a texture by URL, returning a cached copy if already loaded.
 * @param {string} url
 * @returns {Promise<THREE.Texture>}
 */
export function loadTexture(url) {
  if (textureCache.has(url)) {
    return Promise.resolve(textureCache.get(url));
  }
  return new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (texture) => {
        textureCache.set(url, texture);
        resolve(texture);
      },
      undefined,
      (err) => reject(err)
    );
  });
}

/**
 * Preload an array of texture URLs in parallel.
 * @param {string[]} urls
 * @returns {Promise<THREE.Texture[]>}
 */
export function preloadTextures(urls) {
  return Promise.all(urls.map((url) => loadTexture(url)));
}

/**
 * Returns the canonical VHS box dimensions.
 * @returns {{ width: number, height: number, depth: number }}
 */
export function getBoxDimensions() {
  return { width: 0.55, height: 0.85, depth: 0.18 };
}

/**
 * Create a VHS clamshell box mesh group for a movie.
 *
 * BoxGeometry face order (materialIndex):
 *   0 = +x (right)  → spine
 *   1 = -x (left)   → side
 *   2 = +y (top)
 *   3 = -y (bottom)
 *   4 = +z (front)  → poster
 *   5 = -z (back)
 *
 * @param {object} movie  - movie data object stored in userData
 * @param {THREE.Texture} pixelatedTexture  - pixelated/low-res poster for face 4
 * @returns {THREE.Group}
 */
export function createVHSBox(movie, pixelatedTexture) {
  const { width, height, depth } = getBoxDimensions();

  const spineMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.9,
    metalness: 0.05,
  });

  const sideMaterial = new THREE.MeshStandardMaterial({
    color: 0x1c1c1c,
    roughness: 0.9,
    metalness: 0.05,
  });

  const topMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.85,
    metalness: 0.05,
  });

  const bottomMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.85,
    metalness: 0.05,
  });

  const frontMaterial = new THREE.MeshStandardMaterial({
    map: pixelatedTexture || null,
    color: pixelatedTexture ? 0xffffff : 0x333333,
    roughness: 0.7,
    metalness: 0.0,
  });

  const backMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e1e1e,
    roughness: 0.9,
    metalness: 0.05,
  });

  // Face order: +x, -x, +y, -y, +z, -z
  const materials = [
    spineMaterial,  // 0: right (+x) → spine
    sideMaterial,   // 1: left  (-x) → side
    topMaterial,    // 2: top   (+y)
    bottomMaterial, // 3: bottom(-y)
    frontMaterial,  // 4: front (+z) → poster
    backMaterial,   // 5: back  (-z)
  ];

  const geometry = new THREE.BoxGeometry(width, height, depth);
  const boxMesh = new THREE.Mesh(geometry, materials);
  boxMesh.castShadow = true;
  boxMesh.receiveShadow = true;

  const group = new THREE.Group();
  group.add(boxMesh);

  group.userData = {
    movie,
    state: 'default',
    uncovered: false,
    originalPosition: new THREE.Vector3(),
    selected: false,
    frontMaterial,
    spineMaterial,
    boxMesh,
    gridIndex: -1,
    gridRow: -1,
    gridCol: -1,
  };

  return group;
}

/**
 * Change the visual state of a VHS box.
 * @param {THREE.Group} box
 * @param {'default'|'selected'|'locked'|'grayed'} state
 */
export function setBoxState(box, state) {
  const { frontMaterial, boxMesh, originalPosition } = box.userData;
  const materials = boxMesh.material;

  box.userData.state = state;

  switch (state) {
    case 'selected':
      box.userData.selected = true;
      // Lift forward
      box.position.set(
        originalPosition.x,
        originalPosition.y,
        originalPosition.z + 0.25
      );
      // Blue emissive on front face
      frontMaterial.emissive.setHex(0x00d4ff);
      frontMaterial.emissiveIntensity = 0.15;
      break;

    case 'default':
      box.userData.selected = false;
      // Restore z position
      box.position.copy(originalPosition);
      // Remove emissive
      frontMaterial.emissive.setHex(0x000000);
      frontMaterial.emissiveIntensity = 0;
      break;

    case 'locked':
      box.userData.selected = false;
      frontMaterial.emissive.setHex(0x000000);
      frontMaterial.emissiveIntensity = 0;
      break;

    case 'grayed':
      // Tint all materials to gray
      for (const mat of materials) {
        mat.color.setHex(0x333333);
      }
      break;
  }
}

/**
 * Color the spine face for a solved category.
 * @param {THREE.Group} box
 * @param {number} hexColor
 */
export function setSpineColor(box, hexColor) {
  box.userData.spineMaterial.color.setHex(hexColor);
}

/**
 * Swap the front poster to a full-resolution texture and add a golden glow.
 * @param {THREE.Group} box
 * @param {THREE.Texture} fullTexture
 */
export function swapToFullTexture(box, fullTexture) {
  const { frontMaterial } = box.userData;
  frontMaterial.map = fullTexture;
  frontMaterial.needsUpdate = true;
  box.userData.uncovered = true;

  // Golden glow
  frontMaterial.emissive.setHex(0xffd700);
  frontMaterial.emissiveIntensity = 0.2;
}

/**
 * Position 16 boxes in a 4×4 grid across the shelf.
 * @param {THREE.Group[]} boxes  - array of exactly 16 box groups
 * @param {THREE.Group}   shelfGroup
 */
export function layoutBoxes(boxes, shelfGroup) {
  const { rowPositions, shelfWidth } = shelfGroup.userData;
  const { width } = getBoxDimensions();
  const cols = 4;
  const gap = 0.12;
  const totalRowWidth = cols * width + (cols - 1) * gap;
  const startX = -totalRowWidth / 2 + width / 2;
  const z = 0.15;

  boxes.forEach((box, index) => {
    const row = Math.floor(index / cols); // 0-3 (bottom to top)
    const col = index % cols;

    const x = startX + col * (width + gap);
    const y = rowPositions[row];

    box.position.set(x, y, z);
    box.userData.originalPosition.set(x, y, z);
    box.userData.gridIndex = index;
    box.userData.gridRow = row;
    box.userData.gridCol = col;
  });
}

/**
 * Reposition remaining (unsolved) boxes after one or more rows have been solved.
 * Solved rows occupy the bottom rowPositions slots; unsolved boxes fill from there upward.
 *
 * @param {THREE.Group[]} unsolvedBoxes  - remaining unsolved box groups
 * @param {THREE.Group}   shelfGroup
 * @param {number}        solvedRowCount - number of rows already locked/solved
 */
export function reflowBoxes(unsolvedBoxes, shelfGroup, solvedRowCount) {
  const { rowPositions, shelfWidth } = shelfGroup.userData;
  const { width } = getBoxDimensions();
  const cols = 4;
  const gap = 0.12;
  const totalRowWidth = cols * width + (cols - 1) * gap;
  const startX = -totalRowWidth / 2 + width / 2;
  const z = 0.15;

  // Start placing from the first unsolved row
  let startRow = solvedRowCount;

  unsolvedBoxes.forEach((box, index) => {
    const row = startRow + Math.floor(index / cols);
    const col = index % cols;

    if (row < rowPositions.length) {
      const x = startX + col * (width + gap);
      const y = rowPositions[row];
      box.userData.originalPosition.set(x, y, z);
      box.userData.gridIndex = index;
      box.userData.gridRow = row;
      box.userData.gridCol = col;
    }
  });
}
