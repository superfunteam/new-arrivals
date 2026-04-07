// New Arrivals -- Main Integration
// Orchestrates all modules into the complete game flow.

import * as THREE from 'three';

import { createScene, resizeScene, getRowPositions, getShelfWidth } from './scene.js';
import {
  loadTexture,
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
  animateEntrance,
  animateLockIn,
  animateShake,
  animateReflow,
  applyIdleWobble,
  animateGrayOut,
} from './animations.js';
import { setupInteraction } from './interaction.js';
import {
  createGame,
  startTimer,
  getAllMovies,
  toggleSelection,
  clearSelection,
  checkGuess,
  useHint,
  getTimePenalty,
  calculateFinalWage,
  getElapsedTime,
  getElapsedSeconds,
  serializeGame,
  restoreGame,
} from './game-logic.js';
import {
  loadTodaysPuzzle,
  saveGameState,
  loadGameState,
  updateStats,
  loadStats,
  isOnboarded,
  setOnboarded,
} from './state.js';
import {
  createHUD,
  updateWage,
  updateTimer,
  updateHints,
  setShelveButton,
  showOnboarding,
  showLightbox,
  hideLightbox,
  showEndScreen,
  showTrackingFlash,
  onMuteClick,
  setMuteIcon,
  onHelpClick,
} from './ui.js';
import { audio } from './audio.js';
import { triggerShare } from './share.js';

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
// Main
// ---------------------------------------------------------------------------

