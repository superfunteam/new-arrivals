// New Arrivals — State Management (localStorage persistence)

const KEY_ONBOARDED = 'newArrivals_onboarded';
const KEY_SKIP_INTRO = 'newArrivals_skipIntro';
const KEY_TODAY = 'newArrivals_today';
const KEY_STATE = 'newArrivals_state';
const KEY_STATS = 'newArrivals_stats';
const KEY_COMPLETED_DAILIES = 'newArrivals_completedDailies';
const KEY_GAME_SCORES = 'newArrivals_gameScores';

/**
 * Get the current "puzzle date" based on Central Time (America/Chicago).
 * The day flips at 10pm (22:00) Central — if it's 10pm or later, the next
 * day's puzzle is active.
 * @returns {string} YYYY-MM-DD
 */
export function getPuzzleDate() {
  const centralNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));

  if (centralNow.getHours() >= 22) {
    centralNow.setDate(centralNow.getDate() + 1);
  }

  const year = centralNow.getFullYear();
  const month = String(centralNow.getMonth() + 1).padStart(2, '0');
  const day = String(centralNow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Find the puzzle matching today's date.
 * If none match, cycle through puzzles via daysSinceEpoch % puzzleCount.
 * @param {Object} puzzlesData  Object with a `puzzles` array
 * @returns {Object} puzzle
 */
export function loadTodaysPuzzle(puzzlesData) {
  const puzzles = puzzlesData.puzzles;
  const today = getPuzzleDate();

  const match = puzzles.find((p) => p.id === today);
  if (match) return match;

  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  return puzzles[daysSinceEpoch % puzzles.length];
}

/**
 * Persist a serialized game state to localStorage, tagged with today's date.
 * @param {Object} serialized  Output of serializeGame()
 */
export function saveGameState(serialized) {
  try {
    localStorage.setItem(KEY_TODAY, getPuzzleDate());
    localStorage.setItem(KEY_STATE, JSON.stringify(serialized));
  } catch (_) {
    // localStorage may be unavailable (private browsing, quota exceeded, etc.)
  }
}

/**
 * Load game state from localStorage.
 * Returns null if no state exists or if it belongs to a different day.
 * @returns {Object|null}
 */
export function loadGameState() {
  try {
    const savedDate = localStorage.getItem(KEY_TODAY);
    if (savedDate !== getPuzzleDate()) return null;

    const raw = localStorage.getItem(KEY_STATE);
    if (!raw) return null;

    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * Update cumulative stats after a completed game.
 * @param {number} finalWage
 * @param {boolean} won
 */
export function updateStats(finalWage, won) {
  const stats = loadStats();

  stats.totalGames += 1;
  stats.totalWages += finalWage;
  if (finalWage > stats.bestWage) {
    stats.bestWage = finalWage;
  }

  if (won) {
    stats.currentStreak += 1;
    if (stats.currentStreak > stats.maxStreak) {
      stats.maxStreak = stats.currentStreak;
    }
  } else {
    stats.currentStreak = 0;
  }

  stats.history.push({ date: getPuzzleDate(), wage: finalWage, won });

  try {
    localStorage.setItem(KEY_STATS, JSON.stringify(stats));
  } catch (_) {
    // Ignore storage errors
  }
}

/**
 * Load stats from localStorage, or return a default object.
 * @returns {Object}
 */
export function loadStats() {
  try {
    const raw = localStorage.getItem(KEY_STATS);
    if (raw) return JSON.parse(raw);
  } catch (_) {
    // Fall through to default
  }
  return {
    totalGames: 0,
    totalWages: 0,
    bestWage: 0,
    currentStreak: 0,
    maxStreak: 0,
    history: [],
  };
}

/**
 * Returns true if the user has completed onboarding.
 * @returns {boolean}
 */
export function isOnboarded() {
  try {
    return localStorage.getItem(KEY_ONBOARDED) === 'true';
  } catch (_) {
    return false;
  }
}

/**
 * Mark the user as having completed onboarding.
 */
export function setOnboarded() {
  try {
    localStorage.setItem(KEY_ONBOARDED, 'true');
  } catch (_) {
    // Ignore storage errors
  }
}

/**
 * Returns true if the user has opted to skip the intro onboarding.
 * @returns {boolean}
 */
export function isSkipIntro() {
  try {
    return localStorage.getItem(KEY_SKIP_INTRO) === 'true';
  } catch (_) {
    return false;
  }
}

/**
 * Set whether to skip the intro onboarding on future loads.
 * @param {boolean} value
 */
export function setSkipIntro(value) {
  try {
    localStorage.setItem(KEY_SKIP_INTRO, value ? 'true' : 'false');
  } catch (_) {
    // Ignore storage errors
  }
}

/**
 * Returns an array of puzzle IDs the player has completed as daily games.
 * @returns {string[]}
 */
export function getCompletedDailyIds() {
  try {
    const raw = localStorage.getItem(KEY_COMPLETED_DAILIES);
    if (raw) return JSON.parse(raw);
  } catch (_) {
    // Fall through to default
  }
  return [];
}

/**
 * Add a puzzle ID to the completed dailies list (if not already present).
 * @param {string} puzzleId
 */
export function markDailyCompleted(puzzleId) {
  try {
    const ids = getCompletedDailyIds();
    if (!ids.includes(puzzleId)) {
      ids.push(puzzleId);
      localStorage.setItem(KEY_COMPLETED_DAILIES, JSON.stringify(ids));
    }
  } catch (_) {
    // Ignore storage errors
  }
}

/**
 * Returns past daily puzzles (dates before the current puzzle date), sorted
 * most-recent first.
 * @param {Object} puzzlesData  Object with a `puzzles` array
 * @returns {Object[]}
 */
export function getPastPuzzles(puzzlesData) {
  const today = getPuzzleDate();
  return puzzlesData.puzzles
    .filter((p) => p.id < today)
    .sort((a, b) => (a.id > b.id ? -1 : a.id < b.id ? 1 : 0));
}

/**
 * Get all saved game scores. Returns { [puzzleId]: { wage, stars } }.
 * @returns {Object}
 */
export function getGameScores() {
  try {
    const raw = localStorage.getItem(KEY_GAME_SCORES);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {};
}

/**
 * Save a game score for a puzzle. Keeps the best score.
 * Stars: $25 = 3 stars, > $15 = 2 stars, finished = 1 star.
 * @param {string} puzzleId
 * @param {number} finalWage
 */
export function saveGameScore(puzzleId, finalWage) {
  try {
    const scores = getGameScores();
    const stars = finalWage >= 25 ? 3 : finalWage > 15 ? 2 : 1;
    const existing = scores[puzzleId];
    // Keep best score
    if (!existing || finalWage > existing.wage) {
      scores[puzzleId] = { wage: finalWage, stars };
      localStorage.setItem(KEY_GAME_SCORES, JSON.stringify(scores));
    }
  } catch (_) {}
}

/**
 * Get the last 7 days of daily paycheck data.
 * Returns { days: [{ date, wage, played }], total }.
 * Days are ordered oldest → newest, always exactly 7 slots.
 */
export function getPaycheckData(puzzlesData) {
  const scores = getGameScores();
  const today = getPuzzleDate();
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today + 'T12:00:00');
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const score = scores[dateStr];
    const puzzle = puzzlesData.puzzles.find(p => p.id === dateStr);
    days.push({
      date: dateStr,
      wage: score ? score.wage : 0,
      played: !!score,
      puzzleTitle: puzzle ? puzzle.title : null,
    });
  }

  const total = days.reduce((sum, d) => sum + d.wage, 0);
  return { days, total };
}
