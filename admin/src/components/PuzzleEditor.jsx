import React, { useState } from 'react';
import MovieSearch from './MovieSearch';
import { FullPuzzleSparkle, CategorySparkle } from './AiGeneratePanel';
import ProcessingProgress from './ProcessingProgress';

const DIFFICULTIES = [
  { value: 1, label: 'Easy', color: '#4CAF50' },
  { value: 2, label: 'Medium', color: '#FFC107' },
  { value: 3, label: 'Hard', color: '#2196F3' },
  { value: 4, label: 'Devious', color: '#9C27B0' },
];

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
        color: DIFFICULTIES.find((d) => d.value === cat.difficulty)?.color || '#4CAF50',
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

  // Handle AI-generated full puzzle
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

  // Handle AI-generated category movies
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

  // Collect all currently selected movie titles (for AI dedup)
  function getAllSelectedMovies() {
    return categories.flatMap((cat) =>
      cat.items.filter((m) => m && m.title).map((m) => m.title)
    );
  }

  function handleProcessComplete(result) {
    // Processing done -- onSave will navigate back to dashboard
  }

  function handleProcessClose() {
    if (processing) {
      // If it completed successfully, go back to dashboard
      onSave(processing);
    }
    setProcessing(false);
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* AI Full Puzzle Generator */}
      <FullPuzzleSparkle
        onGenerated={handleAiGenerated}
        existingTitle={title}
      />

      <div style={{ marginBottom: 24 }}>
        <label
          style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#374151' }}
        >
          Puzzle Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Scary Halloween"
          style={{
            width: '100%',
            padding: '10px 12px',
            border: `1px solid ${submitted && errors.title ? '#ef4444' : '#e2e8f0'}`,
            borderRadius: 6,
            fontSize: 15,
            fontWeight: 500,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {submitted && errors.title && (
          <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.title}</p>
        )}
      </div>

      {categories.map((cat, ci) => {
        const diff = DIFFICULTIES.find((d) => d.value === cat.difficulty) || DIFFICULTIES[ci];
        return (
          <div
            key={ci}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 20,
              marginBottom: 16,
              borderLeft: `4px solid ${diff.color}`,
              background: '#fff',
            }}
          >
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#6b7280' }}>
                  Category Name
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="text"
                    value={cat.name}
                    onChange={(e) => updateCategory(ci, 'name', e.target.value)}
                    placeholder="e.g. Horror Classics"
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      border: `1px solid ${submitted && errors[`cat_${ci}_name`] ? '#ef4444' : '#e2e8f0'}`,
                      borderRadius: 6,
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <CategorySparkle
                    categoryName={cat.name}
                    existingMovies={getAllSelectedMovies().map((t) => ({ title: t }))}
                    onMoviesGenerated={(movies) => handleCategoryMoviesGenerated(ci, movies)}
                  />
                </div>
                {submitted && errors[`cat_${ci}_name`] && (
                  <p style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>
                    {errors[`cat_${ci}_name`]}
                  </p>
                )}
              </div>
              <div style={{ width: 160 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#6b7280' }}>
                  Difficulty
                </label>
                <select
                  value={cat.difficulty}
                  onChange={(e) =>
                    updateCategory(ci, 'difficulty', parseInt(e.target.value, 10))
                  }
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    fontSize: 13,
                    outline: 'none',
                    background: '#fff',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                  {DIFFICULTIES.map((d) => (
                    <span
                      key={d.value}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: d.value === cat.difficulty ? d.color : '#e2e8f0',
                        display: 'inline-block',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cat.items.map((movie, mi) => (
                <div key={mi}>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>
                    Movie {mi + 1}
                  </label>
                  <MovieSearch
                    value={movie}
                    onChange={(m) => updateMovie(ci, mi, m)}
                  />
                  {submitted && errors[`cat_${ci}_movie_${mi}`] && (
                    <p style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>
                      {errors[`cat_${ci}_movie_${mi}`]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '10px 20px',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            background: '#fff',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            color: '#374151',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={submitted && !isValid()}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: 6,
            background: isValid() ? '#111' : '#d1d5db',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            cursor: isValid() ? 'pointer' : 'not-allowed',
          }}
        >
          Process & Publish
        </button>
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
