import * as THREE from 'three';

const LONG_PRESS_MS = 500;
const TAP_MOVE_THRESHOLD = 10;

export function setupInteraction(camera, renderer, getBoxes, callbacks) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let pointerDown = false;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let longPressTimer = null;
  let movedTooFar = false;
  let longPressed = false;
  let interactionLocked = false;

  function setLocked(locked) {
    interactionLocked = locked;
  }

  function getIntersectedBox(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const boxes = getBoxes();
    const meshes = boxes.flatMap(box => box.children);
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !obj.userData.movie) {
        obj = obj.parent;
      }
      return obj;
    }
    return null;
  }

  function onPointerDown(e) {
    if (interactionLocked) return;
    e.preventDefault();

    const x = e.clientX ?? e.touches?.[0]?.clientX;
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    if (x === undefined) return;

    pointerDown = true;
    pointerStartX = x;
    pointerStartY = y;
    movedTooFar = false;
    longPressed = false;

    const box = getIntersectedBox(x, y);
    if (!box || box.userData.state === 'locked' || box.userData.state === 'grayed') {
      pointerDown = false;
      return;
    }

    longPressTimer = setTimeout(() => {
      if (!movedTooFar && pointerDown) {
        longPressed = true;
        callbacks.onLongPress?.(box);
      }
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e) {
    if (!pointerDown) return;

    const x = e.clientX ?? e.touches?.[0]?.clientX;
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    if (x === undefined) return;

    const dx = x - pointerStartX;
    const dy = y - pointerStartY;
    if (Math.sqrt(dx * dx + dy * dy) > TAP_MOVE_THRESHOLD) {
      movedTooFar = true;
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }
  }

  function onPointerUp(e) {
    if (!pointerDown) return;
    pointerDown = false;

    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    if (longPressed || movedTooFar || interactionLocked) return;

    const x = e.clientX ?? e.changedTouches?.[0]?.clientX;
    const y = e.clientY ?? e.changedTouches?.[0]?.clientY;
    if (x === undefined) return;

    const box = getIntersectedBox(x, y);
    if (box && box.userData.state !== 'locked' && box.userData.state !== 'grayed') {
      callbacks.onTap?.(box);
    }
  }

  // Use pointer events only (unified API, works on desktop + mobile)
  // Avoid also registering touch events which causes double-fire on mobile
  const el = renderer.domElement;
  el.addEventListener('pointerdown', onPointerDown, { passive: false });
  el.addEventListener('pointermove', onPointerMove, { passive: false });
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);

  return {
    setLocked,
    destroy() {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
    },
  };
}
