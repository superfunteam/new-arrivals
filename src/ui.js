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

/**
 * Milliseconds until the next puzzle reset (10pm Central Time).
 * @returns {number}
 */
function getNextResetMs() {
  const centralNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const next = new Date(centralNow);
  if (centralNow.getHours() >= 22) {
    next.setDate(next.getDate() + 1);
  }
  next.setHours(22, 0, 0, 0);
  return Math.max(0, next.getTime() - centralNow.getTime());
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
      <div class="hud-wage" id="hud-wage">$25.00</div>
    </div>

    <button class="mute-btn" id="mute-btn" aria-label="Toggle mute">♪</button>
    <button class="help-btn" id="help-btn" aria-label="Help">?</button>

    <div class="hud-bottom">
      <div class="hud-hints">
        $<span class="hint-count" id="hud-hint-count">25</span> hints left
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

  // Poster images from well-known movies in the game
  const posterIds = { predator: 106, totalRecall: 861, dieHard: 562, ghostbusters: 620 };

  const slides = [
    {
      title: 'Welcome to the Store',
      anim: `<div class="onboarding-posters">
        <img class="onboarding-poster" src="/posters/${posterIds.predator}_pixel.jpg" alt="Predator" />
        <img class="onboarding-poster" src="/posters/${posterIds.totalRecall}_pixel.jpg" alt="Total Recall" />
        <img class="onboarding-poster" src="/posters/${posterIds.dieHard}_pixel.jpg" alt="Die Hard" />
        <img class="onboarding-poster" src="/posters/${posterIds.ghostbusters}_pixel.jpg" alt="Ghostbusters" />
      </div>`,
      body: "You're the new clerk at NEW ARRIVALS VIDEO. Sort 16 tapes into 4 mystery categories to earn your daily wages.",
      btn: 'Next',
    },
    {
      title: 'How to Sort',
      anim: `<div class="onboarding-poster-tap">
        <img class="onboarding-poster-single" src="/posters/${posterIds.predator}_pixel.jpg" alt="Predator" />
        <div class="onboarding-tap-icon">TAP</div>
      </div>`,
      body: 'Tap a tape to select it. Pick 4 you think belong together, then hit SHELVE IT. Long-press any tape to view its details up close.',
      btn: 'Next',
    },
    {
      title: 'Watch Your Wallet',
      anim: `<div class="onboarding-poster-price">
        <img class="onboarding-poster-single" src="/posters/${posterIds.ghostbusters}_pixel.jpg" alt="Ghostbusters" />
        <div class="onboarding-price-tag">$1</div>
      </div>`,
      body: 'You start with $25. Wrong guesses cost $1. Hints cost $1. Take too long and the clock eats your paycheck. Can you keep the store profitable?',
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

// ─── Welcome Screen ─────────────────────────────────────────────────────────

/**
 * Shows the welcome/menu screen with Daily Dropoff, Past Returns, and
 * Trainee Manual modes.
 * @param {Object} options
 * @param {Object}   options.dailyPuzzle        The puzzle object for today
 * @param {string|null} options.dailyState       null | 'in_progress' | 'completed'
 * @param {Object[]} options.practicePuzzles     Array of up to 4 practice puzzle objects
 * @param {Object[]} options.pastPuzzles         Array of past daily puzzle objects
 * @param {string[]} options.completedDailyIds   Array of completed puzzle IDs
 * @param {Function} options.onStartDaily        Called when user clicks daily start
 * @param {Function} options.onStartPractice     Called with practice puzzle index
 * @param {Function} options.onStartPast         Called with past puzzle object
 */
export function showWelcomeScreen(options = {}) {
  const {
    dailyPuzzle,
    dailyState = null,
    practicePuzzles = [],
    pastPuzzles = [],
    completedDailyIds = [],
    onStartDaily,
    onStartPractice,
    onStartPast,
  } = options;

  const overlay = document.getElementById('overlay');
  if (!overlay) return;

  const dateStr = formatDate(new Date());

  // Daily button label and class
  let dailyBtnLabel = 'START SHIFT';
  let dailyBtnClass = 'welcome-btn daily';
  let dailyDisabled = false;
  if (dailyState === 'completed') {
    dailyBtnLabel = 'COMPLETED \u2713';
    dailyBtnClass = 'welcome-btn completed';
    dailyDisabled = true;
  } else if (dailyState === 'in_progress') {
    dailyBtnLabel = 'CONTINUE';
  }

  // Practice cards HTML
  const practiceCardsHtml = practicePuzzles
    .map(
      (p, i) => `
      <div class="practice-card">
        <div class="practice-card-title">${p.title}</div>
        <button class="welcome-btn practice" data-practice-index="${i}">PRACTICE</button>
      </div>`
    )
    .join('');

  // Past Returns cards HTML
  const completedSet = new Set(completedDailyIds);
  const pastCardsHtml = pastPuzzles
    .map(
      (p, i) => {
        const pDate = new Date(p.id + 'T12:00:00');
        const pDateStr = formatDate(pDate);
        const isCompleted = completedSet.has(p.id);
        const checkmark = isCompleted ? '<span class="past-card-check">\u2713</span>' : '';
        return `
      <div class="past-card${isCompleted ? ' completed' : ''}">
        <div class="past-card-info">
          <div class="past-card-title">${p.title}</div>
          <div class="past-card-date">${pDateStr}</div>
        </div>
        <div class="past-card-action">
          ${checkmark}
          <button class="welcome-btn practice" data-past-index="${i}">REPLAY</button>
        </div>
      </div>`;
      }
    )
    .join('');

  // Build Past Returns section (only if there are past puzzles)
  const pastReturnsHtml = pastPuzzles.length > 0
    ? `
      <div class="welcome-section">
        <div class="welcome-section-title">PAST RETURNS</div>
        <div class="past-returns-list">
          ${pastCardsHtml}
        </div>
      </div>`
    : '';

  overlay.innerHTML = `
    <div class="welcome-screen">
      <div class="welcome-title">NEW ARRIVALS</div>
      <div class="welcome-tagline">Be kind, rewind</div>

      <div class="welcome-section">
        <div class="welcome-section-title">DAILY DROPOFF</div>
        <div class="daily-card">
          <div class="daily-card-title">${dailyPuzzle.title}</div>
          <div class="daily-card-date">${dateStr}</div>
          <button class="${dailyBtnClass}" id="welcome-daily-btn"${dailyDisabled ? ' disabled' : ''}>${dailyBtnLabel}</button>
        </div>
      </div>

      ${pastReturnsHtml}

      <div class="welcome-section">
        <div class="welcome-section-title">TRAINEE MANUAL</div>
        <div class="practice-grid">
          ${practiceCardsHtml}
        </div>
      </div>
    </div>
  `;

  overlay.classList.add('active');

  // Daily button handler
  const dailyBtn = document.getElementById('welcome-daily-btn');
  if (dailyBtn && !dailyDisabled) {
    dailyBtn.addEventListener('click', () => {
      overlay.innerHTML = '';
      overlay.classList.remove('active');
      if (typeof onStartDaily === 'function') onStartDaily();
    });
  }

  // Practice button handlers
  overlay.querySelectorAll('[data-practice-index]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-practice-index'), 10);
      overlay.innerHTML = '';
      overlay.classList.remove('active');
      if (typeof onStartPractice === 'function') onStartPractice(idx);
    });
  });

  // Past Returns button handlers
  overlay.querySelectorAll('[data-past-index]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-past-index'), 10);
      overlay.innerHTML = '';
      overlay.classList.remove('active');
      if (typeof onStartPast === 'function') onStartPast(pastPuzzles[idx]);
    });
  });
}

