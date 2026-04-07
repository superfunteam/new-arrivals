// New Arrivals — UI Overlays (HUD, Onboarding, Lightbox, End Screen)

// ─── DOM refs (populated by createHUD) ─────────────────────────────────────
let _wage = null;
let _timer = null;
let _hintCount = null;
let _shelveBtn = null;
let _shelveHandler = null;
let _muteBtn = null;
let _helpBtn = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns a human-readable date string like "Apr 7".
 * @param {Date} date
 * @returns {string}
 */
export function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── HUD ────────────────────────────────────────────────────────────────────

/**
 * Injects the full HUD into #hud.
 */
export function createHUD() {
  const hud = document.getElementById('hud');
  if (!hud) return;

  const dateStr = formatDate(new Date());

  hud.innerHTML = `
    <div class="hud-top">
      <div class="hud-logo">
        NEW ARRIVALS
        <span class="hud-date">${dateStr}</span>
      </div>
      <div class="hud-wage" id="hud-wage">$10.00</div>
    </div>

    <button class="mute-btn" id="mute-btn" aria-label="Toggle mute">♪</button>
    <button class="help-btn" id="help-btn" aria-label="Help">?</button>

    <div class="hud-bottom">
      <div class="hud-hints">
        <span class="hint-count" id="hud-hint-count">5</span> uncover
      </div>
      <button class="shelve-btn" id="shelve-btn" disabled>SHELVE IT</button>
      <div class="hud-timer" id="hud-timer">0:00</div>
    </div>
  `;

  _wage = document.getElementById('hud-wage');
  _timer = document.getElementById('hud-timer');
  _hintCount = document.getElementById('hud-hint-count');
  _shelveBtn = document.getElementById('shelve-btn');
  _muteBtn = document.getElementById('mute-btn');
  _helpBtn = document.getElementById('help-btn');
}

// ─── HUD Updaters ────────────────────────────────────────────────────────────

/**
 * Updates the wage display. Flashes the penalty class for 600ms when isPenalty.
 * @param {string|number} wage
 * @param {boolean} [isPenalty]
 */
export function updateWage(wage, isPenalty = false) {
  if (!_wage) return;
  const formatted =
    typeof wage === 'number'
      ? '$' + wage.toFixed(2)
      : String(wage);
  _wage.textContent = formatted;

  if (isPenalty) {
    _wage.classList.add('penalty');
    setTimeout(() => _wage.classList.remove('penalty'), 600);
  }
}

/**
 * Updates the timer display.
 * @param {string} timeStr  e.g. "1:23"
 */
export function updateTimer(timeStr) {
  if (_timer) _timer.textContent = timeStr;
}

/**
 * Updates the hints-remaining count.
 * @param {number} remaining
 */
export function updateHints(remaining) {
  if (_hintCount) _hintCount.textContent = String(remaining);
}

/**
 * Enable or disable the SHELVE IT button and set its click handler.
 * @param {boolean} active
 * @param {Function|null} [onClick]
 */
export function setShelveButton(active, onClick = null) {
  if (!_shelveBtn) return;

  _shelveBtn.disabled = !active;

  // Remove previous handler
  if (_shelveHandler) {
    _shelveBtn.removeEventListener('click', _shelveHandler);
    _shelveHandler = null;
  }

  if (active && onClick) {
    _shelveHandler = onClick;
    _shelveBtn.addEventListener('click', _shelveHandler);
  }
}

// ─── Mute & Help ─────────────────────────────────────────────────────────────

/**
 * Add a click listener to the mute button.
 * @param {Function} callback
 */
export function onMuteClick(callback) {
  if (_muteBtn) _muteBtn.addEventListener('click', callback);
}

/**
 * Toggle mute button opacity to indicate mute state.
 * @param {boolean} muted
 */
export function setMuteIcon(muted) {
  if (_muteBtn) _muteBtn.style.opacity = muted ? '0.3' : '1';
}

/**
 * Add a click listener to the help button.
 * @param {Function} callback
 */
export function onHelpClick(callback) {
  if (_helpBtn) _helpBtn.addEventListener('click', callback);
}

// ─── Onboarding Modal ────────────────────────────────────────────────────────

/**
 * Shows a 3-slide onboarding carousel inside #overlay.
 * @param {Function} onComplete  Called when the user clicks "Start My Shift"
 */
