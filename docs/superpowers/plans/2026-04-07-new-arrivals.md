# New Arrivals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "New Arrivals" — a daily VHS sorting puzzle game (Connections-meets-Blockbuster) in Three.js with Tone.js audio, deployed on Netlify.

**Architecture:** Single-page app with Three.js canvas for 3D VHS boxes on a shelf, vanilla HTML/CSS overlay for UI (HUD, modals, end screen), Tone.js for synthesized audio. Puzzle data from static JSON, posters pre-fetched from TMDB at build time. State in localStorage. Vite for bundling.

**Tech Stack:** Three.js, Tone.js, Vite, sharp (build-time image processing), Canvas API (share image), Netlify (hosting)

**Interaction Model:** Tap to select/deselect tapes (max 4), long-press (500ms) to inspect/lightbox. "Shelve It" submits when 4 are selected. Solved categories animate to rows top-to-bottom by difficulty. Grid compacts as tapes are solved.

---

## File Map

```
new-arrivals/
├── index.html                   # SPA entry, canvas + overlay containers
├── netlify.toml                 # Build config
├── package.json                 # Dependencies: three, tone; devDeps: vite, sharp
├── scripts/
│   └── fetch-posters.js         # Build step: TMDB search → download → pixelate
├── public/
│   ├── puzzles.json             # 5 puzzles, 80 movies, TMDB IDs populated by script
│   └── posters/                 # Generated: {tmdb_id}.jpg + {tmdb_id}_pixel.jpg
├── src/
│   ├── main.js                  # Orchestrator: loads puzzle, inits modules, game loop
│   ├── scene.js                 # Three.js renderer, camera, lighting, shelf mesh
│   ├── vhs-box.js               # VHS box mesh factory, texture swap, visual states
│   ├── animations.js            # Entrance, lock-in, shake, inspect, return animations
│   ├── interaction.js           # Pointer events, raycasting, tap/long-press detection
│   ├── game-logic.js            # Pure functions: checkGuess, useHint, scoring, timer
│   ├── state.js                 # localStorage: save/load game, stats, daily reset
│   ├── ui.js                    # HTML overlay: HUD, onboarding, lightbox, end screen
│   ├── audio.js                 # Tone.js synth definitions, event-based API
│   └── share.js                 # Canvas API share image + text fallback
└── styles/
    └── main.css                 # UI overlay styles, fonts, animations
```

### Module Interfaces

**scene.js** — `createScene(container)` returns `{ scene, camera, renderer, shelfGroup }`. `resizeScene(camera, renderer)` handles window resize.

**vhs-box.js** — `createVHSBox(movie, textures)` returns a Three.js Group with box mesh. `setBoxState(box, state)` changes visual state. `swapTexture(box, fullTexture)` for uncover.

**animations.js** — `animateEntrance(boxes, onComplete)`, `animateLockIn(boxes, rowY, onComplete)`, `animateShake(boxes, onComplete)`, `animateInspect(box, camera, onComplete)`, `animateReturn(box, originalPos, onComplete)`.

**interaction.js** — `setupInteraction(camera, renderer, boxes, callbacks)` where callbacks = `{ onTap, onLongPress, onSelectionChange }`.

**game-logic.js** — Pure functions: `createGame(puzzle)`, `checkGuess(game, movieIds)`, `useHint(game, movieId)`, `getTimePenalty(startTime)`, `calculateFinalWage(game)`, `getElapsedTime(startTime)`, `getAllMovies(puzzle)`.

**state.js** — `loadTodaysPuzzle(puzzlesData)`, `saveGameState(game)`, `loadGameState()`, `updateStats(finalWage)`, `loadStats()`, `isOnboarded()`, `setOnboarded()`.

**ui.js** — `createHUD()`, `updateHUD(game)`, `showOnboarding(onComplete)`, `showLightbox(movie, options)`, `hideLightbox()`, `showEndScreen(result)`, `setShelveButton(active, onClick)`.

**audio.js** — `audio.init()`, `audio.play(eventName)`, `audio.setMuted(bool)`.

**share.js** — `generateShareImage(result, posterStates)` returns Promise\<canvas\>, `triggerShare(result, posterStates)`, `generateTextFallback(result)` returns string.

---

## Dependency Graph

```
Task 1 (Scaffolding) ──┬── Task 2 (Puzzles) ── Task 3 (Posters)
                        ├── Task 4 (Audio)           [parallel with 5]
                        ├── Task 5 (Scene/Shelf) ── Task 6 (VHS Boxes) ── Task 8 (Interaction)
                        └── Task 7 (Game Logic)  ── Task 9 (UI) ── Task 10 (Share)
                                                                         │
                                                            Task 11 (Integration) ← all above
```

Tasks 4 and 5 can run in parallel. Tasks 7 can start after Task 2.

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `styles/main.css`
- Create: `netlify.toml`
- Create: `src/main.js` (stub)

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/clark/Downloads/Source/new-arrivals
npm init -y
```

Then edit `package.json` to set name and scripts:

```json
{
  "name": "new-arrivals",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "fetch-posters": "node scripts/fetch-posters.js"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install three tone
npm install -D vite sharp
```

Expected: `package-lock.json` created, `node_modules/` populated.

- [ ] **Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>New Arrivals</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles/main.css">
</head>
<body>
  <div id="game-container">
    <canvas id="game-canvas"></canvas>
    <div id="scanlines"></div>
    <div id="hud"></div>
    <div id="overlay"></div>
  </div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create styles/main.css**

```css
/* === Reset & Base === */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --shelf-wood: #8B6914;
  --shelf-dark: #5C4411;
  --bg-store: #1A1A2E;
  --neon-pink: #FF6B9D;
  --neon-blue: #00D4FF;
  --crt-green: #39FF14;
  --category-easy: #4CAF50;
  --category-medium: #FFC107;
  --category-hard: #2196F3;
  --category-devious: #9C27B0;
  --wage-green: #00E676;
  --penalty-red: #FF1744;
  --font-display: 'Press Start 2P', monospace;
  --font-body: 'Space Mono', monospace;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg-store);
  font-family: var(--font-body);
  color: #fff;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}

#game-container {
  position: relative;
  width: 100%;
  height: 100%;
}

#game-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

#scanlines {
  pointer-events: none;
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.03) 0px,
    rgba(0, 0, 0, 0.03) 1px,
    transparent 1px,
    transparent 3px
  );
  z-index: 5;
}

#hud {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 10;
}

#hud > * {
  pointer-events: auto;
}

#overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  pointer-events: none;
}

#overlay.active {
  pointer-events: auto;
}

/* === HUD Layout === */
.hud-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px 16px;
}

.hud-logo {
  font-family: var(--font-display);
  font-size: 11px;
  color: var(--neon-pink);
  text-shadow: 0 0 10px rgba(255, 107, 157, 0.5);
  line-height: 1.4;
}

.hud-date {
  display: block;
  font-size: 8px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
}

.hud-wage {
  font-family: var(--font-body);
  font-size: 20px;
  font-weight: 700;
  color: var(--wage-green);
  text-shadow: 0 0 8px rgba(0, 230, 118, 0.4);
  transition: color 0.3s, text-shadow 0.3s;
}

.hud-wage.penalty {
  color: var(--penalty-red);
  text-shadow: 0 0 12px rgba(255, 23, 68, 0.6);
}

.hud-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 12px 16px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}

.hud-hints {
  font-family: var(--font-body);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.hud-hints .hint-count {
  font-size: 18px;
  color: var(--neon-blue);
}

.hud-timer {
  font-family: var(--font-body);
  font-size: 14px;
  color: rgba(255, 255, 255, 0.3);
}

/* === Shelve It Button === */
.shelve-btn {
  font-family: var(--font-display);
  font-size: 12px;
  padding: 14px 28px;
  background: var(--neon-pink);
  color: #fff;
  border: none;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 1px;
  box-shadow: 0 0 20px rgba(255, 107, 157, 0.4), inset 0 -3px 0 rgba(0, 0, 0, 0.2);
  transition: opacity 0.3s, transform 0.1s;
}

.shelve-btn:disabled {
  opacity: 0.3;
  cursor: default;
  box-shadow: none;
}

.shelve-btn:not(:disabled):active {
  transform: scale(0.95);
}

/* === Mute Button === */
.mute-btn {
  position: absolute;
  top: 12px;
  right: 90px;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.5);
  font-size: 16px;
  width: 32px;
  height: 32px;
  cursor: pointer;
  border-radius: 4px;
  z-index: 10;
}

/* === Onboarding Modal === */
.onboarding {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.onboarding-slide {
  display: none;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px;
  max-width: 360px;
}

.onboarding-slide.active {
  display: flex;
}

.onboarding-slide h2 {
  font-family: var(--font-display);
  font-size: 14px;
  color: var(--neon-pink);
  margin-bottom: 16px;
}

.onboarding-slide p {
  font-family: var(--font-body);
  font-size: 13px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 24px;
}

.onboarding-dots {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.onboarding-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
}

.onboarding-dot.active {
  background: var(--neon-pink);
}

.onboarding-btn {
  font-family: var(--font-display);
  font-size: 10px;
  padding: 12px 24px;
  background: var(--neon-pink);
  color: #fff;
  border: none;
  cursor: pointer;
  text-transform: uppercase;
}

.onboarding-anim {
  width: 120px;
  height: 120px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vhs-icon {
  width: 60px;
  height: 90px;
  background: var(--shelf-wood);
  border: 2px solid var(--shelf-dark);
  border-radius: 3px;
  animation: tapeDrop 1s ease-out;
}

@keyframes tapeDrop {
  0% { transform: translateY(-100px) rotate(15deg); opacity: 0; }
  60% { transform: translateY(10px) rotate(-5deg); opacity: 1; }
  100% { transform: translateY(0) rotate(0); opacity: 1; }
}

.dollar-icon {
  font-size: 40px;
  animation: dollarFly 2s ease-in-out infinite;
}

@keyframes dollarFly {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px) rotate(10deg); }
}

/* === Lightbox === */
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 50;
  opacity: 0;
  transition: opacity 0.3s;
}

.lightbox.visible {
  opacity: 1;
}

.lightbox-title {
  font-family: var(--font-display);
  font-size: 12px;
  color: #fff;
  text-align: center;
  margin-top: 20px;
  max-width: 300px;
}

.lightbox-poster {
  width: 200px;
  height: 300px;
  object-fit: cover;
  border: 3px solid var(--shelf-wood);
  image-rendering: pixelated;
}

.lightbox-poster.uncovered {
  image-rendering: auto;
}

