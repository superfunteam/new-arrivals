# Puzzle Admin ("The Backroom") — Design Spec

**Date:** 2026-04-08
**Status:** Approved
**URL:** game.vhsgarage.com/backroom

---

## Overview

A clean, modern admin panel for managing New Arrivals puzzles. React + shadcn/ui, served from `/backroom/`, completely separate from the game's vanilla JS. White layout, sans-serif fonts, no retro VHS styling.

Features: puzzle CRUD, editorial calendar, TMDB movie search, AI-assisted puzzle generation via Netlify AI Gateway, full processing pipeline (posters, metadata, interrupts), and GitHub commit-back.

---

## Architecture

```
Game (vanilla JS)          Admin (React + shadcn)
    /                         /backroom/
    Vite build                Vite build (separate config)
    dist/                     dist/backroom/

Netlify Functions (shared)
    netlify/functions/admin-*.js
```

Two separate Vite builds. One `netlify.toml` build command runs both. The game build and admin build share the same Netlify Functions backend.

---

## Auth

Simple password gate. No Netlify Identity.

- Password: `vhsgarage`
- On login: Netlify Function hashes and verifies, returns a signed JWT cookie
- Cookie checked on all admin API calls
- Session lasts 24 hours

---

## Puzzle Lifecycle

```
FLOATING ──→ SCHEDULED ──→ FEATURED
```

- **Floating:** No date. `id` is a slug (e.g., `"scary-halloween"`). Fills any unscheduled upcoming day. Global batch edits apply.
- **Scheduled:** Assigned to a future date. `id` changes to that date string (e.g., `"2026-05-01"`). Locked to that day, editable individually.
- **Featured:** Date has passed (already served as a daily). Fully locked — read-only, no moving, excluded from global edits.

Status is determined by the `id` field:
- Matches a date pattern AND date < today → Featured
- Matches a date pattern AND date >= today → Scheduled
- Does not match date pattern → Floating
- Training puzzles (`id` starts with `training-`) → always Floating

---

## Pages

### 1. Login

Full-screen centered card. Password input + "Enter Backroom" button. Clean, minimal.

### 2. Dashboard

**Top: Calendar Strip**
- Horizontal scrolling row of date cells, 30 days forward from today
- Each cell shows: date, day-of-week, puzzle title (if scheduled) or "empty"
- Empty slots show a "+" button to assign a floating puzzle
- Scheduled slots can be clicked to unassign (moves puzzle back to floating)
- Uses shadcn Calendar or a custom horizontal strip

**Middle: Quick Stats**
- Cards showing: Total puzzles, Floating count, Scheduled count, Featured count, Days without coverage (next 30 days)

**Bottom: Puzzle Table**
- shadcn Table with columns: Title, Status (badge), Date, Categories (preview pills), Actions
- Status badges: green=Featured, blue=Scheduled, gray=Floating
- Filter tabs: All | Floating | Scheduled | Featured
- Row click → opens puzzle editor
- "New Puzzle" button top-right

### 3. Puzzle Editor

Two tabs: **Manual** and **AI-Assisted**

#### Manual Tab

- **Title** — text input
- **4 Category Sections** — each collapsible card with:
  - Category name input
  - Difficulty selector (1=Easy green, 2=Medium yellow, 3=Hard blue, 4=Devious purple)
  - 4 Movie search fields — shadcn Command (combobox/autocomplete):
    - Type to search TMDB (debounced, via Netlify Function)
    - Results show: poster thumbnail, title, year, director
    - Select to populate movie data (title, year, tmdb_id, genres, director, stars, summary)
  - Each movie shows a mini card after selection with poster + metadata

#### AI-Assisted Tab

- **Top-level sparkle button** — "Generate Full Puzzle"
  - Text input: enter a theme (e.g., "Easter movies", "90s date night")
  - Click sparkle → AI Gateway generates all 4 categories + 16 movies
  - Results populate the editor below for review/editing
  - User can regenerate individual categories or swap movies

