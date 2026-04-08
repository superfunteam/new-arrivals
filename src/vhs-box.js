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
        // Nearest-neighbor filtering for crisp pixel blocks on upscale
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
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
  return { width: 0.55, height: 0.85, depth: 0.23 };
}

// ---------------------------------------------------------------------------
// Procedural back cover textures
// ---------------------------------------------------------------------------

/** Cache of the 5 generated back cover CanvasTextures. */
let backCoverTextures = null;

/**
 * Generate 5 procedural back-cover textures that mimic real VHS box backs.
 * Each has a dark background, placeholder image blocks, simulated text lines,
 * and a barcode element — all drawn in low-contrast grays.
 * @returns {THREE.CanvasTexture[]}
 */
function getBackCoverTextures() {
  if (backCoverTextures) return backCoverTextures;

  const W = 256;
  const H = 384;

  /** Draw a single design variant and return a CanvasTexture. */
  function makeVariant(variant) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Dark background
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, W, H);

    // Thin border
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    // --- Layout varies by variant ---
    // High contrast so shapes are clearly visible on the back
    const imgColor = '#666666';
    const textColor = '#777777';
    const barcodeColor = '#888888';

    if (variant === 0) {
      // Two screenshot blocks side by side at top
      ctx.fillStyle = imgColor;
      ctx.fillRect(16, 20, 108, 72);
      ctx.fillRect(132, 20, 108, 72);
      // Text lines
      ctx.fillStyle = textColor;
      for (let i = 0; i < 10; i++) {
        const w = 180 + ((i * 17) % 40);
        ctx.fillRect(16, 108 + i * 14, Math.min(w, W - 32), 6);
      }
    } else if (variant === 1) {
      // One large screenshot
      ctx.fillStyle = imgColor;
      ctx.fillRect(16, 20, W - 32, 100);
      // Text lines below
      ctx.fillStyle = textColor;
      for (let i = 0; i < 8; i++) {
        const w = 160 + ((i * 23) % 60);
        ctx.fillRect(16, 136 + i * 14, Math.min(w, W - 32), 6);
      }
      // Small image at bottom-left
      ctx.fillStyle = imgColor;
      ctx.fillRect(16, 260, 80, 60);
    } else if (variant === 2) {
      // Three small screenshots in a row
      ctx.fillStyle = imgColor;
      ctx.fillRect(16, 20, 68, 52);
      ctx.fillRect(94, 20, 68, 52);
      ctx.fillRect(172, 20, 68, 52);
      // Text
      ctx.fillStyle = textColor;
      for (let i = 0; i < 12; i++) {
        const w = 140 + ((i * 19) % 80);
        ctx.fillRect(16, 88 + i * 13, Math.min(w, W - 32), 5);
      }
    } else if (variant === 3) {
      // Large image left, text right
      ctx.fillStyle = imgColor;
      ctx.fillRect(16, 20, 110, 140);
      ctx.fillStyle = textColor;
      for (let i = 0; i < 9; i++) {
        ctx.fillRect(136, 24 + i * 15, 104, 5);
      }
      // More text below
      for (let i = 0; i < 6; i++) {
        const w = 170 + ((i * 13) % 50);
        ctx.fillRect(16, 180 + i * 14, Math.min(w, W - 32), 6);
      }
    } else {
      // Two stacked images with text between
      ctx.fillStyle = imgColor;
      ctx.fillRect(16, 20, W - 32, 64);
      ctx.fillStyle = textColor;
      for (let i = 0; i < 5; i++) {
        const w = 150 + ((i * 21) % 70);
        ctx.fillRect(16, 98 + i * 13, Math.min(w, W - 32), 5);
      }
      ctx.fillStyle = imgColor;
      ctx.fillRect(16, 172, W - 32, 64);
      ctx.fillStyle = textColor;
      for (let i = 0; i < 4; i++) {
        const w = 160 + ((i * 29) % 50);
        ctx.fillRect(16, 250 + i * 13, Math.min(w, W - 32), 5);
      }
    }

    // Barcode at bottom-center (common to all variants)
    ctx.fillStyle = barcodeColor;
    const barcodeX = W / 2 - 40;
    const barcodeY = H - 50;
    for (let b = 0; b < 30; b++) {
      const barW = (b % 3 === 0) ? 3 : 1;
      ctx.fillRect(barcodeX + b * 2.7, barcodeY, barW, 28);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  backCoverTextures = [0, 1, 2, 3, 4].map(makeVariant);
  return backCoverTextures;
}

/**
 * Tint colors indexed 0-4 — earthy/muted palette used for back covers.
 * Multiplied with the back cover texture to give each box a unique hue.
 */
const BACK_TINT_COLORS = [
  0x6b4226, // warm brown
  0x5c1a1a, // dark red
  0x1a2a4a, // navy
  0x1a3a1a, // dark green
  0x3a3a3a, // charcoal
];

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

  // Select back cover variant and tint based on tmdb_id
  const tmdbId = movie.tmdb_id || 0;
  const backCovers = getBackCoverTextures();
  const backCoverTex = backCovers[tmdbId % 5];
  const backTintColor = BACK_TINT_COLORS[tmdbId % 5];

  // Derive edge colors from the movie's tint palette
  const tintColor = new THREE.Color(BACK_TINT_COLORS[tmdbId % 5]);
  const darkTint = tintColor.clone().multiplyScalar(0.5);

  const spineMaterial = new THREE.MeshStandardMaterial({
    color: tintColor,
    roughness: 0.9,
    metalness: 0.05,
  });

  const sideMaterial = new THREE.MeshStandardMaterial({
    color: darkTint,
    roughness: 0.9,
    metalness: 0.05,
  });

  const topMaterial = new THREE.MeshStandardMaterial({
    color: darkTint.clone(),
    roughness: 0.85,
    metalness: 0.05,
  });

  const bottomMaterial = new THREE.MeshStandardMaterial({
    color: darkTint.clone(),
    roughness: 0.85,
    metalness: 0.05,
  });

  const frontMaterial = new THREE.MeshStandardMaterial({
    map: pixelatedTexture || null,
    color: pixelatedTexture ? 0xffffff : 0x333333,
    roughness: 0.7,
    metalness: 0.0,
  });

  // Back cover: show texture at full brightness, use emissive for tint
  const backMaterial = new THREE.MeshStandardMaterial({
    map: backCoverTex,
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.05,
    emissive: backTintColor,
    emissiveIntensity: 0.15,
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
      // Bright cyan emissive on front face
      frontMaterial.emissive.setHex(0x00ffff);
      frontMaterial.emissiveIntensity = 0.3;
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
