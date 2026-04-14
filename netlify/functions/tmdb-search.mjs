const TMDB_BASE = 'https://api.themoviedb.org/3';

export default async (req, context) => {
  if (req.method !== 'GET') {
    return Response.json({ error: 'GET only' }, { status: 405 });
  }

  const token = Netlify.env.get('TMDB_ACCESS_TOKEN');
  if (!token) return Response.json([]);

  const url = new URL(req.url);
  const query = url.searchParams.get('q');
  if (!query || query.length < 2) return Response.json([]);

  const params = new URLSearchParams({
    query,
    language: 'en-US',
    include_adult: 'false',
    region: 'US',
  });

  const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  if (!res.ok) return Response.json([]);

  const data = await res.json();
  const results = (data.results || [])
    .sort((a, b) => {
      const aEn = a.original_language === 'en' ? 0 : 1;
      const bEn = b.original_language === 'en' ? 0 : 1;
      if (aEn !== bEn) return aEn - bEn;
      return (b.popularity || 0) - (a.popularity || 0);
    })
    .slice(0, 8)
    .map(m => ({
      id: m.id,
      title: m.title,
      year: m.release_date ? m.release_date.slice(0, 4) : null,
      poster: m.poster_path ? `https://image.tmdb.org/t/p/w92${m.poster_path}` : null,
    }));

  return Response.json(results, {
    headers: { 'Cache-Control': 'public, max-age=86400' },
  });
};

export const config = { path: '/api/tmdb-search' };
