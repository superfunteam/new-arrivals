# Puzzle Admin ("The Backroom") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "The Backroom" — a React admin panel at `/backroom/` for managing New Arrivals puzzles. CRUD, editorial calendar, TMDB movie search, AI-assisted puzzle generation via Netlify AI Gateway, full processing pipeline (posters, metadata, interrupts), and GitHub commit-back.

**Architecture:** Separate React + Vite + Tailwind + shadcn/ui app in `admin/`, building to `dist/backroom/`. Shares Netlify Functions backend with the game. Password-gated via JWT cookie. All data changes commit to GitHub via API, triggering Netlify redeploy.

**Tech Stack:** React 18, Vite, Tailwind CSS, shadcn/ui, Netlify Functions (Node 22 ESM), jose (JWT), sharp (poster processing), Netlify AI Gateway (Claude)

**The game's vanilla JS is NOT touched. Admin is completely separate.**

---

## File Map

```
admin/                          # React + shadcn source
  index.html
  package.json
  vite.config.js                # Outputs to ../dist/backroom/
  tailwind.config.js
  postcss.config.js
  components.json               # shadcn config
  src/
    main.jsx
    App.jsx
    components/
      Login.jsx
      Dashboard.jsx
      CalendarStrip.jsx
      PuzzleTable.jsx
      PuzzleEditor.jsx
      MovieSearch.jsx
      AiGeneratePanel.jsx
      ProcessingProgress.jsx
    lib/
      api.js                    # Fetch wrappers for all admin endpoints
      utils.js                  # Puzzle status helpers, date formatting
    styles/
      globals.css               # Tailwind base + shadcn theme

netlify/functions/              # Shared backend (new directory)
  admin-auth.mjs
  admin-puzzles.mjs
  admin-tmdb.mjs
  admin-ai-generate.mjs
  admin-ai-interrupts.mjs
  admin-process.mjs

netlify.toml                    # Updated build command + redirects
```

---

## Dependency Graph

```
Task 1 (Scaffold) ─── Task 2 (Auth) ─── Task 3 (Dashboard) ─── Task 4 (Calendar)
                                                │
                                          Task 5 (TMDB Search)
                                                │
                                          Task 6 (Puzzle Editor)
                                               │ │
                              Task 7 (AI Gen) ─┘ └── Task 8 (Pipeline + Commit)
```

Task 1 must come first. Task 2 depends on 1. Tasks 3-4 depend on 2 and are sequential. Task 5 can start after 2. Task 6 needs 5. Tasks 7 and 8 both need 6.

---

## Task 1: Admin React App Scaffold

**Files:**
- Create: `admin/package.json`
- Create: `admin/index.html`
- Create: `admin/vite.config.js`
- Create: `admin/tailwind.config.js`
- Create: `admin/postcss.config.js`
- Create: `admin/components.json`
- Create: `admin/src/main.jsx`
- Create: `admin/src/App.jsx`
- Create: `admin/src/styles/globals.css`
- Create: `admin/src/lib/utils.js`
- Modify: `netlify.toml`

- [ ] **Step 1: Create admin/package.json**

```json
{
  "name": "new-arrivals-admin",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/clark/Downloads/Source/new-arrivals/admin
npm install react react-dom react-router-dom lucide-react class-variance-authority clsx tailwind-merge
npm install -D vite @vitejs/plugin-react tailwindcss @tailwindcss/vite autoprefixer
```

- [ ] **Step 3: Create admin/vite.config.js**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: '.',
  base: '/backroom/',
  build: {
    outDir: path.resolve(__dirname, '../dist/backroom'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:8888',
    },
  },
});
```

- [ ] **Step 4: Create admin/tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 5: Create admin/postcss.config.js**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create admin/components.json**

shadcn config pointing at our `src/` structure:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": false,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

- [ ] **Step 7: Create admin/src/styles/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.9%;
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    --accent: 0 0% 96.1%;
    --accent-foreground: 0 0% 9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 89.8%;
    --input: 0 0% 89.8%;
    --ring: 0 0% 3.9%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
}
```

- [ ] **Step 8: Create admin/src/lib/utils.js**

```js
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Determine puzzle status from its id */
export function getPuzzleStatus(id) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(id)) return 'floating';
  const puzzleDate = new Date(id + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return puzzleDate < today ? 'featured' : 'scheduled';
}

/** Format a date as YYYY-MM-DD */
export function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/** Get array of next N dates from today */
export function getNextDates(count) {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}
```

- [ ] **Step 9: Install shadcn/ui components**

```bash
cd /Users/clark/Downloads/Source/new-arrivals/admin
npx shadcn@latest init --yes
npx shadcn@latest add button input card table badge dialog command tabs calendar toast separator
```

This creates `admin/src/components/ui/` with all shadcn primitives.

- [ ] **Step 10: Create admin/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Backroom — New Arrivals Admin</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 11: Create admin/src/main.jsx**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 12: Create admin/src/App.jsx (shell)**

```jsx
import { useState, useEffect } from 'react';
import { Toaster } from '@/components/ui/toast';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check for existing session cookie
    fetch('/api/admin-auth', { method: 'GET', credentials: 'include' })
      .then(res => {
        setAuthenticated(res.ok);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <>
      {authenticated ? (
        <Dashboard />
      ) : (
        <Login onSuccess={() => setAuthenticated(true)} />
      )}
      <Toaster />
    </>
  );
}
```

- [ ] **Step 13: Update netlify.toml**

Replace the entire file with:

```toml
[build]
  command = "node scripts/fetch-posters.js && npx vite build && cd admin && npm install && npx vite build"
  publish = "dist"
  functions = "netlify/functions"

[build.environment]
  NODE_VERSION = "22"

# Cache posters aggressively — they never change for a given tmdb_id
[[headers]]
  for = "/posters/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# API routes to Netlify Functions
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

# Admin SPA — must come before the game SPA fallback
[[redirects]]
  from = "/backroom/*"
  to = "/backroom/index.html"
  status = 200

# Game SPA fallback
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

# Netlify AI Gateway config
[ai_gateway]
  [ai_gateway.anthropic]
    model = "claude-sonnet-4-20250514"
```

**Verification:** Run `cd admin && npm run build` — should produce `dist/backroom/index.html`.

---

## Task 2: Netlify Functions Setup + Auth

