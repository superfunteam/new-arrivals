import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Search, X, Loader2, Film } from 'lucide-react';

const POSTER_BASE = 'https://image.tmdb.org/t/p/w92';

export default function MovieSearch({ value, onChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const search = useCallback((q) => {
    if (!q || q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    fetch(`/api/admin-tmdb?query=${encodeURIComponent(q)}`)
      .then((res) => res.json())
      .then((data) => {
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  function handleInput(e) {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 300);
  }

  function handleSelect(movie) {
    setOpen(false);
    setQuery('');
    setResults([]);
    setLoading(true);
    fetch(`/api/admin-tmdb?id=${movie.tmdb_id}`)
      .then((res) => res.json())
      .then((details) => {
        onChange(details);
      })
      .catch(() => {
        onChange(movie);
      })
      .finally(() => setLoading(false));
  }

  function handleClear() {
    onChange(null);
    setQuery('');
    setResults([]);
  }

  // Selected movie card
  if (value && value.tmdb_id) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 border rounded-md bg-muted/30 group transition-colors hover:bg-muted/50">
        {value.poster_path ? (
          <img
            src={`${POSTER_BASE}${value.poster_path}`}
            alt=""
            className="w-7 h-[42px] rounded-sm object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-7 h-[42px] rounded-sm bg-muted flex items-center justify-center flex-shrink-0">
            <Film className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
        <span className="text-sm font-medium flex-1 min-w-0 truncate">
          {value.title}
          {value.year && (
            <span className="text-muted-foreground font-normal ml-1.5">
              ({value.year})
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={handleClear}
          className="flex-shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Clear selection"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={handleInput}
          placeholder="Search movies..."
          className="pl-8 h-9"
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-[280px] overflow-y-auto shadow-lg border">
          {results.map((movie) => (
            <div
              key={movie.tmdb_id}
              onClick={() => handleSelect(movie)}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer border-b border-border/40 last:border-b-0 transition-colors hover:bg-muted/50"
            >
              {movie.poster_path ? (
                <img
                  src={`${POSTER_BASE}${movie.poster_path}`}
                  alt=""
                  className="w-10 h-[60px] rounded-sm object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-[60px] rounded-sm bg-muted flex items-center justify-center flex-shrink-0">
                  <Film className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate text-foreground">
                  {movie.title}
                </p>
                {movie.year && (
                  <p className="text-xs text-muted-foreground">{movie.year}</p>
                )}
                {movie.director && (
                  <p className="text-xs text-muted-foreground/70 truncate">
                    Dir. {movie.director}
                  </p>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}

      {open && !loading && results.length === 0 && query.length >= 2 && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 shadow-lg border">
          <div className="flex flex-col items-center py-6 text-center">
            <Film className="h-5 w-5 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No results found</p>
          </div>
        </Card>
      )}
    </div>
  );
}
