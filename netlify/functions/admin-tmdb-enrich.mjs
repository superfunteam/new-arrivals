import { verifyToken } from './lib/auth.mjs';

const TMDB_BASE = 'https://api.themoviedb.org/3';

function tmdbHeaders() {
  return {
    Authorization: `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}`,
    Accept: 'application/json',
  };
}

async function searchMovie(title, year) {
  const params = new URLSearchParams({ query: title });
  if (year) params.set('year', String(year));
  const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, { headers: tmdbHeaders() });
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] || null;
}

async function getMovieDetails(tmdbId) {
  const res = await fetch(`${TMDB_BASE}/movie/${tmdbId}?append_to_response=credits`, { headers: tmdbHeaders() });
  if (!res.ok) return null;
  const m = await res.json();
  const director = m.credits?.crew?.find((c) => c.job === 'Director')?.name || null;
  const stars = (m.credits?.cast || []).sort((a, b) => a.order - b.order).slice(0, 3).map((c) => c.name);
  return {
    tmdb_id: m.id, title: m.title,
    year: m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : null,
    poster_path: m.poster_path, genres: (m.genres || []).map((g) => g.name),
    director, stars, summary: m.overview || '',
  };
}

async function enrichMovie(movie) {
  if (movie.tmdb_id && movie.poster_path && movie.genres?.length && movie.director && movie.stars?.length && movie.summary) return movie;
  if (movie.tmdb_id) { const d = await getMovieDetails(movie.tmdb_id); return d ? { ...movie, ...d } : movie; }
  const result = await searchMovie(movie.title, movie.year);
  if (!result) return movie;
  const d = await getMovieDetails(result.id);
  return d ? { ...movie, ...d } : { ...movie, tmdb_id: result.id, poster_path: result.poster_path };
}

async function enrichBatch(movies, batchSize = 4) {
  const results = [];
  for (let i = 0; i < movies.length; i += batchSize) {
    const batch = movies.slice(i, i + batchSize);
    results.push(...await Promise.all(batch.map(enrichMovie)));
  }
  return results;
}

export default async (req, context) => {
  console.log(`[admin-tmdb-enrich] ${req.method} ${req.url}`);
  const cookie = req.headers.get('cookie');
  if (!(await verifyToken(cookie))) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  try {
    const { puzzle } = await req.json();
    if (!puzzle?.categories) return Response.json({ error: 'Puzzle data required' }, { status: 400 });

    const allMovies = puzzle.categories.flatMap((cat) => cat.items || cat.movies || []);
    const enriched = await enrichBatch(allMovies);

    let idx = 0;
    const enrichedPuzzle = {
      ...puzzle,
      categories: puzzle.categories.map((cat) => ({
        ...cat,
        items: (cat.items || cat.movies || []).map(() => enriched[idx++]),
        movies: undefined,
      })),
    };

    return Response.json({ puzzle: enrichedPuzzle });
  } catch (err) {
    console.error('TMDB enrich error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
};


export const config = { path: '/api/admin-tmdb-enrich' };
