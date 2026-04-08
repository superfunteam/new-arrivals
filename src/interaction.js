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

  // ── Pinch-to-zoom + pan (touch events) ──
  let isPinching = false;
  let initialPinchDistance = 0;
  let initialFov = 50;
  let snapBackRaf = null;
  const defaultCamPos = { x: 0, y: 0.5, z: 9 };
  let prevCenterX = 0;
  let prevCenterY = 0;

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

  // Convert screen pixel delta to world units at current zoom
  function screenDeltaToWorld(dx, dy) {
    const rect = renderer.domElement.getBoundingClientRect();
    const fovRad = (camera.fov * Math.PI) / 180;
    const worldH = 2 * Math.tan(fovRad / 2) * camera.position.z;
    const worldW = worldH * camera.aspect;
    return {
      x: (dx / rect.width) * worldW,
      y: -(dy / rect.height) * worldH,
    };
  }

  // On start: snap camera toward pinch center immediately
  function panTowardPinchCenter(touches) {
    const rect = renderer.domElement.getBoundingClientRect();
    const center = getTouchCenter(touches);
    // Normalized offset from screen center (-1..1)
    const nx = ((center.x - rect.left) / rect.width) * 2 - 1;
    const ny = -(((center.y - rect.top) / rect.height) * 2 - 1);
    // World space visible area at default FOV
    const fovRad = (50 * Math.PI) / 180;
    const worldH = 2 * Math.tan(fovRad / 2) * defaultCamPos.z;
    const worldW = worldH * camera.aspect;
    // Move camera toward that point (scaled by zoom level)
    const zoomFactor = 1 - camera.fov / 50;
    camera.position.x = defaultCamPos.x + nx * worldW * 0.5 * zoomFactor;
    camera.position.y = defaultCamPos.y + ny * worldH * 0.5 * zoomFactor;
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
      const center = getTouchCenter(e.touches);
      prevCenterX = center.x;
      prevCenterY = center.y;
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

      // Pan: track pinch center movement (drag while pinching)
      const center = getTouchCenter(e.touches);
      const dx = center.x - prevCenterX;
      const dy = center.y - prevCenterY;
      prevCenterX = center.x;
      prevCenterY = center.y;

      const worldDelta = screenDeltaToWorld(dx, dy);
      camera.position.x += worldDelta.x;
      camera.position.y += worldDelta.y;

      // Also pull toward the pinch center for initial zoom-in
      panTowardPinchCenter(e.touches);

      // Clamp camera within reasonable bounds
      camera.position.x = Math.max(-3, Math.min(3, camera.position.x));
      camera.position.y = Math.max(-3, Math.min(4, camera.position.y));
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