.lightbox-buttons {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.lightbox-btn {
  font-family: var(--font-display);
  font-size: 9px;
  padding: 10px 18px;
  border: none;
  cursor: pointer;
  text-transform: uppercase;
}

.lightbox-btn.return {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.lightbox-btn.uncover {
  background: var(--neon-blue);
  color: #000;
}

.lightbox-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

/* === End Screen === */
.end-screen {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 40px 20px;
  overflow-y: auto;
  z-index: 100;
}

.end-title {
  font-family: var(--font-display);
  font-size: 16px;
  color: var(--neon-pink);
  text-shadow: 0 0 20px rgba(255, 107, 157, 0.5);
  margin-bottom: 24px;
}

.score-card {
  font-family: var(--font-body);
  font-size: 13px;
  background: rgba(255, 255, 255, 0.05);
  padding: 16px 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 24px;
  width: 100%;
  max-width: 320px;
}

.score-card .line {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}

.score-card .divider {
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  margin: 8px 0;
}

.score-card .final {
  font-weight: 700;
  color: var(--wage-green);
}

.category-recap {
  width: 100%;
  max-width: 320px;
  margin-bottom: 24px;
}

.category-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 4px;
  border-radius: 4px;
}

.category-row .cat-name {
  font-family: var(--font-display);
  font-size: 8px;
  flex-shrink: 0;
  width: 100%;
}

.category-row .cat-movies {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
}

.share-btn {
  font-family: var(--font-display);
  font-size: 11px;
  padding: 14px 28px;
  background: var(--neon-blue);
  color: #000;
  border: none;
  cursor: pointer;
  text-transform: uppercase;
  margin-bottom: 16px;
}

.countdown {
  font-family: var(--font-body);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

/* === VHS Tracking Distortion Flash === */
.tracking-flash {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 15;
  background: repeating-linear-gradient(
    0deg,
    transparent 0px,
    transparent 2px,
    rgba(255, 255, 255, 0.08) 2px,
    rgba(255, 255, 255, 0.08) 4px
  );
  mix-blend-mode: overlay;
  opacity: 0;
  animation: trackingFlash 0.5s ease-out;
}

@keyframes trackingFlash {
  0% { opacity: 1; transform: translateY(-5px); }
  20% { opacity: 0.8; transform: translateY(3px); }
  40% { opacity: 0.6; transform: translateY(-2px); }
  100% { opacity: 0; transform: translateY(0); }
}

/* === Help Button === */
.help-btn {
  position: absolute;
  top: 12px;
  left: auto;
  right: 56px;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.5);
  font-family: var(--font-display);
  font-size: 12px;
  width: 32px;
  height: 32px;
  cursor: pointer;
  border-radius: 4px;
  z-index: 10;
}

/* === Category Label (shown on solved rows) === */
.category-label {
  position: absolute;
  font-family: var(--font-display);
  font-size: 8px;
  text-transform: uppercase;
  text-align: center;
  width: 100%;
  pointer-events: none;
  text-shadow: 0 0 8px currentColor;
  opacity: 0;
  animation: labelReveal 0.6s ease-out forwards;
}

@keyframes labelReveal {
  0% { opacity: 0; transform: translateY(5px); letter-spacing: 8px; }
  100% { opacity: 1; transform: translateY(0); letter-spacing: 2px; }
}
```

- [ ] **Step 5: Create netlify.toml**

```toml
[build]
  command = "npx vite build"
  publish = "dist"
```

- [ ] **Step 6: Create src/main.js stub**

```js
// New Arrivals — Main Entry Point
// This file will be populated in Task 11 (Integration)

console.log('New Arrivals loading...');
```

- [ ] **Step 7: Verify dev server starts**

```bash
npx vite --open
```

Expected: browser opens to localhost showing dark background, "New Arrivals loading..." in console.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json index.html styles/main.css netlify.toml src/main.js
git commit -m "feat: scaffold project with Vite, Three.js, Tone.js"
```

---

## Task 2: Puzzle Data

**Files:**
- Create: `public/puzzles.json`

- [ ] **Step 1: Create puzzles.json with all 5 puzzles**

All movie titles and years come from the PRD. The `tmdb_id` fields start as `null` — the poster fetch script (Task 3) will populate them via TMDB search.

```json
{
  "puzzles": [
    {
      "id": "2026-04-07",
      "title": "Tuesday Restock",
      "categories": [
        {
          "name": "Arnold's Greatest Hits",
          "difficulty": 1,
          "color": "#4CAF50",
          "movies": [
            { "title": "Total Recall", "year": 1990, "tmdb_id": null },
            { "title": "Commando", "year": 1985, "tmdb_id": null },
            { "title": "Predator", "year": 1987, "tmdb_id": null },
            { "title": "The Running Man", "year": 1987, "tmdb_id": null }
          ]
        },
        {
          "name": "Brat Pack Roll Call",
          "difficulty": 2,
          "color": "#FFC107",
          "movies": [
            { "title": "The Breakfast Club", "year": 1985, "tmdb_id": null },
            { "title": "St. Elmo's Fire", "year": 1985, "tmdb_id": null },
            { "title": "Pretty in Pink", "year": 1986, "tmdb_id": null },
            { "title": "About Last Night", "year": 1986, "tmdb_id": null }
          ]
        },
        {
          "name": "Directed by a Woman",
          "difficulty": 3,
          "color": "#2196F3",
          "movies": [
            { "title": "Wayne's World", "year": 1992, "tmdb_id": null },
            { "title": "Big", "year": 1988, "tmdb_id": null },
            { "title": "Pet Sematary", "year": 1989, "tmdb_id": null },
            { "title": "Near Dark", "year": 1987, "tmdb_id": null }
          ]
        },
        {
          "name": "The Villain is a Computer",
          "difficulty": 4,
          "color": "#9C27B0",
          "movies": [
            { "title": "WarGames", "year": 1983, "tmdb_id": null },
            { "title": "2001: A Space Odyssey", "year": 1968, "tmdb_id": null },
            { "title": "Demon Seed", "year": 1977, "tmdb_id": null },
            { "title": "Colossus: The Forbin Project", "year": 1970, "tmdb_id": null }
          ]
        }
      ]
    },
    {
      "id": "2026-04-08",
      "title": "Friday Night Rush",
      "categories": [
        {
          "name": "John Hughes Wrote It",
          "difficulty": 1,
          "color": "#4CAF50",
          "movies": [
            { "title": "Ferris Bueller's Day Off", "year": 1986, "tmdb_id": null },
            { "title": "Sixteen Candles", "year": 1984, "tmdb_id": null },
            { "title": "Weird Science", "year": 1985, "tmdb_id": null },
            { "title": "Planes, Trains and Automobiles", "year": 1987, "tmdb_id": null }
          ]
        },
        {
          "name": "Sequel is Better Than the Original",
          "difficulty": 2,
          "color": "#FFC107",
          "movies": [
            { "title": "Aliens", "year": 1986, "tmdb_id": null },
            { "title": "The Empire Strikes Back", "year": 1980, "tmdb_id": null },
            { "title": "The Road Warrior", "year": 1981, "tmdb_id": null },
            { "title": "Star Trek II: The Wrath of Khan", "year": 1982, "tmdb_id": null }
          ]
        },
        {
          "name": "Set Entirely in One Building",
          "difficulty": 3,
          "color": "#2196F3",
          "movies": [
            { "title": "Die Hard", "year": 1988, "tmdb_id": null },
            { "title": "The Shining", "year": 1980, "tmdb_id": null },
            { "title": "Clue", "year": 1985, "tmdb_id": null },
            { "title": "Cube", "year": 1997, "tmdb_id": null }
          ]
        },
        {
          "name": "Title is a Character's First Name Only",
          "difficulty": 4,
          "color": "#9C27B0",
          "movies": [
            { "title": "Heathers", "year": 1988, "tmdb_id": null },
            { "title": "Beetlejuice", "year": 1988, "tmdb_id": null },
            { "title": "Amadeus", "year": 1984, "tmdb_id": null },
            { "title": "Rocky", "year": 1976, "tmdb_id": null }
          ]
        }
      ]
    },
    {
      "id": "2026-04-09",
      "title": "Slow Wednesday",
      "categories": [
        {
          "name": "Eddie Murphy Leads",
          "difficulty": 1,
          "color": "#4CAF50",
          "movies": [
            { "title": "Beverly Hills Cop", "year": 1984, "tmdb_id": null },
            { "title": "Coming to America", "year": 1988, "tmdb_id": null },
            { "title": "Trading Places", "year": 1983, "tmdb_id": null },
            { "title": "48 Hrs.", "year": 1982, "tmdb_id": null }
          ]
        },
        {
          "name": "Based on a Stephen King Book",
          "difficulty": 2,
          "color": "#FFC107",
          "movies": [
            { "title": "Stand by Me", "year": 1986, "tmdb_id": null },
            { "title": "The Shawshank Redemption", "year": 1994, "tmdb_id": null },
            { "title": "Misery", "year": 1990, "tmdb_id": null },
            { "title": "Christine", "year": 1983, "tmdb_id": null }
          ]
        },
        {
          "name": "Has a Scene at a Prom or School Dance",
          "difficulty": 3,
          "color": "#2196F3",
          "movies": [
            { "title": "Carrie", "year": 1976, "tmdb_id": null },
            { "title": "Back to the Future", "year": 1985, "tmdb_id": null },
            { "title": "Footloose", "year": 1984, "tmdb_id": null },
            { "title": "Never Been Kissed", "year": 1999, "tmdb_id": null }
          ]
        },
        {
          "name": "John Candy Has a Cameo or Small Role",
          "difficulty": 4,
          "color": "#9C27B0",
          "movies": [
            { "title": "Home Alone", "year": 1990, "tmdb_id": null },
            { "title": "The Blues Brothers", "year": 1980, "tmdb_id": null },
            { "title": "It Came from Hollywood", "year": 1982, "tmdb_id": null },
            { "title": "The Silent Partner", "year": 1978, "tmdb_id": null }
          ]
        }
      ]
    },
    {
      "id": "2026-04-10",
      "title": "New Release Wall",
      "categories": [
        {
          "name": "Spielberg Directed",
          "difficulty": 1,
          "color": "#4CAF50",
          "movies": [
            { "title": "Raiders of the Lost Ark", "year": 1981, "tmdb_id": null },
            { "title": "E.T. the Extra-Terrestrial", "year": 1982, "tmdb_id": null },
            { "title": "Jaws", "year": 1975, "tmdb_id": null },
            { "title": "Jurassic Park", "year": 1993, "tmdb_id": null }
          ]
        },
        {
          "name": "The Movie Poster Has a Spaceship",
          "difficulty": 2,
          "color": "#FFC107",
          "movies": [
            { "title": "Star Wars", "year": 1977, "tmdb_id": null },
            { "title": "Alien", "year": 1979, "tmdb_id": null },
            { "title": "Flight of the Navigator", "year": 1986, "tmdb_id": null },
            { "title": "The Last Starfighter", "year": 1984, "tmdb_id": null }
          ]
        },
        {
          "name": "Actor Also Directed This Film",
          "difficulty": 3,
          "color": "#2196F3",
          "movies": [
            { "title": "Reds", "year": 1981, "tmdb_id": null },
            { "title": "Dances with Wolves", "year": 1990, "tmdb_id": null },
            { "title": "Yentl", "year": 1983, "tmdb_id": null },
            { "title": "A Bronx Tale", "year": 1993, "tmdb_id": null }
          ]
        },
        {
          "name": "Banned in at Least One Country on VHS Release",
          "difficulty": 4,
          "color": "#9C27B0",
          "movies": [
            { "title": "A Clockwork Orange", "year": 1971, "tmdb_id": null },
            { "title": "The Texas Chain Saw Massacre", "year": 1974, "tmdb_id": null },
            { "title": "Cannibal Holocaust", "year": 1980, "tmdb_id": null },
            { "title": "Faces of Death", "year": 1978, "tmdb_id": null }
          ]
        }
      ]
    },
    {
      "id": "2026-04-11",
      "title": "Saturday Morning Shift",
      "categories": [
        {
          "name": "Animated Disney",
          "difficulty": 1,
          "color": "#4CAF50",
          "movies": [
            { "title": "The Little Mermaid", "year": 1989, "tmdb_id": null },
            { "title": "Aladdin", "year": 1992, "tmdb_id": null },
            { "title": "The Lion King", "year": 1994, "tmdb_id": null },
            { "title": "Beauty and the Beast", "year": 1991, "tmdb_id": null }
          ]
        },
        {
          "name": "Bill Murray Comedies",
          "difficulty": 2,
          "color": "#FFC107",
          "movies": [
            { "title": "Ghostbusters", "year": 1984, "tmdb_id": null },
            { "title": "Caddyshack", "year": 1980, "tmdb_id": null },
            { "title": "Stripes", "year": 1981, "tmdb_id": null },
            { "title": "Groundhog Day", "year": 1993, "tmdb_id": null }
          ]
        },
        {
          "name": "Remake of a Foreign Film",
          "difficulty": 3,
          "color": "#2196F3",
          "movies": [
            { "title": "The Magnificent Seven", "year": 1960, "tmdb_id": null },
            { "title": "Scarface", "year": 1983, "tmdb_id": null },
            { "title": "Three Men and a Baby", "year": 1987, "tmdb_id": null },
            { "title": "The Birdcage", "year": 1996, "tmdb_id": null }
          ]
        },
        {
          "name": "The Lead Actor Wears a Wig in Every Scene",
          "difficulty": 4,
          "color": "#9C27B0",
          "movies": [
            { "title": "Grease", "year": 1978, "tmdb_id": null },
            { "title": "Tootsie", "year": 1982, "tmdb_id": null },
            { "title": "The Witches of Eastwick", "year": 1987, "tmdb_id": null },
            { "title": "Edward Scissorhands", "year": 1990, "tmdb_id": null }
          ]
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add public/puzzles.json
git commit -m "feat: add 5 starter puzzles with movie data"
```

---

## Task 3: Poster Pipeline

**Files:**
- Create: `scripts/fetch-posters.js`

**Depends on:** Task 2 (puzzles.json)

- [ ] **Step 1: Create fetch-posters.js**

This script reads puzzles.json, searches TMDB for each movie to get the tmdb_id (if not already set), downloads the poster, and generates a pixelated version. It updates puzzles.json with resolved tmdb_ids.

```js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUZZLES_PATH = path.join(ROOT, 'public', 'puzzles.json');
const POSTERS_DIR = path.join(ROOT, 'public', 'posters');

const TOKEN = process.env.TMDB_READ_ACCESS_TOKEN;
const API_KEY = process.env.TMDB_API_KEY;

if (!TOKEN && !API_KEY) {
  console.error('Set TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY in .env');
  process.exit(1);
}

function headers() {
  if (TOKEN) return { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
  return { 'Content-Type': 'application/json' };
}

function apiUrl(endpoint) {
  const base = `https://api.themoviedb.org/3${endpoint}`;
  return API_KEY && !TOKEN ? `${base}${base.includes('?') ? '&' : '?'}api_key=${API_KEY}` : base;
}

