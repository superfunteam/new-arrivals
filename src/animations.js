import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Internal animation queue
// ---------------------------------------------------------------------------

/** @type {Array<{elapsed: number, duration: number, update: (t: number) => void, onComplete: (() => void)|null}>} */
const activeAnimations = [];

// ---------------------------------------------------------------------------
// Easing functions
// ---------------------------------------------------------------------------

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutBounce(t) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    t -= 1.5 / d1;
    return n1 * t * t + 0.75;
  } else if (t < 2.5 / d1) {
    t -= 2.25 / d1;
    return n1 * t * t + 0.9375;
  } else {
    t -= 2.625 / d1;
    return n1 * t * t + 0.984375;
  }
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---------------------------------------------------------------------------
// Core update
// ---------------------------------------------------------------------------

/**
 * Advance all active animations by deltaTime seconds.
 * Call this every frame from the render loop.
 * @param {number} deltaTime  seconds since last frame
 */
export function updateAnimations(deltaTime) {
  for (let i = activeAnimations.length - 1; i >= 0; i--) {
    const anim = activeAnimations[i];
    anim.elapsed += deltaTime;

    const rawT = Math.min(anim.elapsed / anim.duration, 1);
    anim.update(rawT);

    if (rawT >= 1) {
      activeAnimations.splice(i, 1);
      if (typeof anim.onComplete === 'function') {
        anim.onComplete();
      }
    }
  }
}

/** Push a new animation onto the queue. */
export function addAnimation(duration, update, onComplete) {
  activeAnimations.push({ elapsed: 0, duration, update, onComplete: onComplete || null });
}

// ---------------------------------------------------------------------------
// Entrance animation
// ---------------------------------------------------------------------------

/**
 * Cinematic entrance: tapes fly from behind/around the viewer's head,
 * starting large and rushing past the camera into the scene, each with
 * its own personality — some faster, some lazier, extra twirls, varied
 * arcs. The whole sequence takes ~3 seconds.
 *
 * @param {THREE.Group[]} boxes
 * @param {() => void}    [onComplete]
 */
