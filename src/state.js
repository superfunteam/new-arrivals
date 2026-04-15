// New Arrivals — State Management (localStorage persistence)

const KEY_ONBOARDED = 'newArrivals_onboarded';
const KEY_SKIP_INTRO = 'newArrivals_skipIntro';
const KEY_TODAY = 'newArrivals_today';
const KEY_STATE = 'newArrivals_state';
const KEY_STATS = 'newArrivals_stats';
const KEY_COMPLETED_DAILIES = 'newArrivals_completedDailies';
const KEY_GAME_SCORES = 'newArrivals_gameScores';
const KEY_NOTIFY = 'newArrivals_notify';
const KEY_EXTRA_SPENT = 'newArrivals_extraSpent';
const KEY_EXTRA_PLAYED = 'newArrivals_extraPlayed';

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

  // Direct date match (scheduled puzzle)
  const match = puzzles.find((p) => p.id === today);
  if (match) return match;

  // Fallback for floating puzzles — prefer ones matching today's day of week
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayDayName = dayNames[new Date(today + 'T12:00:00').getDay()];

  // Find floating puzzles (non-date IDs, non-training)
  const floating = puzzles.filter(p => !/^\d{4}-\d{2}-\d{2}$/.test(p.id) && !p.id.startsWith('training-'));

  // Prefer a puzzle whose preferredDay matches today
  const dayMatch = floating.find(p => p.preferredDay === todayDayName);
  if (dayMatch) return dayMatch;

  // Otherwise cycle through all puzzles
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

// ─── Extra Shifts ──────────────────────────────────────────────────────────

/**
 * Helper to get the current week key (ISO week start date) for
 * scoping extra-shift spending to a weekly window.
 * @returns {string} YYYY-MM-DD of the most recent Monday
 */
