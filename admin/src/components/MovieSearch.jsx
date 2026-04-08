import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

const POSTER_BASE = 'https://image.tmdb.org/t/p/w92';

export default function MovieSearch({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const timerRef = useRef(null);

  const search = useCallback((q) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    fetch(`/api/admin-tmdb?query=${encodeURIComponent(q)}`)
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
    fetch(`/api/admin-tmdb?id=${movie.tmdb_id}`)
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

  // Selected movie chip
  if (value && value.tmdb_id) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/50">
        {value.poster_path ? (
          <img
            src={`${POSTER_BASE}${value.poster_path}`}
            alt=""
            className="h-[42px] w-7 flex-shrink-0 rounded-sm object-cover"
          />
        ) : (
          <div className="flex h-[42px] w-7 flex-shrink-0 items-center justify-center rounded-sm bg-muted">
            <Film className="size-3.5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium truncate block">
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
          <X className="size-3" />
          <span className="sr-only">Clear selection</span>
        </Button>
      </div>
    );
  }

  if (selecting) {
    return (
      <div className="flex h-[58px] items-center justify-center rounded-lg border border-dashed">
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
            className="h-auto min-h-[58px] w-full justify-between border-dashed px-3 py-2 font-normal text-muted-foreground"
          />
        }
      >
        <div className="flex items-center gap-2">
          <Search className="size-3.5" />
          <span className="text-sm">Search movies...</span>
        </div>
        <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search movies..."
            value={query}
            onValueChange={handleInput}
          />
          <CommandList>
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
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      {movie.poster_path ? (
                        <img
                          src={`${POSTER_BASE}${movie.poster_path}`}
                          alt=""
                          className="h-[45px] w-[30px] flex-shrink-0 rounded-sm object-cover"
                        />
                      ) : (
                        <div className="flex h-[45px] w-[30px] flex-shrink-0 items-center justify-center rounded-sm bg-muted">
                          <Film className="size-3 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{movie.title}</p>
                        <div className="flex items-center gap-2">
                          {movie.year && (
                            <span className="text-xs text-muted-foreground">{movie.year}</span>
                          )}
                          {movie.director && (
                            <span className="text-xs text-muted-foreground/70 truncate">
                              Dir. {movie.director}
                            </span>
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
