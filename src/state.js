// New Arrivals — State Management (localStorage persistence)

const KEY_ONBOARDED = 'newArrivals_onboarded';
const KEY_TODAY = 'newArrivals_today';
const KEY_STATE = 'newArrivals_state';
const KEY_STATS = 'newArrivals_stats';

/** ISO date string for today (YYYY-MM-DD). */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Find the puzzle matching today's date.
 * If none match, cycle through puzzles via daysSinceEpoch % puzzleCount.
 * @param {Object} puzzlesData  Object with a `puzzles` array
 * @returns {Object} puzzle
 */
export function loadTodaysPuzzle(puzzlesData) {
  const puzzles = puzzlesData.puzzles;
  const today = todayISO();

  const match = puzzles.find((p) => p.date === today);
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
    localStorage.setItem(KEY_TODAY, todayISO());
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
    if (savedDate !== todayISO()) return null;

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

  stats.history.push({ date: todayISO(), wage: finalWage, won });

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
