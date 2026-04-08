// New Arrivals — Pure Game Logic (no DOM, no Three.js, no side effects)

/**
 * Create a fresh game state for the given puzzle.
 * @param {Object} puzzle
 * @returns {Object} game state
 */
export function createGame(puzzle) {
  return {
    puzzle,
    solvedCategories: [],
    wrongGuesses: 0,
    hintsUsed: 0,
    uncoveredIds: [],
    selectedIds: [],
    revealedHints: {},
    wage: 25,
    startTime: null,
    completed: false,
    won: false,
  };
}

/**
 * Set startTime to now if it hasn't been set yet.
 * Mutates game in place.
 * @param {Object} game
 */
export function startTimer(game) {
  if (game.startTime === null) {
    game.startTime = Date.now();
  }
}

/**
 * Flatten all movies from every category into a single array.
 * @param {Object} puzzle
 * @returns {Array}
 */
export function getAllMovies(puzzle) {
  return puzzle.categories.flatMap((cat) => cat.movies);
}

/**
 * Toggle selection of a movie by tmdb_id.
 * @param {Object} game
 * @param {number|string} tmdbId
 * @returns {{ action: 'deselected'|'full'|'selected' }}
 */
export function toggleSelection(game, tmdbId) {
  const idx = game.selectedIds.indexOf(tmdbId);
  if (idx !== -1) {
    game.selectedIds.splice(idx, 1);
    return { action: 'deselected' };
  }
  if (game.selectedIds.length >= 4) {
    return { action: 'full' };
  }
  game.selectedIds.push(tmdbId);
  return { action: 'selected' };
}

/**
 * Clear all current selections.
 * Mutates game in place.
 * @param {Object} game
 */
export function clearSelection(game) {
  game.selectedIds = [];
}

/**
 * Check whether the 4 selected movies form a valid unsolved category.
 * Mutates game in place.
 * @param {Object} game
 * @returns {{ correct: boolean, category?: Object }}
 */
export function checkGuess(game) {
  if (game.selectedIds.length !== 4) {
    return { correct: false };
  }

  const selected = new Set(game.selectedIds);
  const solvedNames = new Set(game.solvedCategories.map((c) => c.name));

  for (const category of game.puzzle.categories) {
    if (solvedNames.has(category.name)) continue;

    const categoryIds = new Set(category.movies.map((m) => m.tmdb_id));
    const isMatch =
      categoryIds.size === selected.size &&
      [...selected].every((id) => categoryIds.has(id));

    if (isMatch) {
      game.solvedCategories.push(category);
      game.selectedIds = [];
      if (game.solvedCategories.length === game.puzzle.categories.length) {
        game.completed = true;
        game.won = true;
      }
      return { correct: true, category };
    }
  }

  // Wrong guess
  game.wrongGuesses += 1;
  game.wage = Math.max(0, game.wage - 1);
  game.selectedIds = [];
  if (game.wage <= 0) {
    game.completed = true;
    game.won = false;
  }
  return { correct: false };
}

/**
 * Use a hint to uncover a movie poster.
 * Mutates game in place.
 * @param {Object} game
 * @param {number|string} tmdbId
 * @returns {{ success: boolean, reason?: string, wage?: number }}
 */
export function useHint(game, tmdbId) {
  if (game.uncoveredIds.includes(tmdbId)) {
    return { success: false, reason: 'alreadyUncovered' };
  }
  if (game.wage <= 0) {
    return { success: false, reason: 'broke' };
  }

  game.hintsUsed += 1;
  game.uncoveredIds.push(tmdbId);
  game.wage = Math.max(0, game.wage - 1);

  if (game.wage <= 0) {
    game.completed = true;
    game.won = false;
  }

  return { success: true, wage: game.wage };
}

/**
 * Reveal a paid hint for a movie.
 * When field is 'details', reveals director, stars, and year all at once for $1.
 * When field is 'summary', reveals the summary for $1.
 * Mutates game in place.
 * @param {Object} game
 * @param {number|string} tmdbId
 * @param {string} field  'details' or 'summary'
 * @returns {{ success: boolean, reason?: string, wage?: number }}
 */
