import { verifyToken, authResponse } from './lib/auth.mjs';

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

  const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, {
    headers: tmdbHeaders(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] || null;
}

async function getMovieDetails(tmdbId) {
  const res = await fetch(
    `${TMDB_BASE}/movie/${tmdbId}?append_to_response=credits`,
    { headers: tmdbHeaders() }
  );
  if (!res.ok) return null;
  const m = await res.json();

  const director =
    m.credits?.crew?.find((c) => c.job === 'Director')?.name || null;
  const stars = (m.credits?.cast || [])
    .sort((a, b) => a.order - b.order)
    .slice(0, 3)
    .map((c) => c.name);

  return {
    tmdb_id: m.id,
    title: m.title,
    year: m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : null,
    poster_path: m.poster_path,
    genres: (m.genres || []).map((g) => g.name),
    director,
    stars,
    summary: m.overview || '',
  };
}

async function enrichMovie(movie) {
  // If we already have full data, skip
  if (
    movie.tmdb_id &&
    movie.poster_path &&
    movie.genres?.length &&
    movie.director &&
    movie.stars?.length &&
    movie.summary
  ) {
    return movie;
  }

  // If we have tmdb_id, fetch details directly
  if (movie.tmdb_id) {
    const details = await getMovieDetails(movie.tmdb_id);
    if (details) {
      return { ...movie, ...details };
    }
    return movie;
  }

  // Search TMDB by title + year
  const result = await searchMovie(movie.title, movie.year);
  if (!result) return movie;

  const details = await getMovieDetails(result.id);
  if (details) {
    return { ...movie, ...details };
  }

  return {
    ...movie,
    tmdb_id: result.id,
    poster_path: result.poster_path,
  };
}

// Process movies in batches to avoid rate limits
async function enrichBatch(movies, batchSize = 4) {
  const results = [];
  for (let i = 0; i < movies.length; i += batchSize) {
    const batch = movies.slice(i, i + batchSize);
    const enriched = await Promise.all(batch.map(enrichMovie));
    results.push(...enriched);
  }
  return results;
}

export async function handler(event) {
  const isAuthed = await verifyToken(event.headers.cookie);
  if (!isAuthed) return authResponse(401, { error: 'Unauthorized' });

  if (event.httpMethod !== 'POST') {
    return authResponse(405, { error: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { puzzle } = body;

    if (!puzzle || !puzzle.categories) {
      return authResponse(400, { error: 'Puzzle data with categories is required' });
    }

    // Collect all movies for enrichment
    const allMovies = puzzle.categories.flatMap((cat) =>
      (cat.items || cat.movies || [])
    );

    const enrichedMovies = await enrichBatch(allMovies);

    // Rebuild puzzle with enriched data
    let movieIdx = 0;
    const enrichedPuzzle = {
      ...puzzle,
      categories: puzzle.categories.map((cat) => {
        const items = (cat.items || cat.movies || []).map(() => {
          return enrichedMovies[movieIdx++];
        });
        return { ...cat, items, movies: undefined };
      }),
    };

    return authResponse(200, { puzzle: enrichedPuzzle });
  } catch (err) {
    console.error('TMDB enrich error:', err);
    return authResponse(500, { error: err.message });
  }
}