function _getWeekKey() {
  const today = getPuzzleDate();
  const d = new Date(today + 'T12:00:00');
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = (day === 0 ? 6 : day - 1); // days since Monday
  d.setDate(d.getDate() - diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Get weekly earnings from the paycheck (total wages for the current 7-day window).
 * @param {Object} puzzlesData  Object with a `puzzles` array
 * @returns {number}
 */
export function getWeeklyEarnings(puzzlesData) {
  const { total } = getPaycheckData(puzzlesData);
  return total;
}

/**
 * Deduct an amount from the player's paycheck balance for extra shifts.
 * Stored per-week so it resets automatically.
 * @param {number} amount
 */
export function spendFromPaycheck(amount) {
  try {
    const raw = localStorage.getItem(KEY_EXTRA_SPENT);
    let data = raw ? JSON.parse(raw) : {};
    const weekKey = _getWeekKey();
    // Reset if week changed
    if (data.week !== weekKey) {
      data = { week: weekKey, spent: 0 };
    }
    data.spent += amount;
    localStorage.setItem(KEY_EXTRA_SPENT, JSON.stringify(data));
  } catch (_) {}
}

/**
 * Get the current balance available for extra shifts
 * (weekly earnings minus extra shift spending this week).
 * @param {Object} puzzlesData  Object with a `puzzles` array
 * @returns {number}
 */
export function getExtraShiftBalance(puzzlesData) {
  const earnings = getWeeklyEarnings(puzzlesData);
  let spent = 0;
  try {
    const raw = localStorage.getItem(KEY_EXTRA_SPENT);
    if (raw) {
      const data = JSON.parse(raw);
      const weekKey = _getWeekKey();
      if (data.week === weekKey) {
        spent = data.spent || 0;
      }
    }
  } catch (_) {}
  return earnings - spent;
}

/**
 * Check if an extra shift puzzle has already been played.
 * @param {string} puzzleId
 * @returns {boolean}
 */
export function hasPlayedExtraShift(puzzleId) {
  try {
    const raw = localStorage.getItem(KEY_EXTRA_PLAYED);
    if (raw) {
      const played = JSON.parse(raw);
      return Array.isArray(played) && played.includes(puzzleId);
    }
  } catch (_) {}
  return false;
}

/**
 * Mark an extra shift puzzle as played.
 * @param {string} puzzleId
 */
export function markExtraShiftPlayed(puzzleId) {
  try {
    const raw = localStorage.getItem(KEY_EXTRA_PLAYED);
    let played = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(played)) played = [];
    if (!played.includes(puzzleId)) {
      played.push(puzzleId);
      localStorage.setItem(KEY_EXTRA_PLAYED, JSON.stringify(played));
    }
  } catch (_) {}
}

// ─── Daily Notifications ───────────────────────────────────────────────────

const KEY_NOTIFY_INDEX = 'newArrivals_notifyIdx';
const KEY_LAST_NOTIFY_DATE = 'newArrivals_lastNotifyDate';

const NOTIFY_MESSAGES = [
  "Tonight's tapes just hit the shelf. Start your shift!",
  "The drop box is full. Time to sort the new arrivals.",
  "Your manager left a note: 16 tapes, 4 categories. Good luck.",
  "A fresh shipment just came in. The shelf won't sort itself.",
  "Clock's ticking — tonight's puzzle is live. Punch in!",
  "New tapes on the counter. Regulars are already browsing.",
  "The night shift starts now. New arrivals are waiting.",
  "Someone returned 16 tapes at closing. Sort them before dawn.",
  "Hey clerk — new stock just arrived. Time to earn your wage.",
  "The store opens in the morning. Get these tapes shelved tonight.",
];

function getNextMessage() {
  let idx = parseInt(localStorage.getItem(KEY_NOTIFY_INDEX) || '0', 10);
  const msg = NOTIFY_MESSAGES[idx % NOTIFY_MESSAGES.length];
  localStorage.setItem(KEY_NOTIFY_INDEX, String((idx + 1) % NOTIFY_MESSAGES.length));
  return msg;
}

export function isNotifyEnabled() {
  return localStorage.getItem(KEY_NOTIFY) === 'true';
}

export function setNotifyEnabled(value) {
  localStorage.setItem(KEY_NOTIFY, value ? 'true' : 'false');
}

/**
 * Detect if running inside Capacitor native shell.
 */
function isCapacitor() {
  return window.Capacitor && window.Capacitor.isNativePlatform();
}

/**
 * Check if notifications are actually permitted at the OS/browser level.
 */
export function isNotifyPermissionGranted() {
  if (isCapacitor()) return isNotifyEnabled(); // Capacitor manages its own permissions
  return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Request notification permission and enable daily alerts.
 * Sends a test notification on success so the user sees it worked.
 * Returns true if permission was granted.
 */
export async function enableDailyNotification() {
  if (isCapacitor()) {
    // Use Capacitor Local Notifications
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const result = await LocalNotifications.requestPermissions();
      if (result.display !== 'granted') {
        setNotifyEnabled(false);
        return false;
      }
      setNotifyEnabled(true);
      await scheduleCapacitorNotifications();
      // Test notification
      await LocalNotifications.schedule({
        notifications: [{
          id: 99999,
          title: 'New Arrivals',
          body: "You're all set! We'll remind you when new tapes arrive.",
          smallIcon: 'ic_launcher',
        }],
      });
      return true;
    } catch (e) {
      console.log('Capacitor notification error:', e);
      setNotifyEnabled(false);
      return false;
    }
  }

  // Web path
  if (!('Notification' in window)) return false;

  if (Notification.permission === 'denied') {
    setNotifyEnabled(false);
    return false;
  }

  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setNotifyEnabled(false);
      return false;
    }
  }

  setNotifyEnabled(true);
  scheduleNotification();

  // Test notification so user sees it works
  fireTestNotification();
  return true;
}

export function disableDailyNotification() {
  setNotifyEnabled(false);
  if (window._notifyTimeout) {
    clearTimeout(window._notifyTimeout);
    window._notifyTimeout = null;
  }
  // Cancel ALL Capacitor scheduled notifications
  if (isCapacitor()) {
    import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
      LocalNotifications.getPending().then(pending => {
        if (pending.notifications.length > 0) {
          LocalNotifications.cancel(pending);
        }
      });
    }).catch(() => {});
  }
}

/**
 * Fire a one-time test notification immediately.
 */
function fireTestNotification() {
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification('New Arrivals', {
          body: "You're all set! We'll remind you when new tapes arrive.",
          icon: '/apple-touch-icon.png',
          badge: '/favicon-32.png',
          tag: 'test-notification',
        });
      });
    } else if (Notification.permission === 'granted') {
      new Notification('New Arrivals', {
        body: "You're all set! We'll remind you when new tapes arrive.",
        icon: '/apple-touch-icon.png',
      });
    }
  } catch {
    // Silently fail
  }
}

