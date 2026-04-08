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

  // ── Pinch-to-zoom toward pinch center (touch events) ──
  let isPinching = false;
  let initialPinchDistance = 0;
  let initialFov = 50;
  let snapBackRaf = null;
  const defaultCamPos = { x: 0, y: 0.5, z: 9 };
  let initialCamX = 0;
  let initialCamY = 0;
  let pinchTargetX = 0;
  let pinchTargetY = 0;

  function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getTouchCenter(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }

  // Convert screen coords to a camera offset direction
  function screenToWorldOffset(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    // Normalized -1..1
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
    // Scale to world units (approximate based on FOV and distance)
    const halfH = Math.tan((camera.fov * Math.PI / 180) / 2) * camera.position.z;
    const halfW = halfH * camera.aspect;
    return { x: nx * halfW, y: ny * halfH };
  }

  function animateSnapBack() {
    if (snapBackRaf) cancelAnimationFrame(snapBackRaf);
    const startFov = camera.fov;
    const startX = camera.position.x;
    const startY = camera.position.y;
    const targetFov = 50;
    const startTime = performance.now();
    const duration = 300;

    function step(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      camera.fov = startFov + (targetFov - startFov) * eased;
      camera.position.x = startX + (defaultCamPos.x - startX) * eased;
      camera.position.y = startY + (defaultCamPos.y - startY) * eased;
      camera.updateProjectionMatrix();
      if (t < 1) {
        snapBackRaf = requestAnimationFrame(step);
      } else {
        snapBackRaf = null;
      }
    }
    snapBackRaf = requestAnimationFrame(step);
  }

  function onPinchTouchStart(e) {
    if (e.touches.length === 2) {
      isPinching = true;
      initialPinchDistance = getTouchDistance(e.touches);
      initialFov = camera.fov;
      initialCamX = camera.position.x;
      initialCamY = camera.position.y;
      // Calculate where the user is pinching in world space
      const center = getTouchCenter(e.touches);
      const offset = screenToWorldOffset(center.x, center.y);
      pinchTargetX = offset.x;
      pinchTargetY = offset.y;
      // Cancel any tap/long-press in progress
      pointerDown = false;
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    }
  }

  function onPinchTouchMove(e) {
    if (isPinching && e.touches.length === 2) {
      e.preventDefault();
      const currentDist = getTouchDistance(e.touches);
      const scale = currentDist / initialPinchDistance;

      // Zoom: reduce FOV
      camera.fov = Math.max(20, Math.min(50, initialFov / scale));
      camera.updateProjectionMatrix();

      // Pan toward pinch center proportionally to zoom level
      const zoomFactor = 1 - (camera.fov / 50); // 0 at no zoom, ~0.6 at max zoom
      camera.position.x = initialCamX + pinchTargetX * zoomFactor * 0.5;
      camera.position.y = initialCamY + pinchTargetY * zoomFactor * 0.5;
    }
  }

  function onPinchTouchEnd(e) {
    if (isPinching && e.touches.length < 2) {
      isPinching = false;
      animateSnapBack();
    }
  }

  // Use pointer events only (unified API, works on desktop + mobile)
  // Avoid also registering touch events which causes double-fire on mobile
  const el = renderer.domElement;
  el.addEventListener('pointerdown', onPointerDown, { passive: false });
  el.addEventListener('pointermove', onPointerMove, { passive: false });
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);

  // Touch events specifically for pinch-zoom (multi-touch only)
  el.addEventListener('touchstart', onPinchTouchStart, { passive: true });
  el.addEventListener('touchmove', onPinchTouchMove, { passive: false });
  el.addEventListener('touchend', onPinchTouchEnd, { passive: true });

  return {
    setLocked,
    destroy() {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('touchstart', onPinchTouchStart);
      el.removeEventListener('touchmove', onPinchTouchMove);
      el.removeEventListener('touchend', onPinchTouchEnd);
      if (snapBackRaf) cancelAnimationFrame(snapBackRaf);
    },
  };
}
