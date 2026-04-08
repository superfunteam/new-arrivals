import React, { useState } from 'react';
import { apiPost, apiGet } from '../lib/api';

function SparkleIcon({ size = 20 }) {
  return (
    <span className="material-symbols-rounded" style={{ fontSize: size, fontVariationSettings: "'FILL' 1", lineHeight: 1 }}>
      auto_awesome
    </span>
  );
}

// Look up a movie on TMDB by title+year, return full details
async function tmdbLookup(title, year) {
  try {
    const params = new URLSearchParams({ query: title });
    if (year) params.set('year', String(year));

    const res = await fetch(`/api/admin-tmdb?${params}`);
    if (!res.ok) return null;
    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    // Get full details for the first match
    const detailRes = await fetch(`/api/admin-tmdb?id=${results[0].tmdb_id}`);
    if (!detailRes.ok) return results[0];
    return detailRes.json();
  } catch {
    return null;
  }
}

// Resolve all movies via TMDB lookup in parallel (batched)
async function resolveMoviesViaTmdb(movies) {
  const BATCH = 4;
  const results = [];
  for (let i = 0; i < movies.length; i += BATCH) {
    const batch = movies.slice(i, i + BATCH);
    const resolved = await Promise.all(
      batch.map((m) => tmdbLookup(m.title, m.year))
    );
    results.push(
      ...batch.map((m, idx) => resolved[idx] || { title: m.title, year: m.year })
    );
  }
  return results;
}

export function FullPuzzleSparkle({ onGenerated, existingTitle }) {
  const [theme, setTheme] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleGenerate() {
    const input = theme.trim() || existingTitle;
    if (!input) return;

    setLoading(true);
    setError(null);

    try {
      // Call AI generate
      const aiResult = await apiPost('/admin-ai-generate', {
        mode: 'full_puzzle',
        theme: input,
      });

      // AI returns { title, categories: [{ name, difficulty, color, movies: [{ title, year }] }] }
      // We need to resolve each movie via TMDB for full data
      const allAiMovies = aiResult.categories.flatMap((cat) => cat.movies || []);
      const resolvedMovies = await resolveMoviesViaTmdb(allAiMovies);

      // Rebuild categories with resolved TMDB data
      let movieIdx = 0;
      const categories = aiResult.categories.map((cat) => ({
        name: cat.name,
        difficulty: cat.difficulty,
        items: (cat.movies || []).map(() => {
          const resolved = resolvedMovies[movieIdx++];
          return resolved?.tmdb_id ? resolved : null;
        }),
      }));

      onGenerated({
        title: aiResult.title || input,
        categories,
      });
    } catch (err) {
      console.error('AI generation failed:', err);
      setError(err.message || 'AI generation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: '#fefce8',
        border: '1px solid #fde68a',
        borderRadius: 8,
        padding: 16,
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <SparkleIcon size={18} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
          AI Puzzle Generator
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="Enter a puzzle theme (e.g. 90s date night, scary Halloween)..."
          disabled={loading}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #fde68a',
            borderRadius: 6,
            fontSize: 13,
            outline: 'none',
            background: '#fff',
            boxSizing: 'border-box',
          }}
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || (!theme.trim() && !existingTitle)}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: 6,
            background: loading ? '#d1d5db' : '#f59e0b',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {loading ? (
            <>
              <Spinner /> Generating...
            </>
          ) : (
            <>
              <SparkleIcon size={16} /> Generate Full Puzzle
            </>
          )}
        </button>
      </div>
      {error && (
        <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{error}</p>
      )}
      {loading && (
        <p style={{ color: '#92400e', fontSize: 12, marginTop: 8 }}>
          Calling Claude to design your puzzle, then looking up each movie on TMDB...
        </p>
      )}
    </div>
  );
}

export function CategorySparkle({ categoryName, existingMovies, onMoviesGenerated }) {
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    if (!categoryName.trim()) return;

    setLoading(true);

    try {
      // Get list of already-used movie titles to avoid duplicates
      const usedTitles = existingMovies
        .filter((m) => m && m.title)
        .map((m) => m.title);

      const aiMovies = await apiPost('/admin-ai-generate', {
        mode: 'category',
        name: categoryName,
        existingMovies: usedTitles,
      });

      // Resolve via TMDB
      const movies = Array.isArray(aiMovies) ? aiMovies : [];
      const resolved = await resolveMoviesViaTmdb(movies);

      onMoviesGenerated(
        resolved.map((m) => (m?.tmdb_id ? m : null))
      );
    } catch (err) {
      console.error('Category generation failed:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={loading || !categoryName.trim()}
      title={categoryName.trim() ? `Generate 4 movies for "${categoryName}"` : 'Enter a category name first'}
      style={{
        border: 'none',
        background: loading ? '#d1d5db' : '#f59e0b',
        color: '#fff',
        cursor: loading || !categoryName.trim() ? 'not-allowed' : 'pointer',
        padding: '4px 10px',
        borderRadius: 6,
        opacity: !categoryName.trim() ? 0.4 : 1,
        transition: 'opacity 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {loading ? <Spinner size={14} /> : <><SparkleIcon size={16} /> AI Fill</>}
    </button>
  );
}

function Spinner({ size = 14 }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2px solid #e5e7eb`,
        borderTopColor: '#6b7280',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
        verticalAlign: 'middle',
      }}
    />
  );
}

// Inject the keyframe animation once
if (typeof document !== 'undefined' && !document.getElementById('sparkle-spinner-style')) {
  const style = document.createElement('style');
  style.id = 'sparkle-spinner-style';
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

export default { FullPuzzleSparkle, CategorySparkle };
