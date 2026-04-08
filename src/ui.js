// New Arrivals — UI Overlays (HUD, Onboarding, Lightbox, End Screen)

// ─── DOM refs (populated by createHUD) ─────────────────────────────────────
let _wage = null;
let _timer = null;
let _shelveBtn = null;
let _shelveHandler = null;
let _helpBtn = null;
let _radioVizCanvas = null;
let _radioIcon = null;
let _radioWidget = null;

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
      <div class="hud-logo" id="hud-logo" style="cursor:pointer">
        NEW ARRIVALS
        <span class="hud-date">${dateStr}</span>
      </div>
      <div class="hud-wage-wrap">
        <div class="hud-wage" id="hud-wage">$25</div>
        <span class="hud-wage-label">Current Pay</span>
      </div>
    </div>

    <div class="hud-shelve-row">
      <button class="shelve-btn" id="shelve-btn" disabled>PICK 4 MOVIES</button>
    </div>
    <div class="hud-bottom">
      <div class="hud-radio" id="hud-radio">
        <div class="radio-tune" id="radio-tune">
          <span class="radio-station" id="radio-station">──.─ ────</span>
          <canvas class="radio-viz" id="radio-viz" width="32" height="12"></canvas>
        </div>
        <span class="radio-icon" id="radio-icon">♪</span>
      </div>
      <div class="hud-timer" id="hud-timer">0:00</div>
    </div>
  `;

  _wage = document.getElementById('hud-wage');
  _timer = document.getElementById('hud-timer');
  _shelveBtn = document.getElementById('shelve-btn');
  _helpBtn = document.getElementById('help-btn');
  _radioVizCanvas = document.getElementById('radio-viz');
  _radioIcon = document.getElementById('radio-icon');
  _radioWidget = document.getElementById('hud-radio');
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
      ? '$' + Math.round(wage)
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
 * Updates the hints-remaining count (no-op, hints display removed).
 * @param {number} remaining
 */
export function updateHints(remaining) {
  // No-op: hints counter removed in favor of radio widget
}

/**
 * Enable or disable the SHELVE IT button, set label, and set click handler.
 * @param {boolean} active
 * @param {Function|null} [onClick]
 * @param {number} [selectedCount]  Number of currently selected tapes (0-4)
 */
export function setShelveButton(active, onClick = null, selectedCount = 0) {
  if (!_shelveBtn) return;

  _shelveBtn.disabled = !active;

  // Dynamic label
  if (active) {
    _shelveBtn.textContent = 'SHELVE IT';
  } else {
    const remaining = 4 - selectedCount;
    if (remaining === 4) {
      _shelveBtn.textContent = 'PICK 4 MOVIES';
    } else if (remaining === 1) {
      _shelveBtn.textContent = 'PICK 1 MORE';
    } else if (remaining > 0) {
      _shelveBtn.textContent = `PICK ${remaining} MORE`;
    } else {
      _shelveBtn.textContent = 'SHELVE IT';
    }
  }

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

// ─── Radio Widget ───────────────────────────────────────────────────────────

/**
 * Add a click listener to the radio icon (mute toggle).
 * @param {Function} callback
 */
export function onMuteClick(callback) {
  if (_radioIcon) _radioIcon.addEventListener('click', callback);
}

/**
 * Add a click listener to the station name / spectrograph (change station).
 * @param {Function} callback
 */
export function onStationClick(callback) {
  const el = document.getElementById('radio-tune');
  if (el) el.addEventListener('click', callback);
}

/**
 * Update the station name display.
 * @param {string} name
 */
export function setStationName(name) {
  const el = document.getElementById('radio-station');
  if (el) el.textContent = name;
}

/**
 * Toggle mute visual state on the radio widget.
 * When muted: spectrograph freezes, icon dims, station text dims.
 * @param {boolean} muted
 */
export function setMuteIcon(muted) {
  if (_radioWidget) {
    if (muted) {
      _radioWidget.classList.add('muted');
    } else {
      _radioWidget.classList.remove('muted');
    }
  }
}

/**
 * Draw the spectrograph bars on the radio viz canvas.
 * Call this each frame from the render loop.
 * @param {number} time  Elapsed time in seconds (from THREE.Clock)
 * @param {boolean} muted  Whether audio is currently muted
 */
export function updateRadioViz(time, muted) {
  if (!_radioVizCanvas) return;
  const ctx = _radioVizCanvas.getContext('2d');
  if (!ctx) return;

  const w = _radioVizCanvas.width;
  const h = _radioVizCanvas.height;
  ctx.clearRect(0, 0, w, h);

  const barCount = 5;
  const barWidth = 3;
  const gap = (w - barCount * barWidth) / (barCount + 1);

  for (let i = 0; i < barCount; i++) {
    const x = gap + i * (barWidth + gap);
    let barHeight;
    if (muted) {
      barHeight = 2;
    } else {
      const freq = 1.5 + i * 0.7;
      const phase = i * 1.3;
      barHeight = 3 + Math.abs(Math.sin(time * freq + phase)) * (h - 3);
    }
    const y = h - barHeight;
    ctx.fillStyle = muted ? 'rgba(255,255,255,0.15)' : 'rgba(0,212,255,0.8)';
    ctx.fillRect(x, y, barWidth, barHeight);
  }
}

// ─── Help Button ────────────────────────────────────────────────────────────

/**
 * Add a click listener to the help button.
 * @param {Function} callback
 */
export function onHelpClick(callback) {
  const logo = document.getElementById('hud-logo');
  if (logo) logo.addEventListener('click', callback);
}

// ─── Splash Screen ──────────────────────────────────────────────────────────

/**
 * Shows the splash/welcome screen with marquee VHS posters and the logo.
 * This is the very first screen users see before onboarding.
 * @param {Object} options
 * @param {number[]} options.posterIds    Array of tmdb_ids for marquee images
 * @param {Function} options.onStart      Called when "START YOUR SHIFT" is clicked
 * @param {Function} options.onStartMuted Called when "start on mute" is clicked
 */
// Cache marquee HTML so onboarding and welcome screens can reuse it
let _marqueeHtml = '';

const STICKER_GENRES = ['ACTION', 'HORROR', 'COMEDY', 'DRAMA', 'SCI-FI', 'THRILLER', 'ADVENTURE', 'FANTASY', 'ROMANCE', 'CRIME', 'MYSTERY', 'FAMILY'];
const STICKER_COLORS = ['#FF4500', '#8B0000', '#DAA520', '#4169E1', '#7B68EE', '#2F4F4F', '#228B22', '#9932CC', '#C71585', '#696969', '#483D8B', '#32CD32'];

function buildMarqueeHtml(posterIds) {
  const numRows = 5;
  const perRow = Math.max(8, Math.floor(posterIds.length / numRows));
  const rows = [];
  for (let r = 0; r < numRows; r++) {
    const start = r * perRow;
    const rowIds = posterIds.slice(start, start + perRow);
    const html = [...rowIds, ...rowIds]
      .map(id => {
        // Seeded random from poster id for consistent positioning
        const seed = id * 2654435761 >>> 0;
        const genreIdx = seed % STICKER_GENRES.length;
        const genre = STICKER_GENRES[genreIdx];
        const color = STICKER_COLORS[genreIdx];
        const rot = ((seed >> 8) % 15) - 7; // -7 to +7 degrees
        const top = 2 + ((seed >> 4) % 40); // 2-42% from top
        const left = ((seed >> 12) % 2) === 0 ? '-6px' : 'auto';
        const right = left === 'auto' ? '-6px' : 'auto';
        return `<div class="marquee-poster-wrap">
          <img class="marquee-poster" src="/posters/${id}_pixel.jpg" alt="" />
          <span class="marquee-sticker" style="background:${color};transform:rotate(${rot}deg);top:${top}%;left:${left};right:${right}">${genre}</span>
        </div>`;
      })
      .join('');
    rows.push(html);
  }
  return `<div class="splash-marquees">${rows
    .map((html, i) => `<div class="marquee-row${i % 2 === 1 ? ' reverse' : ''}">${html}</div>`)
    .join('')}</div>`;
}

export function showSplashScreen(options = {}) {
  const { posterIds = [], onStart, onStartMuted } = options;

  const overlay = document.getElementById('overlay');
  if (!overlay) return;

  _marqueeHtml = buildMarqueeHtml(posterIds);

  overlay.innerHTML = `
    <div class="splash-screen">
      ${_marqueeHtml}
      <div class="splash-content">
        <img class="splash-logo" src="/logo-overlay.png" alt="New Arrivals" />
        <p class="splash-tagline">The year is 19XX. You still live at home. You work at the rental store. And you need this paycheck.</p>
        <p class="splash-tagline splash-blink">New games daily at 10pm</p>
        <button class="splash-btn" id="splash-start">START YOUR SHIFT</button>
        <button class="splash-mute-link" id="splash-mute">start on mute</button>
      </div>
    </div>
  `;

  overlay.classList.add('active');

  // Inject jam widget script
  const jamScript = document.createElement('script');
  jamScript.src = 'https://jam.pieter.com/2026/widget.js';
  jamScript.async = true;
  document.head.appendChild(jamScript);

  document.getElementById('splash-start').addEventListener('click', () => {
    overlay.innerHTML = '';
    overlay.classList.remove('active');
    if (typeof onStart === 'function') onStart();
  });

  document.getElementById('splash-mute').addEventListener('click', () => {
    overlay.innerHTML = '';
    overlay.classList.remove('active');
    if (typeof onStartMuted === 'function') onStartMuted();
  });
}

// ─── Onboarding Modal ────────────────────────────────────────────────────────

/**
 * Shows a 3-slide onboarding carousel inside #overlay.
 * @param {Function} onComplete  Called with (skipChecked: boolean) when the user
 *                               clicks "Let's Go" on the last slide.
 */
export function showOnboarding(onComplete, onSlideRender) {
  const overlay = document.getElementById('overlay');
  if (!overlay) return;

  // Poster images from well-known movies in the game
  const posterIds = { predator: 106, totalRecall: 861, dieHard: 562, ghostbusters: 620 };

  const slides = [
    {
      title: 'Welcome to the Store',
      anim: `<canvas class="onboarding-3d-canvas" id="onboarding-3d" width="320" height="180"></canvas>`,
      body: "You're the new clerk at NEW ARRIVALS VIDEO. Sort 16 tapes into 4 mystery categories to earn your daily wages.",
      btn: 'Next',
    },
    {
      title: 'How to Sort',
      anim: `<div class="onboarding-poster-price">
        <img class="demo-tape" id="demo-tape" src="/posters/${posterIds.dieHard}_pixel.jpg" alt="Die Hard" />
        <div class="onboarding-price-tag" style="background:var(--neon-blue);color:#fff;right:-28px">TAP TO SELECT</div>
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
      btn: "Let's Go",
    },
  ];

  let current = 0;

  function render() {
    const isLastSlide = current === slides.length - 1;

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

    const skipCheckboxHtml = isLastSlide
      ? `<label class="skip-checkbox">
          <input type="checkbox" id="skip-intro-check"> Skip this next time
        </label>`
      : '';

    overlay.innerHTML = `
      <div class="onboarding">
        ${_marqueeHtml}
        <div class="onboarding-card">
          ${slidesHtml}
          <div class="onboarding-dots">${dotsHtml}</div>
          ${skipCheckboxHtml}
          <button class="onboarding-btn" id="onboarding-next">${slides[current].btn}</button>
        </div>
      </div>
    `;

    overlay.classList.add('active');

    document.getElementById('onboarding-next').addEventListener('click', () => {
      if (current < slides.length - 1) {
        current++;
        render();
      } else {
        const skipCheck = document.getElementById('skip-intro-check');
        const skipChecked = skipCheck ? skipCheck.checked : false;
        overlay.innerHTML = '';
        overlay.classList.remove('active');
        if (typeof onComplete === 'function') onComplete(skipChecked);
      }
    });

    // Interactive demo tape on slide 2
    const demoTape = document.getElementById('demo-tape');
    if (demoTape) {
      demoTape.addEventListener('click', () => {
        demoTape.classList.toggle('demo-selected');
      });
    }

    // Notify caller which slide just rendered
    if (typeof onSlideRender === 'function') onSlideRender(current);
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
 * @param {Object}   options.gameScores          { [puzzleId]: { wage, stars } }
 * @param {Function} options.onStartDaily        Called when user clicks daily start
 * @param {Function} options.onStartPractice     Called with practice puzzle index
 * @param {Function} options.onStartPast         Called with past puzzle object
 */
function buildPaycheckHtml(data) {
  if (!data) return '';

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const hasAnyPlayed = data.days.some(d => d.played);

  const blocksHtml = data.days.map(d => {
    const dayOfWeek = new Date(d.date + 'T12:00:00').getDay();
    const label = dayNames[dayOfWeek];
    if (d.played) {
      return `<div class="paycheck-block filled" title="$${d.wage}">
        <span class="paycheck-day">${label}</span>
        <span class="paycheck-amount">$${d.wage}</span>
      </div>`;
    }
    return `<div class="paycheck-block empty">
      <span class="paycheck-day">${label}</span>
    </div>`;
  }).join('');

  const content = hasAnyPlayed
    ? `<div class="paycheck-total">$${data.total} <span class="paycheck-total-label">earned this week</span></div>
       <div class="paycheck-timeline">${blocksHtml}</div>`
    : `<div class="paycheck-timeline">${blocksHtml}</div>
       <div class="paycheck-empty">Play your first game to start making money</div>`;

  return `
    <div class="welcome-section">
      <div class="welcome-section-title">YOUR PAYCHECK</div>
      <div class="paycheck-card">
        ${content}
      </div>
    </div>`;
}

export function showWelcomeScreen(options = {}) {
  const {
    dailyPuzzle,
    dailyState = null,
    practicePuzzles = [],
    pastPuzzles = [],
    completedDailyIds = [],
    gameScores = {},
    paycheckData = null,
    onStartDaily,
    onStartPractice,
    onStartPast,
  } = options;

  const overlay = document.getElementById('overlay');
  if (!overlay) return;

  const dateStr = formatDate(new Date());

  function hasScore(puzzleId) {
    return !!gameScores[puzzleId];
  }

  function scoreButton(puzzleId) {
    const score = gameScores[puzzleId];
    if (!score) return '';
    const stars = Array.from({ length: score.stars }, () =>
      '<span class="material-symbols-rounded score-star">star</span>'
    ).join('');
    return `<span class="score-btn">${stars} $${score.wage}</span>`;
  }

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

  // Practice cards HTML — whole card is tappable
  const practiceCardsHtml = practicePuzzles
    .map(
      (p, i) => {
        const played = hasScore(p.id);
        return `
      <div class="game-card" data-practice-index="${i}">
        <div class="game-card-info">
          <div class="game-card-title">${p.title}</div>
        </div>
        <div class="game-card-action">
          ${played ? `<span class="game-card-replay">↻</span>${scoreButton(p.id)}` : '<span class="game-card-play-btn">PRACTICE</span>'}
        </div>
      </div>`;
      }
    )
    .join('');

  // Past Returns cards HTML — whole card is tappable
  const completedSet = new Set(completedDailyIds);
  const pastCardsHtml = pastPuzzles
    .map(
      (p, i) => {
        const pDate = new Date(p.id + 'T12:00:00');
        const pDateStr = formatDate(pDate);
        const played = completedSet.has(p.id) || hasScore(p.id);
        return `
      <div class="game-card" data-past-index="${i}">
        <div class="game-card-info">
          <div class="game-card-title">${p.title}</div>
          <div class="game-card-date">${pDateStr}</div>
        </div>
        <div class="game-card-action">
          ${played ? `<span class="game-card-replay">↻</span>${scoreButton(p.id)}` : '<span class="game-card-play-btn">PLAY</span>'}
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
      ${_marqueeHtml}
      <div class="welcome-inner">
      <div class="welcome-title">NEW ARRIVALS</div>
      <div class="welcome-tagline">The video rental store game</div>

      <div class="welcome-section">
        <div class="welcome-section-title">DAILY DROPOFF</div>
        <div class="daily-card" id="welcome-daily-btn">
          <div class="daily-card-title">${dailyPuzzle.title}</div>
          <div class="daily-card-date">${dateStr}</div>
          ${hasScore(dailyPuzzle.id) ? scoreButton(dailyPuzzle.id) : `<span class="game-card-play-btn daily-play-btn">${dailyBtnLabel}</span>`}
        </div>
      </div>

      ${buildPaycheckHtml(paycheckData)}

      ${pastReturnsHtml}

      <div class="welcome-section">
        <div class="welcome-section-title">TRAINEE MANUAL</div>
        <div class="trainee-list">
          ${practiceCardsHtml}
        </div>
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

  // Genre sticker (colored circle floating above the info panel)
  const primaryGenre = genres.length > 0 ? genres[0] : '';
  const genreColor = GENRE_COLORS[primaryGenre] || '#666';
  const genreStickerHtml = primaryGenre
    ? `<div class="lightbox-sticker" style="background:${genreColor}">${primaryGenre.toUpperCase()}</div>`
    : '';
  const genreInlineHtml = primaryGenre
    ? ` <span class="lightbox-genre" style="color:${genreColor}">&bull; ${primaryGenre.toUpperCase()}</span>`
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

  // Uncover button (swaps the 3D box texture in real-time)
  const uncoverBtnHtml = uncovered
    ? ''
    : `<button class="lightbox-btn uncover" id="lightbox-uncover"${isUncoverDisabled ? ' disabled' : ''}>Uncover Poster — $1</button>`;

  overlay.innerHTML = `
    <div class="lightbox" id="lightbox-inner">
      <button class="lightbox-close" id="lightbox-close" aria-label="Close">&times;</button>
      ${genreStickerHtml}
      <div class="lightbox-content" id="lightbox-content">
        <div class="lightbox-title">${movie.title}${genreInlineHtml}</div>
        ${detailsHtml}
        ${summaryHtml}
        <div class="lightbox-buttons">
          ${uncoverBtnHtml}
          <button class="lightbox-btn return" id="lightbox-return">Return to Shelf</button>
        </div>
      </div>
    </div>
  `;

  overlay.classList.add('active');

  // Hide HUD corners for a cleaner look
  const hud = document.getElementById('hud');
  if (hud) hud.classList.add('hud-inspect-mode');

  // Fade in
  requestAnimationFrame(() => {
    const inner = document.getElementById('lightbox-inner');
    if (inner) inner.classList.add('visible');
  });

  // Close button (same action as Return to Shelf)
  document.getElementById('lightbox-close').addEventListener('click', () => {
    if (typeof onReturn === 'function') onReturn();
  });

  document.getElementById('lightbox-return').addEventListener('click', () => {
    if (typeof onReturn === 'function') onReturn();
  });

  const uncoverBtn = document.getElementById('lightbox-uncover');
  if (uncoverBtn) {
    uncoverBtn.addEventListener('click', () => {
      if (uncoverBtn.disabled) return;
      uncoverBtn.disabled = true;
      if (typeof onUncover === 'function') onUncover(movie.tmdb_id);
    });
  }

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
    }, 18);
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

  // Restore HUD corners
  const hud = document.getElementById('hud');
  if (hud) hud.classList.remove('hud-inspect-mode');
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
    interruptHintCost = 0,
    triviaEarnings = 0,
  } = result;

  const overlay = document.getElementById('overlay');
  if (!overlay) return;

  const title = won ? 'SHIFT COMPLETE' : 'STORE CLOSED EARLY';

  // Score card rows
  const startingWage = 25;
  const wrongDeduction = wrongGuesses * 1;
  const hintDeduction = hintsUsed * 1;

  const interruptHintLine = interruptHintCost > 0
    ? `<div class="line"><span>Customer hints</span><span style="color:var(--penalty-red)">-$${interruptHintCost}</span></div>`
    : '';
  const triviaLine = triviaEarnings > 0
    ? `<div class="line"><span>Trivia tips</span><span style="color:var(--wage-green)">+$${triviaEarnings}</span></div>`
    : '';

  const scoreCardHtml = `
    <div class="score-card">
      <div class="line"><span>Starting wage</span><span>$${startingWage}</span></div>
      <div class="line"><span>Wrong guesses (${wrongGuesses})</span><span style="color:var(--penalty-red)">-$${wrongDeduction}</span></div>
      <div class="line"><span>Hints used (${hintsUsed})</span><span style="color:var(--penalty-red)">-$${hintDeduction}</span></div>
      ${interruptHintLine}
      ${triviaLine}
      <div class="line"><span>Time penalty</span><span style="color:var(--penalty-red)">-$${timePenalty}</span></div>
      <div class="line"><span>Time</span><span>${timeStr}</span></div>
      <div class="divider"></div>
      <div class="line final"><span>Final Wage</span><span>$${finalWage}</span></div>
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
      <div class="end-buttons">
        <button class="return-store-btn" id="end-back-menu" style="flex:1.4;white-space:nowrap">Back to Store</button>
        <button class="share-btn" id="end-play-again">PLAY AGAIN</button>
      </div>
    `;
  } else {
    // Daily mode: share button + countdown to next 10pm Central
    const msLeft = getNextResetMs();
    const hoursLeft = Math.floor(msLeft / 3600000);
    const minsLeft = Math.floor((msLeft % 3600000) / 60000);
    const countdownText = `Next shift in ${hoursLeft}h ${minsLeft}m`;
    bottomHtml = `
      <div class="end-buttons">
        <button class="return-store-btn" id="end-return-btn" style="flex:1.4;white-space:nowrap">Back to Store</button>
        <button class="share-btn" id="end-share-btn">Share</button>
      </div>
      <div class="countdown" id="end-countdown">${countdownText}</div>
    `;
  }

  // Star rating based on final wage
  const stars = finalWage >= 25 ? 3 : finalWage > 15 ? 2 : 1;
  const starsHtml = Array.from({ length: 3 }, (_, i) =>
    `<span class="end-star ${i < stars ? 'earned' : 'empty'}" style="animation-delay:${0.3 + i * 0.35}s">★</span>`
  ).join('');

  overlay.innerHTML = `
    <div class="end-screen">
      <div class="end-title">${title}</div>
      ${scoreCardHtml}
      <div class="end-stars">${starsHtml}</div>
      ${bottomHtml}
      <div class="end-section-title">ANSWER KEY</div>
      <div class="category-recap">${categoryRowsHtml}</div>
    </div>
  `;

  overlay.classList.add('active');

  if (mode === 'practice') {
    const backBtn = document.getElementById('end-back-menu');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        sessionStorage.setItem('skipToMenu', 'true');
        location.reload();
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

    const returnBtn = document.getElementById('end-return-btn');
    if (returnBtn) {
      returnBtn.addEventListener('click', () => {
        sessionStorage.setItem('skipToMenu', 'true');
        location.reload();
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

// ─── Shift Stats Countdown Button ───────────────────────────────────────────

/**
 * Show a "View Your Shift Stats" button with a 10s countdown progress bar.
 * The button sits in the shelve-button row. Auto-fires after 10s if not clicked.
 * @param {Function} onContinue — called when clicked or countdown finishes
 */
export function showShiftStatsButton(onContinue) {
  const shelveRow = document.querySelector('.hud-shelve-row');
  if (!shelveRow) { onContinue(); return; }

  let done = false;
  function proceed() {
    if (done) return;
    done = true;
    clearInterval(ticker);
    shelveRow.innerHTML = '';
    onContinue();
  }

  shelveRow.innerHTML = `
    <button class="shift-stats-btn" id="shift-stats-btn">
      <span class="shift-stats-label">VIEW YOUR SHIFT STATS</span>
      <div class="shift-stats-progress">
        <div class="shift-stats-bar" id="shift-stats-bar"></div>
      </div>
    </button>
  `;

  // Show HUD bottom so the button is visible
  const hudBottom = document.querySelector('.hud-bottom');
  if (hudBottom) hudBottom.style.opacity = '0';

  document.getElementById('shift-stats-btn').addEventListener('click', proceed);

  // Countdown: 10 seconds, bar shrinks
  const duration = 10000;
  const start = Date.now();
  const bar = document.getElementById('shift-stats-bar');

  const ticker = setInterval(() => {
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, 1 - elapsed / duration);
    if (bar) bar.style.width = `${remaining * 100}%`;
    if (elapsed >= duration) proceed();
  }, 50);
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

/**
 * Show a brief floating message over the game (e.g., "So close, one away!")
 * @param {string} text
 */
export function showGuessMessage(text) {
  const el = document.createElement('div');
  el.className = 'guess-message';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}
