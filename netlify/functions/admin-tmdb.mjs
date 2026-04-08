import { verifyToken } from './lib/auth.mjs';

const TMDB_BASE = 'https://api.themoviedb.org/3';

function tmdbHeaders() {
  return {
    Authorization: `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}`,
    Accept: 'application/json',
  };
}

// Netlify Functions v2
export default async (req, context) => {
  const cookie = req.headers.get('cookie');
  console.log('TMDB auth debug — cookie present:', !!cookie, 'cookie value:', cookie?.substring(0, 50));
  const authResult = await verifyToken(cookie);
  console.log('TMDB auth debug — verifyToken result:', authResult);
  if (!authResult) {
    return Response.json({ error: 'Unauthorized', debug: { hasCookie: !!cookie } }, { status: 401 });
  }

  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const url = new URL(req.url);
  const query = url.searchParams.get('query');
  const year = url.searchParams.get('year');
  const id = url.searchParams.get('id');

  try {
    if (id) {
      // Movie details + credits
      const res = await fetch(
        `${TMDB_BASE}/movie/${id}?append_to_response=credits`,
        { headers: tmdbHeaders() }
      );
      if (!res.ok) return Response.json({ error: 'TMDB error' }, { status: res.status });

      const m = await res.json();
      const director = m.credits?.crew?.find((c) => c.job === 'Director')?.name || null;
      const stars = (m.credits?.cast || []).slice(0, 5).map((c) => c.name);

      return Response.json({
        tmdb_id: m.id,
        title: m.title,
        year: m.release_date ? m.release_date.slice(0, 4) : null,
        poster_path: m.poster_path,
        genres: (m.genres || []).map((g) => g.name),
        director,
        stars,
        summary: m.overview,
      });
    }

    if (query) {
      // Search movies
      const params = new URLSearchParams({ query });
      if (year) params.set('year', year);

      const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, {
        headers: tmdbHeaders(),
      });
      if (!res.ok) return Response.json({ error: 'TMDB error' }, { status: res.status });

      const data = await res.json();
      const results = (data.results || []).slice(0, 10).map((m) => ({
        tmdb_id: m.id,
        title: m.title,
        year: m.release_date ? m.release_date.slice(0, 4) : null,
        poster_path: m.poster_path,
        overview: m.overview,
      }));

      return Response.json(results);
    }

    return Response.json({ error: 'Provide ?query= or ?id= parameter' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};

export const config = {
  path: '/api/admin-tmdb',
};
