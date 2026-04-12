import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, Save, HelpCircle } from 'lucide-react';
import MovieSearch from './MovieSearch';
import { FullPuzzleSparkle, CategorySparkle } from './AiGeneratePanel';
import ProcessingProgress from './ProcessingProgress';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const DIFFICULTIES = [
  { value: 1, label: 'Easy', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  { value: 2, label: 'Medium', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
  { value: 3, label: 'Hard', dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' },
  { value: 4, label: 'Devious', dot: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50' },
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

export default function PuzzleEditor({ puzzle, onSave, onCancel, userRole = 'author' }) {
  const [title, setTitle] = useState(puzzle?.title || '');
  const [categories, setCategories] = useState(() => initCategories(puzzle));
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [aiLoadingFull, setAiLoadingFull] = useState(false);
  const [aiLoadingCat, setAiLoadingCat] = useState({}); // { [catIdx]: true }

  // Auto-start tour for new puzzles on first visit
  useEffect(() => {
    if (!puzzle && !localStorage.getItem('editorTourSeen')) {
      const timer = setTimeout(() => {
        startTour();
        localStorage.setItem('editorTourSeen', 'true');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  function startTour() {
    const d = driver({
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(0,0,0,0.6)',
      steps: [
        {
          element: '#tour-ai-generator',
          popover: {
            title: 'Step 1: Generate with AI',
            description: 'Type a theme and hit the sparkle button. Claude will create all 4 categories with movies for you. This is the fastest way to build a puzzle.',
            side: 'bottom',
          },
        },
        {
          element: '#tour-puzzle-title',
          popover: {
            title: 'Step 2: Name Your Puzzle',
            description: 'Give your puzzle a fun title. This is what players see on the game select screen — e.g. "Friday Night Rush" or "Horror Aisle Deep Cut".',
            side: 'bottom',
          },
        },
        {
          element: '#tour-category-0',
          popover: {
            title: 'Step 3: Fill Categories',
            description: 'Each category needs a name and 4 movies. Search for movies by title, or tap the sparkle icon to have AI fill a category. Tap any poster to see it full-size.',
            side: 'top',
          },
        },
        {
          element: '#tour-publish',
          popover: {
            title: 'Step 4: Publish',
            description: 'Once all 4 categories are filled, hit Process & Publish. This fetches poster art, generates customer dialogues, and pushes the puzzle live.',
            side: 'top',
          },
        },
      ],
    });
    d.drive();
  }

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
    setAiLoadingFull(false);
    setShowHints(false);
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
    setAiLoadingCat(prev => ({ ...prev, [catIdx]: false }));
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
    <div className="mx-auto max-w-3xl pb-24">
      {/* Page Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="mb-3 -ml-2 text-muted-foreground"
        >
          <ArrowLeft className="mr-1.5 size-4" />
          Back to Dashboard
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {puzzle ? `Edit: ${puzzle.title}` : 'New Puzzle'}
          </h1>
          {!puzzle && (
            <Button variant="outline" size="sm" onClick={startTour} className="gap-1.5">
              <HelpCircle className="size-3.5" />
              How it works
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Fill in the categories and select 4 movies per group.
        </p>
      </div>

      {/* AI Full Puzzle Generator */}
      <div id="tour-ai-generator">
      <FullPuzzleSparkle
        onGenerated={handleAiGenerated}
        existingTitle={title}
        onLoadingChange={setAiLoadingFull}
      />
      </div>

      {/* Title Input */}
      <Card id="tour-puzzle-title" className="mb-6">
        <CardContent className="pt-4">
          <label className="text-sm font-medium text-foreground mb-2 block">
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
        </CardContent>
      </Card>

      {/* Category Cards */}
      <div className="space-y-4">
        {categories.map((cat, ci) => {
          const diff = DIFFICULTIES.find((d) => d.value === cat.difficulty) || DIFFICULTIES[ci];
          return (
            <Card key={ci} id={ci === 0 ? 'tour-category-0' : undefined} className={diff.bg}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className={`size-2 rounded-full ${diff.dot}`} />
                  <CardTitle className="text-sm">
                    Category {ci + 1} — {diff.label}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Category Name + AI sparkle (full width) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Category Name
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={cat.name}
                      onChange={(e) => updateCategory(ci, 'name', e.target.value)}
                      placeholder="e.g. Horror Classics"
                      className={`h-10 flex-1 ${submitted && errors[`cat_${ci}_name`] ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    />
                    <CategorySparkle
                      categoryName={cat.name}
                      existingMovies={getAllSelectedMovies().map((t) => ({ title: t }))}
                      onMoviesGenerated={(movies) => handleCategoryMoviesGenerated(ci, movies)}
                      onLoadingChange={(loading) => setAiLoadingCat(prev => ({ ...prev, [ci]: loading }))}
                    />
                  </div>
                  {submitted && errors[`cat_${ci}_name`] && (
                    <p className="text-xs text-destructive">{errors[`cat_${ci}_name`]}</p>
                  )}
                </div>

                <Separator />

                {/* Movie Grid - 2x2 */}
                <div className="grid grid-cols-2 gap-3">
                  {cat.items.map((movie, mi) => (
                    <div key={mi} className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">
                        Movie {mi + 1}
                      </label>
                      <MovieSearch
                        value={movie}
                        onChange={(m) => updateMovie(ci, mi, m)}
                        isLoading={aiLoadingFull || !!aiLoadingCat[ci]}
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
      <div id="tour-publish" className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-sm z-40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <p className="text-xs text-muted-foreground hidden sm:block">
            {isValid() ? 'Ready to process and publish' : 'Fill all fields to continue'}
          </p>
          <div className="flex items-center gap-3 ml-auto">
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
              disabled={(submitted && !isValid()) || userRole !== 'admin'}
              title={userRole !== 'admin' ? 'Only admins can publish puzzles' : ''}
            >
              <Save className="mr-2 size-4" />
              {userRole === 'admin' ? 'Process & Publish' : 'Publish (Admin Only)'}
            </Button>
          </div>
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