export function animateEntrance(boxes, onComplete) {
  let completedCount = 0;
  const total = boxes.length;

  if (total === 0) {
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  // Seeded PRNG so entrance looks the same on every load for a given puzzle
  // (uses the first box's gridIndex as a simple seed differentiator)
  let seed = 42 + (boxes[0]?.userData.gridIndex || 0);
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  // Pre-roll a few values to decorrelate
  for (let k = 0; k < 10; k++) rand();

  boxes.forEach((box, i) => {
    const targetX = box.userData.originalPosition.x;
    const targetY = box.userData.originalPosition.y;
    const targetZ = box.userData.originalPosition.z;

    // ── Per-tape personality (random scatter with guardrails) ──

    // Stagger: 80-140ms apart, so the stream takes ~1.5-2s to start all
    const delay = i * (0.08 + rand() * 0.06);

    // Flight duration: 1.2 – 1.8s per tape (some zip, some float)
    const duration = 1.2 + rand() * 0.6;

    // Start behind/around the camera (camera is at z=9)
    // z: 11-15 (behind camera), x: scattered wide, y: scattered
    const startX = (rand() - 0.5) * 8;
    const startY = (rand() - 0.5) * 6 + 1;
    const startZ = 11 + rand() * 4;

    // Start scale: 1.8 – 2.8x (they appear huge rushing past)
    const startScale = 1.8 + rand() * 1.0;

    // Y twirls: 1-3 full rotations (some tapes show off more)
    const twirls = (1 + Math.floor(rand() * 3)) * Math.PI * 2;
    // Random twirl direction
    const ySign = rand() > 0.5 ? 1 : -1;
    const totalRotY = twirls * ySign;

    // X tilt: gentle lean during flight (±20-40 degrees)
    const tiltX = (rand() - 0.5) * 0.7;

    // Z roll: subtle roll (±15 degrees)
    const rollZ = (rand() - 0.5) * 0.5;

    // Mid-flight arc: slight curve via a control point offset
    // This makes them feel like they're swooping, not flying straight
    const arcX = (rand() - 0.5) * 2;
    const arcY = rand() * 2 + 1; // upward bias for a nice arc

    // Place at start immediately (invisible — behind camera / in fog)
    box.position.set(startX, startY, startZ);
    box.rotation.set(tiltX, totalRotY, rollZ);
    box.scale.setScalar(startScale);

    const animDuration = delay + duration;

    addAnimation(
      animDuration,
      (rawT) => {
        // Before this tape's stagger kicks in, hold at start
        if (rawT * animDuration < delay) return;

        // Normalized t within this tape's active window [0..1]
        const localT = Math.min((rawT * animDuration - delay) / duration, 1);

        // Smooth deceleration — fast rush then gentle settle
        const eased = easeOutQuart(localT);

        // Position: quadratic bezier through an arc control point
        // P = (1-t)²·start + 2(1-t)t·control + t²·target
        const oneMinusT = 1 - eased;
        const ctrlX = (startX + targetX) / 2 + arcX;
        const ctrlY = (startY + targetY) / 2 + arcY;
        const ctrlZ = (startZ + targetZ) / 2;

        box.position.x = oneMinusT * oneMinusT * startX + 2 * oneMinusT * eased * ctrlX + eased * eased * targetX;
        box.position.y = oneMinusT * oneMinusT * startY + 2 * oneMinusT * eased * ctrlY + eased * eased * targetY;
        box.position.z = oneMinusT * oneMinusT * startZ + 2 * oneMinusT * eased * ctrlZ + eased * eased * targetZ;

        // Scale: shrink from large to 1
        const s = startScale + (1 - startScale) * eased;
        box.scale.setScalar(s);

        // Rotation: wind down from start rotation to zero
        // Use a slightly different easing so rotation settles later than position
        const rotT = easeOutCubic(localT);
        box.rotation.x = tiltX * (1 - rotT);
        box.rotation.y = totalRotY * (1 - rotT);
        box.rotation.z = rollZ * (1 - rotT);
      },
      () => {
        // Snap to exact final resting state
        box.position.set(targetX, targetY, targetZ);
        box.rotation.set(0, 0, 0);
        box.scale.setScalar(1);

        completedCount++;
        if (completedCount === total && typeof onComplete === 'function') {
          onComplete();
        }
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Lock-in animation
// ---------------------------------------------------------------------------

/**
 * Slide boxes into their solved-row positions.
 * @param {THREE.Group[]} boxes
 * @param {number}        targetY
 * @param {THREE.Vector3[]} targetPositions  - one per box
 * @param {() => void}    [onComplete]
 */
export function animateLockIn(boxes, targetY, targetPositions, onComplete) {
  let completedCount = 0;
  const total = boxes.length;

  if (total === 0) {
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  boxes.forEach((box, i) => {
    const delay = i * 0.1; // 100 ms stagger
    const duration = 0.5;
    const animDuration = delay + duration;

    const startPos = box.position.clone();
    const target = targetPositions[i];

    addAnimation(
      animDuration,
      (rawT) => {
        if (rawT * animDuration < delay) return;

        const localT = Math.min((rawT * animDuration - delay) / duration, 1);
        const easedT = easeOutBack(localT);

        box.position.x = startPos.x + (target.x - startPos.x) * easedT;
        box.position.y = startPos.y + (target.y - startPos.y) * easedT;
        box.position.z = startPos.z + (target.z - startPos.z) * easedT;

        // Slight rotation wobble on Z
        box.rotation.z = Math.sin(localT * Math.PI * 3) * 0.08 * (1 - localT);
      },
      () => {
        box.position.copy(target);
        box.rotation.set(0, 0, 0);
        box.userData.originalPosition.copy(target);

        completedCount++;
        if (completedCount === total && typeof onComplete === 'function') {
          onComplete();
        }
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Shake animation (wrong guess)
// ---------------------------------------------------------------------------

/**
 * Rapid horizontal shake to signal an incorrect guess.
 * @param {THREE.Group[]} boxes
 * @param {() => void}    [onComplete]
 */
export function animateShake(boxes, onComplete) {
  let completedCount = 0;
  const total = boxes.length;

  if (total === 0) {
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  const startPositions = boxes.map((b) => b.position.clone());

  addAnimation(
    0.4,
    (t) => {
      boxes.forEach((box, i) => {
        const offsetX = Math.sin(t * Math.PI * 8) * 0.08 * (1 - t);
        box.position.x = startPositions[i].x + offsetX;
      });
    },
    () => {
      boxes.forEach((box, i) => {
        box.position.copy(startPositions[i]);
      });
      completedCount = total; // single animation covers all boxes
      if (typeof onComplete === 'function') onComplete();
    }
  );
}

// ---------------------------------------------------------------------------
// Reflow animation
// ---------------------------------------------------------------------------

/**
 * Smoothly move boxes to their updated originalPosition values.
 * Call reflowBoxes() first to update userData.originalPosition, then call this.
 * @param {THREE.Group[]} boxes
 * @param {() => void}    [onComplete]
 */
export function animateReflow(boxes, onComplete) {
  let completedCount = 0;
  const total = boxes.length;

  if (total === 0) {
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  // Capture ALL start positions and targets BEFORE any animation begins,
  // preventing flicker from mid-flight reads of originalPosition.
  const snapshots = boxes.map((box) => ({
    startPos: box.position.clone(),
    startRotY: box.rotation.y,
    target: box.userData.originalPosition.clone(),
  }));

  boxes.forEach((box, i) => {
    const { startPos, target } = snapshots[i];

    addAnimation(
      0.8,
      (t) => {
        const easedT = easeInOutCubic(t);
        box.position.x = startPos.x + (target.x - startPos.x) * easedT;
        box.position.y = startPos.y + (target.y - startPos.y) * easedT;
        box.position.z = startPos.z + (target.z - startPos.z) * easedT;
      },
      () => {
        box.position.copy(target);
        box.rotation.set(0, 0, 0);
        completedCount++;
        if (completedCount === total && typeof onComplete === 'function') {
          onComplete();
        }
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Idle wobble (called every frame, not queued)
// ---------------------------------------------------------------------------

/**
 * Apply a subtle continuous wobble to a box. Call each frame for unsolved boxes.
 * @param {THREE.Group} box
 * @param {number}      time  - elapsed time in seconds (e.g. from clock.getElapsedTime())
 */
export function applyIdleWobble(box, time) {
  const { state, gridIndex, selected, frontMaterial } = box.userData;
  if (state === 'locked' || state === 'grayed') return;

  // Selected boxes get a pulsing glow + breathing scale instead of idle wobble
  if (selected) {
    const pulse = Math.sin(time * 3) * 0.5 + 0.5; // 0..1
    frontMaterial.emissiveIntensity = 0.15 + pulse * 0.2;
    // Subtle scale breathing
    const s = 1.0 + Math.sin(time * 2) * 0.015;
    box.scale.setScalar(s);
    return;
  }

  const offset = gridIndex >= 0 ? gridIndex : 0;
  box.rotation.z = Math.sin(time * 1.5 + offset * 0.7) * 0.01;
  box.rotation.x = Math.cos(time * 1.2 + offset * 0.5) * 0.005;
}

// ---------------------------------------------------------------------------
// Gray-out animation (game over)
// ---------------------------------------------------------------------------

/**
 * Staggered gray-out of all boxes for a game-over state.
 * @param {THREE.Group[]} boxes
 * @param {() => void}    [onComplete]
 */
export function animateGrayOut(boxes, onComplete) {
  const targetColor = new THREE.Color(0x333333);
  let completedCount = 0;
  const total = boxes.length;

  if (total === 0) {
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  boxes.forEach((box, i) => {
    const delay = i * 0.05; // 50 ms stagger
    const duration = 0.3;
    const animDuration = delay + duration;

    // Snapshot current material colors
    const { boxMesh } = box.userData;
    const materials = Array.isArray(boxMesh.material)
      ? boxMesh.material
      : [boxMesh.material];
    const startColors = materials.map((m) => m.color.clone());

    addAnimation(
      animDuration,
      (rawT) => {
        if (rawT * animDuration < delay) return;

        const localT = Math.min((rawT * animDuration - delay) / duration, 1);

        materials.forEach((mat, mi) => {
          mat.color.lerpColors(startColors[mi], targetColor, localT);
        });
      },
      () => {
        materials.forEach((mat) => {
          mat.color.copy(targetColor);
        });
        box.userData.state = 'grayed';

        completedCount++;
        if (completedCount === total && typeof onComplete === 'function') {
          onComplete();
        }
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Inspect animation (long-press 3D twirl)
// ---------------------------------------------------------------------------

/**
 * Animate a box off the shelf toward the camera with a full 360-degree twirl.
 * @param {THREE.Group}  box
 * @param {THREE.Camera} camera
 * @param {() => void}   [onComplete]
 */
export function animateInspect(box, camera, onComplete) {
  const startPos = box.position.clone();
  const startRotX = box.rotation.x;
  const startRotY = box.rotation.y;

  // Slightly above center so tape sits above the bottom info panel
  const targetPos = new THREE.Vector3(0, camera.position.y + 0.25, camera.position.z - 2);

  // TEST: end at PI (back face visible) to verify back cover textures
  addAnimation(
    0.8,
    (t) => {
      const easedT = easeOutCubic(t);

      box.position.x = startPos.x + (targetPos.x - startPos.x) * easedT;
      box.position.y = startPos.y + (targetPos.y - startPos.y) * easedT;
      box.position.z = startPos.z + (targetPos.z - startPos.z) * easedT;

      // 1.5 turns: lands showing back face (PI)
      box.rotation.y = startRotY + Math.PI * 3 * easedT;

      // Slight X tilt: lean back ~15 degrees then return (peaks at t=0.5)
      const tiltAmount = 15 * (Math.PI / 180);
      box.rotation.x = startRotX + Math.sin(t * Math.PI) * tiltAmount;
    },
    () => {
      box.position.copy(targetPos);
      box.rotation.set(0, Math.PI, 0); // back face toward camera
      if (typeof onComplete === 'function') onComplete();
    }
  );
}

/**
 * Animate a box back from the inspect position to its shelf position.
 * @param {THREE.Group}   box
 * @param {THREE.Vector3} originalPos
 * @param {() => void}    [onComplete]
 */
export function animateReturnToShelf(box, originalPos, onComplete) {
  const startPos = box.position.clone();
  const startRotY = box.rotation.y;

  addAnimation(
    0.5,
    (t) => {
      const easedT = easeInOutCubic(t);

      box.position.x = startPos.x + (originalPos.x - startPos.x) * easedT;
      box.position.y = startPos.y + (originalPos.y - startPos.y) * easedT;
      box.position.z = startPos.z + (originalPos.z - startPos.z) * easedT;

      // Half twirl on Y (PI)
      box.rotation.y = startRotY + Math.PI * easedT;
    },
    () => {
      box.position.copy(originalPos);
      box.rotation.set(0, 0, 0);
      if (typeof onComplete === 'function') onComplete();
    }
  );
}

// ---------------------------------------------------------------------------
// Slide-out / slide-in animations (lightbox swipe navigation)
// ---------------------------------------------------------------------------

/**
 * Slide a box off-screen horizontally.
 * @param {THREE.Group}  box
 * @param {number}       targetX   X position to slide to (e.g. -5 or +5)
 * @param {() => void}   [onComplete]
 */
export function animateSlideOut(box, targetX, onComplete) {
  const startX = box.position.x;

  addAnimation(
    0.25,
    (t) => {
      const easedT = easeOutCubic(t);
      box.position.x = startX + (targetX - startX) * easedT;
    },
    () => {
      box.position.x = targetX;
      if (typeof onComplete === 'function') onComplete();
    }
  );
}

/**
 * Slide a box in from off-screen to a target position.
 * @param {THREE.Group}   box
 * @param {number}        fromX      Starting X (off-screen, e.g. +5 or -5)
 * @param {THREE.Vector3} targetPos  Final position (inspect position)
 * @param {() => void}    [onComplete]
 */
export function animateSlideIn(box, fromX, targetPos, onComplete) {
  box.position.set(fromX, targetPos.y, targetPos.z);
  box.rotation.set(0, 0, 0);
  box.scale.setScalar(1);

  addAnimation(
    0.25,
    (t) => {
      const easedT = easeOutCubic(t);
      box.position.x = fromX + (targetPos.x - fromX) * easedT;
    },
    () => {
      box.position.copy(targetPos);
      if (typeof onComplete === 'function') onComplete();
    }
  );
}
