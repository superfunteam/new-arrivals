import React, { useState, useRef, useEffect, useCallback } from 'react';

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
        // Fallback to search result data
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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        background: '#f8fafc',
      }}>
        {value.poster_path && (
          <img
            src={`${POSTER_BASE}${value.poster_path}`}
            alt=""
            style={{ width: 28, height: 42, borderRadius: 3, objectFit: 'cover' }}
          />
        )}
        <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>
          {value.title}
          {value.year && (
            <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 4 }}>
              ({value.year})
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={handleClear}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: '#94a3b8',
            fontSize: 16,
            lineHeight: 1,
            padding: '2px 4px',
          }}
          aria-label="Clear selection"
        >
          &times;
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={handleInput}
        placeholder="Search movies..."
        style={{
          width: '100%',
          padding: '7px 10px',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box',
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {loading && (
        <span style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 11,
          color: '#94a3b8',
        }}>
          ...
        </span>
      )}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          zIndex: 50,
          maxHeight: 280,
          overflowY: 'auto',
          marginTop: 4,
        }}>
          {results.map((movie) => (
            <div
              key={movie.tmdb_id}
              onClick={() => handleSelect(movie)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                cursor: 'pointer',
                borderBottom: '1px solid #f1f5f9',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {movie.poster_path ? (
                <img
                  src={`${POSTER_BASE}${movie.poster_path}`}
                  alt=""
                  style={{ width: 40, height: 60, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 40,
                  height: 60,
                  borderRadius: 3,
                  background: '#e2e8f0',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: '#94a3b8',
                }}>
                  N/A
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {movie.title}
                </div>
                {movie.year && (
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{movie.year}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