// ─── Genre Color Map ────────────────────────────────────────────────────────

const GENRE_COLORS = {
  'Horror': '#8B0000',
  'Comedy': '#DAA520',
  'Action': '#FF4500',
  'Drama': '#4169E1',
  'Science Fiction': '#7B68EE',
  'Thriller': '#2F4F4F',
  'Adventure': '#228B22',
  'Animation': '#FF69B4',
  'Fantasy': '#9932CC',
  'Romance': '#C71585',
  'Crime': '#696969',
  'Mystery': '#483D8B',
  'Music': '#FF1493',
  'Family': '#32CD32',
  'War': '#556B2F',
  'Western': '#8B4513',
  'Documentary': '#4682B4',
  'History': '#B8860B',
};

// ─── Lightbox ────────────────────────────────────────────────────────────────

/**
 * Show the inspect lightbox for a movie.
 * @param {Object} movie  Must have tmdb_id and title
 * @param {Object} options
 * @param {boolean}  options.uncovered
 * @param {number}   options.hintsLeft
 * @param {number}   options.wage
 * @param {Function} options.onReturn
 * @param {Function} options.onUncover  Called with tmdb_id
 * @param {string[]} options.genres
 * @param {string}   options.director
 * @param {string[]} options.stars
 * @param {number}   options.year
 * @param {string}   options.summary
 * @param {string[]} options.revealedFields  Already-revealed field names
 * @param {Function} options.onRevealHint  Called with fieldName ('details' or 'summary')
 */