- **Category-level sparkle** — on each category section
  - Enter just a category name (e.g., "Scary Halloween Movies")
  - Click sparkle → AI fills in 4 movies for that category
  - User reviews and can swap individual movies

- Both modes use the same editor layout — AI just pre-fills it

#### Save Flow

"Process & Publish" button at the bottom. Runs the full pipeline:
1. Validate: 4 categories, 4 movies each, all have TMDB data
2. TMDB enrichment: fill any missing metadata
3. Poster pipeline: download, pixelate (shelf + detail versions)
4. AI: generate 10 interrupt dialogues
5. Commit all files to GitHub
6. Show success toast with deploy link

Progress shown as a step-by-step checklist with live status.

---

## Netlify Functions

### `netlify/functions/admin-auth.js`
- POST `/api/admin-auth` — verify password, return JWT cookie
- JWT secret from env var `ADMIN_JWT_SECRET` (we'll generate one)

### `netlify/functions/admin-puzzles.js`
- GET `/api/admin-puzzles` — read puzzles.json from GitHub API
- PUT `/api/admin-puzzles` — write updated puzzles.json to GitHub

### `netlify/functions/admin-tmdb.js`
- GET `/api/admin-tmdb?query=...&year=...` — search TMDB movies
- GET `/api/admin-tmdb?id=...` — get full movie details + credits

### `netlify/functions/admin-ai-generate.js`
- POST `/api/admin-ai-generate` — AI Gateway → Claude
  - Body: `{ mode: "full_puzzle", theme: "..." }` or `{ mode: "category", name: "..." }`
  - Returns generated categories/movies as JSON

### `netlify/functions/admin-ai-interrupts.js`
- POST `/api/admin-ai-interrupts` — AI Gateway → Claude
  - Body: puzzle data (categories + movies)
  - Returns 10 interrupt dialogues following the game's format

### `netlify/functions/admin-process.js`
- POST `/api/admin-process` — full pipeline
  - Body: complete puzzle data
  - Steps: TMDB enrich → download posters → pixelate → generate interrupts → commit all to GitHub
  - Returns progress updates via streaming or polling

---

## AI Prompt: Puzzle Generation

```
You are a puzzle designer for "New Arrivals," a daily VHS rental store trivia game.

GAME CONCEPT: Players sort 16 VHS tapes into 4 hidden genre categories on a 3D shelf. Think NYT Connections meets 1980s Blockbuster Video.

DIFFICULTY TIERS (required, one of each):
- Category 1 (Easy): Instantly recognizable grouping. Actor filmography, franchise, studio, obvious genre. Anyone who's browsed a video store gets this.
- Category 2 (Medium): Requires some film knowledge. Theme, subgenre, source material, era. Film fans get this.
- Category 3 (Hard): Non-obvious trait. Behind-the-scenes fact, setting constraint, production detail. You'd need to have seen or read about these films.
- Category 4 (Devious): Deep trivia. Cameos, bans, actor trivia, obscure production facts. Only serious cinephiles catch this.

RULES:
- Exactly 4 categories, exactly 4 movies per category (16 total)
- Movies primarily from 1970-1999 (video store golden age). Occasional outliers OK.
- At least 2-3 movies must plausibly fit multiple categories (overlap traps that create false confidence)
- Each movie needs: title (exact as on TMDB) and year

OUTPUT: Valid JSON only, no commentary.
{
  "title": "Puzzle Title",
  "categories": [
    {
      "name": "Category Name",
      "difficulty": 1,
      "color": "#4CAF50",
      "movies": [
        { "title": "Movie Title", "year": 1985 }
      ]
    }
  ]
}

Difficulty colors: 1="#4CAF50", 2="#FFC107", 3="#2196F3", 4="#9C27B0"
```

## AI Prompt: Interrupt Dialogues

```
You are writing customer dialogue for "New Arrivals," a VHS rental store game. Customers interrupt the player while they sort tapes.

SETTING: A video rental store, Friday night, 1987. Customers are browsing, chatting, looking for movies.

CHARACTER: {character_name} ({character_type})
PUZZLE MOVIES: {list of 16 movies on the shelf}
PUZZLE CATEGORIES: {list of 4 category names}

Generate exactly 10 interruptions:
- 4 TRIVIA: Ask about a specific movie on the shelf. 4 multiple-choice answers (1 correct, 3 plausible wrong from the same era). Short question, 1-2 sentences.
- 3 HINTS: Character vaguely describes what they're looking for (obliquely referencing a category). Include the exact category name as hintCategory. Never say the category name in dialogue.
- 3 STORIES: Funny 80s rental store anecdote, joke, pun, or oversharing. Include a fun dismiss button label.

CHARACTER VOICE RULES:
- Kid characters: UNHINGED energy. Caps, "UHHH", "MY MOM SAID", sugar-high, Tindendo references
- Adults: Normal 80s rental customer. Friday nights, date nights, late fees, opinions
- Old characters: Slower, nostalgic, confused by technology, wholesome

Keep dialogue SHORT (1-3 sentences max). These are quick interruptions.

OUTPUT: Valid JSON array, no commentary.
[
  { "type": "trivia", "character": "...", "sprite": "...", "folder": "...", "dialogue": "...", "answers": ["A","B","C","D"], "correct": 0 },
  { "type": "hint", "character": "...", "sprite": "...", "folder": "...", "dialogue": "...", "hintCategory": "...", "cost": 3 },
  { "type": "story", "character": "...", "sprite": "...", "folder": "...", "dialogue": "...", "dismiss": "Button label" }
]
```

---

## File Structure

```
admin/                          # React + shadcn source
├── index.html
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── components/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── CalendarStrip.jsx
│   │   ├── PuzzleTable.jsx
│   │   ├── PuzzleEditor.jsx
│   │   ├── MovieSearch.jsx
│   │   ├── AiGeneratePanel.jsx
│   │   └── ProcessingProgress.jsx
│   ├── lib/
│   │   ├── api.js              # Fetch wrappers for all admin endpoints
│   │   └── utils.js
│   └── styles/
│       └── globals.css         # Tailwind + shadcn theme overrides
├── vite.config.js              # Separate Vite config for admin
├── tailwind.config.js
├── postcss.config.js
└── components.json             # shadcn config

netlify/functions/              # Shared backend
├── admin-auth.js
├── admin-puzzles.js
├── admin-tmdb.js
├── admin-ai-generate.js
├── admin-ai-interrupts.js
└── admin-process.js
```

---

## Build Setup

```toml
# netlify.toml
[build]
  command = "node scripts/fetch-posters.js && npx vite build && cd admin && npm install && npx vite build"
  publish = "dist"

# Redirect /backroom/* to the admin SPA
[[redirects]]
  from = "/backroom/*"
  to = "/backroom/index.html"
  status = 200

# API routes to Netlify Functions
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

Admin's `vite.config.js` outputs to `../dist/backroom/`.

---

## Env Vars (Netlify Dashboard)

| Key | Purpose | Status |
|-----|---------|--------|
| `TMDB_READ_ACCESS_TOKEN` | TMDB API calls | Already set |
| `GITHUB_TOKEN` | Commit to repo | Already set |
| `ADMIN_JWT_SECRET` | Sign admin session cookies | Needs setting (any random string) |

---

## Netlify AI Gateway Config

Add to `netlify.toml`:
```toml
[ai_gateway]
  [ai_gateway.anthropic]
    model = "claude-sonnet-4-20250514"
```

Functions call via: `https://ai-gateway.netlify.app/v1/messages` with the Netlify site's credentials.

---

## Key Constraints

- Admin at `/backroom/` only. No impact on game at `/`.
- Featured puzzles (past dailies) are read-only in the admin.
- Global edits skip featured puzzles.
- All data changes commit to GitHub → trigger Netlify redeploy → live in ~30s.
- Poster processing (sharp) runs in Netlify Functions (Node 22 runtime).
- Training puzzles (`training-*` IDs) are always floating, never auto-scheduled.