async function main() {
  // ── 1. Fetch puzzles, find today's puzzle ─────────────────────────────────
  let puzzlesData;
  try {
    const res = await fetch('/puzzles.json');
    puzzlesData = await res.json();
  } catch (err) {
    console.error('Failed to load puzzles.json:', err);
    return;
  }
  const puzzle = loadTodaysPuzzle(puzzlesData);

  // ── 2. Check localStorage for saved state ─────────────────────────────────
  const savedState = loadGameState();
  const isRestoring = savedState && savedState.puzzleId === puzzle.id;

  // ── 3. Create Three.js scene ──────────────────────────────────────────────
  const canvas = document.getElementById('game-canvas');
  const { scene, camera, renderer, shelfGroup } = createScene(canvas);

  // ── 4. Create HUD ─────────────────────────────────────────────────────────
  createHUD();

  // ── 5. Setup mute button ──────────────────────────────────────────────────
  onMuteClick(() => {
    const nowMuted = !audio.isMuted();
    audio.setMuted(nowMuted);
    setMuteIcon(nowMuted);
  });

  // ── 6. Create or restore game state ───────────────────────────────────────
  let game;
  if (isRestoring) {
    game = restoreGame(savedState, puzzle);
  } else {
    game = createGame(puzzle);
  }

  // Update HUD to match restored state
  updateWage(game.wage);
  updateHints(5 - game.hintsUsed);
  if (game.startTime) {
    updateTimer(getElapsedTime(game.startTime));
  }

  // ── 7. Load poster textures, create 16 VHS boxes ─────────────────────────
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

  // Create box meshes
  const allBoxes = shuffledMovies.map((movie, i) => {
    const box = createVHSBox(movie, textures[i]);
    return box;
  });

  // ── 8. Layout boxes on shelf ──────────────────────────────────────────────
  layoutBoxes(allBoxes, shelfGroup);

  // Add all boxes to the scene
  for (const box of allBoxes) {
    scene.add(box);
  }

  // Track which boxes are unsolved vs locked
  let unsolvedBoxes = [...allBoxes];
  let solvedRowCount = 0;

  // ── 9. If restoring: apply solved state ───────────────────────────────────
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

  // ── 10. If restoring: apply uncovered state ───────────────────────────────
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

  // If restoring a game that had the timer running, resume the timer display
  if (isRestoring && game.startTime && !game.completed) {
    timerStarted = true;
    timerInterval = setInterval(() => {
      updateTimer(getElapsedTime(game.startTime));
    }, 1000);
  }

  let renderLoopStarted = false;
  const clock = new THREE.Clock();

  // ── 11. If game already completed: show end screen, render, return ────────
  if (game.completed) {
    showEndScreenForGame(game);
    startRenderLoop();
    return;
  }

  // ── 12. If first visit: show onboarding ───────────────────────────────────
  if (!isOnboarded()) {
    // Start render loop immediately so shelf is visible behind onboarding
    startRenderLoop();
    showOnboarding(() => {
      setOnboarded();
      startGameAfterOnboarding();
    });
  } else {
    startGame();
  }

  function startGame() {
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
      setShelveButton(game.selectedIds.length === 4, handleShelveIt);
    } else {
      // Fresh game — play entrance animation, then enable interaction
      animateEntrance(unsolvedBoxes, () => {
        setupGameInteraction();
      });
    }
  }

  /** Called when onboarding completes (render loop already running). */
  function startGameAfterOnboarding() {
    // Entrance animation + interaction — render loop is already running
    animateEntrance(unsolvedBoxes, () => {
      setupGameInteraction();
    });
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
    setShelveButton(false, handleShelveIt);

    // Set up help button
    onHelpClick(() => {
      showOnboarding(() => {
        // Just close it, no onboarded tracking needed
      });
    });
  }

  // =========================================================================
  // onTap
  // =========================================================================

  function handleTap(box) {
    // 1. Start timer on first interaction
    if (!timerStarted) {
      startTimer(game);
      timerStarted = true;
      timerInterval = setInterval(() => {
        updateTimer(getElapsedTime(game.startTime));
      }, 1000);
    }

    // 2. Init audio on first interaction
    if (!audioInitialized) {
      audio.init();
      audioInitialized = true;
    }

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

    // 6. Update shelve button (active when 4 selected)
    setShelveButton(game.selectedIds.length === 4, handleShelveIt);

    // 7. Save state
    saveGameState(serializeGame(game));
  }

  // =========================================================================
  // onLongPress
  // =========================================================================

  function handleLongPress(box) {
    // Init audio
    if (!audioInitialized) {
      audio.init();
      audioInitialized = true;
    }
    audio.play('tapInspect');

    const movie = box.userData.movie;

    showLightbox(movie, {
      uncovered: game.uncoveredIds.includes(movie.tmdb_id),
      hintsLeft: 5 - game.hintsUsed,
      wage: game.wage,
      onReturn: () => {
        audio.play('returnToShelf');
        hideLightbox();
      },
      onUncover: (tmdbId) => {
        const result = useHint(game, tmdbId);
        if (!result.success) return;

        audio.play('uncover');
        audio.play('penalty');

        // Update HUD
        updateWage(game.wage, true);
        updateHints(5 - game.hintsUsed);

        // Swap 3D texture on the actual box
        const targetBox = allBoxes.find((b) => b.userData.movie.tmdb_id === tmdbId);
        if (targetBox) {
          loadTexture(`/posters/${tmdbId}.jpg`)
            .then((fullTex) => swapToFullTexture(targetBox, fullTex))
            .catch(() => {
              // Keep pixelated if full fails
            });
        }

        // Save state
        saveGameState(serializeGame(game));

        // Check if game over (wage hit 0)
        if (game.completed) {
          hideLightbox();
          handleGameOver();
        }
      },
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

      // Animate lock-in
      animateLockIn(catBoxes, targetY, targetPositions, () => {
        // Set box states and spine colors
        for (const box of catBoxes) {
          setBoxState(box, 'locked');
          setSpineColor(box, parseInt(cat.color.replace('#', ''), 16));
        }

        // Update solved count
        solvedRowCount++;

        // Remove from unsolved list
        unsolvedBoxes = unsolvedBoxes.filter((b) => !catMovieIds.has(b.userData.movie.tmdb_id));

        // Reflow remaining unsolved boxes
        reflowBoxes(unsolvedBoxes, shelfGroup, solvedRowCount);
        animateReflow(unsolvedBoxes, () => {
          // Unlock interaction
          interactionHandle.setLocked(false);

          // Clear button state
          setShelveButton(false, handleShelveIt);

          // Save state
          saveGameState(serializeGame(game));

          // Check if game complete
          if (game.completed) {
            handleGameOver();
          }
        });
      });
    } else {
      // ── WRONG ────────────────────────────────────────────────────────────
      audio.play('wrong');
      audio.play('penalty');

      // Show tracking flash
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
        setShelveButton(false, handleShelveIt);

        // Save state
        saveGameState(serializeGame(game));

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
      // Win: play gameWin, brief delay, then show end screen
      audio.play('gameWin');
      setTimeout(() => {
        showEndScreenForGame(game);
      }, 1500);
    }

    // Update stats
    const finalWage = calculateFinalWage(game);
    updateStats(finalWage, game.won);
    saveGameState(serializeGame(game));
  }

  // =========================================================================
  // End Screen helper
  // =========================================================================

  function showEndScreenForGame(g) {
    const finalWage = calculateFinalWage(g);
    const timePenalty = getTimePenalty(g.startTime);
    const timeStr = getElapsedTime(g.startTime);

    showEndScreen({
      won: g.won,
      finalWage,
      wrongGuesses: g.wrongGuesses,
      hintsUsed: g.hintsUsed,
      timePenalty,
      timeStr,
      solvedCategories: g.solvedCategories,
      allCategories: g.puzzle.categories,
      onShare: () => {
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
      },
    });
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