async function searchMovie(title, year) {
  const url = apiUrl(`/search/movie?query=${encodeURIComponent(title)}&year=${year}`);
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`TMDB search failed for "${title}": ${res.status}`);
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    // Retry without year filter
    const url2 = apiUrl(`/search/movie?query=${encodeURIComponent(title)}`);
    const res2 = await fetch(url2, { headers: headers() });
    const data2 = await res2.json();
    if (!data2.results || data2.results.length === 0) {
      console.warn(`  WARNING: No results for "${title}" (${year})`);
      return null;
    }
    return data2.results[0];
  }
  return data.results[0];
}

async function downloadPoster(posterPath, outputPath) {
  const url = `https://image.tmdb.org/t/p/w500${posterPath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download poster: ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
}

async function createPixelated(inputPath, outputPath) {
  // Downscale to tiny, then upscale with nearest-neighbor for chunky pixel look
  const metadata = await sharp(inputPath).metadata();
  const targetW = 320;
  const targetH = Math.round(targetW * (metadata.height / metadata.width));

  await sharp(inputPath)
    .resize(24, 36, { fit: 'fill', kernel: 'nearest' })
    .resize(targetW, targetH, { fit: 'fill', kernel: 'nearest' })
    .jpeg({ quality: 80 })
    .toFile(outputPath);
}

async function main() {
  // Load .env manually
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
      }
    }
  }

  fs.mkdirSync(POSTERS_DIR, { recursive: true });

  const puzzlesData = JSON.parse(fs.readFileSync(PUZZLES_PATH, 'utf-8'));
  let updated = false;

  // Collect all unique movies
  const movies = [];
  const seen = new Set();

  for (const puzzle of puzzlesData.puzzles) {
    for (const cat of puzzle.categories) {
      for (const movie of cat.movies) {
        const key = `${movie.title}|${movie.year}`;
        if (!seen.has(key)) {
          seen.add(key);
          movies.push(movie);
        }
      }
    }
  }

  console.log(`Processing ${movies.length} unique movies...\n`);

  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i];
    console.log(`[${i + 1}/${movies.length}] ${movie.title} (${movie.year})`);

    // Resolve tmdb_id if missing
    if (!movie.tmdb_id) {
      const result = await searchMovie(movie.title, movie.year);
      if (!result) continue;
      movie.tmdb_id = result.id;
      // Update all references in puzzlesData
      for (const puzzle of puzzlesData.puzzles) {
        for (const cat of puzzle.categories) {
          for (const m of cat.movies) {
            if (m.title === movie.title && m.year === movie.year) {
              m.tmdb_id = result.id;
            }
          }
        }
      }
      updated = true;

      if (!result.poster_path) {
        console.warn(`  No poster available`);
        continue;
      }

      // Download full-res
      const fullPath = path.join(POSTERS_DIR, `${result.id}.jpg`);
      if (!fs.existsSync(fullPath)) {
        await downloadPoster(result.poster_path, fullPath);
        console.log(`  Downloaded poster`);
      } else {
        console.log(`  Poster already exists`);
      }

      // Create pixelated
      const pixelPath = path.join(POSTERS_DIR, `${result.id}_pixel.jpg`);
      if (!fs.existsSync(pixelPath)) {
        await createPixelated(fullPath, pixelPath);
        console.log(`  Created pixelated version`);
      }
    } else {
      // tmdb_id already set, just check if poster files exist
      const fullPath = path.join(POSTERS_DIR, `${movie.tmdb_id}.jpg`);
      const pixelPath = path.join(POSTERS_DIR, `${movie.tmdb_id}_pixel.jpg`);

      if (!fs.existsSync(fullPath)) {
        // Need to fetch poster_path from TMDB
        const url = apiUrl(`/movie/${movie.tmdb_id}`);
        const res = await fetch(url, { headers: headers() });
        const data = await res.json();
        if (data.poster_path) {
          await downloadPoster(data.poster_path, fullPath);
          console.log(`  Downloaded poster`);
        }
      } else {
        console.log(`  Poster already exists`);
      }

      if (fs.existsSync(fullPath) && !fs.existsSync(pixelPath)) {
        await createPixelated(fullPath, pixelPath);
        console.log(`  Created pixelated version`);
      }
    }

    // Rate limit: TMDB allows ~40 requests per 10 seconds
    await new Promise(r => setTimeout(r, 250));
  }

  // Write updated puzzles.json with tmdb_ids
  if (updated) {
    fs.writeFileSync(PUZZLES_PATH, JSON.stringify(puzzlesData, null, 2) + '\n');
    console.log('\nUpdated puzzles.json with TMDB IDs');
  }

  console.log('\nDone!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the fetch-posters script**

Note: the script reads `.env` itself, so no `dotenv` package needed.

```bash
cd /Users/clark/Downloads/Source/new-arrivals
node scripts/fetch-posters.js
```

Expected output: 80 movies processed (some shared across puzzles = fewer unique), posters downloaded to `public/posters/`, `puzzles.json` updated with tmdb_ids. Verify:

```bash
ls public/posters/ | head -20
cat public/puzzles.json | grep tmdb_id | head -5
```

Should show `.jpg` files and non-null tmdb_ids.

- [ ] **Step 3: Fix any missing posters**

If any movies failed to resolve (check console warnings), manually search TMDB and add the tmdb_id to puzzles.json, then re-run the script. The script is idempotent — it skips already-downloaded posters.

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch-posters.js public/puzzles.json
git commit -m "feat: add TMDB poster pipeline, populate puzzle IDs"
```

Note: `public/posters/` is gitignored — posters are generated locally.

---

## Task 4: Audio System

**Files:**
- Create: `src/audio.js`

**Depends on:** Task 1 (package.json with tone installed)

- [ ] **Step 1: Create src/audio.js**

```js
import * as Tone from 'tone';

let initialized = false;
let muted = false;

const masterGain = new Tone.Gain(0.6).toDestination();
const reverb = new Tone.Reverb({ decay: 1.2, wet: 0.25 }).connect(masterGain);

function synth(options) {
  return new Tone.Synth(options).connect(masterGain);
}

const sounds = {
  tapeLand() {
    const s = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 3,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
    }).connect(reverb);
    const pitch = 55 + Math.random() * 20;
    s.triggerAttackRelease(pitch, '8n');
    setTimeout(() => s.dispose(), 1000);
  },

  tapInspect() {
    const s = synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.05 },
    });
    s.triggerAttackRelease('C5', '32n');
    s.frequency.rampTo('G5', 0.08);
    setTimeout(() => s.dispose(), 500);
  },

  returnToShelf() {
    const s = synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.1 },
    });
    s.triggerAttackRelease('E4', '16n');
    s.frequency.rampTo('C3', 0.12);
    setTimeout(() => s.dispose(), 500);
  },

  dragStart() {
    const noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.01 },
    }).connect(masterGain);
    noise.triggerAttackRelease('32n');
    setTimeout(() => noise.dispose(), 200);
  },

  dropInPlace() {
    const noise = new Tone.NoiseSynth({
      noise: { type: 'brown' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    }).connect(reverb);
    noise.triggerAttackRelease('16n');
    const click = synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
    });
    click.triggerAttackRelease('A3', '32n');
    setTimeout(() => { noise.dispose(); click.dispose(); }, 500);
  },

  correct() {
    const notes = ['C4', 'E4', 'G4', 'C5'];
    notes.forEach((note, i) => {
      setTimeout(() => {
        const s = synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 0.3 },
        });
        s.triggerAttackRelease(note, '8n');
        setTimeout(() => s.dispose(), 1000);
      }, i * 150);
    });
  },

  wrong() {
    const s1 = synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.1 },
    });
    const s2 = synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.1 },
    });
    s1.triggerAttackRelease('A2', '8n');
    s2.triggerAttackRelease('Bb2', '8n');
    const crackle = new Tone.NoiseSynth({
      noise: { type: 'brown' },
      envelope: { attack: 0.01, decay: 0.25, sustain: 0, release: 0.1 },
    }).connect(masterGain);
    crackle.triggerAttackRelease('8n');
    setTimeout(() => { s1.dispose(); s2.dispose(); crackle.dispose(); }, 1000);
  },

  uncover() {
    const noise = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.1, decay: 0.4, sustain: 0.1, release: 0.2 },
    }).connect(masterGain);
    noise.triggerAttackRelease('4n');
    setTimeout(() => {
      const ding = synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.3 },
      });
      ding.triggerAttackRelease('E5', '8n');
      setTimeout(() => ding.dispose(), 1000);
    }, 500);
    setTimeout(() => noise.dispose(), 1500);
  },

  penalty() {
    const s = synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 },
    });
    s.triggerAttackRelease('G4', '16n');
    s.frequency.rampTo('C3', 0.15);
    setTimeout(() => s.dispose(), 500);
  },

  gameWin() {
    const chord = ['C4', 'E4', 'G4', 'C5'];
    const synths = chord.map(note => {
      const s = synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.3, decay: 1.0, sustain: 0.3, release: 0.8 },
      });
      s.triggerAttackRelease(note, '2n');
      return s;
    });
    setTimeout(() => synths.forEach(s => s.dispose()), 4000);
  },

  gameLoss() {
    const s = synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.05, decay: 1.5, sustain: 0, release: 0.5 },
    });
    s.triggerAttackRelease('C4', '2n');
    s.frequency.rampTo('C1', 1.5);
    const noise = new Tone.NoiseSynth({
      noise: { type: 'brown' },
      envelope: { attack: 0.1, decay: 1.5, sustain: 0, release: 0.3 },
    }).connect(masterGain);
    noise.triggerAttackRelease('2n');
    setTimeout(() => { s.dispose(); noise.dispose(); }, 3000);
  },

  share() {
    const click = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
    }).connect(masterGain);
    click.triggerAttackRelease('32n');
    setTimeout(() => {
      const whir = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.02, decay: 0.15, sustain: 0, release: 0.05 },
      }).connect(masterGain);
      whir.triggerAttackRelease('8n');
      setTimeout(() => whir.dispose(), 500);
    }, 50);
    setTimeout(() => click.dispose(), 200);
  },
};

export const audio = {
  async init() {
    if (initialized) return;
    await Tone.start();
    initialized = true;
  },

  play(event) {
    if (!initialized || muted) return;
    if (sounds[event]) {
      try { sounds[event](); } catch (e) { console.warn('Audio error:', e); }
    }
  },

  setMuted(value) {
    muted = value;
  },

  isMuted() {
    return muted;
  },
};
```

- [ ] **Step 2: Verify audio loads without errors**

In `src/main.js`, temporarily add:

```js
import { audio } from './audio.js';
document.addEventListener('click', async () => {
  await audio.init();
  audio.play('tapInspect');
}, { once: true });
console.log('Audio module loaded');
```

Run `npx vite`, open browser, click anywhere. Should hear a short upward zip sound. Check console for no errors.

- [ ] **Step 3: Revert main.js to stub, commit**

Restore `src/main.js` to:
```js
// New Arrivals — Main Entry Point
console.log('New Arrivals loading...');
```

```bash
git add src/audio.js src/main.js
git commit -m "feat: add Tone.js audio system with all game sounds"
```

---

## Task 5: Three.js Scene & Shelf

**Files:**
- Create: `src/scene.js`

**Depends on:** Task 1

- [ ] **Step 1: Create src/scene.js**

```js
import * as THREE from 'three';

const SHELF_COLOR = 0x8B6914;
const SHELF_DARK = 0x5C4411;
const BG_COLOR = 0x1A1A2E;

export function createScene(canvas) {
  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(BG_COLOR);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Scene
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG_COLOR, 15, 25);

  // Camera — perspective, fixed position
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 50);
  // Positioned to see the full shelf in portrait or landscape
  camera.position.set(0, 0.5, 9);
  camera.lookAt(0, 0, 0);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.4);
  scene.add(ambientLight);

  // Overhead fluorescent (warm white, slight offset for drama)
  const mainLight = new THREE.DirectionalLight(0xfff0d4, 0.8);
  mainLight.position.set(0, 6, 4);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.set(1024, 1024);
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 20;
  mainLight.shadow.camera.left = -5;
  mainLight.shadow.camera.right = 5;
  mainLight.shadow.camera.top = 5;
  mainLight.shadow.camera.bottom = -5;
  scene.add(mainLight);

  // Subtle fill from below (bounce light from shelf)
  const fillLight = new THREE.PointLight(0xffcc88, 0.2, 10);
  fillLight.position.set(0, -2, 3);
  scene.add(fillLight);

  // Neon "OPEN" sign glow (upper right corner)
  const neonLight = new THREE.PointLight(0xFF6B9D, 0.3, 8);
  neonLight.position.set(3.5, 3.5, 1);
  scene.add(neonLight);

  // Build shelf
  const shelfGroup = buildShelf();
  scene.add(shelfGroup);

  // Back wall
  const wallGeo = new THREE.PlaneGeometry(20, 15);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x12121f, roughness: 0.9 });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(0, 0, -1.5);
  wall.receiveShadow = true;
  scene.add(wall);

  // Floor hint (dark, barely visible)
  const floorGeo = new THREE.PlaneGeometry(20, 10);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0a0a15, roughness: 1 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -4.5, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  return { scene, camera, renderer, shelfGroup };
}

function buildShelf() {
  const group = new THREE.Group();
  const woodMaterial = new THREE.MeshStandardMaterial({
    color: SHELF_COLOR,
    roughness: 0.8,
    metalness: 0.05,
  });
  const darkWoodMaterial = new THREE.MeshStandardMaterial({
    color: SHELF_DARK,
    roughness: 0.85,
    metalness: 0.05,
  });

  // Shelf dimensions
  const shelfWidth = 4.2;
  const plankThickness = 0.08;
  const plankDepth = 0.8;
  const sideThickness = 0.1;
  const numRows = 4;
  const rowSpacing = 1.35;
  const bottomY = -2.2;

  // Horizontal planks (5 planks: one below each row + one on top)
  for (let i = 0; i <= numRows; i++) {
    const y = bottomY + i * rowSpacing;
    const plankGeo = new THREE.BoxGeometry(shelfWidth, plankThickness, plankDepth);
    const plank = new THREE.Mesh(plankGeo, woodMaterial);
    plank.position.set(0, y, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  }

  // Side panels
  const sideHeight = numRows * rowSpacing + plankThickness;
  const sideGeo = new THREE.BoxGeometry(sideThickness, sideHeight, plankDepth);
  const leftSide = new THREE.Mesh(sideGeo, darkWoodMaterial);
  leftSide.position.set(-shelfWidth / 2, bottomY + sideHeight / 2, 0);
  leftSide.castShadow = true;
  group.add(leftSide);

  const rightSide = new THREE.Mesh(sideGeo, darkWoodMaterial);
  rightSide.position.set(shelfWidth / 2, bottomY + sideHeight / 2, 0);
  rightSide.castShadow = true;
  group.add(rightSide);

  // Store shelf row Y positions as userData for interaction system
  group.userData.rowPositions = [];
  for (let i = 0; i < numRows; i++) {
    group.userData.rowPositions.push(bottomY + i * rowSpacing + plankThickness / 2 + 0.55);
  }
  group.userData.shelfWidth = shelfWidth;
  group.userData.rowSpacing = rowSpacing;

  return group;
}

export function resizeScene(camera, renderer) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// Returns the Y positions of the 4 shelf rows (bottom to top)
export function getRowPositions(shelfGroup) {
  return shelfGroup.userData.rowPositions;
}

export function getShelfWidth(shelfGroup) {
  return shelfGroup.userData.shelfWidth;
}
```

- [ ] **Step 2: Test the scene renders**

Temporarily update `src/main.js`:

```js
import { createScene, resizeScene } from './scene.js';

const canvas = document.getElementById('game-canvas');
const { scene, camera, renderer } = createScene(canvas);

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => resizeScene(camera, renderer));
```

Run `npx vite`. Expected: brown wooden shelf unit on dark background, warm lighting, subtle neon pink glow in upper right.

- [ ] **Step 3: Revert main.js to stub, commit**

```js
// New Arrivals — Main Entry Point
console.log('New Arrivals loading...');
```

```bash
git add src/scene.js src/main.js
git commit -m "feat: add Three.js scene with shelf geometry and lighting"
```

---

## Task 6: VHS Boxes & Animations

**Files:**
- Create: `src/vhs-box.js`
- Create: `src/animations.js`

**Depends on:** Task 5 (scene.js)

- [ ] **Step 1: Create src/vhs-box.js**

```js
import * as THREE from 'three';

// VHS clamshell proportions: width × height × depth
const BOX_W = 0.55;
const BOX_H = 0.85;
const BOX_D = 0.18;

const textureLoader = new THREE.TextureLoader();

// Cache loaded textures
const textureCache = new Map();

export function loadTexture(url) {
  if (textureCache.has(url)) return Promise.resolve(textureCache.get(url));
  return new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (tex) => { textureCache.set(url, tex); resolve(tex); },
      undefined,
      reject
    );
  });
}

export function preloadTextures(urls) {
  return Promise.all(urls.map(url => loadTexture(url).catch(() => null)));
}

export function createVHSBox(movie, pixelatedTexture) {
  const group = new THREE.Group();
  group.userData = {
    movie,
    state: 'default',      // default | selected | locked | grayed
    uncovered: false,
    originalPosition: null, // set after placement
    selected: false,
  };

  // Box geometry
  const boxGeo = new THREE.BoxGeometry(BOX_W, BOX_H, BOX_D);

  // Materials: 6 faces [+x, -x, +y, -y, +z (front), -z (back)]
  const sideMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.7,
  });
  const spineMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.6,
  });
  const topBottomMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.8,
  });

  // Front face: poster texture
  const frontMat = new THREE.MeshStandardMaterial({
    map: pixelatedTexture,
    roughness: 0.5,
  });
  // Back face
  const backMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.7,
  });

  const materials = [
    spineMat,     // right (+x)
    sideMat,      // left (-x)
    topBottomMat, // top (+y)
    topBottomMat, // bottom (-y)
    frontMat,     // front (+z) — poster faces the camera
    backMat,      // back (-z)
  ];

  const box = new THREE.Mesh(boxGeo, materials);
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);

  // Store reference to front material for texture swapping
  group.userData.frontMaterial = frontMat;
  group.userData.spineMaterial = spineMat;
  group.userData.boxMesh = box;

  return group;
}

export function setBoxState(box, state) {
  box.userData.state = state;
  const mesh = box.userData.boxMesh;

  switch (state) {
    case 'selected':
      box.userData.selected = true;
      // Lift slightly toward camera, add emissive outline
      box.position.z = (box.userData.originalPosition?.z ?? 0) + 0.25;
      mesh.material[4].emissive = new THREE.Color(0x00D4FF);
      mesh.material[4].emissiveIntensity = 0.15;
      break;

    case 'default':
      box.userData.selected = false;
      if (box.userData.originalPosition) {
        box.position.z = box.userData.originalPosition.z;
      }
      mesh.material[4].emissive = new THREE.Color(0x000000);
      mesh.material[4].emissiveIntensity = 0;
      break;

    case 'locked':
      box.userData.selected = false;
      mesh.material[4].emissive = new THREE.Color(0x000000);
      mesh.material[4].emissiveIntensity = 0;
      break;

    case 'grayed':
      box.userData.selected = false;
      mesh.material.forEach(mat => {
        mat.color = new THREE.Color(0x333333);
      });
      mesh.material[4].emissive = new THREE.Color(0x000000);
      break;
  }
}

export function setSpineColor(box, hexColor) {
  box.userData.spineMaterial.color = new THREE.Color(hexColor);
  box.userData.spineMaterial.emissive = new THREE.Color(hexColor);
  box.userData.spineMaterial.emissiveIntensity = 0.3;
}

export function swapToFullTexture(box, fullTexture) {
  box.userData.uncovered = true;
  box.userData.frontMaterial.map = fullTexture;
  box.userData.frontMaterial.needsUpdate = true;
  // Add subtle golden glow
  box.userData.frontMaterial.emissive = new THREE.Color(0xFFD700);
  box.userData.frontMaterial.emissiveIntensity = 0.08;
}

export function getBoxDimensions() {
  return { width: BOX_W, height: BOX_H, depth: BOX_D };
}

// Position 16 boxes in a 4×4 grid on the shelf
export function layoutBoxes(boxes, shelfGroup) {
  const rowPositions = shelfGroup.userData.rowPositions;
  const shelfW = shelfGroup.userData.shelfWidth;
  const { width } = getBoxDimensions();

  const cols = 4;
  const gap = 0.12;
  const totalRowWidth = cols * width + (cols - 1) * gap;
  const startX = -totalRowWidth / 2 + width / 2;

  boxes.forEach((box, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = startX + col * (width + gap);
    const y = rowPositions[row];
    const z = 0.15; // slightly forward of shelf back

    box.position.set(x, y, z);
    box.userData.originalPosition = { x, y, z };
    box.userData.gridIndex = i;
    box.userData.gridRow = row;
    box.userData.gridCol = col;
  });
}

// Reflow remaining unsolved boxes into available rows after a solve
export function reflowBoxes(unsolvedBoxes, shelfGroup, solvedRowCount) {
  const rowPositions = shelfGroup.userData.rowPositions;
  const { width } = getBoxDimensions();

  const availableRows = rowPositions.slice(solvedRowCount);
  const cols = 4;
  const gap = 0.12;
  const totalRowWidth = cols * width + (cols - 1) * gap;
  const startX = -totalRowWidth / 2 + width / 2;

  unsolvedBoxes.forEach((box, i) => {
    const rowIdx = Math.floor(i / cols);
    const col = i % cols;
    if (rowIdx >= availableRows.length) return;

    const x = startX + col * (width + gap);
    const y = availableRows[rowIdx];
    const z = 0.15;

    box.userData.originalPosition = { x, y, z };
    box.userData.gridRow = rowIdx + solvedRowCount;
    box.userData.gridCol = col;
  });
}
```

- [ ] **Step 2: Create src/animations.js**

```js
import * as THREE from 'three';

// Active animations for the update loop
const activeAnimations = [];

export function updateAnimations(deltaTime) {
  for (let i = activeAnimations.length - 1; i >= 0; i--) {
    const anim = activeAnimations[i];
    anim.elapsed += deltaTime;
    const t = Math.min(anim.elapsed / anim.duration, 1);
    anim.update(t);
    if (t >= 1) {
      if (anim.onComplete) anim.onComplete();
      activeAnimations.splice(i, 1);
    }
  }
}

function addAnimation(duration, update, onComplete) {
  activeAnimations.push({ elapsed: 0, duration, update, onComplete });
}

// Easing functions
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutBounce(t) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Entrance: boxes spin in from above and land in grid
export function animateEntrance(boxes, onComplete) {
  let completed = 0;
  const total = boxes.length;

  boxes.forEach((box, i) => {
    const target = box.userData.originalPosition;
    const delay = i * 0.06; // stagger
    const startY = target.y + 6 + Math.random() * 2;
    const startX = target.x + (Math.random() - 0.5) * 3;
    const startRotY = (Math.random() - 0.5) * Math.PI * 2;
    const startRotX = (Math.random() - 0.5) * Math.PI;

    box.position.set(startX, startY, target.z);
    box.rotation.set(startRotX, startRotY, 0);

    setTimeout(() => {
      addAnimation(0.6, (t) => {
        const e = easeOutBounce(t);
        box.position.x = startX + (target.x - startX) * e;
        box.position.y = startY + (target.y - startY) * e;
        box.rotation.x = startRotX * (1 - e);
        box.rotation.y = startRotY * (1 - e);
      }, () => {
        box.position.set(target.x, target.y, target.z);
        box.rotation.set(0, 0, 0);
        completed++;
        if (completed === total && onComplete) onComplete();
      });
    }, delay * 1000);
  });
}

// Lock-in: 4 boxes slide into a solved row position
export function animateLockIn(boxes, targetY, targetPositions, onComplete) {
  let completed = 0;

  boxes.forEach((box, i) => {
    const startPos = box.position.clone();
    const target = targetPositions[i];

    setTimeout(() => {
      addAnimation(0.4, (t) => {
        const e = easeOutBack(t);
        box.position.x = startPos.x + (target.x - startPos.x) * e;
        box.position.y = startPos.y + (target.y - startPos.y) * e;
        box.position.z = startPos.z + (target.z - startPos.z) * e;
        box.rotation.y = (1 - e) * 0.1;
      }, () => {
        box.position.set(target.x, target.y, target.z);
        box.rotation.set(0, 0, 0);
        completed++;
        if (completed === boxes.length && onComplete) onComplete();
      });
    }, i * 100);
  });
}

// Shake: wrong guess — rapid horizontal shake then return
export function animateShake(boxes, onComplete) {
  let completed = 0;

  boxes.forEach((box) => {
    const startX = box.position.x;
    addAnimation(0.4, (t) => {
      const shake = Math.sin(t * Math.PI * 8) * 0.08 * (1 - t);
      box.position.x = startX + shake;
    }, () => {
      box.position.x = startX;
      completed++;
      if (completed === boxes.length && onComplete) onComplete();
    });
  });
}

// Reflow: smoothly move boxes to new grid positions
export function animateReflow(boxes, onComplete) {
  let completed = 0;

  boxes.forEach((box) => {
    const startPos = box.position.clone();
    const target = box.userData.originalPosition;

    addAnimation(0.5, (t) => {
      const e = easeInOutCubic(t);
      box.position.x = startPos.x + (target.x - startPos.x) * e;
      box.position.y = startPos.y + (target.y - startPos.y) * e;
      box.position.z = startPos.z + (target.z - startPos.z) * e;
    }, () => {
      box.position.set(target.x, target.y, target.z);
      completed++;
      if (completed === boxes.length && onComplete) onComplete();
    });
  });
}

// Idle wobble: subtle continuous animation for unsolved boxes
export function applyIdleWobble(box, time) {
  if (box.userData.state === 'locked' || box.userData.state === 'grayed') return;
  const offset = box.userData.gridIndex || 0;
  box.rotation.z = Math.sin(time * 1.5 + offset * 0.7) * 0.01;
  box.rotation.x = Math.cos(time * 1.2 + offset * 0.5) * 0.005;
}

// Gray out: for game over
export function animateGrayOut(boxes, onComplete) {
  let completed = 0;
  boxes.forEach((box, i) => {
    setTimeout(() => {
      addAnimation(0.3, (t) => {
        const mesh = box.userData.boxMesh;
        const gray = new THREE.Color(0x333333);
        mesh.material.forEach(mat => {
          mat.color.lerp(gray, t);
        });
      }, () => {
        completed++;
        if (completed === boxes.length && onComplete) onComplete();
      });
    }, i * 50);
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/vhs-box.js src/animations.js
git commit -m "feat: add VHS box mesh factory and animation system"
```

---

## Task 7: Game Logic & State

**Files:**
- Create: `src/game-logic.js`
- Create: `src/state.js`

**Depends on:** Task 2 (puzzles.json schema)

- [ ] **Step 1: Create src/game-logic.js**

```js
// Pure game logic — no DOM, no Three.js, no side effects

export function createGame(puzzle) {
  return {
    puzzle,
    solvedCategories: [],    // array of { name, difficulty, color, movies }
    wrongGuesses: 0,
    hintsUsed: 0,
    uncoveredIds: [],        // tmdb_ids that have been uncovered
    selectedIds: [],         // currently selected tmdb_ids
    wage: 10,
    startTime: null,
    completed: false,
    won: false,
  };
}

export function startTimer(game) {
  if (!game.startTime) {
    game.startTime = Date.now();
  }
}

export function getAllMovies(puzzle) {
  const movies = [];
  for (const cat of puzzle.categories) {
    for (const movie of cat.movies) {
      movies.push(movie);
    }
  }
  return movies;
}

export function toggleSelection(game, tmdbId) {
  const idx = game.selectedIds.indexOf(tmdbId);
  if (idx >= 0) {
    game.selectedIds.splice(idx, 1);
    return { action: 'deselected' };
  }
  if (game.selectedIds.length >= 4) {
    return { action: 'full' };
  }
  game.selectedIds.push(tmdbId);
  return { action: 'selected' };
}

export function clearSelection(game) {
  game.selectedIds = [];
}

export function checkGuess(game) {
  if (game.selectedIds.length !== 4) {
    return { correct: false, reason: 'need4' };
  }

  const selected = new Set(game.selectedIds);

  for (const category of game.puzzle.categories) {
    // Skip already solved
    if (game.solvedCategories.some(c => c.name === category.name)) continue;

    const catIds = new Set(category.movies.map(m => m.tmdb_id));
    const isMatch = selected.size === catIds.size &&
      [...selected].every(id => catIds.has(id));

    if (isMatch) {
      game.solvedCategories.push(category);
      game.selectedIds = [];

      if (game.solvedCategories.length === 4) {
        game.completed = true;
        game.won = true;
      }

      return { correct: true, category };
    }
  }

  // Wrong guess
  game.wrongGuesses++;
  game.wage = Math.max(0, game.wage - 1);
  game.selectedIds = [];

  if (game.wage <= 0) {
    game.completed = true;
    game.won = false;
  }

  return { correct: false };
}

export function useHint(game, tmdbId) {
  if (game.hintsUsed >= 5) return { success: false, reason: 'maxHints' };
  if (game.uncoveredIds.includes(tmdbId)) return { success: false, reason: 'alreadyUncovered' };
  if (game.wage <= 0) return { success: false, reason: 'broke' };

  game.hintsUsed++;
  game.uncoveredIds.push(tmdbId);
  game.wage = Math.max(0, game.wage - 1);

  if (game.wage <= 0) {
    game.completed = true;
    game.won = false;
  }

  return { success: true, wage: game.wage };
}

export function getTimePenalty(startTime) {
  if (!startTime) return 0;
  const minutes = (Date.now() - startTime) / 60000;
  if (minutes < 2) return 0;
  if (minutes <= 5) return 1;
  return 2;
}

export function calculateFinalWage(game) {
  const timePenalty = getTimePenalty(game.startTime);
  return Math.max(0, game.wage - timePenalty);
}

export function getElapsedTime(startTime) {
  if (!startTime) return '0:00';
  const totalSec = Math.floor((Date.now() - startTime) / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function getElapsedSeconds(startTime) {
  if (!startTime) return 0;
  return Math.floor((Date.now() - startTime) / 1000);
}

// Serialize game state for localStorage (convert Set-like structures)
export function serializeGame(game) {
  return {
    puzzleId: game.puzzle.id,
    solvedCategories: game.solvedCategories.map(c => c.name),
    wrongGuesses: game.wrongGuesses,
    hintsUsed: game.hintsUsed,
    uncoveredIds: [...game.uncoveredIds],
    wage: game.wage,
    startTime: game.startTime,
    completed: game.completed,
    won: game.won,
  };
}

// Restore game state from localStorage save
export function restoreGame(saved, puzzle) {
  const game = createGame(puzzle);
  game.solvedCategories = puzzle.categories.filter(c =>
    saved.solvedCategories.includes(c.name)
  );
  game.wrongGuesses = saved.wrongGuesses;
  game.hintsUsed = saved.hintsUsed;
  game.uncoveredIds = saved.uncoveredIds;
  game.wage = saved.wage;
  game.startTime = saved.startTime;
  game.completed = saved.completed;
  game.won = saved.won;
  return game;
}
```

- [ ] **Step 2: Create src/state.js**

```js
const KEYS = {
  onboarded: 'newArrivals_onboarded',
  today: 'newArrivals_today',
  state: 'newArrivals_state',
  stats: 'newArrivals_stats',
};

export function loadTodaysPuzzle(puzzlesData) {
  const today = new Date().toISOString().split('T')[0];
  const directMatch = puzzlesData.puzzles.find(p => p.id === today);
  if (directMatch) return directMatch;

  // Cycle fallback: daysSinceEpoch % puzzleCount
  const msPerDay = 86400000;
  const daysSinceEpoch = Math.floor(Date.now() / msPerDay);
  const index = daysSinceEpoch % puzzlesData.puzzles.length;
  return puzzlesData.puzzles[index];
}

export function saveGameState(serialized) {
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem(KEYS.today, today);
  localStorage.setItem(KEYS.state, JSON.stringify(serialized));
}

export function loadGameState() {
  const today = new Date().toISOString().split('T')[0];
  const savedDate = localStorage.getItem(KEYS.today);
  if (savedDate !== today) return null;
  const raw = localStorage.getItem(KEYS.state);
  return raw ? JSON.parse(raw) : null;
}

export function updateStats(finalWage, won) {
  const stats = loadStats();
  stats.totalGames++;
  stats.totalWages += finalWage;
  stats.bestWage = Math.max(stats.bestWage, finalWage);

  if (won) {
    stats.currentStreak++;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
  } else {
    stats.currentStreak = 0;
  }

  stats.history.push({
    date: new Date().toISOString().split('T')[0],
    wage: finalWage,
    won,
  });

  localStorage.setItem(KEYS.stats, JSON.stringify(stats));
  return stats;
}

export function loadStats() {
  const raw = localStorage.getItem(KEYS.stats);
  if (raw) return JSON.parse(raw);
  return {
    totalGames: 0,
    totalWages: 0,
    bestWage: 0,
    currentStreak: 0,
    maxStreak: 0,
    history: [],
  };
}

export function isOnboarded() {
  return localStorage.getItem(KEYS.onboarded) === 'true';
}

export function setOnboarded() {
  localStorage.setItem(KEYS.onboarded, 'true');
}
```

- [ ] **Step 3: Commit**

```bash
git add src/game-logic.js src/state.js
git commit -m "feat: add game logic (scoring, hints, timer) and state management"
```

---

## Task 8: Interaction System

**Files:**
- Create: `src/interaction.js`

**Depends on:** Task 5 (scene.js), Task 6 (vhs-box.js)

- [ ] **Step 1: Create src/interaction.js**

```js
import * as THREE from 'three';

const LONG_PRESS_MS = 500;
const TAP_MOVE_THRESHOLD = 10; // pixels

export function setupInteraction(camera, renderer, getBoxes, callbacks) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let pointerDown = false;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let longPressTimer = null;
  let movedTooFar = false;
  let longPressed = false;
  let interactionLocked = false;

  function setLocked(locked) {
    interactionLocked = locked;
  }

  function getIntersectedBox(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const boxes = getBoxes();
    // Raycast against all box meshes
    const meshes = boxes.flatMap(box => box.children);
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      // Walk up to find the VHS box group
      let obj = intersects[0].object;
      while (obj && !obj.userData.movie) {
        obj = obj.parent;
      }
      return obj;
    }
    return null;
  }

  function onPointerDown(e) {
    if (interactionLocked) return;
    e.preventDefault();

    const x = e.clientX ?? e.touches?.[0]?.clientX;
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    if (x === undefined) return;

    pointerDown = true;
    pointerStartX = x;
    pointerStartY = y;
    movedTooFar = false;
    longPressed = false;

    const box = getIntersectedBox(x, y);
    if (!box || box.userData.state === 'locked' || box.userData.state === 'grayed') {
      pointerDown = false;
      return;
    }

    longPressTimer = setTimeout(() => {
      if (!movedTooFar && pointerDown) {
        longPressed = true;
        callbacks.onLongPress?.(box);
      }
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e) {
    if (!pointerDown) return;

    const x = e.clientX ?? e.touches?.[0]?.clientX;
    const y = e.clientY ?? e.touches?.[0]?.clientY;
    if (x === undefined) return;

    const dx = x - pointerStartX;
    const dy = y - pointerStartY;
    if (Math.sqrt(dx * dx + dy * dy) > TAP_MOVE_THRESHOLD) {
      movedTooFar = true;
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }
  }

  function onPointerUp(e) {
    if (!pointerDown) return;
    pointerDown = false;

    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    if (longPressed || movedTooFar || interactionLocked) return;

    // It's a tap
    const x = e.clientX ?? e.changedTouches?.[0]?.clientX;
    const y = e.clientY ?? e.changedTouches?.[0]?.clientY;
    if (x === undefined) return;

    const box = getIntersectedBox(x, y);
    if (box && box.userData.state !== 'locked' && box.userData.state !== 'grayed') {
      callbacks.onTap?.(box);
    }
  }

  const el = renderer.domElement;
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);

  // Touch events for mobile
  el.addEventListener('touchstart', onPointerDown, { passive: false });
  el.addEventListener('touchmove', onPointerMove, { passive: false });
  el.addEventListener('touchend', onPointerUp);
  el.addEventListener('touchcancel', onPointerUp);

  return {
    setLocked,
    destroy() {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('touchstart', onPointerDown);
      el.removeEventListener('touchmove', onPointerMove);
      el.removeEventListener('touchend', onPointerUp);
      el.removeEventListener('touchcancel', onPointerUp);
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/interaction.js
git commit -m "feat: add interaction system with tap and long-press detection"
```

---

## Task 9: UI Overlays

**Files:**
- Create: `src/ui.js`

**Depends on:** Task 7 (game-logic.js for data structures)

- [ ] **Step 1: Create src/ui.js**

```js
export function createHUD() {
  const hud = document.getElementById('hud');
  hud.innerHTML = `
    <div class="hud-top">
      <div class="hud-logo">
        NEW ARRIVALS
        <span class="hud-date">${formatDate(new Date())}</span>
      </div>
      <div class="hud-wage" id="wage-display">$10.00</div>
    </div>
    <div class="hud-bottom">
      <div class="hud-hints">
        <span class="hint-count" id="hint-count">5</span> uncover
      </div>
      <button class="shelve-btn" id="shelve-btn" disabled>SHELVE IT</button>
      <div class="hud-timer" id="timer-display">0:00</div>
    </div>
    <button class="mute-btn" id="mute-btn" title="Toggle sound">♪</button>
    <button class="help-btn" id="help-btn" title="How to play">?</button>
  `;
}

export function updateWage(wage, isPenalty) {
  const el = document.getElementById('wage-display');
  if (!el) return;
  el.textContent = `$${wage.toFixed(2)}`;
  if (isPenalty) {
    el.classList.add('penalty');
    setTimeout(() => el.classList.remove('penalty'), 600);
  }
}

export function updateTimer(timeStr) {
  const el = document.getElementById('timer-display');
  if (el) el.textContent = timeStr;
}

export function updateHints(remaining) {
  const el = document.getElementById('hint-count');
  if (el) el.textContent = remaining;
}

export function setShelveButton(active, onClick) {
  const btn = document.getElementById('shelve-btn');
  if (!btn) return;
  btn.disabled = !active;
  btn.onclick = active ? onClick : null;
}

export function onMuteClick(callback) {
  const btn = document.getElementById('mute-btn');
  if (btn) btn.addEventListener('click', callback);
}

export function setMuteIcon(muted) {
  const btn = document.getElementById('mute-btn');
  if (btn) btn.textContent = muted ? '♪' : '♪';
  if (btn) btn.style.opacity = muted ? '0.3' : '1';
}

export function onHelpClick(callback) {
  const btn = document.getElementById('help-btn');
  if (btn) btn.addEventListener('click', callback);
}

// Onboarding modal
export function showOnboarding(onComplete) {
  const overlay = document.getElementById('overlay');
  overlay.classList.add('active');

  let currentSlide = 0;
  const slides = [
    {
      title: 'Welcome to the Store',
      anim: '<div class="vhs-icon"></div>',
      text: "You're the new clerk at NEW ARRIVALS VIDEO. Sort 16 tapes into 4 mystery categories to earn your daily wages.",
      btn: 'Next',
    },
    {
      title: 'How to Sort',
      anim: '<div style="font-size:40px">👆📼📼📼📼</div>',
      text: 'Tap 4 movies you think belong together, then hit SHELVE IT. Get it right and the category reveals itself. Long-press any tape to inspect it up close.',
      btn: 'Next',
    },
    {
      title: 'Watch Your Wallet',
      anim: '<div class="dollar-icon">💸</div>',
      text: "You start with $10. Wrong guesses cost $1. Hints cost $1. Take too long and the clock eats your paycheck. Can you keep the store profitable?",
      btn: 'Start My Shift',
    },
  ];

  function render() {
    const slide = slides[currentSlide];
    overlay.innerHTML = `
      <div class="onboarding">
        <div class="onboarding-slide active">
          <div class="onboarding-anim">${slide.anim}</div>
          <h2>${slide.title}</h2>
          <p>${slide.text}</p>
          <div class="onboarding-dots">
            ${slides.map((_, i) => `<div class="onboarding-dot ${i === currentSlide ? 'active' : ''}"></div>`).join('')}
          </div>
          <button class="onboarding-btn" id="onboarding-next">${slide.btn}</button>
        </div>
      </div>
    `;

    document.getElementById('onboarding-next').addEventListener('click', () => {
      currentSlide++;
      if (currentSlide >= slides.length) {
        overlay.innerHTML = '';
        overlay.classList.remove('active');
        onComplete();
      } else {
        render();
      }
    });
  }

  render();
}

// Lightbox for tape inspection
export function showLightbox(movie, options) {
  const { uncovered, hintsLeft, wage, onReturn, onUncover } = options;
  const overlay = document.getElementById('overlay');
  overlay.classList.add('active');

  const posterSrc = uncovered
    ? `/posters/${movie.tmdb_id}.jpg`
    : `/posters/${movie.tmdb_id}_pixel.jpg`;
  const canUncover = !uncovered && hintsLeft > 0 && wage > 0;
  const uncoverLabel = hintsLeft <= 0 ? 'Out of Focus' : `Uncover — $1`;

  overlay.innerHTML = `
    <div class="lightbox visible">
      <img class="lightbox-poster ${uncovered ? 'uncovered' : ''}" src="${posterSrc}" alt="${movie.title}">
      <div class="lightbox-title">${movie.title}${movie.year ? ` (${movie.year})` : ''}</div>
      <div class="lightbox-buttons">
        <button class="lightbox-btn return" id="lb-return">Return to Shelf</button>
        <button class="lightbox-btn uncover" id="lb-uncover" ${canUncover ? '' : 'disabled'}>${uncoverLabel}</button>
      </div>
    </div>
  `;

  document.getElementById('lb-return').addEventListener('click', () => {
    overlay.innerHTML = '';
    overlay.classList.remove('active');
    onReturn();
  });

  if (canUncover) {
    document.getElementById('lb-uncover').addEventListener('click', () => {
      const img = overlay.querySelector('.lightbox-poster');
      img.src = `/posters/${movie.tmdb_id}.jpg`;
      img.classList.add('uncovered');
      const btn = document.getElementById('lb-uncover');
      btn.disabled = true;
      btn.textContent = 'Uncovered';
      onUncover(movie.tmdb_id);
    });
  }
}

export function hideLightbox() {
  const overlay = document.getElementById('overlay');
  overlay.innerHTML = '';
  overlay.classList.remove('active');
}

// End screen
export function showEndScreen(result) {
  const { won, finalWage, wrongGuesses, hintsUsed, timePenalty, timeStr,
          solvedCategories, allCategories, onShare } = result;
  const overlay = document.getElementById('overlay');
  overlay.classList.add('active');

  const title = won ? 'SHIFT COMPLETE' : 'STORE CLOSED EARLY';
  const titleColor = won ? 'var(--neon-pink)' : 'var(--penalty-red)';

  const categoryRows = (won ? solvedCategories : allCategories).map(cat => {
    const movies = cat.movies.map(m => m.title).join(', ');
    const difficulty = ['Easy', 'Medium', 'Hard', 'Devious'][cat.difficulty - 1];
    return `
      <div class="category-row" style="background: ${cat.color}22; border-left: 4px solid ${cat.color}">
        <div>
          <div class="cat-name" style="color: ${cat.color}">${cat.name}</div>
          <div class="cat-movies">${movies}</div>
        </div>
      </div>
    `;
  }).join('');

  // Countdown to midnight
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  const msToMidnight = midnight - now;
  const hoursLeft = Math.floor(msToMidnight / 3600000);
  const minsLeft = Math.floor((msToMidnight % 3600000) / 60000);

  overlay.innerHTML = `
    <div class="end-screen">
      <div class="end-title" style="color: ${titleColor}">${title}</div>
      <div class="score-card">
        <div class="line"><span>Today's Wage:</span><span>$${(10).toFixed(2)}</span></div>
        <div class="line"><span>Wrong Guesses: ${wrongGuesses}</span><span style="color:var(--penalty-red)">-$${wrongGuesses.toFixed(2)}</span></div>
        <div class="line"><span>Hints Used: ${hintsUsed}</span><span style="color:var(--penalty-red)">-$${hintsUsed.toFixed(2)}</span></div>
        <div class="line"><span>Time Penalty:</span><span style="color:var(--penalty-red)">${timePenalty > 0 ? '-$' + timePenalty.toFixed(2) : '$0.00'}</span></div>
        <div class="divider"></div>
        <div class="line final"><span>Final:</span><span>$${finalWage.toFixed(2)} / $10.00</span></div>
        <div class="line"><span>Time:</span><span>${timeStr}</span></div>
      </div>
      <div class="category-recap">${categoryRows}</div>
      <button class="share-btn" id="share-btn">SHARE RESULTS</button>
      <div class="countdown">Next puzzle in ${hoursLeft}h ${minsLeft}m</div>
    </div>
  `;

  document.getElementById('share-btn').addEventListener('click', onShare);
}

// VHS tracking distortion flash
export function showTrackingFlash() {
  const flash = document.createElement('div');
  flash.className = 'tracking-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 500);
}

function formatDate(date) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui.js
git commit -m "feat: add UI overlays — HUD, onboarding, lightbox, end screen"
```

---

## Task 10: Share Image Generation

**Files:**
- Create: `src/share.js`

**Depends on:** Task 7 (game result data shape)

- [ ] **Step 1: Create src/share.js**

```js
const SHARE_W = 600;
const SHARE_H = 800;
const BG_COLOR = '#1A1A2E';
const CATEGORY_COLORS = { 1: '#4CAF50', 2: '#FFC107', 3: '#2196F3', 4: '#9C27B0' };

export async function generateShareImage(result) {
  const { finalWage, timeStr, solvedCategories, allCategories, date, posterStates } = result;
  const categories = solvedCategories.length === 4 ? solvedCategories : allCategories;

  const canvas = document.createElement('canvas');
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);

  // Wait for fonts
  await document.fonts.ready;

  // Title
  ctx.fillStyle = '#FF6B9D';
  ctx.font = '18px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('NEW ARRIVALS', SHARE_W / 2, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '12px "Space Mono"';
  ctx.fillText(date, SHARE_W / 2, 62);

  // Poster grid: 4 rows × 4 posters
  const posterW = 100;
  const posterH = 150;
  const gap = 10;
  const gridW = 4 * posterW + 3 * gap;
  const gridStartX = (SHARE_W - gridW) / 2;
  let gridY = 85;

  // Sort categories by difficulty for display
  const sorted = [...categories].sort((a, b) => a.difficulty - b.difficulty);

  for (const cat of sorted) {
    const color = cat.color;
    // Category color bar
    ctx.fillStyle = color;
    ctx.fillRect(gridStartX - 6, gridY - 2, 4, posterH + 4);

    // Draw posters
    for (let j = 0; j < cat.movies.length; j++) {
      const movie = cat.movies[j];
      const x = gridStartX + j * (posterW + gap);

      // Load poster image
      const isUncovered = posterStates?.uncoveredIds?.includes(movie.tmdb_id);
      const src = isUncovered
        ? `/posters/${movie.tmdb_id}.jpg`
        : `/posters/${movie.tmdb_id}_pixel.jpg`;

      try {
        const img = await loadImage(src);
        ctx.drawImage(img, x, gridY, posterW, posterH);
      } catch {
        // Fallback: colored rectangle with title
        ctx.fillStyle = '#333';
        ctx.fillRect(x, gridY, posterW, posterH);
        ctx.fillStyle = '#fff';
        ctx.font = '9px "Space Mono"';
        ctx.textAlign = 'center';
        ctx.fillText(movie.title, x + posterW / 2, gridY + posterH / 2, posterW - 10);
      }
    }

    // Category name to the right or below
    ctx.fillStyle = color;
    ctx.font = '9px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.fillText(cat.name, gridStartX, gridY + posterH + 14, gridW);

    gridY += posterH + 30;
  }

  // Score bar
  const scoreY = gridY + 10;
  ctx.fillStyle = '#00E676';
  ctx.font = 'bold 20px "Space Mono"';
  ctx.textAlign = 'center';
  ctx.fillText(`$${finalWage} / $10`, SHARE_W / 2 - 60, scoreY);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '16px "Space Mono"';
  ctx.fillText(timeStr, SHARE_W / 2 + 80, scoreY);

  // URL
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '12px "Space Mono"';
  ctx.fillText('game.vhsgarage.com', SHARE_W / 2, scoreY + 30);

  return canvas;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function triggerShare(result) {
  const canvas = await generateShareImage(result);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const textFallback = generateTextFallback(result);

  if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'new-arrivals.png', { type: 'image/png' })] })) {
    try {
      await navigator.share({
        text: textFallback,
        files: [new File([blob], 'new-arrivals.png', { type: 'image/png' })],
      });
      return;
    } catch {
      // User cancelled or share failed, fall through to clipboard
    }
  }

  // Fallback: copy text to clipboard and download image
  try {
    await navigator.clipboard.writeText(textFallback);
  } catch { /* clipboard not available */ }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `new-arrivals-${result.date}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateTextFallback(result) {
  const { finalWage, timeStr, date, solvedCategories, allCategories, won } = result;
  const categories = won ? solvedCategories : allCategories;
  const sorted = [...categories].sort((a, b) => a.difficulty - b.difficulty);

  const colorEmoji = { 1: '🟩', 2: '🟨', 3: '🟦', 4: '🟪' };
  const rows = sorted.map(cat => {
    const solved = solvedCategories.some(s => s.name === cat.name);
    const emoji = colorEmoji[cat.difficulty];
    return solved ? `${emoji}${emoji}${emoji}${emoji}` : `⬛⬛⬛⬛`;
  });

  const dateStr = formatShareDate(date);
  return [
    `📼 NEW ARRIVALS — ${dateStr}`,
    `💰 $${finalWage} / $10 | ⏱ ${timeStr}`,
    ...rows,
    'game.vhsgarage.com',
  ].join('\n');
}

function formatShareDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/share.js
git commit -m "feat: add Canvas API share image generation and text fallback"
```

---

## Task 11: Main Integration

**Files:**
- Modify: `src/main.js`

**Depends on:** All previous tasks

This is the orchestrator that wires everything together into the complete game.

- [ ] **Step 1: Write src/main.js — full integration**

```js
import { createScene, resizeScene, getRowPositions, getShelfWidth } from './scene.js';
import { createVHSBox, loadTexture, preloadTextures, layoutBoxes, setBoxState, setSpineColor, swapToFullTexture, reflowBoxes, getBoxDimensions } from './vhs-box.js';
import { updateAnimations, animateEntrance, animateLockIn, animateShake, animateReflow, applyIdleWobble, animateGrayOut } from './animations.js';
import { setupInteraction } from './interaction.js';
import { createGame, startTimer, getAllMovies, toggleSelection, clearSelection, checkGuess, useHint, getTimePenalty, calculateFinalWage, getElapsedTime, serializeGame, restoreGame } from './game-logic.js';
import { loadTodaysPuzzle, saveGameState, loadGameState, updateStats, isOnboarded, setOnboarded } from './state.js';
import { createHUD, updateWage, updateTimer, updateHints, setShelveButton, showOnboarding, showLightbox, hideLightbox, showEndScreen, showTrackingFlash, onMuteClick, setMuteIcon, onHelpClick } from './ui.js';
import { audio } from './audio.js';
import { triggerShare, generateTextFallback } from './share.js';

let game = null;
let boxes = [];          // All VHS box groups
let unsolvedBoxes = [];  // Currently unsolved boxes
let scene, camera, renderer, shelfGroup;
let interaction;
let clock;
let timerInterval;

async function init() {
  // Load puzzle data
  const res = await fetch('/puzzles.json');
  const puzzlesData = await res.json();
  const puzzle = loadTodaysPuzzle(puzzlesData);

  // Check for saved state
  const savedState = loadGameState();

  // Set up Three.js scene
  const canvas = document.getElementById('game-canvas');
  const sceneResult = createScene(canvas);
  scene = sceneResult.scene;
  camera = sceneResult.camera;
  renderer = sceneResult.renderer;
  shelfGroup = sceneResult.shelfGroup;

  window.addEventListener('resize', () => resizeScene(camera, renderer));

  // Create HUD
  createHUD();

  // Mute toggle
  onMuteClick(async () => {
    await audio.init();
    audio.setMuted(!audio.isMuted());
    setMuteIcon(audio.isMuted());
  });

  // Create game state
  if (savedState && savedState.puzzleId === puzzle.id) {
    game = restoreGame(savedState, puzzle);
  } else {
    game = createGame(puzzle);
  }

  // Load textures and create boxes
  const allMovies = getAllMovies(puzzle);
  const shuffled = shuffleWithSeed(allMovies, puzzle.id);

  // Preload all full-res textures in background
  const fullUrls = shuffled.map(m => `/posters/${m.tmdb_id}.jpg`);
  preloadTextures(fullUrls);

  // Create VHS boxes with pixelated textures
  for (const movie of shuffled) {
    const pixUrl = `/posters/${movie.tmdb_id}_pixel.jpg`;
    let pixTex;
    try {
      pixTex = await loadTexture(pixUrl);
    } catch {
      // Fallback: create a colored placeholder texture
      pixTex = createPlaceholderTexture(movie.title);
    }
    const box = createVHSBox(movie, pixTex);
    boxes.push(box);
    scene.add(box);
  }

  // Layout on shelf
  layoutBoxes(boxes, shelfGroup);

  // If restoring, re-apply solved state
  if (game.solvedCategories.length > 0) {
    applySavedSolvedState(puzzle);
  }

  // If restoring uncovered state
  for (const tmdbId of game.uncoveredIds) {
    const box = boxes.find(b => b.userData.movie.tmdb_id === tmdbId);
    if (box) {
      try {
        const fullTex = await loadTexture(`/posters/${tmdbId}.jpg`);
        swapToFullTexture(box, fullTex);
      } catch { /* ignore */ }
    }
  }

  updateUnsolvedBoxes();
  updateHUD();

  // If game already completed (restored), show end screen
  if (game.completed) {
    showEndScreenWithData();
    startRenderLoop();
    return;
  }

  // Show onboarding if first visit
  if (!isOnboarded()) {
    showOnboarding(() => {
      setOnboarded();
      startGame();
    });
  } else {
    startGame();
  }

  // Help button replays onboarding
  onHelpClick(() => {
    showOnboarding(() => {});
  });

  startRenderLoop();
}

function startGame() {
  // Entrance animation
  if (!loadGameState()) {
    animateEntrance(boxes, () => {
      setupGameInteraction();
    });
    // Stagger tape landing sounds
    boxes.forEach((_, i) => {
      setTimeout(async () => {
        await audio.init();
        audio.play('tapeLand');
      }, i * 60);
    });
  } else {
    setupGameInteraction();
  }
}

function setupGameInteraction() {
  interaction = setupInteraction(camera, renderer, () => unsolvedBoxes, {
    onTap(box) {
      handleTap(box);
    },
    onLongPress(box) {
      handleLongPress(box);
    },
  });
}

function handleTap(box) {
  // Start timer on first interaction
  startTimer(game);
  startTimerDisplay();

  // Init audio on first interaction
  audio.init();

  const movie = box.userData.movie;
  const result = toggleSelection(game, movie.tmdb_id);

  if (result.action === 'selected') {
    setBoxState(box, 'selected');
    audio.play('dropInPlace');
  } else if (result.action === 'deselected') {
    setBoxState(box, 'default');
    audio.play('returnToShelf');
  } else if (result.action === 'full') {
    // Already 4 selected, ignore
    return;
  }

  // Update shelve button
  setShelveButton(game.selectedIds.length === 4, handleShelveIt);
  saveGameState(serializeGame(game));
}

function handleLongPress(box) {
  audio.init();
  audio.play('tapInspect');

  const movie = box.userData.movie;
  const isUncovered = game.uncoveredIds.includes(movie.tmdb_id);
  const hintsLeft = 5 - game.hintsUsed;

  showLightbox(movie, {
    uncovered: isUncovered,
    hintsLeft,
    wage: game.wage,
    onReturn() {
      audio.play('returnToShelf');
    },
    onUncover(tmdbId) {
      const result = useHint(game, tmdbId);
      if (result.success) {
        audio.play('uncover');
        audio.play('penalty');
        updateWage(result.wage, true);
        updateHints(5 - game.hintsUsed);

        // Swap texture on the 3D box too
        const targetBox = boxes.find(b => b.userData.movie.tmdb_id === tmdbId);
        if (targetBox) {
          loadTexture(`/posters/${tmdbId}.jpg`).then(tex => {
            swapToFullTexture(targetBox, tex);
          });
        }

        saveGameState(serializeGame(game));

        if (game.completed) {
          hideLightbox();
          handleGameOver();
        }
      }
    },
  });
}

async function handleShelveIt() {
  if (game.selectedIds.length !== 4) return;

  // Lock interaction during animation
  interaction.setLocked(true);
  setShelveButton(false, null);

  const result = checkGuess(game);

  if (result.correct) {
    audio.play('correct');
    const solvedBoxes = boxes.filter(b => game.selectedIds.length === 0 &&
      result.category.movies.some(m => m.tmdb_id === b.userData.movie.tmdb_id));

    // Actually, selectedIds were cleared by checkGuess. Find boxes by category.
    const catBoxes = boxes.filter(b =>
      result.category.movies.some(m => m.tmdb_id === b.userData.movie.tmdb_id)
    );

    // Determine target row (fill top to bottom by solve order)
    const rowIdx = game.solvedCategories.length - 1; // just solved, so -1 is current index
    const rowPositions = getRowPositions(shelfGroup);
    const targetY = rowPositions[rowIdx];
    const { width } = getBoxDimensions();
    const gap = 0.12;
    const cols = 4;
    const totalW = cols * width + (cols - 1) * gap;
    const startX = -totalW / 2 + width / 2;

    const targets = catBoxes.map((_, i) => ({
      x: startX + i * (width + gap),
      y: targetY,
      z: 0.15,
    }));

    // Lock-in animation
    animateLockIn(catBoxes, targetY, targets, () => {
      catBoxes.forEach(b => {
        setBoxState(b, 'locked');
        setSpineColor(b, result.category.color);
        b.userData.originalPosition = { ...targets[catBoxes.indexOf(b)] };
      });

      updateUnsolvedBoxes();
      reflowBoxes(unsolvedBoxes, shelfGroup, game.solvedCategories.length);
      animateReflow(unsolvedBoxes, () => {
        interaction.setLocked(false);
        saveGameState(serializeGame(game));

        if (game.completed) {
          handleGameOver();
        }
      });
    });
  } else {
    audio.play('wrong');
    audio.play('penalty');
    showTrackingFlash();
    updateWage(game.wage, true);

    // Find the boxes that were selected (IDs were cleared, find by previous selection)
    const selectedBoxes = unsolvedBoxes.filter(b => b.userData.selected);
    animateShake(selectedBoxes, () => {
      selectedBoxes.forEach(b => setBoxState(b, 'default'));
      interaction.setLocked(false);
      saveGameState(serializeGame(game));

      if (game.completed) {
        handleGameOver();
      }
    });
  }
}

function handleGameOver() {
  if (timerInterval) clearInterval(timerInterval);

  if (!game.won) {
    audio.play('gameLoss');
    const remaining = boxes.filter(b => b.userData.state !== 'locked');
    animateGrayOut(remaining, () => {
      showEndScreenWithData();
    });
  } else {
    audio.play('gameWin');
    setTimeout(() => showEndScreenWithData(), 500);
  }

  // Update stats
  const finalWage = calculateFinalWage(game);
  updateStats(finalWage, game.won);
  saveGameState(serializeGame(game));
}

function showEndScreenWithData() {
  const finalWage = calculateFinalWage(game);
  const timePenalty = getTimePenalty(game.startTime);
  const timeStr = getElapsedTime(game.startTime);
  const date = game.puzzle.id;

  showEndScreen({
    won: game.won,
    finalWage,
    wrongGuesses: game.wrongGuesses,
    hintsUsed: game.hintsUsed,
    timePenalty,
    timeStr,
    solvedCategories: game.solvedCategories,
    allCategories: game.puzzle.categories,
    onShare() {
      audio.play('share');
      triggerShare({
        finalWage,
        timeStr,
        date,
        solvedCategories: game.solvedCategories,
        allCategories: game.puzzle.categories,
        won: game.won,
        posterStates: { uncoveredIds: game.uncoveredIds },
      });
    },
  });
}

function updateUnsolvedBoxes() {
  const solvedIds = new Set();
  for (const cat of game.solvedCategories) {
    for (const m of cat.movies) {
      solvedIds.add(m.tmdb_id);
    }
  }
  unsolvedBoxes = boxes.filter(b => !solvedIds.has(b.userData.movie.tmdb_id));
}

function updateHUD() {
  updateWage(game.wage, false);
  updateHints(5 - game.hintsUsed);
  updateTimer(getElapsedTime(game.startTime));
}

function startTimerDisplay() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    updateTimer(getElapsedTime(game.startTime));
  }, 1000);
}