/**
 * Fire a daily notification (used for catch-up and scheduled).
 * Uses a timestamp-based lock to prevent duplicate firings.
 */
async function fireNotification() {
  // De-duplicate using a precise timestamp lock (not puzzle date, which shifts at 10pm)
  const now = Date.now();
  const lockKey = KEY_LAST_NOTIFY_DATE;
  const lastFiredMs = parseInt(localStorage.getItem(lockKey) || '0', 10);

  // Don't fire if we fired within the last 12 hours
  if (now - lastFiredMs < 12 * 60 * 60 * 1000) return;
  localStorage.setItem(lockKey, String(now));

  const body = getNextMessage();

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('New Arrivals', {
        body,
        icon: '/apple-touch-icon.png',
        badge: '/favicon-32.png',
        tag: 'daily-puzzle',
        // renotify: false — let the tag de-duplicate
        data: { url: '/' },
      });
    } else if (Notification.permission === 'granted') {
      new Notification('New Arrivals', { body, icon: '/apple-touch-icon.png' });
    }
  } catch {
    // Silently fail
  }
}

/**
 * Schedule notifications via Capacitor Local Notifications.
 * Cancels ALL existing, then schedules next 7 days.
 */
async function scheduleCapacitorNotifications() {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    // Cancel ALL pending notifications to avoid stacking
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }

    // Calculate 10pm Central in the device's local timezone
    // Central Time offset: -6 (CST) or -5 (CDT)
    const centralNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const localNow = new Date();
    const offsetMs = localNow.getTime() - centralNow.getTime();

    const notifications = [];
    for (let i = 0; i < 7; i++) {
      // Target: 10pm Central
      const centralTarget = new Date(centralNow);
      centralTarget.setDate(centralTarget.getDate() + i);
      centralTarget.setHours(22, 0, 0, 0);
      if (centralTarget <= centralNow) {
        centralTarget.setDate(centralTarget.getDate() + 1);
      }

      // Convert Central time to device local time
      const localTarget = new Date(centralTarget.getTime() + offsetMs);

      notifications.push({
        id: i + 1,
        title: 'New Arrivals',
        body: NOTIFY_MESSAGES[i % NOTIFY_MESSAGES.length],
        schedule: { at: localTarget },
        smallIcon: 'ic_launcher',
      });
    }

    await LocalNotifications.schedule({ notifications });
    console.log('Scheduled', notifications.length, 'native notifications');
  } catch (e) {
    console.log('Failed to schedule native notifications:', e);
  }
}

/**
 * Schedule notifications. Called once on page load.
 *
 * - Capacitor: schedules 7 days of native notifications (works when app is closed)
 * - Web: sets a setTimeout for 10pm (only works while tab is open) + catch-up on load
 */
export function scheduleNotification() {
  if (!isNotifyEnabled()) return;

  // Capacitor: native scheduling only, skip web path entirely
  if (isCapacitor()) {
    scheduleCapacitorNotifications();
    return;
  }

  if (!isNotifyPermissionGranted()) return;

  // Catch-up: if it's past 10pm Central and we haven't notified recently
  const centralNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  if (centralNow.getHours() >= 22) {
    fireNotification(); // de-duplication is inside fireNotification
  }

  // Schedule the next one via setTimeout (only works while tab is open)
  if (window._notifyTimeout) clearTimeout(window._notifyTimeout);
  const msUntilReset = getNextResetMs();

  // Only set timeout if it's a reasonable duration (< 24 hours)
  if (msUntilReset > 0 && msUntilReset < 24 * 60 * 60 * 1000) {
    window._notifyTimeout = setTimeout(() => {
      fireNotification();
      // Don't recursively schedule — the next page load will handle it
    }, msUntilReset);
  }
}

function getNextResetMs() {
  const centralNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const next = new Date(centralNow);
  if (centralNow.getHours() >= 22) {
    next.setDate(next.getDate() + 1);
  }
  next.setHours(22, 0, 0, 0);
  return Math.max(0, next.getTime() - centralNow.getTime());
}
