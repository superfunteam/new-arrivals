import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Search, X, Loader2, Film } from 'lucide-react';

const POSTER_THUMB = 'https://image.tmdb.org/t/p/w185';
const POSTER_FULL = 'https://image.tmdb.org/t/p/w500';

export default function MovieSearch({ value, onChange, isLoading }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  const search = useCallback((q) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    fetch(`/api/admin-tmdb?query=${encodeURIComponent(q)}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setResults(Array.isArray(data) ? data : []))
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
    setSelecting(true);
    setQuery('');
    setResults([]);
    setFocused(false);
    fetch(`/api/admin-tmdb?id=${movie.tmdb_id}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((details) => onChange(details))
      .catch(() => onChange(movie))
      .finally(() => setSelecting(false));
  }

  function handleClear(e) {
    e.stopPropagation();
    onChange(null);
    setQuery('');
    setResults([]);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showDropdown = focused && query.length >= 2;

  // AI loading skeleton
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/30 px-3 py-3 animate-pulse">
        <div className="h-[56px] w-[38px] flex-shrink-0 rounded bg-amber-200/50" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-3/4 rounded bg-amber-200/50" />
          <div className="h-2.5 w-1/2 rounded bg-amber-200/30" />
        </div>
      </div>
    );
  }

  // Selected movie chip
  if (value && value.tmdb_id) {
    return (
      <>
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50">
          {value.poster_path ? (
            <img
              src={`${POSTER_THUMB}${value.poster_path}`}
              alt=""
              className="h-[56px] w-[38px] flex-shrink-0 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity active:scale-95"
              onClick={() => setPreviewOpen(true)}
            />
          ) : (
            <div className="flex h-[56px] w-[38px] flex-shrink-0 items-center justify-center rounded bg-muted">
              <Film className="size-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium truncate block leading-tight">
              {value.title}
            </span>
            {value.year && (
              <span className="text-xs text-muted-foreground">{value.year}</span>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="flex-shrink-0 size-8"
          >
            <X className="size-4" />
          </Button>
        </div>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="sm:max-w-xs p-2 bg-black/95 border-none">
            {value.poster_path ? (
              <img src={`${POSTER_FULL}${value.poster_path}`} alt={value.title} className="w-full rounded" />
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground">No poster</div>
            )}
            <p className="text-center text-sm text-white/80 pb-1">
              {value.title} {value.year ? `(${value.year})` : ''}
            </p>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (selecting) {
    return (
      <div className="flex h-[72px] items-center justify-center rounded-lg border border-dashed">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => setFocused(true)}
          placeholder="Search movies..."
          className="h-[72px] pl-9 text-sm"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg overflow-hidden">
          {loading && results.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-8 text-muted-foreground">
              <Film className="size-5 opacity-50" />
              <span className="text-sm">No movies found</span>
            </div>
          )}

          {results.length > 0 && (
            <div className="max-h-72 overflow-y-auto">
              {results.map((movie) => (
                <button
                  key={movie.tmdb_id}
                  type="button"
                  onClick={() => handleSelect(movie)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors"
                >
                  {movie.poster_path ? (
                    <img
                      src={`${POSTER_THUMB}${movie.poster_path}`}
                      alt=""
                      className="h-[56px] w-[38px] flex-shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-[56px] w-[38px] flex-shrink-0 items-center justify-center rounded bg-muted">
                      <Film className="size-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{movie.title}</p>
                    {movie.year && (
                      <span className="text-xs text-muted-foreground">{movie.year}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
