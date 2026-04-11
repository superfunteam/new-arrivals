import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Search, X, Loader2, Film, ChevronsUpDown } from 'lucide-react';

const POSTER_THUMB = 'https://image.tmdb.org/t/p/w185';
const POSTER_FULL = 'https://image.tmdb.org/t/p/w500';

export default function MovieSearch({ value, onChange, isLoading }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const timerRef = useRef(null);

  const search = useCallback((q) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    fetch(`/api/admin-tmdb?query=${encodeURIComponent(q)}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        setResults(Array.isArray(data) ? data : []);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  function handleInput(val) {
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 300);
  }

  function handleSelect(movie) {
    setSelecting(true);
    setOpen(false);
    setQuery('');
    setResults([]);
    fetch(`/api/admin-tmdb?id=${movie.tmdb_id}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((details) => {
        onChange(details);
      })
      .catch(() => {
        onChange(movie);
      })
      .finally(() => setSelecting(false));
  }

  function handleClear(e) {
    e.stopPropagation();
    onChange(null);
    setQuery('');
    setResults([]);
  }

  // AI loading skeleton
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/30 px-3 py-3 animate-pulse">
        <div className="h-[56px] w-[38px] flex-shrink-0 rounded-sm bg-amber-200/50" />
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
              className="h-[56px] w-[38px] flex-shrink-0 rounded-sm object-cover cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setPreviewOpen(true)}
            />
          ) : (
            <div className="flex h-[56px] w-[38px] flex-shrink-0 items-center justify-center rounded-sm bg-muted">
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
            size="icon-xs"
            onClick={handleClear}
            className="flex-shrink-0"
          >
            <X className="size-3.5" />
            <span className="sr-only">Clear selection</span>
          </Button>
        </div>

        {/* Full-screen poster preview */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="sm:max-w-sm p-2 bg-black/95 border-none">
            {value.poster_path ? (
              <img
                src={`${POSTER_FULL}${value.poster_path}`}
                alt={value.title}
                className="w-full rounded"
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                No poster available
              </div>
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="h-auto min-h-[72px] w-full justify-between border-dashed px-3 py-3 font-normal text-muted-foreground"
          />
        }
      >
        <div className="flex items-center gap-2">
          <Search className="size-4" />
          <span className="text-sm">Search movies...</span>
        </div>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search movies..."
            value={query}
            onValueChange={handleInput}
          />
          <CommandList className="max-h-72">
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && query.length >= 2 && results.length === 0 && (
              <CommandEmpty>
                <div className="flex flex-col items-center gap-1.5 py-2">
                  <Film className="size-5 text-muted-foreground/50" />
                  <span>No movies found</span>
                </div>
              </CommandEmpty>
            )}
            {!loading && results.length > 0 && (
              <CommandGroup heading="Results">
                {results.map((movie) => (
                  <CommandItem
                    key={movie.tmdb_id}
                    value={String(movie.tmdb_id)}
                    onSelect={() => handleSelect(movie)}
                    className="cursor-pointer py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      {movie.poster_path ? (
                        <img
                          src={`${POSTER_THUMB}${movie.poster_path}`}
                          alt=""
                          className="h-[56px] w-[38px] flex-shrink-0 rounded-sm object-cover"
                        />
                      ) : (
                        <div className="flex h-[56px] w-[38px] flex-shrink-0 items-center justify-center rounded-sm bg-muted">
                          <Film className="size-3.5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{movie.title}</p>
                        <div className="flex items-center gap-2">
                          {movie.year && (
                            <span className="text-xs text-muted-foreground">{movie.year}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
