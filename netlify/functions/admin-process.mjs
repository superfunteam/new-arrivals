import { verifyToken } from './lib/auth.mjs';

const REPO = 'superfunteam/new-arrivals';
const GH_API = `https://api.github.com/repos/${REPO}`;
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

function ghHeaders() {
  return {
    Authorization: `Bearer ${Netlify.env.get("GITHUB_TOKEN")}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'new-arrivals-admin',
    'Content-Type': 'application/json',
  };
}

// --- Poster pipeline using sharp ---

async function downloadPosterBuffer(posterPath) {
  const url = `${TMDB_IMAGE_BASE}${posterPath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download poster: ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function processPosters(posterPath, tmdbId) {
  // Dynamic import of sharp (available in Netlify Functions with Node 22)
  const sharp = (await import('sharp')).default;

  const original = await downloadPosterBuffer(posterPath);

  // Shelf version: 6x9 -> 320x480 nearest-neighbor JPEG
  const shelfBuf = await sharp(original)
    .resize(6, 9, { kernel: sharp.kernel.nearest })
    .resize(320, 480, { kernel: sharp.kernel.nearest })
    .jpeg({ quality: 80 })
    .toBuffer();

  // Detail version: 54x81 native PNG
  const detailBuf = await sharp(original)
    .resize(54, 81, { kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();

  return {
    original: { buffer: original, path: `public/posters/${tmdbId}.jpg` },
    shelf: { buffer: shelfBuf, path: `public/posters/${tmdbId}_pixel.jpg` },
    detail: { buffer: detailBuf, path: `public/posters/${tmdbId}_pixel_detail.png` },
  };
}

// Process posters in parallel batches
async function processAllPosters(movies) {
  const allPosters = [];
  const BATCH_SIZE = 4;

  for (let i = 0; i < movies.length; i += BATCH_SIZE) {
    const batch = movies.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (movie) => {
        if (!movie.poster_path || !movie.tmdb_id) return [];
        try {
          const posters = await processPosters(movie.poster_path, movie.tmdb_id);
          return [posters.original, posters.shelf, posters.detail];
        } catch (err) {
          console.error(`Poster processing failed for ${movie.title}:`, err.message);
          return [];
        }
      })
    );
    allPosters.push(...results.flat());
  }

  return allPosters;
}

// --- GitHub Trees API for atomic multi-file commit ---

async function getRef(branch = 'main') {
  const res = await fetch(`${GH_API}/git/ref/heads/${branch}`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`Failed to get ref: ${await res.text()}`);
  const data = await res.json();
  return data.object.sha;
}

async function getCommit(sha) {
  const res = await fetch(`${GH_API}/git/commits/${sha}`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`Failed to get commit: ${await res.text()}`);
  return res.json();
}

async function createBlob(content, encoding = 'utf-8') {
  const res = await fetch(`${GH_API}/git/blobs`, {
    method: 'POST',
    headers: ghHeaders(),
    body: JSON.stringify({ content, encoding }),
  });
  if (!res.ok) throw new Error(`Failed to create blob: ${await res.text()}`);
  const data = await res.json();
  return data.sha;
}

async function createTree(baseTreeSha, files) {
  const tree = files.map((f) => ({
    path: f.path,
    mode: '100644',
    type: 'blob',
    sha: f.sha,
  }));

  const res = await fetch(`${GH_API}/git/trees`, {
    method: 'POST',
    headers: ghHeaders(),
    body: JSON.stringify({ base_tree: baseTreeSha, tree }),
  });
  if (!res.ok) throw new Error(`Failed to create tree: ${await res.text()}`);
  const data = await res.json();
  return data.sha;
}

async function createCommit(treeSha, parentSha, message) {
  const res = await fetch(`${GH_API}/git/commits`, {
    method: 'POST',
    headers: ghHeaders(),
    body: JSON.stringify({
      message,
      tree: treeSha,
      parents: [parentSha],
    }),
  });
  if (!res.ok) throw new Error(`Failed to create commit: ${await res.text()}`);
  const data = await res.json();
  return data.sha;
}

async function updateRef(sha, branch = 'main') {
  const res = await fetch(`${GH_API}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: ghHeaders(),
    body: JSON.stringify({ sha }),
  });
  if (!res.ok) throw new Error(`Failed to update ref: ${await res.text()}`);
  return res.json();
}

async function getFileContent(filePath) {
  const res = await fetch(`${GH_API}/contents/${filePath}`, { headers: ghHeaders() });
  if (!res.ok) {
    if (res.status === 404) return { content: null, sha: null };
    throw new Error(`Failed to get file: ${await res.text()}`);
  }
  const data = await res.json();
  const content = JSON.parse(Buffer.from(data.content, 'base64').toString());
  return { content, sha: data.sha };
}

// Create blobs in parallel batches to stay within rate limits
async function createBlobsBatch(files, batchSize = 5) {
  const results = [];
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const shas = await Promise.all(
      batch.map(async (f) => {
        const encoding = f.binary ? 'base64' : 'utf-8';
        const content = f.binary
          ? f.buffer.toString('base64')
          : f.content;
        const sha = await createBlob(content, encoding);
        return { path: f.path, sha };
      })
    );
    results.push(...shas);
  }
  return results;
}

export default async (req, context) => {
  console.log(`[admin-process] ${req.method} ${req.url}`);
  const cookie = req.headers.get('cookie');
  if (!(await verifyToken(cookie))) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  try {
    const { puzzle, interrupts } = await req.json();

    if (!puzzle || !puzzle.categories || !puzzle.id || !puzzle.title) {
      return Response.json({ error: 'Complete puzzle data is required' }, { status: 400 });
    }

    if (!interrupts || !Array.isArray(interrupts)) {
      return Response.json({ error: 'Interrupts array is required' }, { status: 400 });
    }

    // Format puzzle for puzzles.json (use "movies" key, not "items")
    const formattedPuzzle = {
      id: puzzle.id,
      title: puzzle.title,
      categories: puzzle.categories.map((cat) => ({
        name: cat.name,
        difficulty: cat.difficulty,
        color: cat.color || ['#4CAF50', '#FFC107', '#2196F3', '#9C27B0'][cat.difficulty - 1],
        movies: (cat.items || cat.movies || []).map((m) => ({
          title: m.title,
          year: typeof m.year === 'string' ? parseInt(m.year, 10) : m.year,
          tmdb_id: m.tmdb_id,
          summary: m.summary || '',
          genres: m.genres || [],
          director: m.director || null,
          stars: m.stars || [],
        })),
      })),
    };

    // 1. Read current puzzles.json and interrupts.json from GitHub
    const [puzzlesFile, interruptsFile] = await Promise.all([
      getFileContent('public/puzzles.json'),
      getFileContent('public/interrupts.json'),
    ]);

    const currentPuzzles = puzzlesFile.content || { puzzles: [] };
    const currentInterrupts = interruptsFile.content || {};

    // Update or add puzzle
    const existingIdx = currentPuzzles.puzzles.findIndex((p) => p.id === puzzle.id);
    if (existingIdx >= 0) {
      currentPuzzles.puzzles[existingIdx] = formattedPuzzle;
    } else {
      currentPuzzles.puzzles.push(formattedPuzzle);
    }

    // Add interrupts keyed by puzzle ID
    currentInterrupts[puzzle.id] = interrupts;

    // 2. Process posters for all movies
    const allMovies = formattedPuzzle.categories.flatMap((cat) => cat.movies);
    const posterFiles = await processAllPosters(allMovies);

    // 3. Prepare all files for commit
    const filesToCommit = [
      {
        path: 'public/puzzles.json',
        content: JSON.stringify(currentPuzzles, null, 2),
        binary: false,
      },
      {
        path: 'public/interrupts.json',
        content: JSON.stringify(currentInterrupts, null, 2),
        binary: false,
      },
      ...posterFiles.map((pf) => ({
        path: pf.path,
        buffer: pf.buffer,
        binary: true,
      })),
    ];

    // 4. Atomic commit via GitHub Trees API
    const headSha = await getRef('main');
    const headCommit = await getCommit(headSha);
    const baseTreeSha = headCommit.tree.sha;

    // Create blobs for all files
    const blobResults = await createBlobsBatch(filesToCommit);

    // Create tree
    const newTreeSha = await createTree(baseTreeSha, blobResults);

    // Create commit
    const commitMessage = existingIdx >= 0
      ? `Update puzzle: ${puzzle.title}`
      : `Add puzzle: ${puzzle.title}`;
    const newCommitSha = await createCommit(newTreeSha, headSha, commitMessage);

    // Update ref
    await updateRef(newCommitSha);

    return Response.json({
      ok: true,
      commitSha: newCommitSha,
      message: commitMessage,
      filesCommitted: filesToCommit.length,
    });
  } catch (err) {
    console.error('Process error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
};


export const config = { path: '/api/admin-process' };