function applySavedSolvedState(puzzle) {
  const rowPositions = getRowPositions(shelfGroup);
  const { width } = getBoxDimensions();
  const gap = 0.12;
  const cols = 4;
  const totalW = cols * width + (cols - 1) * gap;
  const startX = -totalW / 2 + width / 2;

  game.solvedCategories.forEach((cat, rowIdx) => {
    const catBoxes = boxes.filter(b =>
      cat.movies.some(m => m.tmdb_id === b.userData.movie.tmdb_id)
    );
    catBoxes.forEach((box, i) => {
      const pos = { x: startX + i * (width + gap), y: rowPositions[rowIdx], z: 0.15 };
      box.position.set(pos.x, pos.y, pos.z);
      box.userData.originalPosition = pos;
      setBoxState(box, 'locked');
      setSpineColor(box, cat.color);
    });
  });

  updateUnsolvedBoxes();
  reflowBoxes(unsolvedBoxes, shelfGroup, game.solvedCategories.length);
  unsolvedBoxes.forEach(b => {
    const p = b.userData.originalPosition;
    b.position.set(p.x, p.y, p.z);
  });
}

// Deterministic shuffle based on puzzle ID so order is consistent
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

function createPlaceholderTexture(title) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, 128, 192);
  ctx.fillStyle = '#888';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, 64, 96, 120);

  const tex = new (await import('three')).CanvasTexture(canvas);
  return tex;
}