export function revealHint(game, tmdbId, field) {
  if (!game.revealedHints[tmdbId]) {
    game.revealedHints[tmdbId] = [];
  }

  if (field === 'details') {
    // Check if all three detail fields are already revealed
    const detailFields = ['director', 'stars', 'year'];
    const allRevealed = detailFields.every(f => game.revealedHints[tmdbId].includes(f));
    if (allRevealed) {
      return { success: false, reason: 'alreadyRevealed' };
    }
    if (game.wage <= 0) {
      return { success: false, reason: 'broke' };
    }

    // Reveal all three fields at once for $1
    for (const f of detailFields) {
      if (!game.revealedHints[tmdbId].includes(f)) {
        game.revealedHints[tmdbId].push(f);
      }
    }
    game.hintsUsed += 1;
    game.wage = Math.max(0, game.wage - 1);
  } else {
    // 'summary' or any single field
    if (game.revealedHints[tmdbId].includes(field)) {
      return { success: false, reason: 'alreadyRevealed' };
    }
    if (game.wage <= 0) {
      return { success: false, reason: 'broke' };
    }

    game.revealedHints[tmdbId].push(field);
    game.hintsUsed += 1;
    game.wage = Math.max(0, game.wage - 1);
  }

  if (game.wage <= 0) {
    game.completed = true;
    game.won = false;
  }

  return { success: true, wage: game.wage };
}

/**
 * Adjust wage by a positive or negative amount.
 * Clamps to 0. If wage hits 0, marks game as lost.
 * @param {Object} game
 * @param {number} amount  positive to add, negative to deduct
 * @returns {number} new wage
 */
export function adjustWage(game, amount) {
  game.wage = Math.max(0, game.wage + amount);
  if (game.wage <= 0) {
    game.completed = true;
    game.won = false;
  }
  return game.wage;
}

/**
 * Calculate a time penalty based on elapsed seconds.
 * <2 min → $0, 2–5 min → $1, >5 min → $2
 * @param {number|null} startTime  Date.now() timestamp
 * @returns {number} penalty amount
 */
export function getTimePenalty(startTime) {
  if (startTime === null) return 0;
  const elapsed = (Date.now() - startTime) / 1000;
  if (elapsed < 120) return 0;
  if (elapsed <= 300) return 1;
  return 2;
}

/**
 * Calculate the final wage after applying the time penalty.
 * @param {Object} game
 * @returns {number}
 */
export function calculateFinalWage(game) {
  return Math.max(0, game.wage - getTimePenalty(game.startTime));
}

/**
 * Returns elapsed time as a formatted "M:SS" string.
 * @param {number|null} startTime
 * @returns {string}
 */
export function getElapsedTime(startTime) {
  const seconds = getElapsedSeconds(startTime);
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Returns total elapsed seconds since startTime.
 * @param {number|null} startTime
 * @returns {number}
 */
export function getElapsedSeconds(startTime) {
  if (startTime === null) return 0;
  return (Date.now() - startTime) / 1000;
}

/**
 * Serialize game state to a JSON-safe object for localStorage.
 * Stores puzzleId instead of the full puzzle, and solved category names only.
 * @param {Object} game
 * @returns {Object}
 */
export function serializeGame(game) {
  return {
    puzzleId: game.puzzle.id,
    solvedCategories: game.solvedCategories.map((c) => c.name),
    wrongGuesses: game.wrongGuesses,
    hintsUsed: game.hintsUsed,
    uncoveredIds: [...game.uncoveredIds],
    selectedIds: [...game.selectedIds],
    revealedHints: JSON.parse(JSON.stringify(game.revealedHints)),
    wage: game.wage,
    startTime: game.startTime,
    completed: game.completed,
    won: game.won,
  };
}

/**
 * Reconstruct a full game state from a serialized save and the matching puzzle.
 * @param {Object} saved   Output of serializeGame
 * @param {Object} puzzle  Full puzzle object
 * @returns {Object} game state
 */
export function restoreGame(saved, puzzle) {
  const nameSet = new Set(saved.solvedCategories);
  const solvedCategories = puzzle.categories.filter((c) => nameSet.has(c.name));

  return {
    puzzle,
    solvedCategories,
    wrongGuesses: saved.wrongGuesses,
    hintsUsed: saved.hintsUsed,
    uncoveredIds: [...saved.uncoveredIds],
    selectedIds: [...saved.selectedIds],
    revealedHints: saved.revealedHints ? JSON.parse(JSON.stringify(saved.revealedHints)) : {},
    wage: saved.wage,
    startTime: saved.startTime,
    completed: saved.completed,
    won: saved.won,
  };
}
