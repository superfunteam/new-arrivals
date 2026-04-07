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

/** Internal helper — push a new animation onto the queue. */
function addAnimation(duration, update, onComplete) {
  activeAnimations.push({ elapsed: 0, duration, update, onComplete: onComplete || null });
}

// ---------------------------------------------------------------------------
// Entrance animation
// ---------------------------------------------------------------------------

/**
 * Boxes spin in from above with a staggered, bouncy landing.
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

  boxes.forEach((box, i) => {
    const delay = i * 0.06; // 60 ms stagger
    const duration = 0.6;

    // Snapshot the landing position
    const targetX = box.userData.originalPosition.x;
    const targetY = box.userData.originalPosition.y;
    const targetZ = box.userData.originalPosition.z;

    // Random starting offsets
    const startOffsetY = 6 + Math.random() * 2;
    const startOffsetX = (Math.random() - 0.5) * 0.6;
    const startRotX = (Math.random() - 0.5) * Math.PI;
    // Start Y rotation includes a full extra spin (2*PI) so the box
    // completes at least one full Y revolution during the entrance.
    const startRotY = (Math.random() - 0.5) * Math.PI + Math.PI * 2;
    const startRotZ = (Math.random() - 0.5) * Math.PI;

    // Place box at starting position immediately
    box.position.set(targetX + startOffsetX, targetY + startOffsetY, targetZ);
    box.rotation.set(startRotX, startRotY, startRotZ);

    const animDuration = delay + duration;

    addAnimation(
      animDuration,
      (rawT) => {
        // Before stagger delay: keep at start
        if (rawT * animDuration < delay) return;

        // Normalised t within the active window
        const localT = Math.min((rawT * animDuration - delay) / duration, 1);
        const easedT = easeOutBounce(localT);

        box.position.x = targetX + startOffsetX * (1 - localT);
        box.position.y = targetY + startOffsetY * (1 - easedT);
        box.position.z = targetZ;

        // Spin down to zero — Y includes the full extra revolution
        box.rotation.x = startRotX * (1 - localT);
        box.rotation.y = startRotY * (1 - localT);
        box.rotation.z = startRotZ * (1 - localT);
      },
      () => {
        // Snap to exact final state
        box.position.set(targetX, targetY, targetZ);
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
    const duration = 0.4;
    const animDuration = delay + duration;

    const startPos = box.position.clone();
    const startRotY = box.rotation.y;
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

        // Half-flip around Y so the box visually flips into place
        box.rotation.y = startRotY + Math.PI * easeInOutCubic(localT);

        // Slight rotation wobble on Z
        box.rotation.z = Math.sin(localT * Math.PI * 3) * 0.08 * (1 - localT);
      },
      () => {
        box.position.copy(target);
        // PI rotation means the box ends facing the same direction (front visible)
        // since a half-turn of a symmetric box looks the same. Snap to nearest
        // multiple of 2*PI to avoid drift.
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
    const { startPos, startRotY, target } = snapshots[i];

    addAnimation(
      0.6,
      (t) => {
        const easedT = easeInOutCubic(t);
        box.position.x = startPos.x + (target.x - startPos.x) * easedT;
        box.position.y = startPos.y + (target.y - startPos.y) * easedT;
        // Keep Z consistent — interpolate smoothly to target Z
        box.position.z = startPos.z + (target.z - startPos.z) * easedT;

        // Full 360-degree Y spin during the transition
        box.rotation.y = startRotY + Math.PI * 2 * easeInOutCubic(t);
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
  const { state, gridIndex } = box.userData;
  if (state === 'locked' || state === 'grayed') return;

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
