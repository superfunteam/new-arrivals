import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2 } from 'lucide-react';
import MovieSearch from './MovieSearch';
import { FullPuzzleSparkle, CategorySparkle } from './AiGeneratePanel';
import ProcessingProgress from './ProcessingProgress';

const DIFFICULTIES = [
  { value: 1, label: 'Easy', tw: 'border-l-emerald-500', dot: 'bg-emerald-500' },
  { value: 2, label: 'Medium', tw: 'border-l-amber-500', dot: 'bg-amber-500' },
  { value: 3, label: 'Hard', tw: 'border-l-blue-500', dot: 'bg-blue-500' },
  { value: 4, label: 'Devious', tw: 'border-l-purple-500', dot: 'bg-purple-500' },
];

const DIFFICULTY_COLORS = {
  1: '#4CAF50',
  2: '#FFC107',
  3: '#2196F3',
  4: '#9C27B0',
};

function emptyCategory(index) {
  return {
    name: '',
    difficulty: index + 1,
    items: [null, null, null, null],
  };
}

function initCategories(puzzle) {
  if (!puzzle || !puzzle.categories) {
    return [emptyCategory(0), emptyCategory(1), emptyCategory(2), emptyCategory(3)];
  }
  return puzzle.categories.map((cat, i) => ({
    name: cat.name || '',
    difficulty: cat.difficulty || i + 1,
    items: (cat.items || cat.movies || []).map((item) =>
      item && item.tmdb_id ? item : null
    ).concat(Array(4).fill(null)).slice(0, 4),
  }));
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function PuzzleEditor({ puzzle, onSave, onCancel }) {
  const [title, setTitle] = useState(puzzle?.title || '');
  const [categories, setCategories] = useState(() => initCategories(puzzle));
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [processing, setProcessing] = useState(false);

  function updateCategory(catIdx, field, value) {
    setCategories((prev) =>
      prev.map((cat, i) => (i === catIdx ? { ...cat, [field]: value } : cat))
    );
  }

  function updateMovie(catIdx, movieIdx, movie) {
    setCategories((prev) =>
      prev.map((cat, i) => {
        if (i !== catIdx) return cat;
        const items = [...cat.items];
        items[movieIdx] = movie;
        return { ...cat, items };
      })
    );
  }

  function validate() {
    const errs = {};
    if (!title.trim()) errs.title = 'Title is required';

    categories.forEach((cat, ci) => {
      if (!cat.name.trim()) errs[`cat_${ci}_name`] = 'Category name is required';
      cat.items.forEach((item, mi) => {
        if (!item || !item.tmdb_id) {
          errs[`cat_${ci}_movie_${mi}`] = 'Select a movie from TMDB search';
        }
      });
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function isValid() {
    if (!title.trim()) return false;
    return categories.every(
      (cat) =>
        cat.name.trim() &&
        cat.items.every((item) => item && item.tmdb_id)
    );
  }

  function handleSave() {
    setSubmitted(true);
    if (!validate()) return;

    const id = puzzle?.id || slugify(title);
    const puzzleData = {
      id,
      title: title.trim(),
      categories: categories.map((cat) => ({
        name: cat.name.trim(),
        difficulty: cat.difficulty,
        color: DIFFICULTY_COLORS[cat.difficulty] || '#4CAF50',
        items: cat.items.map((item) => ({
          tmdb_id: item.tmdb_id,
          title: item.title,
          year: item.year,
          poster_path: item.poster_path,
          genres: item.genres || [],
          director: item.director || null,
          stars: item.stars || [],
          summary: item.summary || item.overview || '',
        })),
      })),
    };

    setProcessing(puzzleData);
  }

  function handleAiGenerated(aiData) {
    if (aiData.title) setTitle(aiData.title);
    if (aiData.categories) {
      setCategories(
        aiData.categories.map((cat, i) => ({
          name: cat.name || '',
          difficulty: cat.difficulty || i + 1,
          items: (cat.items || []).concat(Array(4).fill(null)).slice(0, 4),
        }))
      );
    }
  }

  function handleCategoryMoviesGenerated(catIdx, movies) {
    setCategories((prev) =>
      prev.map((cat, i) => {
        if (i !== catIdx) return cat;
        const newItems = [...cat.items];
        movies.forEach((movie, mi) => {
          if (mi < 4 && movie) {
            newItems[mi] = movie;
          }
        });
        return { ...cat, items: newItems };
      })
    );
  }

  function getAllSelectedMovies() {
    return categories.flatMap((cat) =>
      cat.items.filter((m) => m && m.title).map((m) => m.title)
    );
  }

  function handleProcessComplete(result) {
    // Processing done
  }

  function handleProcessClose() {
    if (processing) {
      onSave(processing);
    }
    setProcessing(false);
  }

  return (
    <div className="max-w-3xl mx-auto pb-24">
      {/* Page Header */}
      <div className="mb-6">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
        <h1 className="text-2xl font-semibold text-foreground">
          {puzzle ? `Edit: ${puzzle.title}` : 'New Puzzle'}
        </h1>
      </div>

      {/* AI Full Puzzle Generator */}
      <FullPuzzleSparkle
        onGenerated={handleAiGenerated}
        existingTitle={title}
      />

      {/* Title Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          Puzzle Title
        </label>
        <Input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Scary Halloween"
          className={`h-11 text-base font-medium ${submitted && errors.title ? 'border-destructive focus-visible:ring-destructive' : ''}`}
        />
        {submitted && errors.title && (
          <p className="text-xs text-destructive mt-1.5">{errors.title}</p>
        )}
      </div>

      {/* Category Cards */}
      <div className="space-y-4">
        {categories.map((cat, ci) => {
          const diff = DIFFICULTIES.find((d) => d.value === cat.difficulty) || DIFFICULTIES[ci];
          return (
            <Card key={ci} className={`border-l-4 ${diff.tw} overflow-hidden`}>
              <CardContent className="p-5">
                {/* Category Header */}
                <div className="flex gap-3 mb-4 items-start">
                  <div className="flex-1 space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">
                      Category Name
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={cat.name}
                        onChange={(e) => updateCategory(ci, 'name', e.target.value)}
                        placeholder="e.g. Horror Classics"
                        className={`h-9 ${submitted && errors[`cat_${ci}_name`] ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                      />
                      <CategorySparkle
                        categoryName={cat.name}
                        existingMovies={getAllSelectedMovies().map((t) => ({ title: t }))}
                        onMoviesGenerated={(movies) => handleCategoryMoviesGenerated(ci, movies)}
                      />
                    </div>
                    {submitted && errors[`cat_${ci}_name`] && (
                      <p className="text-xs text-destructive">{errors[`cat_${ci}_name`]}</p>
                    )}
                  </div>
                  <div className="w-40 space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">
                      Difficulty
                    </label>
                    <select
                      value={cat.difficulty}
                      onChange={(e) =>
                        updateCategory(ci, 'difficulty', parseInt(e.target.value, 10))
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                    >
                      {DIFFICULTIES.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-1 mt-1">
                      {DIFFICULTIES.map((d) => (
                        <span
                          key={d.value}
                          className={`h-2 w-2 rounded-full transition-colors ${
                            d.value === cat.difficulty ? d.dot : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Movie Grid - 2x2 */}
                <div className="grid grid-cols-2 gap-3">
                  {cat.items.map((movie, mi) => (
                    <div key={mi} className="space-y-1">
                      <label className="block text-xs text-muted-foreground/70">
                        Movie {mi + 1}
                      </label>
                      <MovieSearch
                        value={movie}
                        onChange={(m) => updateMovie(ci, mi, m)}
                      />
                      {submitted && errors[`cat_${ci}_movie_${mi}`] && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Required
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-sm z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-end gap-3 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={submitted && !isValid()}
          >
            Process & Publish
          </Button>
        </div>
      </div>

      {/* Processing dialog */}
      {processing && (
        <ProcessingProgress
          puzzle={processing}
          onComplete={handleProcessComplete}
          onClose={handleProcessClose}
        />
      )}
    </div>
  );
}