export function showOnboarding(onComplete) {
  const overlay = document.getElementById('overlay');
  if (!overlay) return;

  const slides = [
    {
      title: 'Welcome to the Store',
      anim: `<div class="vhs-icon"></div>`,
      body: "You're the new clerk at NEW ARRIVALS VIDEO. Sort 16 tapes into 4 mystery categories to earn your daily wages.",
      btn: 'Next',
    },
    {
      title: 'How to Sort',
      anim: `<div style="font-size:48px;margin-bottom:0;">🖐️📼</div>`,
      body: 'Tap 4 movies you think belong together, then hit SHELVE IT. Get it right and the category reveals itself. Long-press any tape to inspect it up close.',
      btn: 'Next',
    },
    {
      title: 'Watch Your Wallet',
      anim: `<div class="dollar-icon">💸</div>`,
      body: 'You start with $10. Wrong guesses cost $1. Hints cost $1. Take too long and the clock eats your paycheck. Can you keep the store profitable?',
      btn: 'Start My Shift',
    },
  ];

  let current = 0;

  function render() {
    const dotsHtml = slides
      .map(
        (_, i) =>
          `<div class="onboarding-dot${i === current ? ' active' : ''}"></div>`
      )
      .join('');

    const slidesHtml = slides
      .map(
        (s, i) => `
        <div class="onboarding-slide${i === current ? ' active' : ''}">
          <div class="onboarding-anim">${s.anim}</div>
          <h2>${s.title}</h2>
          <p>${s.body}</p>
        </div>`
      )
      .join('');

    overlay.innerHTML = `
      <div class="onboarding">
        ${slidesHtml}
        <div class="onboarding-dots">${dotsHtml}</div>
        <button class="onboarding-btn" id="onboarding-next">${slides[current].btn}</button>
      </div>
    `;

    overlay.classList.add('active');

    document.getElementById('onboarding-next').addEventListener('click', () => {
      if (current < slides.length - 1) {
        current++;
        render();
      } else {
        overlay.innerHTML = '';
        overlay.classList.remove('active');
        if (typeof onComplete === 'function') onComplete();
      }
    });
  }

  render();
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

/**
 * Show the inspect lightbox for a movie.
 * @param {Object} movie  Must have tmdb_id and title
 * @param {Object} options
 * @param {boolean} options.uncovered
 * @param {number}  options.hintsLeft
 * @param {number}  options.wage
 * @param {Function} options.onReturn
 * @param {Function} options.onUncover  Called with tmdb_id
 */
export function showLightbox(movie, options = {}) {
  const { uncovered = false, hintsLeft = 0, wage = 0, onReturn, onUncover } = options;
  const overlay = document.getElementById('overlay');
  if (!overlay) return;

  const isUncoverDisabled = uncovered || hintsLeft <= 0 || wage <= 0;
  const posterSrc = uncovered
    ? `/posters/${movie.tmdb_id}.jpg`
    : `/posters/${movie.tmdb_id}_pixel.jpg`;
  const posterClass = uncovered ? 'lightbox-poster uncovered' : 'lightbox-poster';
  const outOfFocusHtml = !uncovered && hintsLeft <= 0
    ? `<div style="font-family:var(--font-body);font-size:11px;color:rgba(255,255,255,0.5);margin-top:8px;">Out of Focus</div>`
    : '';

  overlay.innerHTML = `
    <div class="lightbox" id="lightbox-inner">
      <img
        class="${posterClass}"
        id="lightbox-poster"
        src="${posterSrc}"
        alt="${movie.title}"
      />
      <div class="lightbox-title">${movie.title}</div>
      ${outOfFocusHtml}
      <div class="lightbox-buttons">
        <button class="lightbox-btn return" id="lightbox-return">Return to Shelf</button>
        <button class="lightbox-btn uncover" id="lightbox-uncover"${isUncoverDisabled ? ' disabled' : ''}>
          Uncover — $1
        </button>
      </div>
    </div>
  `;

  overlay.classList.add('active');

  // Fade in
  requestAnimationFrame(() => {
    const inner = document.getElementById('lightbox-inner');
    if (inner) inner.classList.add('visible');
  });

  document.getElementById('lightbox-return').addEventListener('click', () => {
    if (typeof onReturn === 'function') onReturn();
  });

  const uncoverBtn = document.getElementById('lightbox-uncover');
  uncoverBtn.addEventListener('click', () => {
    if (uncoverBtn.disabled) return;

    // Swap to full-res poster
    const poster = document.getElementById('lightbox-poster');
    if (poster) {
      poster.src = `/posters/${movie.tmdb_id}.jpg`;
      poster.className = 'lightbox-poster uncovered';
    }

    uncoverBtn.disabled = true;

    if (typeof onUncover === 'function') onUncover(movie.tmdb_id);
  });
}

/**
 * Hides and clears the overlay.
 */
export function hideLightbox() {
  const overlay = document.getElementById('overlay');
  if (!overlay) return;
  overlay.innerHTML = '';
  overlay.classList.remove('active');
}

// ─── End Screen ──────────────────────────────────────────────────────────────

// Maps a category difficulty to its CSS color variable
const CATEGORY_COLORS = {
  easy: 'var(--category-easy)',
  medium: 'var(--category-medium)',
  hard: 'var(--category-hard)',
  devious: 'var(--category-devious)',
};

/**
 * Builds and shows the end screen.
 * @param {Object} result
 * @param {boolean}  result.won
 * @param {number}   result.finalWage
 * @param {number}   result.wrongGuesses
 * @param {number}   result.hintsUsed
 * @param {number}   result.timePenalty
 * @param {string}   result.timeStr
 * @param {Object[]} result.solvedCategories  Array of solved category objects
 * @param {Object[]} result.allCategories     All 4 category objects
 * @param {Function} result.onShare
 */
export function showEndScreen(result = {}) {
  const {
    won = false,
    finalWage = 0,
    wrongGuesses = 0,
    hintsUsed = 0,
    timePenalty = 0,
    timeStr = '0:00',
    solvedCategories = [],
    allCategories = [],
    onShare,
  } = result;

  const overlay = document.getElementById('overlay');
  if (!overlay) return;

  const title = won ? 'SHIFT COMPLETE' : 'STORE CLOSED EARLY';

  // Score card rows
  const startingWage = 10;
  const wrongDeduction = wrongGuesses * 1;
  const hintDeduction = hintsUsed * 1;

  const scoreCardHtml = `
    <div class="score-card">
      <div class="line"><span>Starting wage</span><span>$${startingWage.toFixed(2)}</span></div>
      <div class="line"><span>Wrong guesses (${wrongGuesses})</span><span>-$${wrongDeduction.toFixed(2)}</span></div>
      <div class="line"><span>Hints used (${hintsUsed})</span><span>-$${hintDeduction.toFixed(2)}</span></div>
      <div class="line"><span>Time penalty</span><span>-$${timePenalty.toFixed(2)}</span></div>
      <div class="line"><span>Time</span><span>${timeStr}</span></div>
      <div class="divider"></div>
      <div class="line final"><span>Final Wage</span><span>$${finalWage.toFixed(2)}</span></div>
    </div>
  `;

  // Category recap rows
  const categoryRowsHtml = allCategories
    .map((cat) => {
      const difficulty = cat.difficulty || 'easy';
      const color = CATEGORY_COLORS[difficulty] || CATEGORY_COLORS.easy;
      const movieTitles = (cat.movies || []).map((m) => m.title).join(', ');
      return `
        <div class="category-row" style="background:${color}22;border-left:4px solid ${color};">
          <div>
            <div class="cat-name">${cat.name || ''}</div>
            <div class="cat-movies">${movieTitles}</div>
          </div>
        </div>
      `;
    })
    .join('');

  // Countdown to midnight
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msLeft = midnight - now;
  const hoursLeft = Math.floor(msLeft / 3600000);
  const minsLeft = Math.floor((msLeft % 3600000) / 60000);
  const countdownText = `Next shift in ${hoursLeft}h ${minsLeft}m`;

  overlay.innerHTML = `
    <div class="end-screen">
      <div class="end-title">${title}</div>
      ${scoreCardHtml}
      <div class="category-recap">${categoryRowsHtml}</div>
      <button class="share-btn" id="end-share-btn">Share Result</button>
      <div class="countdown" id="end-countdown">${countdownText}</div>
    </div>
  `;

  overlay.classList.add('active');

  document.getElementById('end-share-btn').addEventListener('click', () => {
    if (typeof onShare === 'function') onShare();
  });

  // Live countdown tick
  const countdownEl = document.getElementById('end-countdown');
  const ticker = setInterval(() => {
    if (!countdownEl || !document.body.contains(countdownEl)) {
      clearInterval(ticker);
      return;
    }
    const n = new Date();
    const m = new Date(n);
    m.setHours(24, 0, 0, 0);
    const ms = m - n;
    const h = Math.floor(ms / 3600000);
    const min = Math.floor((ms % 3600000) / 60000);
    countdownEl.textContent = `Next shift in ${h}h ${min}m`;
  }, 60000);
}

// ─── VHS Tracking Flash ──────────────────────────────────────────────────────

/**
 * Creates a brief VHS distortion overlay and removes it after 500ms.
 */
export function showTrackingFlash() {
  const el = document.createElement('div');
  el.className = 'tracking-flash';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 500);
}
