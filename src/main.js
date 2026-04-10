// New Arrivals -- Main Integration
// Orchestrates all modules into the complete game flow.

import * as THREE from 'three';

import { createScene, resizeScene, getRowPositions, animateShelfZoomIn, createExitPortal, createReturnPortal } from './scene.js';
import {
  loadTexture,
  preloadTextures,
  createVHSBox,
  setBoxState,
  setSpineColor,
  swapToFullTexture,
  getBoxDimensions,
  layoutBoxes,
  reflowBoxes,
} from './vhs-box.js';
import {
  updateAnimations,
  addAnimation,
  animateEntrance,
  animateLockIn,
  animateShake,
  animateReflow,
  applyIdleWobble,
  animateGrayOut,
  animateInspect,
  animateReturnToShelf,
  animateSlideOut,
  animateSlideIn,
  animateBump,
} from './animations.js';
import { setupInteraction } from './interaction.js';
import {
  createGame,
  startTimer,
  getAllMovies,
  toggleSelection,
  checkGuess,
  useHint,
  revealHint,
  getTimePenalty,
  calculateFinalWage,
  getElapsedTime,
  serializeGame,
  restoreGame,
} from './game-logic.js';
import {
  loadTodaysPuzzle,
  saveGameState,
  loadGameState,
  updateStats,
  isSkipIntro,
  setSkipIntro,
  getPastPuzzles,
  getCompletedDailyIds,
  markDailyCompleted,
  getGameScores,
  saveGameScore,
  getPaycheckData,
} from './state.js';
import {
  createHUD,
  updateWage,
  updateTimer,
  setShelveButton,
  showSplashScreen,
  showOnboarding,
  showWelcomeScreen,
  showLightbox,
  hideLightbox,
  showEndScreen,
  showTrackingFlash,
  showShiftStatsButton,
  showGuessMessage,
  dismissSwipeHint,
  onMuteClick,
  setMuteIcon,
  onStationClick,
  setStationName,
  onHelpClick,
  addSolvedRowLabel,
  revealHintInPlace,
  revealDetailsInPlace,
  revealSummaryInPlace,
  updateRadioViz,
} from './ui.js';
import { audio } from './audio.js';
import { triggerShare } from './share.js';
import { initInterrupts, stopInterrupts, pauseInterrupts, resumeInterrupts } from './interrupts.js';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Deterministic shuffle seeded by a string (puzzle id). */
function shuffleWithSeed(array, seed) {
  const arr = [...array];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  for (let i = arr.length - 1; i > 0; i--) {
    hash = ((hash << 5) - hash) + i;
    hash |= 0;
    const j = Math.abs(hash) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Create a placeholder CanvasTexture when a poster fails to load. */
function createPlaceholderTexture(title) {
  const cvs = document.createElement('canvas');
  cvs.width = 128;
  cvs.height = 192;
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, 128, 192);
  ctx.fillStyle = '#888';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, 64, 96, 120);
  return new THREE.CanvasTexture(cvs);
}

// ---------------------------------------------------------------------------
// Mini Three.js scene for onboarding slide 0 (cascading twirl showcase)
// ---------------------------------------------------------------------------

function startOnboarding3DScene(posterIds) {
  const canvas = document.getElementById('onboarding-3d');
  if (!canvas) return () => {};

  const W = 320;
  const H = 180;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 20);
  camera.position.set(0, 0, 3);
  camera.lookAt(0, 0, 0);

  // Lighting matching the main game
  scene.add(new THREE.AmbientLight(0xfff5e6, 0.5));
  const dirLight = new THREE.DirectionalLight(0xfff0d4, 0.8);
  dirLight.position.set(0, 3, 4);
  scene.add(dirLight);
  const neon = new THREE.PointLight(0xFF6B9D, 0.3, 8);
  neon.position.set(2, 2, 2);
  scene.add(neon);

  // Create 4 VHS boxes using the real createVHSBox
  const movieIds = posterIds.slice(0, 4);
  const boxes = [];
  const gap = 0.75;
  const startX = -((movieIds.length - 1) * gap) / 2;

  let loadedCount = 0;

  movieIds.forEach((id, i) => {
    loadTexture(`/posters/${id}_pixel.jpg`).then(tex => {
      const movie = { tmdb_id: id, title: '' };
      const box = createVHSBox(movie, tex);
      box.position.set(startX + i * gap, 0, 0);
      box.scale.setScalar(1);
      scene.add(box);
      boxes[i] = box;
      loadedCount++;
    }).catch(() => { loadedCount++; });
  });

  // Animation loop with cascading twirl
  let running = true;
  const clock = new THREE.Clock();

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Each box twirls on its own schedule:
    // Cycle is 6s total. Each box gets a 1.2s twirl window, staggered 0.4s apart.
    // Remaining time is the pause.
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (!box) continue;

      const cycleT = (t + 10) % 6; // +10 to avoid start-of-cycle weirdness
      const boxStart = i * 0.4;
      const twirlDuration = 1.2;

      if (cycleT >= boxStart && cycleT < boxStart + twirlDuration) {
        const localT = (cycleT - boxStart) / twirlDuration;
        const eased = 1 - Math.pow(1 - localT, 3); // easeOutCubic
        box.rotation.y = eased * Math.PI * 2;
        box.position.y = Math.sin(localT * Math.PI) * 0.12;
      } else {
        box.rotation.y = 0;
        box.position.y = 0;
      }
    }

    renderer.render(scene, camera);
  }
  animate();

  // Return cleanup function
  return () => {
    running = false;
    renderer.dispose();
    scene.clear();
  };
}