**Files:**
- Create: `netlify/functions/admin-auth.mjs`
- Create: `admin/src/components/Login.jsx`
- Create: `admin/src/lib/api.js`

- [ ] **Step 1: Install function dependencies**

Netlify Functions bundle their own `node_modules`. We need jose for JWT:

```bash
cd /Users/clark/Downloads/Source/new-arrivals
mkdir -p netlify/functions
npm install --save jose
```

Note: `jose` is installed in the root `package.json` because Netlify Functions at the repo root have access to root `node_modules`. We use `jose` (not `jsonwebtoken`) because it supports ESM natively.

- [ ] **Step 2: Create netlify/functions/admin-auth.mjs**

```js
import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || 'dev-secret-change-me');
const PASSWORD = 'vhsgarage';
const COOKIE_NAME = 'backroom_session';
const EXPIRY = '24h';

/** Shared helper: verify JWT from cookie. Returns payload or null. */
export async function verifySession(event) {
  const cookieHeader = event.headers?.cookie || '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  try {
    const { payload } = await jwtVerify(match[1], SECRET);
    return payload;
  } catch {
    return null;
  }
}

export default async (req, context) => {
  // GET — session check
  if (req.method === 'GET') {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (!match) return new Response('Unauthorized', { status: 401 });
    try {
      await jwtVerify(match[1], SECRET);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  // POST — login
  if (req.method === 'POST') {
    const body = await req.json();
    if (body.password !== PASSWORD) {
      return new Response(JSON.stringify({ error: 'Wrong password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(EXPIRY)
      .setIssuedAt()
      .sign(SECRET);

    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`,
      },
    });
  }

  return new Response('Method not allowed', { status: 405 });
};

export const config = {
  path: '/api/admin-auth',
};
```

- [ ] **Step 3: Create admin/src/lib/api.js**

```js
const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (res.status === 401) {
    window.location.reload(); // Force re-login
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Auth
  login: (password) => request('/admin-auth', {
    method: 'POST',
    body: JSON.stringify({ password }),
  }),

  checkSession: () => request('/admin-auth', { method: 'GET' }),

  // Puzzles
  getPuzzles: () => request('/admin-puzzles', { method: 'GET' }),
  savePuzzles: (puzzles, sha) => request('/admin-puzzles', {
    method: 'PUT',
    body: JSON.stringify({ puzzles, sha }),
  }),

  // TMDB
  searchMovies: (query, year) => {
    const params = new URLSearchParams({ query });
    if (year) params.set('year', year);
    return request(`/admin-tmdb?${params}`);
  },
  getMovieDetails: (id) => request(`/admin-tmdb?id=${id}`),

  // AI
  generatePuzzle: (theme) => request('/admin-ai-generate', {
    method: 'POST',
    body: JSON.stringify({ mode: 'full_puzzle', theme }),
  }),
  generateCategory: (name) => request('/admin-ai-generate', {
    method: 'POST',
    body: JSON.stringify({ mode: 'category', name }),
  }),

  // Processing
  processPuzzle: (puzzle) => request('/admin-process', {
    method: 'POST',
    body: JSON.stringify(puzzle),
  }),
};
```

- [ ] **Step 4: Create admin/src/components/Login.jsx**

```jsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

export default function Login({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      setError('Wrong password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">The Backroom</CardTitle>
          <p className="text-sm text-muted-foreground">New Arrivals Admin</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Checking...' : 'Enter Backroom'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Verification:** Deploy to Netlify or run `netlify dev`. Visiting `/backroom/` should show the login page. Entering "vhsgarage" should set a cookie and show the Dashboard shell.

---

## Task 3: Dashboard — Puzzle List + Stats

**Files:**
- Create: `netlify/functions/admin-puzzles.mjs`
- Create: `admin/src/components/Dashboard.jsx`
- Create: `admin/src/components/PuzzleTable.jsx`

- [ ] **Step 1: Create netlify/functions/admin-puzzles.mjs**

This function reads/writes `public/puzzles.json` via the GitHub Contents API. It uses the get-then-put pattern (read SHA before writing).

```js
import { verifySession } from './admin-auth.mjs';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'your-username/new-arrivals'; // Update to actual repo
const FILE_PATH = 'public/puzzles.json';
const BRANCH = 'main';

async function githubApi(endpoint, options = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API ${res.status}: ${err}`);
  }
  return res.json();
}

