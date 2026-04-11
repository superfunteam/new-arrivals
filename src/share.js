// New Arrivals — Share Image Generation and Text Fallback

// ─── Constants ───────────────────────────────────────────────────────────────

const CANVAS_W = 600;
const CANVAS_H = 750;
const BG_COLOR = '#1A1A2E';
const TITLE_COLOR = '#FF6B9D';
const SCORE_COLOR = '#00E676';
const MUTED_WHITE = 'rgba(255,255,255,0.6)';

const POSTER_W = 120;
const POSTER_H = 180;
const POSTER_GAP = 10;
const POSTERS_PER_ROW = 4;

// Difficulty emoji map for text fallback
const DIFF_EMOJI = { 1: '🟩', 2: '🟨', 3: '🟦', 4: '🟪' };

// Same seeded shuffle as main.js so we can reconstruct the initial layout
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Load an image from a URL, returning a Promise<HTMLImageElement>.
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Convert an ISO date string like "2026-04-07" to a display string like "Apr 7".
 * @param {string} dateStr  YYYY-MM-DD
 * @returns {string}
 */
export function formatShareDate(dateStr) {
  // Parse as UTC midnight then display in local-ish terms using UTC methods
  // to avoid off-by-one from timezone shifts.
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Core: Generate Share Image ───────────────────────────────────────────────

/**
 * Generate a 600×800 share canvas for the given result.
 * @param {Object} result
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function generateShareImage(result) {
  const { finalWage, timeStr, date, solvedCategories, allCategories, posterStates } = result;

  // Sort categories by difficulty (1→4)
  const sortedCategories = [...allCategories].sort((a, b) => a.difficulty - b.difficulty);

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // ── Wait for fonts ──────────────────────────────────────────────────────────
  await document.fonts.ready;

  // ── Title ───────────────────────────────────────────────────────────────────
  ctx.fillStyle = TITLE_COLOR;
  ctx.font = '18px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('NEW ARRIVALS', CANVAS_W / 2, 24);

  // ── Date ────────────────────────────────────────────────────────────────────
  ctx.fillStyle = MUTED_WHITE;
  ctx.font = '12px "Space Mono"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(formatShareDate(date), CANVAS_W / 2, 52);

  // ── Poster Grid (shuffled order, all pixelated — no spoilers) ────────────────
  const allMovies = allCategories.flatMap(c => c.movies);
  const shuffled = shuffleWithSeed(allMovies, date);

  const gridTotalW = POSTERS_PER_ROW * POSTER_W + (POSTERS_PER_ROW - 1) * POSTER_GAP;
  const gridStartX = Math.round((CANVAS_W - gridTotalW) / 2);
  const rowH = POSTER_H + POSTER_GAP;
  const gridStartY = 75;
  const numRows = Math.ceil(shuffled.length / POSTERS_PER_ROW);

  for (let i = 0; i < shuffled.length; i++) {
    const row = Math.floor(i / POSTERS_PER_ROW);
    const col = i % POSTERS_PER_ROW;
    const px = gridStartX + col * (POSTER_W + POSTER_GAP);
    const py = gridStartY + row * rowH;
    const tmdbId = shuffled[i].tmdb_id;

    try {
      const img = await loadImage(`/posters/${tmdbId}_pixel.jpg`);
      ctx.drawImage(img, px, py, POSTER_W, POSTER_H);
    } catch (_) {
      ctx.fillStyle = '#333344';
      ctx.fillRect(px, py, POSTER_W, POSTER_H);
    }
  }

  // ── Score & Time ─────────────────────────────────────────────────────────────
  const scoreY = gridStartY + numRows * rowH + 10;

  ctx.fillStyle = SCORE_COLOR;
  ctx.font = 'bold 20px "Space Mono"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const scoreText = `$${finalWage} / $25`;
  ctx.fillText(scoreText, CANVAS_W / 2 - 40, scoreY);

  ctx.fillStyle = MUTED_WHITE;
  ctx.font = '14px "Space Mono"';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(timeStr, CANVAS_W / 2 + 40, scoreY + 4);

  // ── URL ─────────────────────────────────────────────────────────────────────
  ctx.fillStyle = MUTED_WHITE;
  ctx.font = '11px "Space Mono"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('game.vhsgarage.com', CANVAS_W / 2, CANVAS_H - 18);

  return canvas;
}

// ─── Text Fallback ────────────────────────────────────────────────────────────

/**
 * Generate a viral emoji share string.
 * Shows solve order, star rating, wage, and wrong guesses.
 * @param {Object} result
 * @returns {string}
 */
export function generateTextFallback(result) {
  const { finalWage, timeStr, date, solvedCategories, allCategories, wrongGuesses = 0 } = result;

  const sortedByDifficulty = [...allCategories].sort((a, b) => a.difficulty - b.difficulty);
  const solvedNames = new Set(solvedCategories.map((c) => c.name));
  const solvedOrder = solvedCategories.map((c) => c.name);

  const dateLabel = formatShareDate(date);
  const stars = finalWage >= 25 ? 3 : finalWage > 15 ? 2 : 1;
  const starStr = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);

  const lines = [];
  lines.push(`📼 NEW ARRIVALS — ${dateLabel}`);
  lines.push('');

  // Emoji grid: rows in solve order, each row is 4 blocks of the category's difficulty color
  // Unsolved categories show as ⬛⬛⬛⬛
  // This reveals the ORDER you solved them in (easy first? hard first?)
  for (const cat of solvedOrder) {
    const catObj = allCategories.find((c) => c.name === cat);
    const emoji = DIFF_EMOJI[catObj?.difficulty] ?? '⬛';
    lines.push(`${emoji}${emoji}${emoji}${emoji}`);
  }
  // Append unsolved categories
  for (const cat of sortedByDifficulty) {
    if (!solvedNames.has(cat.name)) {
      lines.push('⬛⬛⬛⬛');
    }
  }

  lines.push('');
  lines.push(`${starStr}  💰$${finalWage}  ⏱${timeStr}`);

  // Wrong guesses indicator
  if (wrongGuesses === 0) {
    lines.push('🧹 Perfect shift — no mistakes!');
  } else if (wrongGuesses <= 2) {
    lines.push(`📦 ${wrongGuesses} wrong shelf${wrongGuesses > 1 ? 's' : ''}`);
  } else {
    lines.push(`🔥 ${wrongGuesses} wrong shelves`);
  }

  lines.push('');
  lines.push('game.vhsgarage.com');

  return lines.join('\n');
}

// ─── Trigger Share (native share intent) ─────────────────────────────────────

/**
 * Share via native share sheet (image + text).
 * @param {Object} result
 */
export async function triggerShare(result) {
  const canvas = await generateShareImage(result);
  const text = generateTextFallback(result);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const file = new File([blob], 'new-arrivals.png', { type: 'image/png' });

  // Try Web Share API with file
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  // Try Web Share API text-only
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  // Fallback: copy to clipboard
  await copyScoreToClipboard(result);
}

// ─── Copy to Clipboard ───────────────────────────────────────────────────────

/**
 * Copy the emoji share text to clipboard.
 * @param {Object} result
 * @returns {Promise<boolean>} true if copied
 */
export async function copyScoreToClipboard(result) {
  const text = generateTextFallback(result);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    return false;
  }
}
