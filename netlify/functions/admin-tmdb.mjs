import { verifyToken, authResponse } from './lib/auth.mjs';

const TMDB_BASE = 'https://api.themoviedb.org/3';

function tmdbHeaders() {
  return {
    Authorization: `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}`,
    Accept: 'application/json',
  };
}

async function handleSearch(query, year) {
  const params = new URLSearchParams({ query });
  if (year) params.set('year', year);

  const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, {
    headers: tmdbHeaders(),
  });

  if (!res.ok) {
    const err = await res.text();
    return authResponse(res.status, { error: `TMDB API error: ${err}` });
  }

  const data = await res.json();
  const results = (data.results || []).slice(0, 10).map((m) => ({
    tmdb_id: m.id,
    title: m.title,
    year: m.release_date ? m.release_date.slice(0, 4) : null,
    poster_path: m.poster_path,
    overview: m.overview,
  }));

  return authResponse(200, results);
}

async function handleDetails(id) {
  const res = await fetch(
    `${TMDB_BASE}/movie/${id}?append_to_response=credits`,
    { headers: tmdbHeaders() }
  );

  if (!res.ok) {
    const err = await res.text();
    return authResponse(res.status, { error: `TMDB API error: ${err}` });
  }

  const m = await res.json();
  const director =
    m.credits?.crew?.find((c) => c.job === 'Director')?.name || null;
  const stars = (m.credits?.cast || []).slice(0, 5).map((c) => c.name);

  return authResponse(200, {
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

export async function handler(event) {
  const isAuthed = await verifyToken(event.headers.cookie);
  if (!isAuthed) return authResponse(401, { error: 'Unauthorized' });

  if (event.httpMethod !== 'GET') {
    return authResponse(405, { error: 'Method not allowed' });
  }

  const params = event.queryStringParameters || {};

  if (params.id) {
    return handleDetails(params.id);
  }

  if (params.query) {
    return handleSearch(params.query, params.year);
  }

  return authResponse(400, { error: 'Provide ?query= or ?id= parameter' });
}