export function showLightbox(movie, options = {}) {
  const {
    uncovered = false,
    hintsLeft = 0,
    wage = 0,
    onReturn,
    onUncover,
    genres = [],
    director = '',
    stars = [],
    year = 0,
    summary = '',
    revealedFields = [],
    onRevealHint,
  } = options;
  const overlay = document.getElementById('overlay');
  if (!overlay) return;

  const isUncoverDisabled = uncovered || wage <= 0;
  const posterSrc = uncovered
    ? `/posters/${movie.tmdb_id}.jpg`
    : `/posters/${movie.tmdb_id}_pixel.jpg`;
  const posterClass = uncovered ? 'lightbox-poster uncovered' : 'lightbox-poster';

  // Genre sticker (free hint)
  const primaryGenre = genres.length > 0 ? genres[0] : '';
  const genreColor = GENRE_COLORS[primaryGenre] || '#666';
  const genreStickerHtml = primaryGenre
    ? `<div class="genre-sticker" style="background:${genreColor}">${primaryGenre.toUpperCase()}</div>`
    : '';

  // Details section (director, stars, year — bundled as one $1 reveal)
  const detailsRevealed = ['director', 'stars', 'year'].every(f => revealedFields.includes(f));

  function buildDetailLine(label, value) {
    const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
    if (detailsRevealed) {
      return `<div class="hint-row">
        <span class="hint-label">${label}:</span>
        <span class="hint-value">${displayValue}</span>
      </div>`;
    }
    const redactLen = label === 'Year' ? 4 : Math.min(displayValue.length, 12);
    const redactBlock = '\u2588'.repeat(redactLen);
    return `<div class="hint-row">
      <span class="hint-label">${label}:</span>
      <span class="hint-redacted" data-detail="${label.toLowerCase()}">${redactBlock}</span>
    </div>`;
  }

  const detailsBtnHtml = detailsRevealed
    ? ''
    : `<button class="hint-reveal-btn details-reveal-btn" data-field="details"${wage <= 0 ? ' disabled' : ''}>REVEAL DETAILS — $1</button>`;

  const detailsHtml = `
    <div class="lightbox-details" id="lightbox-details">
      ${buildDetailLine('Director', director)}
      ${buildDetailLine('Stars', stars)}
      ${buildDetailLine('Year', year)}
      ${detailsBtnHtml}
    </div>
  `;

  // Summary section (separate $1 reveal)
  const summaryRevealed = revealedFields.includes('summary');
  const summaryRedact = '\u2588'.repeat(18);
  const summaryBtnHtml = summaryRevealed
    ? ''
    : `<button class="hint-reveal-btn summary-reveal-btn" data-field="summary"${wage <= 0 ? ' disabled' : ''}>REVEAL SUMMARY — $1</button>`;
  const summaryContentHtml = summaryRevealed
    ? `<span class="hint-value summary-text">${summary}</span>`
    : `<span class="hint-redacted summary-redacted">${summaryRedact}</span>`;

  const summaryHtml = `
    <div class="lightbox-summary" id="lightbox-summary">
      ${summaryContentHtml}
      ${summaryBtnHtml}
    </div>
  `;

  overlay.innerHTML = `
    <div class="lightbox" id="lightbox-inner">
      <div class="lightbox-poster-wrap">
        <img
          class="${posterClass}"
          id="lightbox-poster"
          src="${posterSrc}"
          alt="${movie.title}"
        />
        ${genreStickerHtml}
      </div>
      <div class="lightbox-title">${movie.title}</div>
      ${detailsHtml}
      ${summaryHtml}
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

  // Hint reveal buttons (details and summary)
  overlay.querySelectorAll('.hint-reveal-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const fieldName = btn.getAttribute('data-field');
      if (typeof onRevealHint === 'function') onRevealHint(fieldName);
    });
  });
}

/**
 * Reveal a hint field in-place with a typing animation (no modal rebuild).
 * @param {string} fieldName  'director', 'stars', or 'year'
 * @param {string|string[]} value  The value to type in
 */
export function revealHintInPlace(fieldName, value) {
  const overlay = document.getElementById('overlay');
  if (!overlay) return;

  const row = overlay.querySelector(`.hint-reveal-btn[data-field="${fieldName}"]`)?.closest('.hint-row');
  if (!row) return;

  const displayValue = Array.isArray(value) ? value.join(', ') : String(value);

  // Remove the redacted text and button
  const redacted = row.querySelector('.hint-redacted');
  const btn = row.querySelector('.hint-reveal-btn');
  if (btn) btn.remove();

  if (redacted) {
    // Replace redacted block with a typing span
    const typingSpan = document.createElement('span');
    typingSpan.className = 'hint-value hint-typing';
    typingSpan.textContent = '';
    redacted.replaceWith(typingSpan);

    // Type out the text character by character
    let i = 0;
    const interval = setInterval(() => {
      if (i < displayValue.length) {
        typingSpan.textContent += displayValue[i];
        i++;
      } else {
        clearInterval(interval);
        typingSpan.classList.remove('hint-typing');
      }
    }, 35);
  }
}

/**
 * Animate typing for a single redacted span, returning a promise when done.
 * @param {HTMLElement} redacted  The .hint-redacted element
 * @param {string} displayValue  Text to type in
 * @returns {Promise<void>}
 */
function _animateTyping(redacted, displayValue) {
  return new Promise((resolve) => {
    const typingSpan = document.createElement('span');
    typingSpan.className = 'hint-value hint-typing';
    typingSpan.textContent = '';
    redacted.replaceWith(typingSpan);

    let i = 0;
    const interval = setInterval(() => {
      if (i < displayValue.length) {
        typingSpan.textContent += displayValue[i];
        i++;
      } else {
        clearInterval(interval);
        typingSpan.classList.remove('hint-typing');
        resolve();
      }
    }, 35);
  });
}

/**
 * Reveal all three detail fields (director, stars, year) in-place simultaneously.
 * Removes the "REVEAL DETAILS" button and animates all three fields at once.
 * @param {string} director
 * @param {string[]} stars
 * @param {number} year
 */
export function revealDetailsInPlace(director, stars, year) {
  const overlay = document.getElementById('overlay');
  if (!overlay) return;

  // Remove the details reveal button
  const detailsBtn = overlay.querySelector('.details-reveal-btn');
  if (detailsBtn) detailsBtn.remove();

  // Find all three redacted spans by data-detail attribute
  const fields = [
    { attr: 'director', value: director },
    { attr: 'stars', value: Array.isArray(stars) ? stars.join(', ') : String(stars) },
    { attr: 'year', value: String(year) },
  ];

  for (const field of fields) {
    const redacted = overlay.querySelector(`.hint-redacted[data-detail="${field.attr}"]`);
    if (redacted) {
      _animateTyping(redacted, field.value);
    }
  }
}

/**
 * Reveal the summary text in-place with a typing animation.
 * Removes the "REVEAL SUMMARY" button and animates the summary text.
 * @param {string} summary
 */
export function revealSummaryInPlace(summary) {
  const overlay = document.getElementById('overlay');
  if (!overlay) return;

  // Remove the summary reveal button
  const summaryBtn = overlay.querySelector('.summary-reveal-btn');
  if (summaryBtn) summaryBtn.remove();

  // Find the redacted summary span
  const redacted = overlay.querySelector('.summary-redacted');
  if (redacted) {
    _animateTyping(redacted, summary);
  }
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

// ─── Solved Row Label ───────────────────────────────────────────────────────

/**
 * Creates an absolutely positioned label in #hud for a solved row.
 * @param {string} categoryName
 * @param {string} categoryColor  CSS color string
 * @param {number} screenY  Y position in pixels from top of viewport
 */
export function addSolvedRowLabel(categoryName, categoryColor, screenY) {
  const hud = document.getElementById('hud');
  if (!hud) return;

  const label = document.createElement('div');
  label.className = 'solved-row-label';
  label.textContent = categoryName.toUpperCase();
  label.style.top = `${screenY}px`;
  label.style.background = categoryColor;
  hud.appendChild(label);
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
 * @param {string}   [result.mode]            'daily' (default) or 'practice'
 * @param {Function} [result.onBackToMenu]    Called in practice mode for back to menu
 * @param {Function} [result.onPlayAgain]     Called in practice mode for replay
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
    mode = 'daily',
    onBackToMenu,
    onPlayAgain,
  } = result;

  const overlay = document.getElementById('overlay');
  if (!overlay) return;

  const title = won ? 'SHIFT COMPLETE' : 'STORE CLOSED EARLY';

  // Score card rows
  const startingWage = 25;
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

  // Bottom section differs by mode
  let bottomHtml = '';
  if (mode === 'practice') {
    bottomHtml = `
      <div class="end-practice-buttons">
        <button class="end-practice-btn menu" id="end-back-menu">BACK TO MENU</button>
        <button class="end-practice-btn replay" id="end-play-again">PLAY AGAIN</button>
      </div>
    `;
  } else {
    // Daily mode: share button + countdown to next 10pm Central
    const msLeft = getNextResetMs();
    const hoursLeft = Math.floor(msLeft / 3600000);
    const minsLeft = Math.floor((msLeft % 3600000) / 60000);
    const countdownText = `Next shift in ${hoursLeft}h ${minsLeft}m`;
    bottomHtml = `
      <button class="share-btn" id="end-share-btn">Share Result</button>
      <div class="countdown" id="end-countdown">${countdownText}</div>
    `;
  }

  overlay.innerHTML = `
    <div class="end-screen">
      <div class="end-title">${title}</div>
      ${scoreCardHtml}
      <div class="category-recap">${categoryRowsHtml}</div>
      ${bottomHtml}
    </div>
  `;

  overlay.classList.add('active');

  if (mode === 'practice') {
    const backBtn = document.getElementById('end-back-menu');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (typeof onBackToMenu === 'function') onBackToMenu();
      });
    }
    const replayBtn = document.getElementById('end-play-again');
    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        if (typeof onPlayAgain === 'function') onPlayAgain();
      });
    }
  } else {
    const shareBtn = document.getElementById('end-share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        if (typeof onShare === 'function') onShare();
      });
    }

    // Live countdown tick (counts down to 10pm Central)
    const countdownEl = document.getElementById('end-countdown');
    const ticker = setInterval(() => {
      if (!countdownEl || !document.body.contains(countdownEl)) {
        clearInterval(ticker);
        return;
      }
      const ms = getNextResetMs();
      const h = Math.floor(ms / 3600000);
      const min = Math.floor((ms % 3600000) / 60000);
      countdownEl.textContent = `Next shift in ${h}h ${min}m`;
    }, 60000);
  }
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
