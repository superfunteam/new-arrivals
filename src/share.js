// New Arrivals — Share Image Generation and Text Fallback

// ─── Constants ───────────────────────────────────────────────────────────────

const CANVAS_W = 600;
const CANVAS_H = 800;
const BG_COLOR = '#1A1A2E';
const TITLE_COLOR = '#FF6B9D';
const SCORE_COLOR = '#00E676';
const MUTED_WHITE = 'rgba(255,255,255,0.6)';

const POSTER_W = 100;
const POSTER_H = 150;
const POSTER_GAP = 10;
const POSTERS_PER_ROW = 4;

// Difficulty emoji map for text fallback
const DIFF_EMOJI = { 1: '🟩', 2: '🟨', 3: '🟦', 4: '🟪' };

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

  // ── Poster Grid ─────────────────────────────────────────────────────────────
  // Layout: 4 rows × 4 posters
  // Total poster area width: 4*100 + 3*10 = 430px, centered in 600px → margin 85px
  // Left bar (4px) sits to the left of the poster block, so offset posters by 4+4=8px
  const gridTotalW = POSTERS_PER_ROW * POSTER_W + (POSTERS_PER_ROW - 1) * POSTER_GAP;
  const leftBar = 4;
  const barGap = 4; // gap between bar and first poster column
  const blockW = leftBar + barGap + gridTotalW;
  const gridStartX = Math.round((CANVAS_W - blockW) / 2);
  const posterStartX = gridStartX + leftBar + barGap;

  // Category label height + spacing
  const labelH = 20; // px reserved below each row for category name
  const rowH = POSTER_H + POSTER_GAP + labelH; // row pitch
  const gridStartY = 80;

  const uncoveredIds = posterStates?.uncoveredIds ?? [];
  const solvedMovieIds = new Set(
    solvedCategories.flatMap((cat) => cat.movies.map((m) => m.tmdb_id))
  );

  for (let rowIdx = 0; rowIdx < sortedCategories.length; rowIdx++) {
    const cat = sortedCategories[rowIdx];
    const rowY = gridStartY + rowIdx * rowH;

    // Draw colored left bar
    ctx.fillStyle = cat.color;
    ctx.fillRect(gridStartX, rowY, leftBar, POSTER_H);

    // Draw 4 poster slots
    for (let col = 0; col < POSTERS_PER_ROW; col++) {
      const movie = cat.movies[col];
      const px = posterStartX + col * (POSTER_W + POSTER_GAP);
      const py = rowY;

      if (!movie) {
        // Empty slot — dark rectangle
        ctx.fillStyle = '#2a2a3e';
        ctx.fillRect(px, py, POSTER_W, POSTER_H);
        continue;
      }

      const tmdbId = movie.tmdb_id;
      const isUncovered = uncoveredIds.includes(tmdbId);
      const isSolved = solvedMovieIds.has(tmdbId);
      // Show full poster if the category was solved or the poster was individually uncovered;
      // otherwise show pixelated version.
      const usePixel = !isSolved && !isUncovered;
      const posterSrc = usePixel
        ? `/posters/${tmdbId}_pixel.jpg`
        : `/posters/${tmdbId}.jpg`;

      try {
        const img = await loadImage(posterSrc);
        ctx.drawImage(img, px, py, POSTER_W, POSTER_H);
      } catch (_) {
        // Fallback: dark gray rectangle + truncated title
        ctx.fillStyle = '#333344';
        ctx.fillRect(px, py, POSTER_W, POSTER_H);

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '7px "Space Mono"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const title = movie.title ?? '';
        // Truncate to ~14 chars per line, wrap to 2 lines
        const line1 = title.slice(0, 14);
        const line2 = title.slice(14, 28);
        ctx.fillText(line1, px + POSTER_W / 2, py + POSTER_H / 2 - 8);
        if (line2) ctx.fillText(line2, px + POSTER_W / 2, py + POSTER_H / 2 + 8);
      }
    }

    // Category name below the row
    ctx.fillStyle = cat.color;
    ctx.font = '9px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(cat.name, posterStartX, rowY + POSTER_H + 4);
  }

  // ── Score & Time ─────────────────────────────────────────────────────────────
  const scoreY = gridStartY + sortedCategories.length * rowH + 14;

  ctx.fillStyle = SCORE_COLOR;
  ctx.font = 'bold 20px "Space Mono"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const scoreText = `$${finalWage} / $10`;
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
 * Generate a plain-text share string.
 * @param {Object} result
 * @returns {string}
 */
export function generateTextFallback(result) {
  const { finalWage, timeStr, date, solvedCategories, allCategories } = result;

  const sortedCategories = [...allCategories].sort((a, b) => a.difficulty - b.difficulty);
  const solvedNames = new Set(solvedCategories.map((c) => c.name));

  const dateLabel = formatShareDate(date);
  const lines = [];

  lines.push(`📼 NEW ARRIVALS — ${dateLabel}`);
  lines.push(`💰 $${finalWage} / $10 | ⏱ ${timeStr}`);

  for (const cat of sortedCategories) {
    const emoji = DIFF_EMOJI[cat.difficulty] ?? '⬛';
    const solved = solvedNames.has(cat.name);
    const block = solved ? `${emoji}${emoji}${emoji}${emoji}` : '⬛⬛⬛⬛';
    lines.push(block);
  }

  lines.push('game.vhsgarage.com');

  return lines.join('\n');
}

// ─── Trigger Share ────────────────────────────────────────────────────────────

/**
 * Generate and share/download the result image.
 * @param {Object} result
 */
export async function triggerShare(result) {
  const canvas = await generateShareImage(result);
  const text = generateTextFallback(result);

  // Convert canvas to PNG blob
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const file = new File([blob], 'new-arrivals.png', { type: 'image/png' });

  // Try Web Share API with file
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        text,
      });
      return;
    } catch (err) {
      // User cancelled or share failed — fall through
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

  // Fallback: copy text to clipboard + download PNG
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    // Clipboard unavailable — skip
  }

  // Download the PNG
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'new-arrivals.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