// ---------------------------------------------------------------------------
// Radio Station System (module scope so startGameSession can access)
// ---------------------------------------------------------------------------

const STATIONS = [
  { name: '98.5 KPEZ', file: '/audio/kpez.mp3' },
  { name: '101.7 HOT-Z', file: '/audio/HOT-Z.mp3' },
  { name: '94.3 WOLF', file: '/audio/WOLF.mp3' },
  { name: '107.9 CHIL', file: '/audio/CHIL.mp3' },
];
const staticAudio = new Audio('/audio/static.mp3');
staticAudio.volume = 0.65;
staticAudio.load();

let currentStationIdx = Math.floor(Math.random() * STATIONS.length);
const radioEl = new Audio(STATIONS[currentStationIdx].file);
radioEl.loop = true;
radioEl.volume = 0.65;
let radioStarted = false;
let changingStation = false;

function ensureRadioStarted() {
  if (radioStarted) return;
  radioStarted = true;
  audio.init();
  radioEl.play().catch(() => {});
}

function changeStation() {
  if (changingStation || !radioStarted) return;
  changingStation = true;
  radioEl.pause();
  staticAudio.currentTime = 0;
  staticAudio.play().catch(() => {});
  currentStationIdx = (currentStationIdx + 1) % STATIONS.length;
  setStationName(STATIONS[currentStationIdx].name);
  radioEl.src = STATIONS[currentStationIdx].file;
  radioEl.load();
  setTimeout(() => {
    staticAudio.pause();
    radioEl.play().catch(() => {});
    changingStation = false;
  }, 1000);
}

// ---------------------------------------------------------------------------
// Main — Welcome Screen Entry Point
// ---------------------------------------------------------------------------

async function main() {
  // ── 1. Fetch puzzles ──────────────────────────────────────────────────────
  let puzzlesData;
  try {
    const res = await fetch('/puzzles.json');
    puzzlesData = await res.json();
  } catch (err) {
    console.error('Failed to load puzzles.json:', err);
    return;
  }

  // ── 2. Determine daily puzzle ─────────────────────────────────────────────
  const dailyPuzzle = loadTodaysPuzzle(puzzlesData);

  // ── Portal instant entry: skip splash/onboarding/welcome ─────────────────
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('portal') === 'true') {
    ensureRadioStarted();
    startGameSession(dailyPuzzle, 'daily', puzzlesData);
    return; // skip splash/onboarding/welcome
  }

  // ── 3. Check daily state ──────────────────────────────────────────────────
  const savedState = loadGameState();
  const hasSavedDaily = savedState && savedState.puzzleId === dailyPuzzle.id;
  let dailyState = null; // null | 'in_progress' | 'completed'
  if (hasSavedDaily) {
    dailyState = savedState.completed ? 'completed' : 'in_progress';
  }

  // ── 4. Determine practice puzzles (training only — don't spoil upcoming dailies) ──
  const allPuzzles = puzzlesData.puzzles;
  const practicePuzzles = allPuzzles.filter(p => p.id.startsWith('training-'));

  // ── 5. Determine past puzzles and completed dailies ───────────────────────
  const pastPuzzles = getPastPuzzles(puzzlesData);
  const completedDailyIds = getCompletedDailyIds();

  // ── 6. Collect poster IDs for splash screen marquee ─────────────────────────
  const allPosterIds = [];
  const seenIds = new Set();
  for (const p of allPuzzles) {
    for (const cat of p.categories) {
      for (const m of cat.movies) {
        if (!seenIds.has(m.tmdb_id)) {
          seenIds.add(m.tmdb_id);
          allPosterIds.push(m.tmdb_id);
        }
      }
    }
  }
  // Use up to 60 unique posters (12 per row × 5 rows, no repeats in viewport)
  const splashPosterIds = allPosterIds.slice(0, 60);

  // ── 7. Show splash → onboarding → welcome ─────────────────────────────────
  function showWelcome() {
    showWelcomeScreen({
      dailyPuzzle,
      dailyState,
      practicePuzzles,
      pastPuzzles,
      completedDailyIds,
      gameScores: getGameScores(),
      paycheckData: getPaycheckData(puzzlesData),
      onStartDaily: () => {
        ensureRadioStarted();
        startGameSession(dailyPuzzle, 'daily', puzzlesData);
      },
      onStartPractice: (index) => {
        ensureRadioStarted();
        startGameSession(practicePuzzles[index], 'practice', puzzlesData);
      },
      onStartPast: (puzzle) => {
        ensureRadioStarted();
        startGameSession(puzzle, 'practice', puzzlesData);
      },
    });
  }

  function proceedAfterSplash(startMuted) {
    if (startMuted) {
      audio.setMuted(true);
      radioEl.muted = true;
    } else {
      ensureRadioStarted();
    }

    if (!isSkipIntro()) {
      let miniSceneCleanup = null;

      showOnboarding((skipChecked) => {
        if (miniSceneCleanup) { miniSceneCleanup(); miniSceneCleanup = null; }
        setSkipIntro(skipChecked);
        showWelcome();
      }, (slideIndex) => {
        // Clean up previous mini scene
        if (miniSceneCleanup) { miniSceneCleanup(); miniSceneCleanup = null; }
        // Start 3D tape showcase on slide 0
        if (slideIndex === 0) {
          miniSceneCleanup = startOnboarding3DScene(splashPosterIds);
        }
      });
    } else {
      showWelcome();
    }
  }

  // Check if returning from a finished game — skip straight to menu
  if (sessionStorage.getItem('skipToMenu')) {
    sessionStorage.removeItem('skipToMenu');
    ensureRadioStarted();
    showWelcome();
  } else {
    showSplashScreen({
      posterIds: splashPosterIds,
      onStart: () => proceedAfterSplash(false),
      onStartMuted: () => proceedAfterSplash(true),
    });
  }
}