// Render loop
function startRenderLoop() {
  clock = new (await import('three')).Clock();

  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    updateAnimations(delta);

    // Idle wobble
    for (const box of unsolvedBoxes) {
      applyIdleWobble(box, time);
    }

    renderer.render(scene, camera);
  }
  animate();
}

// Fix: can't use top-level await with dynamic imports in the render loop.
// Move THREE.Clock and CanvasTexture to static imports.
// Actually, let's fix createPlaceholderTexture and startRenderLoop:

// We already import THREE at the top via scene.js deps, but let's import Clock directly:
import * as THREE from 'three';

// Override the functions to use the static import:
function startRenderLoopFixed() {
  const localClock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const delta = localClock.getDelta();
    const time = localClock.getElapsedTime();

    updateAnimations(delta);

    for (const box of unsolvedBoxes) {
      applyIdleWobble(box, time);
    }

    renderer.render(scene, camera);
  }
  animate();
}

function createPlaceholderTextureFixed(title) {
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

// Start the app
init().catch(err => console.error('Failed to initialize:', err));
```

**IMPORTANT:** The above file has a structural issue — the functions `startRenderLoop` and `createPlaceholderTexture` use `await import()` which won't work inline. The implementing agent MUST use the `Fixed` versions instead. The final `src/main.js` should:

1. Add `import * as THREE from 'three';` at the top (with the other imports)
2. Use `createPlaceholderTextureFixed` in place of `createPlaceholderTexture`
3. Use `startRenderLoopFixed` in place of `startRenderLoop`
4. Remove the broken `async` versions

- [ ] **Step 2: Verify the full game flow**

```bash
npx vite
```

Open browser. Expected flow:
1. Dark background, shelf visible
2. Onboarding modal (first visit) — 3 slides
3. After "Start My Shift": 16 VHS boxes spin in and land on shelf
4. Tap boxes to select (blue glow, max 4)
5. "SHELVE IT" activates with 4 selected
6. Correct: boxes lock into top row, category reveals
7. Wrong: boxes shake, $1 penalty, tracking flash
8. Long-press: lightbox with poster + uncover option
9. Game over: end screen with score, share button

- [ ] **Step 3: Fix any integration bugs**

Common things to check:
- Selection state clears properly after correct/wrong guess
- Wage display updates on penalties
- Timer starts on first tap
- Lightbox poster paths resolve correctly
- Solved rows use correct positions

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat: integrate all modules into complete game flow"
```

---

## Post-Integration Checklist

After Task 11, verify all spec requirements:

- [ ] 16 VHS boxes render with pixelated poster textures
- [ ] Tap to select, long-press to inspect
- [ ] Shelve It checks 4 selected against categories
- [ ] Correct/wrong animations and sounds play
- [ ] Wage decrements on wrong guess and uncover
- [ ] Max 5 uncovers, "Out of Focus" after limit
- [ ] Time penalty applied at end
- [ ] End screen shows score breakdown and categories
- [ ] Share generates PNG image + text fallback
- [ ] Daily reset works (change date, refresh)
- [ ] Onboarding shows once, "?" replays it
- [ ] localStorage persists state across refresh
- [ ] Mobile touch works (test in Chrome DevTools mobile mode)
- [ ] Mute button toggles audio
- [ ] All references say "New Arrivals" (not "Shelf Shuffle")
- [ ] Share URL is game.vhsgarage.com
