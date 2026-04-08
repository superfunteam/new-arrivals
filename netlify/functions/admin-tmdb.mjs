import { verifyToken } from './lib/auth.mjs';

const TMDB_BASE = 'https://api.themoviedb.org/3';

function tmdbHeaders() {
  return {
    Authorization: `Bearer ${Netlify.env.get("TMDB_READ_ACCESS_TOKEN")}`,
    Accept: 'application/json',
  };
}

// Netlify Functions v2
export default async (req, context) => {
  console.log(`[admin-tmdb] ${req.method} ${req.url}`);
  const cookie = req.headers.get('cookie');
  const authed = await verifyToken(cookie);
  console.log(`[admin-tmdb] Auth: cookie=${!!cookie}, verified=${authed}`);
  if (!authed) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
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
      console.log(`[admin-tmdb] Fetching TMDB details for id=${id}`);
      const res = await fetch(
        `${TMDB_BASE}/movie/${id}?append_to_response=credits`,
        { headers: tmdbHeaders() }
      );
      console.log(`[admin-tmdb] TMDB detail response: ${res.status}`);
      if (!res.ok) {
        const errBody = await res.text();
        console.log(`[admin-tmdb] TMDB error: ${errBody.slice(0, 200)}`);
        return Response.json({ error: 'TMDB error', tmdbStatus: res.status }, { status: 502 });
      }

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

      console.log(`[admin-tmdb] Searching TMDB: query=${query}, year=${year}`);
      console.log(`[admin-tmdb] TMDB token present: ${!!Netlify.env.get("TMDB_READ_ACCESS_TOKEN")}`);
      const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, {
        headers: tmdbHeaders(),
      });
      console.log(`[admin-tmdb] TMDB response status: ${res.status}`);
      if (!res.ok) {
        const errBody = await res.text();
        console.log(`[admin-tmdb] TMDB error body: ${errBody.slice(0, 200)}`);
        return Response.json({ error: 'TMDB error', tmdbStatus: res.status, detail: errBody.slice(0, 200) }, { status: 502 });
      }

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


export const config = { path: '/api/admin-tmdb' };