export default async (req, context) => {
  // Auth check
  const cookieHeader = req.headers.get('cookie') || '';
  const session = await verifyAuth(cookieHeader);
  if (!session) return new Response('Unauthorized', { status: 401 });

  if (req.method === 'GET') {
    const data = await githubApi(FILE_PATH + `?ref=${BRANCH}`);
    const content = JSON.parse(atob(data.content));
    return new Response(JSON.stringify({ puzzles: content.puzzles, sha: data.sha }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'PUT') {
    const body = await req.json();
    const { puzzles, sha } = body;
    const content = btoa(JSON.stringify({ puzzles }, null, 2));

    await githubApi(FILE_PATH, {
      method: 'PUT',
      body: JSON.stringify({
        message: `[backroom] Update puzzles.json`,
        content,
        sha,
        branch: BRANCH,
      }),
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
};

/** Verify JWT from cookie header string */
async function verifyAuth(cookieHeader) {
  // Inline verification to avoid circular import issues
  const { jwtVerify } = await import('jose');
  const SECRET = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || 'dev-secret-change-me');
  const match = cookieHeader.match(/backroom_session=([^;]+)/);
  if (!match) return null;
  try {
    const { payload } = await jwtVerify(match[1], SECRET);
    return payload;
  } catch {
    return null;
  }
}

export const config = {
  path: '/api/admin-puzzles',
};
```

- [ ] **Step 2: Create admin/src/components/Dashboard.jsx**

```jsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { getPuzzleStatus, getNextDates, formatDate } from '@/lib/utils';
import PuzzleTable from './PuzzleTable';
import CalendarStrip from './CalendarStrip';
import PuzzleEditor from './PuzzleEditor';

export default function Dashboard() {
  const [puzzles, setPuzzles] = useState([]);
  const [sha, setSha] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingPuzzle, setEditingPuzzle] = useState(null); // null = list view, object = editing
  const [filter, setFilter] = useState('all');

  const loadPuzzles = async () => {
    setLoading(true);
    try {
      const data = await api.getPuzzles();
      setPuzzles(data.puzzles);
      setSha(data.sha);
    } catch (err) {
      console.error('Failed to load puzzles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPuzzles(); }, []);

  // Compute stats
  const stats = {
    total: puzzles.length,
    floating: puzzles.filter(p => getPuzzleStatus(p.id) === 'floating').length,
    scheduled: puzzles.filter(p => getPuzzleStatus(p.id) === 'scheduled').length,
    featured: puzzles.filter(p => getPuzzleStatus(p.id) === 'featured').length,
  };
  const next30 = getNextDates(30).map(d => formatDate(d));
  const scheduledDates = new Set(puzzles.filter(p => getPuzzleStatus(p.id) === 'scheduled').map(p => p.id));
  stats.uncovered = next30.filter(d => !scheduledDates.has(d)).length;

  // Filter puzzles for table
  const filtered = filter === 'all'
    ? puzzles
    : puzzles.filter(p => getPuzzleStatus(p.id) === filter);

  if (editingPuzzle !== null) {
    return (
      <PuzzleEditor
        puzzle={editingPuzzle === 'new' ? null : editingPuzzle}
        puzzles={puzzles}
        sha={sha}
        onBack={() => { setEditingPuzzle(null); loadPuzzles(); }}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">The Backroom</h1>
        <Button onClick={() => setEditingPuzzle('new')}>
          <Plus className="w-4 h-4 mr-2" /> New Puzzle
        </Button>
      </div>

      {/* Calendar Strip */}
      <CalendarStrip
        puzzles={puzzles}
        sha={sha}
        onRefresh={loadPuzzles}
      />

      <Separator />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total },
          { label: 'Floating', value: stats.floating },
          { label: 'Scheduled', value: stats.scheduled },
          { label: 'Featured', value: stats.featured },
          { label: 'Uncovered (30d)', value: stats.uncovered },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Puzzle Table with Filter Tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
          <TabsTrigger value="floating">Floating ({stats.floating})</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled ({stats.scheduled})</TabsTrigger>
          <TabsTrigger value="featured">Featured ({stats.featured})</TabsTrigger>
        </TabsList>
        <TabsContent value={filter}>
          <PuzzleTable
            puzzles={filtered}
            loading={loading}
            onEdit={(puzzle) => setEditingPuzzle(puzzle)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 3: Create admin/src/components/PuzzleTable.jsx**

```jsx
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getPuzzleStatus } from '@/lib/utils';

const STATUS_COLORS = {
  featured: 'bg-green-100 text-green-800',
  scheduled: 'bg-blue-100 text-blue-800',
  floating: 'bg-gray-100 text-gray-800',
};

export default function PuzzleTable({ puzzles, loading, onEdit }) {
  if (loading) {
    return <p className="text-center py-8 text-muted-foreground">Loading puzzles...</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>ID / Date</TableHead>
          <TableHead>Categories</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {puzzles.map((puzzle) => {
          const status = getPuzzleStatus(puzzle.id);
          return (
            <TableRow
              key={puzzle.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onEdit(puzzle)}
            >
              <TableCell className="font-medium">{puzzle.title}</TableCell>
              <TableCell>
                <Badge variant="secondary" className={STATUS_COLORS[status]}>
                  {status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{puzzle.id}</TableCell>
              <TableCell>
                <div className="flex gap-1 flex-wrap">
                  {puzzle.categories?.map((c, i) => (
                    <span
                      key={i}
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: c.color + '22', color: c.color }}
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

**Verification:** Dashboard loads and shows all puzzles from GitHub. Stats cards show correct counts. Filter tabs work. Clicking a row sets editingPuzzle (editor is a stub for now).

---

## Task 4: Calendar Strip

**Files:**
- Create: `admin/src/components/CalendarStrip.jsx`

- [ ] **Step 1: Create admin/src/components/CalendarStrip.jsx**

```jsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { getPuzzleStatus, getNextDates, formatDate } from '@/lib/utils';
import { api } from '@/lib/api';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarStrip({ puzzles, sha, onRefresh }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [saving, setSaving] = useState(false);

  const dates = getNextDates(30);
  const scheduledMap = {};
  puzzles.forEach(p => {
    if (getPuzzleStatus(p.id) === 'scheduled') {
      scheduledMap[p.id] = p;
    }
  });

  const floatingPuzzles = puzzles.filter(p => getPuzzleStatus(p.id) === 'floating');

  /** Assign a floating puzzle to a date — changes its id to the date string */
  const assignPuzzle = async (puzzle, dateStr) => {
    setSaving(true);
    try {
      const updated = puzzles.map(p =>
        p === puzzle ? { ...p, id: dateStr } : p
      );
      const { sha: newSha } = await api.getPuzzles(); // Fresh SHA
      await api.savePuzzles(updated, newSha);
      setPickerOpen(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to assign puzzle:', err);
    } finally {
      setSaving(false);
    }
  };

  /** Unassign a scheduled puzzle — revert its id to its title slug */
  const unassignPuzzle = async (puzzle) => {
    setSaving(true);
    try {
      const slug = puzzle.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const updated = puzzles.map(p =>
        p.id === puzzle.id ? { ...p, id: slug } : p
      );
      const { sha: newSha } = await api.getPuzzles();
      await api.savePuzzles(updated, newSha);
      onRefresh();
    } catch (err) {
      console.error('Failed to unassign puzzle:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">Next 30 Days</h2>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {dates.map(date => {
          const dateStr = formatDate(date);
          const scheduled = scheduledMap[dateStr];
          const isToday = dateStr === formatDate(new Date());

          return (
            <div
              key={dateStr}
              className={`flex-shrink-0 w-24 rounded-lg border p-2 text-center text-xs
                ${isToday ? 'border-primary ring-1 ring-primary' : 'border-border'}
                ${scheduled ? 'bg-blue-50' : 'bg-white'}`}
            >
              <div className="font-medium">{DAY_NAMES[date.getDay()]}</div>
              <div className="text-lg font-bold">{date.getDate()}</div>
              <div className="text-muted-foreground">{date.toLocaleDateString('en', { month: 'short' })}</div>
              {scheduled ? (
                <div className="mt-1">
                  <Badge variant="secondary" className="text-[10px] truncate max-w-full">
                    {scheduled.title}
                  </Badge>
                  <button
                    className="mt-1 text-muted-foreground hover:text-destructive"
                    onClick={() => unassignPuzzle(scheduled)}
                    disabled={saving}
                  >
                    <X className="w-3 h-3 mx-auto" />
                  </button>
                </div>
              ) : (
                <button
                  className="mt-1 text-muted-foreground hover:text-primary"
                  onClick={() => { setSelectedDate(dateStr); setPickerOpen(true); }}
                >
                  <Plus className="w-4 h-4 mx-auto" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating puzzle picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign puzzle to {selectedDate}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {floatingPuzzles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No floating puzzles available</p>
            ) : (
              floatingPuzzles.map(p => (
                <Button
                  key={p.id}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={saving}
                  onClick={() => assignPuzzle(p, selectedDate)}
                >
                  {p.title}
                  <span className="ml-auto text-xs text-muted-foreground">{p.id}</span>
                </Button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Verification:** Calendar strip renders 30 date cells. Empty slots show "+". Clicking "+" opens a dialog listing floating puzzles. Selecting one assigns it (changes id in GitHub). Scheduled puzzles show title + "x" to unassign.

---

## Task 5: TMDB Search Function + Movie Search Component

**Files:**
- Create: `netlify/functions/admin-tmdb.mjs`
- Create: `admin/src/components/MovieSearch.jsx`

- [ ] **Step 1: Create netlify/functions/admin-tmdb.mjs**

```js
const TMDB_BASE = 'https://api.themoviedb.org/3';
const BEARER = process.env.TMDB_READ_ACCESS_TOKEN;

async function tmdbFetch(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${BEARER}`,
      'Content-Type': 'application/json;charset=utf-8',
    },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

export default async (req, context) => {
  // Auth check
  const cookieHeader = req.headers.get('cookie') || '';
  if (!(await verifyAuth(cookieHeader))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const query = url.searchParams.get('query');

  // Single movie details + credits
  if (id) {
    const [movie, credits] = await Promise.all([
      tmdbFetch(`${TMDB_BASE}/movie/${id}`),
      tmdbFetch(`${TMDB_BASE}/movie/${id}/credits`),
    ]);
    const director = credits.crew?.find(c => c.job === 'Director')?.name || 'Unknown';
    const stars = credits.cast?.slice(0, 3).map(c => c.name) || [];

    return Response.json({
      title: movie.title,
      year: new Date(movie.release_date).getFullYear(),
      tmdb_id: movie.id,
      summary: movie.overview,
      genres: movie.genres?.map(g => g.name) || [],
      director,
      stars,
      poster_path: movie.poster_path,
    });
  }

  // Search
  if (query) {
    const year = url.searchParams.get('year');
    let searchUrl = `${TMDB_BASE}/search/movie?query=${encodeURIComponent(query)}`;
    if (year) searchUrl += `&year=${year}`;
    const data = await tmdbFetch(searchUrl);

    const results = (data.results || []).slice(0, 10).map(m => ({
      tmdb_id: m.id,
      title: m.title,
      year: m.release_date ? new Date(m.release_date).getFullYear() : null,
      poster_path: m.poster_path,
    }));

    return Response.json({ results });
  }

  return Response.json({ error: 'Provide query or id' }, { status: 400 });
};

async function verifyAuth(cookieHeader) {
  const { jwtVerify } = await import('jose');
  const SECRET = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || 'dev-secret-change-me');
  const match = cookieHeader.match(/backroom_session=([^;]+)/);
  if (!match) return false;
  try {
    await jwtVerify(match[1], SECRET);
    return true;
  } catch {
    return false;
  }
}

export const config = {
  path: '/api/admin-tmdb',
};
```

- [ ] **Step 2: Create admin/src/components/MovieSearch.jsx**

Uses shadcn Command for autocomplete with debounced search:

```jsx
import { useState, useEffect, useRef } from 'react';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command';
import { api } from '@/lib/api';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w92';

export default function MovieSearch({ value, onChange, placeholder }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.searchMovies(query);
        setResults(data.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const selectMovie = async (movie) => {
    // Fetch full details
    try {
      const full = await api.getMovieDetails(movie.tmdb_id);
      onChange(full);
      setOpen(false);
      setQuery('');
    } catch (err) {
      console.error('Failed to fetch movie details:', err);
    }
  };

  // Show selected movie card if value is set
  if (value?.tmdb_id) {
    return (
      <div className="flex items-center gap-3 p-2 border rounded-md bg-muted/30">
        {value.poster_path && (
          <img
            src={`${TMDB_IMG}${value.poster_path}`}
            alt={value.title}
            className="w-10 h-14 object-cover rounded"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{value.title} ({value.year})</p>
          <p className="text-xs text-muted-foreground truncate">{value.director}</p>
        </div>
        <button
          className="text-xs text-muted-foreground hover:text-destructive"
          onClick={() => onChange(null)}
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Command className="border rounded-md" shouldFilter={false}>
        <CommandInput
          placeholder={placeholder || 'Search movies...'}
          value={query}
          onValueChange={(v) => { setQuery(v); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {open && query.length >= 2 && (
          <CommandList className="absolute z-50 top-full left-0 right-0 bg-white border rounded-md shadow-lg mt-1 max-h-60">
            {loading && <CommandEmpty>Searching...</CommandEmpty>}
            {!loading && results.length === 0 && <CommandEmpty>No results</CommandEmpty>}
            {results.map(m => (
              <CommandItem
                key={m.tmdb_id}
                onSelect={() => selectMovie(m)}
                className="flex items-center gap-2 cursor-pointer"
              >
                {m.poster_path ? (
                  <img src={`${TMDB_IMG}${m.poster_path}`} alt="" className="w-8 h-12 object-cover rounded" />
                ) : (
                  <div className="w-8 h-12 bg-muted rounded" />
                )}
                <span className="text-sm">{m.title}</span>
                <span className="text-xs text-muted-foreground ml-auto">{m.year}</span>
              </CommandItem>
            ))}
          </CommandList>
        )}
      </Command>
    </div>
  );
}
```

**Verification:** Type a movie title in the search field. Results appear after 300ms debounce with poster thumbnails. Selecting a movie fetches full details and shows a mini card. "Remove" clears the selection.

---

## Task 6: Manual Puzzle Editor

**Files:**
- Create: `admin/src/components/PuzzleEditor.jsx`

- [ ] **Step 1: Create admin/src/components/PuzzleEditor.jsx**

```jsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import MovieSearch from './MovieSearch';
import AiGeneratePanel from './AiGeneratePanel';
import ProcessingProgress from './ProcessingProgress';

const DIFFICULTY_OPTIONS = [
  { value: 1, label: 'Easy', color: '#4CAF50' },
  { value: 2, label: 'Medium', color: '#FFC107' },
  { value: 3, label: 'Hard', color: '#2196F3' },
  { value: 4, label: 'Devious', color: '#9C27B0' },
];

function emptyCategory(difficulty) {
  const d = DIFFICULTY_OPTIONS[difficulty - 1];
  return {
    name: '',
    difficulty: d.value,
    color: d.color,
    movies: [null, null, null, null],
  };
}

function emptyPuzzle() {
  return {
    id: '',
    title: '',
    categories: [1, 2, 3, 4].map(emptyCategory),
  };
}

export default function PuzzleEditor({ puzzle, puzzles, sha, onBack }) {
  const [data, setData] = useState(puzzle ? structuredClone(puzzle) : emptyPuzzle());
  const [collapsed, setCollapsed] = useState([false, false, false, false]);
  const [processing, setProcessing] = useState(false);
  const [tab, setTab] = useState('manual');

  const updateCategory = (catIdx, field, value) => {
    setData(prev => {
      const next = structuredClone(prev);
      next.categories[catIdx][field] = value;
      return next;
    });
  };

  const updateMovie = (catIdx, movieIdx, movie) => {
    setData(prev => {
      const next = structuredClone(prev);
      next.categories[catIdx].movies[movieIdx] = movie;
      return next;
    });
  };

  const setDifficulty = (catIdx, diff) => {
    setData(prev => {
      const next = structuredClone(prev);
      const d = DIFFICULTY_OPTIONS[diff - 1];
      next.categories[catIdx].difficulty = d.value;
      next.categories[catIdx].color = d.color;
      return next;
    });
  };

  const toggleCollapse = (idx) => {
    setCollapsed(prev => prev.map((v, i) => i === idx ? !v : v));
  };

  /** Populate editor from AI-generated data */
  const applyAiResult = (result) => {
    setData(prev => ({
      ...prev,
      title: result.title || prev.title,
      categories: result.categories || prev.categories,
    }));
    setTab('manual'); // Switch to manual tab for review
  };

  const applyCategoryAiResult = (catIdx, category) => {
    setData(prev => {
      const next = structuredClone(prev);
      next.categories[catIdx] = { ...next.categories[catIdx], ...category };
      return next;
    });
  };

  /** Validate puzzle has 4 categories x 4 movies */
  const validate = () => {
    if (!data.title.trim()) return 'Puzzle needs a title';
    for (let i = 0; i < 4; i++) {
      const cat = data.categories[i];
      if (!cat.name.trim()) return `Category ${i + 1} needs a name`;
      for (let j = 0; j < 4; j++) {
        if (!cat.movies[j]?.tmdb_id) return `Category "${cat.name}" needs movie ${j + 1}`;
      }
    }
    return null;
  };

  if (processing) {
    return <ProcessingProgress puzzle={data} puzzles={puzzles} sha={sha} onDone={onBack} />;
  }

  const validationError = validate();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold">
          {puzzle ? `Edit: ${puzzle.title}` : 'New Puzzle'}
        </h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="manual">Manual</TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="w-3 h-3 mr-1" /> AI-Assisted
          </TabsTrigger>
        </TabsList>

        {/* AI Tab */}
        <TabsContent value="ai">
          <AiGeneratePanel
            onFullPuzzle={applyAiResult}
            onCategory={(catIdx, cat) => applyCategoryAiResult(catIdx, cat)}
            categories={data.categories}
          />
        </TabsContent>

        {/* Manual Tab (also used for reviewing AI output) */}
        <TabsContent value="manual" className="space-y-4">
          {/* Title + ID */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={data.title}
                onChange={(e) => setData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Puzzle title"
              />
            </div>
            <div>
              <label className="text-sm font-medium">ID</label>
              <Input
                value={data.id}
                onChange={(e) => setData(prev => ({ ...prev, id: e.target.value }))}
                placeholder="slug or YYYY-MM-DD"
              />
            </div>
          </div>

          {/* 4 Category Sections */}
          {data.categories.map((cat, catIdx) => (
            <Card key={catIdx}>
              <CardHeader
                className="cursor-pointer flex flex-row items-center justify-between py-3"
                onClick={() => toggleCollapse(catIdx)}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <CardTitle className="text-base">
                    {cat.name || `Category ${catIdx + 1}`}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {DIFFICULTY_OPTIONS[cat.difficulty - 1]?.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {cat.movies.filter(Boolean).length}/4 movies
                  </span>
                </div>
                {collapsed[catIdx] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </CardHeader>

              {!collapsed[catIdx] && (
                <CardContent className="space-y-3">
                  {/* Category name + difficulty */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Name</label>
                      <Input
                        value={cat.name}
                        onChange={(e) => updateCategory(catIdx, 'name', e.target.value)}
                        placeholder="Category name"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Difficulty</label>
                      <div className="flex gap-1 mt-1">
                        {DIFFICULTY_OPTIONS.map(d => (
                          <button
                            key={d.value}
                            className={`w-8 h-8 rounded text-xs font-bold border-2 transition-colors
                              ${cat.difficulty === d.value ? 'border-current' : 'border-transparent opacity-50'}`}
                            style={{ color: d.color, backgroundColor: d.color + '22' }}
                            onClick={() => setDifficulty(catIdx, d.value)}
                          >
                            {d.value}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* 4 Movie search fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {cat.movies.map((movie, movieIdx) => (
                      <div key={movieIdx}>
                        <label className="text-xs text-muted-foreground">Movie {movieIdx + 1}</label>
                        <MovieSearch
                          value={movie}
                          onChange={(m) => updateMovie(catIdx, movieIdx, m)}
                          placeholder={`Search movie ${movieIdx + 1}...`}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Process & Publish */}
      <div className="flex items-center justify-between pt-4 border-t">
        {validationError && (
          <p className="text-sm text-muted-foreground">{validationError}</p>
        )}
        <div className="ml-auto">
          <Button
            size="lg"
            disabled={!!validationError}
            onClick={() => setProcessing(true)}
          >
            Process & Publish
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Verification:** Opening a puzzle shows 4 collapsible category cards. Each has name, difficulty selector, and 4 movie search fields. Validation message updates live. "Process & Publish" is disabled until all 16 movies are filled.

---

## Task 7: AI-Assisted Generation

**Files:**
- Create: `netlify/functions/admin-ai-generate.mjs`
- Create: `admin/src/components/AiGeneratePanel.jsx`

- [ ] **Step 1: Create netlify/functions/admin-ai-generate.mjs**

Uses Netlify AI Gateway to call Claude. The function proxies to the AI Gateway endpoint with the appropriate prompt.

```js
export default async (req, context) => {
  // Auth check
  const cookieHeader = req.headers.get('cookie') || '';
  if (!(await verifyAuth(cookieHeader))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await req.json();
  const { mode, theme, name } = body;

  let prompt;
  if (mode === 'full_puzzle') {
    prompt = buildFullPuzzlePrompt(theme);
  } else if (mode === 'category') {
    prompt = buildCategoryPrompt(name);
  } else {
    return Response.json({ error: 'Invalid mode' }, { status: 400 });
  }

  try {
    // Call Netlify AI Gateway
    const aiResponse = await fetch('https://ai-gateway.netlify.app/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NETLIFY_API_TOKEN || ''}`,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      const err = await aiResponse.text();
      throw new Error(`AI Gateway ${aiResponse.status}: ${err}`);
    }

    const result = await aiResponse.json();
    const text = result.content?.[0]?.text || '';

    // Extract JSON from response (Claude may wrap in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in AI response');

    const parsed = JSON.parse(jsonMatch[0]);
    return Response.json(parsed);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};

function buildFullPuzzlePrompt(theme) {
  return `You are a puzzle designer for "New Arrivals," a daily VHS rental store trivia game.

GAME CONCEPT: Players sort 16 VHS tapes into 4 hidden genre categories on a 3D shelf. Think NYT Connections meets 1980s Blockbuster Video.

THEME: "${theme}"

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

Difficulty colors: 1="#4CAF50", 2="#FFC107", 3="#2196F3", 4="#9C27B0"`;
}

function buildCategoryPrompt(categoryName) {
  return `You are a puzzle designer for "New Arrivals," a VHS rental store trivia game.

Generate exactly 4 movies for this category: "${categoryName}"

Rules:
- Movies primarily from 1970-1999
- Each movie must clearly belong to this category
- Use exact TMDB titles

OUTPUT: Valid JSON only, no commentary.
{
  "name": "${categoryName}",
  "movies": [
    { "title": "Movie Title", "year": 1985 }
  ]
}`;
}

async function verifyAuth(cookieHeader) {
  const { jwtVerify } = await import('jose');
  const SECRET = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || 'dev-secret-change-me');
  const match = cookieHeader.match(/backroom_session=([^;]+)/);
  if (!match) return false;
  try {
    await jwtVerify(match[1], SECRET);
    return true;
  } catch {
    return false;
  }
}

export const config = {
  path: '/api/admin-ai-generate',
};
```

- [ ] **Step 2: Create admin/src/components/AiGeneratePanel.jsx**

```jsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function AiGeneratePanel({ onFullPuzzle, onCategory, categories }) {
  const [theme, setTheme] = useState('');
  const [generatingFull, setGeneratingFull] = useState(false);
  const [generatingCat, setGeneratingCat] = useState(null); // index
  const [catNames, setCatNames] = useState(['', '', '', '']);

  const generateFull = async () => {
    if (!theme.trim()) return;
    setGeneratingFull(true);
    try {
      const result = await api.generatePuzzle(theme);
      onFullPuzzle(result);
    } catch (err) {
      console.error('AI generation failed:', err);
    } finally {
      setGeneratingFull(false);
    }
  };

  const generateSingleCategory = async (idx) => {
    const name = catNames[idx] || categories[idx]?.name;
    if (!name?.trim()) return;
    setGeneratingCat(idx);
    try {
      const result = await api.generateCategory(name);
      onCategory(idx, {
        name: result.name || name,
        movies: result.movies?.map(m => ({ ...m, tmdb_id: null })) || [],
        difficulty: categories[idx]?.difficulty || idx + 1,
        color: categories[idx]?.color || '#4CAF50',
      });
    } catch (err) {
      console.error('Category generation failed:', err);
    } finally {
      setGeneratingCat(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Full puzzle generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4" /> Generate Full Puzzle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Enter a theme (e.g., Easter movies, 90s date night)"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          />
          <Button onClick={generateFull} disabled={generatingFull || !theme.trim()}>
            {generatingFull ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Generate</>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            AI will create 4 categories with 4 movies each. Review and edit before publishing.
          </p>
        </CardContent>
      </Card>

      {/* Per-category generation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate by Category</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[0, 1, 2, 3].map(idx => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                className="flex-1"
                placeholder={`Category ${idx + 1} name`}
                value={catNames[idx]}
                onChange={(e) => setCatNames(prev => prev.map((v, i) => i === idx ? e.target.value : v))}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={generatingCat === idx}
                onClick={() => generateSingleCategory(idx)}
              >
                {generatingCat === idx ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Enter a category name and click sparkle to generate 4 movies for it.
            Note: AI-generated movies need TMDB verification in the manual tab.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Verification:** "Generate Full Puzzle" sends theme to AI and populates all 4 categories. Per-category sparkle buttons generate 4 movies for a single category. Results appear in the manual tab for review. Movies from AI still need TMDB search to fill `tmdb_id`.

---

## Task 8: Processing Pipeline + GitHub Commit

**Files:**
- Create: `netlify/functions/admin-process.mjs`
- Create: `netlify/functions/admin-ai-interrupts.mjs`
- Create: `admin/src/components/ProcessingProgress.jsx`

- [ ] **Step 1: Create netlify/functions/admin-ai-interrupts.mjs**

```js
export default async (req, context) => {
  const cookieHeader = req.headers.get('cookie') || '';
  if (!(await verifyAuth(cookieHeader))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const puzzle = await req.json();
  const movieList = puzzle.categories.flatMap(c =>
    c.movies.map(m => `${m.title} (${m.year})`)
  ).join(', ');
  const categoryList = puzzle.categories.map(c => c.name).join(', ');

  // Pick a random character set
  const characters = [
    { name: 'Punk Kid Boy', type: 'kid', sprite: 'punk_kid_boy', folder: 'Punk Kid Boy' },
    { name: 'Blonde Woman', type: 'adult', sprite: 'blonde_woman', folder: 'Blonde Woman' },
    { name: 'Viking Man', type: 'adult', sprite: 'viking_man', folder: 'Viking Man' },
    { name: 'Businessman', type: 'adult', sprite: 'businessman', folder: 'Businessman' },
  ];
  const char = characters[Math.floor(Math.random() * characters.length)];

  const prompt = `You are writing customer dialogue for "New Arrivals," a VHS rental store game. Customers interrupt the player while they sort tapes.

SETTING: A video rental store, Friday night, 1987. Customers are browsing, chatting, looking for movies.

CHARACTER: ${char.name} (${char.type})
PUZZLE MOVIES: ${movieList}
PUZZLE CATEGORIES: ${categoryList}

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
  { "type": "trivia", "character": "${char.name}", "sprite": "${char.sprite}", "folder": "${char.folder}", "dialogue": "...", "answers": ["A","B","C","D"], "correct": 0 },
  { "type": "hint", "character": "${char.name}", "sprite": "${char.sprite}", "folder": "${char.folder}", "dialogue": "...", "hintCategory": "...", "cost": 3 },
  { "type": "story", "character": "${char.name}", "sprite": "${char.sprite}", "folder": "${char.folder}", "dialogue": "...", "dismiss": "Button label" }
]`;

  try {
    const aiResponse = await fetch('https://ai-gateway.netlify.app/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NETLIFY_API_TOKEN || ''}`,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const result = await aiResponse.json();
    const text = result.content?.[0]?.text || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in AI response');

    return Response.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};

async function verifyAuth(cookieHeader) {
  const { jwtVerify } = await import('jose');
  const SECRET = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || 'dev-secret-change-me');
  const match = cookieHeader.match(/backroom_session=([^;]+)/);
  if (!match) return false;
  try {
    await jwtVerify(match[1], SECRET);
    return true;
  } catch {
    return false;
  }
}

export const config = {
  path: '/api/admin-ai-interrupts',
};
```

- [ ] **Step 2: Create netlify/functions/admin-process.mjs**

This orchestrates the full pipeline: TMDB enrichment, poster download + pixelation, interrupt generation, and GitHub commit.

```js
import sharp from 'sharp';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const TMDB_BEARER = process.env.TMDB_READ_ACCESS_TOKEN;
const REPO = 'your-username/new-arrivals'; // Update to actual repo
const BRANCH = 'main';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';

export default async (req, context) => {
  const cookieHeader = req.headers.get('cookie') || '';
  if (!(await verifyAuth(cookieHeader))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const puzzle = await req.json();

  try {
    // Step 1: TMDB enrichment — fill missing metadata for all 16 movies
    for (const cat of puzzle.categories) {
      for (let i = 0; i < cat.movies.length; i++) {
        const movie = cat.movies[i];
        if (!movie.summary || !movie.director) {
          const [details, credits] = await Promise.all([
            tmdbFetch(`${TMDB_BASE}/movie/${movie.tmdb_id}`),
            tmdbFetch(`${TMDB_BASE}/movie/${movie.tmdb_id}/credits`),
          ]);
          cat.movies[i] = {
            ...movie,
            summary: movie.summary || details.overview,
            genres: movie.genres || details.genres?.map(g => g.name),
            director: movie.director || credits.crew?.find(c => c.job === 'Director')?.name || 'Unknown',
            stars: movie.stars || credits.cast?.slice(0, 3).map(c => c.name),
            poster_path: movie.poster_path || details.poster_path,
          };
        }
      }
    }

    // Step 2: Download and pixelate posters
    const posterFiles = []; // { path, content (base64) }
    for (const cat of puzzle.categories) {
      for (const movie of cat.movies) {
        if (!movie.poster_path) continue;
        const tmdbId = movie.tmdb_id;

        // Download original poster
        const posterRes = await fetch(`${TMDB_IMG}${movie.poster_path}`);
        const posterBuf = Buffer.from(await posterRes.arrayBuffer());

        // Shelf version (150px wide)
        const shelfBuf = await sharp(posterBuf).resize(150).jpeg({ quality: 80 }).toBuffer();
        posterFiles.push({
          path: `public/posters/${tmdbId}.jpg`,
          content: shelfBuf.toString('base64'),
        });

        // Pixelated version (16px wide, scaled back up)
        const pixelBuf = await sharp(posterBuf)
          .resize(16, 24, { fit: 'fill' })
          .resize(150, 225, { fit: 'fill', kernel: 'nearest' })
          .jpeg({ quality: 70 })
          .toBuffer();
        posterFiles.push({
          path: `public/posters/${tmdbId}_pixel.jpg`,
          content: pixelBuf.toString('base64'),
        });

        // Remove poster_path from final data (not needed in puzzles.json)
        delete movie.poster_path;
      }
    }

    // Step 3: Generate interrupts via AI
    const interruptRes = await fetch(new URL('/api/admin-ai-interrupts', req.url).href, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify(puzzle),
    });
    const interrupts = await interruptRes.json();

    // Step 4: Commit all files to GitHub
    // Read current puzzles.json SHA
    const puzzlesFile = await githubGet(`public/puzzles.json?ref=${BRANCH}`);
    const currentPuzzles = JSON.parse(atob(puzzlesFile.content));

    // Read current interrupts.json SHA
    const interruptsFile = await githubGet(`public/interrupts.json?ref=${BRANCH}`);
    const currentInterrupts = JSON.parse(atob(interruptsFile.content));

    // Update or add the puzzle
    const existingIdx = currentPuzzles.puzzles.findIndex(p => p.id === puzzle.id);
    if (existingIdx >= 0) {
      currentPuzzles.puzzles[existingIdx] = puzzle;
    } else {
      currentPuzzles.puzzles.push(puzzle);
    }

    // Add interrupts (keyed by puzzle id for scheduled, or generic for floating)
    if (Array.isArray(interrupts)) {
      currentInterrupts[puzzle.id] = interrupts;
    }

    // Use GitHub Trees API for atomic multi-file commit
    // 1. Get current commit SHA
    const refData = await githubApiRaw(`git/refs/heads/${BRANCH}`);
    const commitSha = refData.object.sha;

    // 2. Get base tree
    const commitData = await githubApiRaw(`git/commits/${commitSha}`);
    const baseTree = commitData.tree.sha;

    // 3. Create blobs for all files
    const treeItems = [];

    // puzzles.json
    const puzzlesBlob = await githubApiRaw('git/blobs', {
      method: 'POST',
      body: JSON.stringify({
        content: JSON.stringify(currentPuzzles, null, 2),
        encoding: 'utf-8',
      }),
    });
    treeItems.push({ path: 'public/puzzles.json', mode: '100644', type: 'blob', sha: puzzlesBlob.sha });

    // interrupts.json
    const interruptsBlob = await githubApiRaw('git/blobs', {
      method: 'POST',
      body: JSON.stringify({
        content: JSON.stringify(currentInterrupts, null, 2),
        encoding: 'utf-8',
      }),
    });
    treeItems.push({ path: 'public/interrupts.json', mode: '100644', type: 'blob', sha: interruptsBlob.sha });

    // Poster files
    for (const poster of posterFiles) {
      const blob = await githubApiRaw('git/blobs', {
        method: 'POST',
        body: JSON.stringify({ content: poster.content, encoding: 'base64' }),
      });
      treeItems.push({ path: poster.path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    // 4. Create tree
    const newTree = await githubApiRaw('git/trees', {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseTree, tree: treeItems }),
    });

    // 5. Create commit
    const newCommit = await githubApiRaw('git/commits', {
      method: 'POST',
      body: JSON.stringify({
        message: `[backroom] Add/update puzzle: ${puzzle.title}`,
        tree: newTree.sha,
        parents: [commitSha],
      }),
    });

    // 6. Update ref
    await githubApiRaw(`git/refs/heads/${BRANCH}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommit.sha }),
    });

    return Response.json({
      ok: true,
      commit: newCommit.sha,
      posterCount: posterFiles.length / 2,
      interruptCount: Array.isArray(interrupts) ? interrupts.length : 0,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};

async function tmdbFetch(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TMDB_BEARER}` },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

async function githubGet(filePath) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${filePath}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) throw new Error(`GitHub GET ${res.status}`);
  return res.json();
}

async function githubApiRaw(endpoint, options = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API ${res.status}: ${err}`);
  }
  return res.json();
}

async function verifyAuth(cookieHeader) {
  const { jwtVerify } = await import('jose');
  const SECRET = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || 'dev-secret-change-me');
  const match = cookieHeader.match(/backroom_session=([^;]+)/);
  if (!match) return false;
  try {
    await jwtVerify(match[1], SECRET);
    return true;
  } catch {
    return false;
  }
}

export const config = {
  path: '/api/admin-process',
};
```

- [ ] **Step 3: Create admin/src/components/ProcessingProgress.jsx**

```jsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2, X, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';

const STEPS = [
  { key: 'validate', label: 'Validating puzzle data' },
  { key: 'enrich', label: 'Enriching TMDB metadata' },
  { key: 'posters', label: 'Downloading & pixelating posters' },
  { key: 'interrupts', label: 'Generating interrupt dialogues' },
  { key: 'commit', label: 'Committing to GitHub' },
  { key: 'deploy', label: 'Triggering deploy' },
];

export default function ProcessingProgress({ puzzle, puzzles, sha, onDone }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState('running'); // running | success | error
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    runPipeline();
  }, []);

  const runPipeline = async () => {
    try {
      // Steps 0-4 happen server-side in one call
      setCurrentStep(1);
      const res = await api.processPuzzle(puzzle);
      setCurrentStep(5);
      setResult(res);
      setStatus('success');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <h1 className="text-xl font-bold">Processing Puzzle</h1>
      <p className="text-sm text-muted-foreground">{puzzle.title}</p>

      <Card>
        <CardContent className="pt-6 space-y-3">
          {STEPS.map((step, idx) => {
            let icon;
            if (status === 'error' && idx >= currentStep) {
              icon = idx === currentStep
                ? <X className="w-4 h-4 text-destructive" />
                : <div className="w-4 h-4 rounded-full border border-muted" />;
            } else if (idx < currentStep || status === 'success') {
              icon = <Check className="w-4 h-4 text-green-600" />;
            } else if (idx === currentStep) {
              icon = <Loader2 className="w-4 h-4 animate-spin" />;
            } else {
              icon = <div className="w-4 h-4 rounded-full border border-muted" />;
            }

            return (
              <div key={step.key} className="flex items-center gap-3">
                {icon}
                <span className={`text-sm ${idx > currentStep && status !== 'success' ? 'text-muted-foreground' : ''}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {status === 'error' && (
        <div className="p-3 bg-destructive/10 rounded-md text-sm text-destructive">
          {error}
        </div>
      )}

      {status === 'success' && result && (
        <div className="p-3 bg-green-50 rounded-md text-sm space-y-1">
          <p className="font-medium text-green-800">Published successfully!</p>
          <p className="text-green-700">
            {result.posterCount} posters processed, {result.interruptCount} interrupts generated.
          </p>
          <p className="text-green-600 text-xs">
            Deploy will be live in ~30 seconds.
          </p>
        </div>
      )}

      <Button variant="outline" onClick={onDone}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>
    </div>
  );
}
```

**Verification:** Clicking "Process & Publish" shows the progress screen. Steps animate through as the server processes. On success, shows commit SHA and poster/interrupt counts. On error, shows the error message with a clear indication of which step failed.

---

## Environment Variables Checklist

Before first deploy, set in Netlify Dashboard:

| Key | Value | Notes |
|-----|-------|-------|
| `TMDB_READ_ACCESS_TOKEN` | (existing) | Already set |
| `GITHUB_TOKEN` | (existing) | Already set |
| `ADMIN_JWT_SECRET` | (random 32+ char string) | `openssl rand -hex 32` |

The `REPO` constant in `admin-puzzles.mjs` and `admin-process.mjs` must be updated to the actual GitHub `owner/repo` path.