// ---------------------------------------------------------------------------
// startGameSession — Full Game Flow (extracted from original main)
// ---------------------------------------------------------------------------

async function startGameSession(puzzle, mode, puzzlesData) {
  const isDaily = mode === 'daily';

  // ── 1. Check localStorage for saved state (daily only) ────────────────────
  let savedState = null;
  let isRestoring = false;
  if (isDaily) {
    savedState = loadGameState();
    isRestoring = savedState && savedState.puzzleId === puzzle.id;
  }

  // ── 2. Create Three.js scene ──────────────────────────────────────────────
  const canvas = document.getElementById('game-canvas');
  const { scene, camera, renderer, shelfGroup } = createScene(canvas);

  // ── Vibe Jam 2026 portals ────────────────────────────────────────────────
  const activePortals = [];

  // Exit portal (green) — always present, links to Vibe Jam 2026
  const exitPortal = createExitPortal(scene);
  exitPortal.url = 'https://vibejam.cc/portal/2026?portal=true&ref=game.vhsgarage.com&username=clerk';
  activePortals.push(exitPortal);

  // Return portal (red/pink) — only if ?ref= is present in the URL
  const gameUrlParams = new URLSearchParams(window.location.search);
  const refUrl = gameUrlParams.get('ref');
  if (refUrl) {
    const returnPortal = createReturnPortal(scene);
    // Build the return URL: use the ref value, forward portal param
    const returnHref = refUrl.startsWith('http') ? refUrl : `https://${refUrl}`;
    returnPortal.url = `${returnHref}?portal=true`;
    activePortals.push(returnPortal);
  }

  // Portal click detection via raycaster
  const portalRaycaster = new THREE.Raycaster();
  const portalPointer = new THREE.Vector2();

  function onPortalClick(e) {
    const clientX = e.clientX ?? e.changedTouches?.[0]?.clientX;
    const clientY = e.clientY ?? e.changedTouches?.[0]?.clientY;
    if (clientX === undefined) return;

    const rect = renderer.domElement.getBoundingClientRect();
    portalPointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    portalPointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    portalRaycaster.setFromCamera(portalPointer, camera);

    for (const portal of activePortals) {
      const meshes = [];
      portal.group.traverse((child) => {
        if (child.isMesh) meshes.push(child);
      });
      const hits = portalRaycaster.intersectObjects(meshes, false);
      if (hits.length > 0) {
        window.location.href = portal.url;
        return;
      }
    }
  }

  renderer.domElement.addEventListener('click', onPortalClick);

  // ── 3. Create HUD ─────────────────────────────────────────────────────────
  createHUD();
  setStationName(STATIONS[currentStationIdx].name);

  // Show puzzle title + day of week in HUD
  const hudDate = document.querySelector('.hud-date');
  if (hudDate && puzzle.title) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[new Date().getDay()];
    hudDate.innerHTML = `${dayName} · ${hudDate.textContent}<br><span class="hud-puzzle-title">${puzzle.title}</span>`;
  }

  // ── 4. Setup radio + mute + station switching ──────────────────────────────
  let _isMuted = audio.isMuted();
  setMuteIcon(_isMuted);

  // Mute icon toggles audio
  onMuteClick(() => {
    _isMuted = !_isMuted;
    audio.setMuted(_isMuted);
    radioEl.muted = _isMuted;
    setMuteIcon(_isMuted);
  });

  // Station name / spectrograph taps change station
  onStationClick(() => {
    changeStation();
  });

  // ── 5. Create or restore game state ───────────────────────────────────────
  let game;
  if (isRestoring) {
    game = restoreGame(savedState, puzzle);
  } else {
    game = createGame(puzzle);
  }

  // Update HUD to match restored state
  updateWage(game.wage);
  if (game.startTime) {
    updateTimer(getElapsedTime(game.startTime));
  }

  // ── 6. Load poster textures, create 16 VHS boxes ─────────────────────────
  const allMovies = getAllMovies(puzzle);
  const shuffledMovies = shuffleWithSeed(allMovies, puzzle.id);

  // Load pixelated textures (for initial display)
  const textures = await Promise.all(
    shuffledMovies.map(async (movie) => {
      try {
        return await loadTexture(`/posters/${movie.tmdb_id}_pixel.jpg`);
      } catch {
        return createPlaceholderTexture(movie.title);
      }
    })
  );

  // Preload full-res posters in background for instant uncover
  const fullResUrls = shuffledMovies.map(m => `/posters/${m.tmdb_id}.jpg`);
  preloadTextures(fullResUrls);

  // Create box meshes
  const allBoxes = shuffledMovies.map((movie, i) => {
    const box = createVHSBox(movie, textures[i]);
    return box;
  });

  // ── 7. Layout boxes on shelf ──────────────────────────────────────────────
  layoutBoxes(allBoxes, shelfGroup);

  // Add all boxes to the scene
  for (const box of allBoxes) {
    scene.add(box);
  }

  // Track which boxes are unsolved vs locked
  let unsolvedBoxes = [...allBoxes];
  let solvedRowCount = 0;

  // ── 8. If restoring: apply solved state ───────────────────────────────────
  if (isRestoring && game.solvedCategories.length > 0) {
    const rowPositions = getRowPositions(shelfGroup);
    const { width } = getBoxDimensions();
    const cols = 4;
    const gap = 0.12;
    const totalRowWidth = cols * width + (cols - 1) * gap;
    const startX = -totalRowWidth / 2 + width / 2;
    const z = 0.15;

    solvedRowCount = game.solvedCategories.length;

    // For each solved category, find its boxes and lock them into their row
    game.solvedCategories.forEach((cat, catIdx) => {
      const catMovieIds = new Set(cat.movies.map((m) => m.tmdb_id));
      const catBoxes = allBoxes.filter((b) => catMovieIds.has(b.userData.movie.tmdb_id));

      catBoxes.forEach((box, colIdx) => {
        const x = startX + colIdx * (width + gap);
        const y = rowPositions[catIdx];
        box.position.set(x, y, z);
        box.userData.originalPosition.set(x, y, z);
        setBoxState(box, 'locked');
        setSpineColor(box, parseInt(cat.color.replace('#', ''), 16));
      });

      // Remove these boxes from unsolved list
      unsolvedBoxes = unsolvedBoxes.filter((b) => !catMovieIds.has(b.userData.movie.tmdb_id));
    });

    // Reflow unsolved boxes into remaining rows
    reflowBoxes(unsolvedBoxes, shelfGroup, solvedRowCount);
    // Snap unsolved boxes to their reflowed positions
    for (const box of unsolvedBoxes) {
      box.position.copy(box.userData.originalPosition);
    }
  }

  // ── 9. If restoring: apply uncovered state ────────────────────────────────
  if (isRestoring && game.uncoveredIds.length > 0) {
    const uncoveredSet = new Set(game.uncoveredIds);
    for (const box of allBoxes) {
      if (uncoveredSet.has(box.userData.movie.tmdb_id)) {
        try {
          const fullTex = await loadTexture(`/posters/${box.userData.movie.tmdb_id}.jpg`);
          swapToFullTexture(box, fullTex);
        } catch {
          // Keep pixelated if full texture fails
        }
      }
    }
  }

  // =========================================================================
  // Shared mutable state for interaction callbacks
  // =========================================================================

  let interactionHandle = null;
  let audioInitialized = false;
  let timerStarted = false;
  let timerInterval = null;
  let interruptsData = null;

  // If restoring a game that had the timer running, resume the timer display
  if (isRestoring && game.startTime && !game.completed) {
    timerStarted = true;
    timerInterval = setInterval(() => {
      updateTimer(getElapsedTime(game.startTime));
    }, 1000);
  }

  let renderLoopStarted = false;
  const clock = new THREE.Clock();

  // ── 10a. Fetch interrupts data ──────────────────────────────────────────────
  try {
    const intRes = await fetch('/interrupts.json');
    interruptsData = await intRes.json();
  } catch (err) {
    console.warn('Failed to load interrupts.json:', err);
  }

  // Helper to start the interrupt system for this session
  function startInterruptSystem() {
    if (!interruptsData) return;
    initInterrupts({
      puzzleId: puzzle.id,
      game,
      onWageChange: (newWage, isGain) => {
        updateWage(newWage, !isGain);
      },
      onPause: () => {
        // Pause game timer
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
        // Lock interaction
        if (interactionHandle) {
          interactionHandle.setLocked(true);
        }
      },
      onResume: () => {
        // Resume game timer
        if (timerStarted && game.startTime && !game.completed) {
          timerInterval = setInterval(() => {
            updateTimer(getElapsedTime(game.startTime));
          }, 1000);
        }
        // Unlock interaction
        if (interactionHandle) {
          interactionHandle.setLocked(false);
        }
        // Check if game over (wage hit 0 from interrupt cost)
        if (game.completed) {
          handleGameOver();
        }
      },
      interruptsData,
    });
  }

  // ── 10. If game already completed: show end screen, render, return ────────
  if (game.completed) {
    showEndScreenForGame(game);
    startRenderLoop();
    return;
  }

  // ── 11. Start game play ────────────────────────────────────────────────────
  startGamePlay();

  function startGamePlay() {
    // Start render loop (if not already started by onboarding path)
    if (!renderLoopStarted) {
      startRenderLoop();
    }

    if (isRestoring) {
      // Skip entrance animation for restored games — boxes are already placed
      // Also restore visual selection state for any currently selected boxes
      const selectedSet = new Set(game.selectedIds);
      for (const box of unsolvedBoxes) {
        if (selectedSet.has(box.userData.movie.tmdb_id)) {
          setBoxState(box, 'selected');
        }
      }
      setupGameInteraction();
      // Re-enable shelve button if 4 are selected
      setShelveButton(game.selectedIds.length === 4, handleShelveIt, game.selectedIds.length);
      // Start interrupt system for restored games
      startInterruptSystem();
    } else {
      // Fresh game — hide tapes during shelf zoom, then fly them in
      for (const box of allBoxes) box.visible = false;

      animateShelfZoomIn(camera, () => {
        for (const box of allBoxes) box.visible = true;
        animateEntrance(unsolvedBoxes, () => {
          // Start timer when tapes land
          startTimer(game);
          timerStarted = true;
          timerInterval = setInterval(() => {
            updateTimer(getElapsedTime(game.startTime));
          }, 1000);
          setupGameInteraction();
          // Start interrupt system after entrance animation completes
          startInterruptSystem();
        });
      });
    }
  }

  // =========================================================================
  // Interaction Setup
  // =========================================================================

  function setupGameInteraction() {
    interactionHandle = setupInteraction(
      camera,
      renderer,
      () => unsolvedBoxes,
      {
        onTap: handleTap,
        onLongPress: handleLongPress,
      }
    );

    // Set up the SHELVE IT button
    setShelveButton(false, handleShelveIt, 0);

    // Set up help button — reloads to show onboarding + welcome screen
    onHelpClick(() => {
      location.reload();
    });

    // Device shake (sustained 1s+) → bump all tapes on the shelf
    let shakeCount = 0;
    let shakeWindowStart = 0;
    let lastBumpTime = 0;
    const SHAKE_THRESHOLD = 20;
    const SHAKE_HITS_NEEDED = 5;  // need 5 spikes within the window
    const SHAKE_WINDOW = 1000;    // within 1 second
    const BUMP_COOLDOWN = 2000;

    window.addEventListener('devicemotion', (e) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const force = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
      const now = Date.now();

      if (force > SHAKE_THRESHOLD) {
        if (now - shakeWindowStart > SHAKE_WINDOW) {
          // Reset window
          shakeCount = 0;
          shakeWindowStart = now;
        }
        shakeCount++;

        if (shakeCount >= SHAKE_HITS_NEEDED && now - lastBumpTime > BUMP_COOLDOWN) {
          lastBumpTime = now;
          shakeCount = 0;
          animateBump(allBoxes);
          audio.play('dropInPlace');
        }
      }
    });
  }

  // =========================================================================
  // onTap
  // =========================================================================

  function handleTap(box) {
    // 1. Ensure audio is initialized (fallback if welcome screen didn't start it)
    if (!audioInitialized) { audio.init(); audioInitialized = true; }

    // 3. Toggle selection
    const { action } = toggleSelection(game, box.userData.movie.tmdb_id);

    // 4. Update box visual state
    if (action === 'selected') {
      setBoxState(box, 'selected');
      // 5. Play sound
      audio.play('dropInPlace');
    } else if (action === 'deselected') {
      setBoxState(box, 'default');
      audio.play('returnToShelf');
    }
    // action === 'full' means 4 already selected, do nothing

    // 6. Update shelve button (active when 4 selected, show "Pick N" otherwise)
    setShelveButton(game.selectedIds.length === 4, handleShelveIt, game.selectedIds.length);

    // 7. Save state (daily only)
    if (isDaily) {
      saveGameState(serializeGame(game));
    }
  }

  // =========================================================================
  // onLongPress
  // =========================================================================

  // =========================================================================
  // Lightbox canvas-swipe state
  // =========================================================================

  let lightboxSwipeCleanup = null;

  function setupLightboxSwipe(getCurrentBox, setCurrentBox) {
    const el = renderer.domElement;
    let startX = 0, deltaX = 0, swiping = false;
    // Must match the y offset in animateInspect (+0.25)
    const inspectPos = new THREE.Vector3(0, camera.position.y + 0.25, camera.position.z - 2);

    function onStart(e) {
      if (e.touches && e.touches.length === 1) {
        startX = e.touches[0].clientX;
        deltaX = 0;
        swiping = true;
      }
    }
    function onMove(e) {
      if (!swiping || !e.touches) return;
      deltaX = e.touches[0].clientX - startX;
      // Live feedback: shift the 3D box horizontally
      const box = getCurrentBox();
      if (box) {
        box.position.x = inspectPos.x + deltaX * 0.01;
      }
    }
    function onEnd() {
      if (!swiping) return;
      swiping = false;
      const box = getCurrentBox();
      const threshold = 80;
      if (Math.abs(deltaX) > threshold) {
        const direction = deltaX > 0 ? -1 : 1; // swipe right = prev, swipe left = next
        const allTapes = unsolvedBoxes.map(b => b.userData.movie);
        const currentIndex = allTapes.findIndex(m => m.tmdb_id === box.userData.movie.tmdb_id);
        // Loop: wrap around at both ends
        const newIndex = (currentIndex + direction + allTapes.length) % allTapes.length;
        if (allTapes.length > 1) {
          // Fade sticker + swipe hint out immediately
          const sticker = document.querySelector('.lightbox-sticker');
          if (sticker) sticker.classList.add('sticker-out');
          dismissSwipeHint();
          navigateToTape(newIndex, deltaX > 0 ? 'right' : 'left', getCurrentBox, setCurrentBox);
          return;
        }
      }
      // Snap back to inspect center
      if (box) {
        box.position.x = inspectPos.x;
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });

    lightboxSwipeCleanup = () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      lightboxSwipeCleanup = null;
    };
  }

  function navigateToTape(newIndex, direction, getCurrentBox, setCurrentBox) {
    const allTapes = unsolvedBoxes.map(b => b.userData.movie);
    const newMovie = allTapes[newIndex];
    const newBox = unsolvedBoxes.find(b => b.userData.movie.tmdb_id === newMovie.tmdb_id);
    if (!newBox) return;

    const currentBox = getCurrentBox();

    // Twirl current box back — swap texture mid-twirl when back is visible
    const returnPos = currentBox.userData.originalPosition.clone();
    setTimeout(() => swapToShelfTexture(currentBox), 125);
    animateReturnToShelf(currentBox, returnPos, () => {
      currentBox.scale.setScalar(1);
    });

    // Set new box as current
    setCurrentBox(newBox);

    // Swap incoming box to detail texture for zoom view
    swapToDetailTexture(newBox);

    // Twirl new box up to inspect position (same animateInspect used for initial long-press)
    newBox.scale.setScalar(1);
    animateInspect(newBox, camera, () => {
      // Update lightbox text for the new movie
      hideLightbox();
      openLightboxForBox(newBox, getCurrentBox, setCurrentBox);
    });
  }

  function openLightboxForBox(box, getCurrentBox, setCurrentBox) {
    const movie = box.userData.movie;
    const revealedForMovie = game.revealedHints[movie.tmdb_id] || [];

    showLightbox(movie, {
      uncovered: game.uncoveredIds.includes(movie.tmdb_id),
      hintsLeft: game.wage,
      wage: game.wage,
      genres: movie.genres || [],
      director: movie.director || '',
      stars: movie.stars || [],
      year: movie.year || 0,
      summary: movie.summary || '',
      revealedFields: revealedForMovie,
      onReturn: () => {
        // Fade sticker out immediately before hiding lightbox
        const sticker = document.querySelector('.lightbox-sticker');
        if (sticker) sticker.classList.add('sticker-out');
        audio.play('returnToShelf');
        setTimeout(() => hideLightbox(), 150);

        // Clean up canvas swipe listeners
        if (lightboxSwipeCleanup) lightboxSwipeCleanup();

        // Resume interrupts now that lightbox is closing
        resumeInterrupts();

        // Animate back — swap texture mid-twirl when back face is toward camera
        const currentBox = getCurrentBox();
        const returnPos = currentBox.userData.originalPosition.clone();
        // Delay texture swap ~125ms (quarter of 0.5s animation = first half-turn)
        setTimeout(() => swapToShelfTexture(currentBox), 125);
        animateReturnToShelf(currentBox, returnPos, () => {
          if (interactionHandle) {
            interactionHandle.setLocked(false);
          }
        });
      },
      onUncover: (tmdbId) => {
        const result = useHint(game, tmdbId);
        if (!result.success) return;

        audio.play('uncover');
        audio.play('penalty');

        // Update HUD
        updateWage(game.wage, true);

        // Swap 3D texture on the actual box in real-time
        const targetBox = allBoxes.find((b) => b.userData.movie.tmdb_id === tmdbId);
        if (targetBox) {
          loadTexture(`/posters/${tmdbId}.jpg`)
            .then((fullTex) => swapToFullTexture(targetBox, fullTex))
            .catch(() => {
              // Keep pixelated if full fails
            });
        }

        // Save state (daily only)
        if (isDaily) {
          saveGameState(serializeGame(game));
        }

        // Check if game over (wage hit 0)
        if (game.completed) {
          hideLightbox();
          if (lightboxSwipeCleanup) lightboxSwipeCleanup();
          handleGameOver();
        }
      },
      onRevealHint: (fieldName) => {
        const currentBox = getCurrentBox();
        const movie = currentBox.userData.movie;
        const result = revealHint(game, movie.tmdb_id, fieldName);
        if (!result.success) return;

        audio.play('penalty');

        // Update HUD
        updateWage(game.wage, true);

        // Animate the reveal in-place
        if (fieldName === 'details') {
          revealDetailsInPlace(movie.director, movie.stars, movie.year);
        } else if (fieldName === 'summary') {
          revealSummaryInPlace(movie.summary || '');
        } else {
          // Fallback for individual fields (legacy)
          const valueMap = { director: movie.director, stars: movie.stars, year: movie.year };
          revealHintInPlace(fieldName, valueMap[fieldName]);
        }

        // Save state (daily only)
        if (isDaily) {
          saveGameState(serializeGame(game));
        }

        if (game.completed) {
          hideLightbox();
          if (lightboxSwipeCleanup) lightboxSwipeCleanup();
          handleGameOver();
        }
      },
    });
  }

  // Swap a box's front texture to the detail (chunkier) version for zoom view
  function swapToDetailTexture(box) {
    if (box.userData.uncovered) return; // already uncovered, keep full-res
    const movie = box.userData.movie;
    loadTexture(`/posters/${movie.tmdb_id}_pixel_detail.png`).then(tex => {
      box.userData._shelfTexture = box.userData.frontMaterial.map; // save shelf version
      box.userData.frontMaterial.map = tex;
      box.userData.frontMaterial.needsUpdate = true;
    }).catch(() => {});
  }

  // Swap back to the shelf (less chunky) texture
  function swapToShelfTexture(box) {
    if (box.userData.uncovered) return;
    if (box.userData._shelfTexture) {
      box.userData.frontMaterial.map = box.userData._shelfTexture;
      box.userData.frontMaterial.needsUpdate = true;
      delete box.userData._shelfTexture;
    }
  }

  function handleLongPress(box) {
    // Ensure audio is initialized (fallback)
    if (!audioInitialized) { audio.init(); audioInitialized = true; }
    audio.play('tapInspect');

    // Hide row labels IMMEDIATELY (before animation starts)
    const hud = document.getElementById('hud');
    if (hud) hud.classList.add('hud-inspect-mode');

    // Pause interrupts while lightbox is open
    pauseInterrupts();

    // Lock interaction during the inspect animation
    if (interactionHandle) {
      interactionHandle.setLocked(true);
    }

    // Track the currently inspected box via getter/setter closures
    let currentBox = box;
    const getCurrentBox = () => currentBox;
    const setCurrentBox = (b) => { currentBox = b; };

    // Reset scale to 1 (entrance animation may have scaled boxes)
    box.scale.setScalar(1);

    // Swap to chunkier detail texture for zoom view
    swapToDetailTexture(box);

    // Animate the box toward the camera with a 3D twirl
    animateInspect(box, camera, () => {
      // Animation complete — set up canvas swipe and show lightbox
      setupLightboxSwipe(getCurrentBox, setCurrentBox);
      openLightboxForBox(currentBox, getCurrentBox, setCurrentBox);
    });
  }

  // =========================================================================
  // handleShelveIt
  // =========================================================================

  function handleShelveIt() {
    if (!interactionHandle) return;

    // 1. Lock interaction during animation
    interactionHandle.setLocked(true);

    // 2. Check guess
    const result = checkGuess(game);

    // Duplicate guess — no penalty, just a message
    if (result.duplicate) {
      showGuessMessage("You already guessed this!");
      // Deselect all visually
      const selectedBoxes = allBoxes.filter((b) => b.userData.selected);
      for (const box of selectedBoxes) { setBoxState(box, 'default'); }
      interactionHandle.setLocked(false);
      setShelveButton(false, handleShelveIt, 0);
      return;
    }

    if (result.correct) {
      // ── CORRECT ──────────────────────────────────────────────────────────
      audio.play('correct');

      const cat = result.category;
      const catMovieIds = new Set(cat.movies.map((m) => m.tmdb_id));
      const catBoxes = allBoxes.filter((b) => catMovieIds.has(b.userData.movie.tmdb_id));

      // Calculate target positions for the solved row
      const rowPositions = getRowPositions(shelfGroup);
      const targetRowIdx = solvedRowCount;
      const { width } = getBoxDimensions();
      const cols = 4;
      const gap = 0.12;
      const totalRowWidth = cols * width + (cols - 1) * gap;
      const startX = -totalRowWidth / 2 + width / 2;
      const z = 0.15;
      const targetY = rowPositions[targetRowIdx];

      const targetPositions = catBoxes.map((_, colIdx) => {
        return new THREE.Vector3(
          startX + colIdx * (width + gap),
          targetY,
          z
        );
      });

      // Update solved count and unsolved list BEFORE animating
      // so reflow positions are calculated correctly
      solvedRowCount++;
      unsolvedBoxes = unsolvedBoxes.filter((b) => !catMovieIds.has(b.userData.movie.tmdb_id));
      reflowBoxes(unsolvedBoxes, shelfGroup, solvedRowCount);

      // Animate lock-in AND reflow simultaneously
      animateLockIn(catBoxes, targetY, targetPositions, () => {
        // Set box states and spine colors once lock-in finishes
        for (const box of catBoxes) {
          setBoxState(box, 'locked');
          setSpineColor(box, parseInt(cat.color.replace('#', ''), 16));
        }

        // Project 3D row position to screen space for the solved label
        const rowCenter = new THREE.Vector3(0, targetY, z);
        rowCenter.project(camera);
        const screenY = (-rowCenter.y * 0.5 + 0.5) * renderer.domElement.clientHeight;
        addSolvedRowLabel(cat.name, cat.color, screenY);
      });

      // Reflow remaining tapes at the same time
      animateReflow(unsolvedBoxes, () => {
          // Unlock interaction once both animations done
          interactionHandle.setLocked(false);

          // Clear button state
          setShelveButton(false, handleShelveIt, 0);

          // Save state (daily only)
          if (isDaily) {
            saveGameState(serializeGame(game));
          }

          // Check if game complete
          if (game.completed) {
            handleGameOver();
          }
      });
    } else {
      // ── WRONG ────────────────────────────────────────────────────────────
      audio.play('wrong');
      audio.play('penalty');

      // Show "one away" hint or tracking flash
      if (result.oneAway) {
        showGuessMessage("So close, one away!");
      }
      showTrackingFlash();

      // Update wage display
      updateWage(game.wage, true);

      // Find selected boxes (they were just cleared by checkGuess, but we
      // can identify them as boxes still in 'selected' state visually)
      const selectedBoxes = allBoxes.filter((b) => b.userData.selected);

      // Animate shake
      animateShake(selectedBoxes, () => {
        // Reset box states to default
        for (const box of selectedBoxes) {
          setBoxState(box, 'default');
        }

        // Unlock interaction
        interactionHandle.setLocked(false);

        // Clear button state
        setShelveButton(false, handleShelveIt, 0);

        // Save state (daily only)
        if (isDaily) {
          saveGameState(serializeGame(game));
        }

        // Check if game over (wage hit 0)
        if (game.completed) {
          handleGameOver();
        }
      });
    }
  }

  // =========================================================================
  // handleGameOver
  // =========================================================================

  function handleGameOver() {
    // Stop customer interrupts
    stopInterrupts();

    // Clear timer interval
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    // Lock interaction
    if (interactionHandle) {
      interactionHandle.setLocked(true);
    }

    if (!game.won) {
      // Loss: play gameLoss, gray out remaining boxes, then show end screen
      audio.play('gameLoss');
      animateGrayOut(unsolvedBoxes, () => {
        setTimeout(() => {
          showEndScreenForGame(game);
        }, 500);
      });
    } else {
      // Win: play gameWin, then show countdown button — let the solve breathe
      audio.play('gameWin');

      // Show the HUD again so labels are visible
      const hud = document.getElementById('hud');
      if (hud) hud.classList.remove('hud-inspect-mode');

      // After a brief moment, show the countdown "View Your Shift Stats" button
      setTimeout(() => {
        showShiftStatsButton(() => showEndScreenForGame(game));
      }, 1000);
    }

    // Save score for all modes (best score kept)
    const finalWage = calculateFinalWage(game);
    saveGameScore(puzzle.id, finalWage);

    // Update stats (daily only)
    if (isDaily) {
      updateStats(finalWage, game.won);
      markDailyCompleted(puzzle.id);
      saveGameState(serializeGame(game));
    }
  }

  // =========================================================================
  // End Screen helper
  // =========================================================================

  function showEndScreenForGame(g) {
    const finalWage = calculateFinalWage(g);
    const timePenalty = getTimePenalty(g.startTime);
    const timeStr = getElapsedTime(g.startTime);

    const endScreenOpts = {
      won: g.won,
      finalWage,
      wrongGuesses: g.wrongGuesses,
      hintsUsed: g.hintsUsed + Object.values(g.revealedHints).reduce((sum, arr) => sum + arr.length, 0),
      interruptHintCost: g.interruptHintCost || 0,
      triviaEarnings: g.triviaEarnings || 0,
      timePenalty,
      timeStr,
      solvedCategories: g.solvedCategories,
      allCategories: g.puzzle.categories,
      mode,
    };

    if (isDaily) {
      endScreenOpts.onShare = () => {
        audio.play('share');
        triggerShare({
          finalWage,
          timeStr,
          date: g.puzzle.id,
          solvedCategories: g.solvedCategories,
          allCategories: g.puzzle.categories,
          posterStates: {
            uncoveredIds: g.uncoveredIds,
          },
        });
      };
    } else {
      // Practice mode: back to menu or play again
      endScreenOpts.onBackToMenu = () => {
        window.location.reload();
      };
      endScreenOpts.onPlayAgain = () => {
        // Clear overlay and HUD, restart this same puzzle fresh
        const overlay = document.getElementById('overlay');
        if (overlay) {
          overlay.innerHTML = '';
          overlay.classList.remove('active');
        }
        const hud = document.getElementById('hud');
        if (hud) hud.innerHTML = '';
        // Remove solved row labels
        document.querySelectorAll('.solved-row-label').forEach((el) => el.remove());
        startGameSession(puzzle, 'practice', puzzlesData);
      };
    }

    showEndScreen(endScreenOpts);
  }

  // =========================================================================
  // Render Loop
  // =========================================================================

  function startRenderLoop() {
    renderLoopStarted = true;
    function animate() {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      updateAnimations(delta);

      for (const box of unsolvedBoxes) {
        applyIdleWobble(box, time);
      }

      // Animate Vibe Jam portals
      for (const portal of activePortals) {
        portal.animate(time);
      }

      // Update radio spectrograph visualization
      updateRadioViz(time, _isMuted);

      renderer.render(scene, camera);
    }
    animate();
  }

  // ── Window resize ─────────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    resizeScene(camera, renderer);
  });
}

// ── Launch ──────────────────────────────────────────────────────────────────
main().catch((err) => console.error('New Arrivals fatal error:', err));
