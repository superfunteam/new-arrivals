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
      // Still track pointer for edge-click peek detection in onPointerUp
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
    } else if (!box) {
      // No tape hit — check if click is on the edge to peek at side shelves
      const rect = renderer.domElement.getBoundingClientRect();
      const normX = (x - rect.left) / rect.width;
      const edgeZone = 0.15; // 15% of screen width on each side
      if (normX < edgeZone || normX > (1 - edgeZone)) {
        peekAtShelf(normX < 0.5 ? 'left' : 'right');
      }
    }
  }

  // Desktop: temporarily pan camera to show side shelf
  let peekActive = false;
  let peekRaf = null;

  function peekAtShelf(direction) {
    if (peekActive || interactionLocked) return;
    peekActive = true;

    const startX = camera.position.x;
    const startY = camera.position.y;
    const peekX = direction === 'right' ? 5.0 : -5.0;
    const startTime = performance.now();
    const panDuration = 400;
    const holdDuration = 2000;
    const returnDuration = 400;
    const totalDuration = panDuration + holdDuration + returnDuration;

    // Hide solved labels during peek
    const hud = document.getElementById('hud');
    if (hud) hud.classList.add('hud-pinch-mode');

    function step(now) {
      const elapsed = now - startTime;

      if (elapsed < panDuration) {
        // Pan out
        const t = elapsed / panDuration;
        const e = 1 - Math.pow(1 - t, 3);
        camera.position.x = startX + (peekX - startX) * e;
      } else if (elapsed < panDuration + holdDuration) {
        // Hold
        camera.position.x = peekX;
      } else if (elapsed < totalDuration) {
        // Return
        const t = (elapsed - panDuration - holdDuration) / returnDuration;
        const e = 1 - Math.pow(1 - t, 3);
        camera.position.x = peekX + (startX - peekX) * e;
      } else {
        camera.position.x = startX;
        camera.position.y = startY;
        peekActive = false;
        if (hud) hud.classList.remove('hud-pinch-mode');
        return;
      }

      peekRaf = requestAnimationFrame(step);
    }

    peekRaf = requestAnimationFrame(step);
  }

  // ── Pinch-to-zoom (map-native: world point under pinch stays fixed) ──
  let isPinching = false;
  let initialPinchDistance = 0;
  let snapBackRaf = null;
  // Capture actual camera position (may vary by viewport due to auto-fit)
  const defaultCamPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
  const defaultFov = 50;
  const maxZoomOutFov = defaultFov * 1.2; // 20% zoom out

  // The world-space point that was under the pinch center at start
  let anchorWorldX = 0;
  let anchorWorldY = 0;
  // The normalized screen position of the pinch center
  let anchorScreenNx = 0;
  let anchorScreenNy = 0;
  // Camera state at pinch start
  let startCamX = 0;
  let startCamY = 0;
  let startFov = 50;

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

  // Convert screen position to world point at a given FOV and camera position
  function screenToWorld(clientX, clientY, fov, camX, camY) {
    const rect = renderer.domElement.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
    const fovRad = (fov * Math.PI) / 180;
    const halfH = Math.tan(fovRad / 2) * camera.position.z;
    const halfW = halfH * camera.aspect;
    return {
      x: camX + nx * halfW,
      y: camY + ny * halfH,
    };
  }

  function animateSnapTo(targetFov, targetX) {
    if (snapBackRaf) cancelAnimationFrame(snapBackRaf);
    const sf = camera.fov, sx = camera.position.x, sy = camera.position.y;
    const tx = targetX ?? defaultCamPos.x;
    const startTime = performance.now();

    const hud = document.getElementById('hud');

    function step(now) {
      const t = Math.min((now - startTime) / 300, 1);
      const e = 1 - Math.pow(1 - t, 3);
      camera.fov = sf + (targetFov - sf) * e;
      camera.position.x = sx + (tx - sx) * e;
      camera.position.y = sy + (defaultCamPos.y - sy) * e;
      camera.updateProjectionMatrix();
      if (t < 1) {
        snapBackRaf = requestAnimationFrame(step);
      } else {
        snapBackRaf = null;
        if (hud) hud.classList.remove('hud-pinch-mode');
      }
    }
    snapBackRaf = requestAnimationFrame(step);
  }

  function onPinchTouchStart(e) {
    if (e.touches.length === 2) {
      isPinching = true;
      initialPinchDistance = getTouchDistance(e.touches);
      startFov = camera.fov;
      startCamX = camera.position.x;
      startCamY = camera.position.y;

      // Calculate the world point under the pinch center
      const center = getTouchCenter(e.touches);
      const rect = renderer.domElement.getBoundingClientRect();
      anchorScreenNx = ((center.x - rect.left) / rect.width) * 2 - 1;
      anchorScreenNy = -(((center.y - rect.top) / rect.height) * 2 - 1);
      const wp = screenToWorld(center.x, center.y, startFov, startCamX, startCamY);
      anchorWorldX = wp.x;
      anchorWorldY = wp.y;

      // Hide solved row labels during pinch
      const hud = document.getElementById('hud');
      if (hud) hud.classList.add('hud-pinch-mode');

      // Cancel any tap/long-press in progress
      pointerDown = false;
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    }
  }

  function onPinchTouchMove(e) {
    if (isPinching && e.touches.length === 2) {
      e.preventDefault();

      // Calculate new FOV from pinch scale
      const currentDist = getTouchDistance(e.touches);
      const scale = currentDist / initialPinchDistance;
      const newFov = Math.max(20, Math.min(maxZoomOutFov, startFov / scale));
      camera.fov = newFov;
      camera.updateProjectionMatrix();

      if (newFov > defaultFov) {
        // Zooming out — allow horizontal panning to see side shelves/portals
        const fovRad = (newFov * Math.PI) / 180;
        const halfH = Math.tan(fovRad / 2) * camera.position.z;
        const halfW = halfH * camera.aspect;

        const center = getTouchCenter(e.touches);
        const rect = renderer.domElement.getBoundingClientRect();
        const currentNx = ((center.x - rect.left) / rect.width) * 2 - 1;
        const currentNy = -(((center.y - rect.top) / rect.height) * 2 - 1);

        // Pan based on pinch center offset from start, clamped to side shelf range
        camera.position.x = anchorWorldX - currentNx * halfW;
        camera.position.y = defaultCamPos.y; // lock vertical to shelf center
        camera.position.x = Math.max(-5.5, Math.min(5.5, camera.position.x));
      } else {
        // Zooming in — anchor-based panning
        const fovRad = (newFov * Math.PI) / 180;
        const halfH = Math.tan(fovRad / 2) * camera.position.z;
        const halfW = halfH * camera.aspect;

        const center = getTouchCenter(e.touches);
        const rect = renderer.domElement.getBoundingClientRect();
        const currentNx = ((center.x - rect.left) / rect.width) * 2 - 1;
        const currentNy = -(((center.y - rect.top) / rect.height) * 2 - 1);

        camera.position.x = anchorWorldX - currentNx * halfW;
        camera.position.y = anchorWorldY - currentNy * halfH;

        camera.position.x = Math.max(-4, Math.min(4, camera.position.x));
        camera.position.y = Math.max(-4, Math.min(5, camera.position.y));
      }
    }
  }

  function onPinchTouchEnd(e) {
    if (isPinching && e.touches.length < 2) {
      isPinching = false;
      if (camera.fov > defaultFov) {
        // Zoomed out — stick at current FOV, keep horizontal pan position
        animateSnapTo(camera.fov, camera.position.x);
      } else {
        // Zoomed in — snap back to default centered
        animateSnapTo(defaultFov);
      }
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
