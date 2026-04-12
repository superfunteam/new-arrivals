import React, { useState } from 'react';
import { apiPost, apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';

// Look up a movie on TMDB by title+year, return full details
async function tmdbLookup(title, year) {
  try {
    const params = new URLSearchParams({ query: title });
    if (year) params.set('year', String(year));

    const searchRes = await apiFetch(`/admin-tmdb?${params}`);
    if (!searchRes.ok) return null;
    const results = await searchRes.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    const detailRes = await apiFetch(`/admin-tmdb?id=${results[0].tmdb_id}`);
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

export function FullPuzzleSparkle({ onGenerated, existingTitle, onLoadingChange }) {
  const [theme, setTheme] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleGenerate() {
    const input = theme.trim() || existingTitle;
    if (!input) return;

    setLoading(true);
    setError(null);
    if (onLoadingChange) onLoadingChange(true);

    try {
      const aiResult = await apiPost('/admin-ai-generate', {
        mode: 'full_puzzle',
        theme: input,
      });

      const allAiMovies = aiResult.categories.flatMap((cat) => cat.movies || []);
      const resolvedMovies = await resolveMoviesViaTmdb(allAiMovies);

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
      if (onLoadingChange) onLoadingChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mb-6 border-amber-200 bg-amber-50/30">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10">
            <Sparkles className="size-3.5 text-amber-600" />
          </div>
          <span className="text-sm font-semibold text-amber-800">
            AI Puzzle Generator
          </span>
          <Badge variant="outline" className="ml-auto border-amber-200 text-amber-700 text-[10px]">
            Claude
          </Badge>
        </div>
        <div className="flex gap-2">
          <Input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Enter a puzzle theme (e.g. 90s date night, scary Halloween)..."
            disabled={loading}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            className="flex-1 border-amber-200 bg-white focus-visible:ring-amber-400"
          />
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={loading || (!theme.trim() && !existingTitle)}
            className="bg-amber-500 text-white hover:bg-amber-600 shadow-none whitespace-nowrap"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" />
                Generate Full Puzzle
              </>
            )}
          </Button>
        </div>
        {error && (
          <p className="text-sm text-destructive mt-2">{error}</p>
        )}
        {loading && (
          <p className="text-xs text-amber-700 mt-2">
            Calling Claude to design your puzzle, then looking up each movie on TMDB...
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function CategorySparkle({ categoryName, existingMovies, onMoviesGenerated, onLoadingChange }) {
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    if (!categoryName.trim()) return;

    setLoading(true);
    if (onLoadingChange) onLoadingChange(true);

    try {
      const usedTitles = existingMovies
        .filter((m) => m && m.title)
        .map((m) => m.title);

      const aiMovies = await apiPost('/admin-ai-generate', {
        mode: 'category',
        name: categoryName,
        existingMovies: usedTitles,
      });

      const movies = Array.isArray(aiMovies) ? aiMovies : [];
      const resolved = await resolveMoviesViaTmdb(movies);

      onMoviesGenerated(
        resolved.map((m) => (m?.tmdb_id ? m : null))
      );
    } catch (err) {
      console.error('Category generation failed:', err);
      if (onLoadingChange) onLoadingChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={handleGenerate}
      disabled={loading || !categoryName.trim()}
      title={categoryName.trim() ? `Generate 4 movies for "${categoryName}"` : 'Enter a category name first'}
      className="h-10 w-10 shrink-0 bg-amber-500 text-white hover:bg-amber-600 shadow-none p-0 disabled:opacity-40"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Sparkles className="size-4" />
      )}
    </Button>
  );
}

export default { FullPuzzleSparkle, CategorySparkle };
