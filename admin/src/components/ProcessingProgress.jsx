import React, { useState, useEffect, useRef } from 'react';
import { apiPost } from '../lib/api';

const STEPS = [
  { key: 'enrich', label: 'Enriching movie data from TMDB...' },
  { key: 'interrupts', label: 'Generating customer dialogues...' },
  { key: 'commit', label: 'Processing posters & publishing to GitHub...' },
];

function StepIcon({ status }) {
  if (status === 'complete') {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: '#22c55e',
        color: '#fff',
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
      }}>
        &#10003;
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span style={{
        display: 'inline-block',
        width: 22,
        height: 22,
        borderRadius: '50%',
        border: '2px solid #e5e7eb',
        borderTopColor: '#3b82f6',
        animation: 'spin 0.6s linear infinite',
        flexShrink: 0,
      }} />
    );
  }
  if (status === 'error') {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: '#ef4444',
        color: '#fff',
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
      }}>
        !
      </span>
    );
  }
  // pending
  return (
    <span style={{
      display: 'inline-block',
      width: 22,
      height: 22,
      borderRadius: '50%',
      border: '2px solid #e5e7eb',
      flexShrink: 0,
    }} />
  );
}

export default function ProcessingProgress({ puzzle, onComplete, onClose }) {
  const [stepStates, setStepStates] = useState(
    STEPS.map(() => 'pending')
  );
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const started = useRef(false);

  function markStep(idx, status) {
    setStepStates((prev) => prev.map((s, i) => (i === idx ? status : s)));
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function run() {
      try {
        // Step 1: Enrich via TMDB
        markStep(0, 'active');
        const enrichResult = await apiPost('/admin-tmdb-enrich', { puzzle });
        const enrichedPuzzle = enrichResult.puzzle;
        markStep(0, 'complete');

        // Step 2: Generate interrupts
        markStep(1, 'active');
        const interrupts = await apiPost('/admin-ai-interrupts', { puzzle: enrichedPuzzle });
        markStep(1, 'complete');

        // Step 3: Process posters + commit to GitHub
        markStep(2, 'active');
        const commitResult = await apiPost('/admin-process', {
          puzzle: enrichedPuzzle,
          interrupts,
        });
        markStep(2, 'complete');

        setResult(commitResult);
        if (onComplete) onComplete(commitResult);
      } catch (err) {
        console.error('Processing pipeline failed:', err);
        setError(err.message || 'Processing failed');
        // Mark current active step as error
        setStepStates((prev) =>
          prev.map((s) => (s === 'active' ? 'error' : s))
        );
      }
    }

    run();
  }, []);

  const isRunning = stepStates.some((s) => s === 'active');
  const isDone = stepStates.every((s) => s === 'complete');
  const hasError = stepStates.some((s) => s === 'error');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 32,
          maxWidth: 480,
          width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: '#111' }}>
          {isDone ? 'Published!' : hasError ? 'Processing Failed' : 'Processing & Publishing'}
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
          {isDone
            ? 'Your puzzle has been committed to GitHub. A deploy will start automatically.'
            : hasError
              ? 'An error occurred during processing.'
              : 'Please wait while we prepare and publish your puzzle...'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {STEPS.map((step, i) => (
            <div
              key={step.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <StepIcon status={stepStates[i]} />
              <span
                style={{
                  fontSize: 14,
                  color: stepStates[i] === 'pending' ? '#9ca3af' : '#374151',
                  fontWeight: stepStates[i] === 'active' ? 500 : 400,
                }}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: '10px 14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 6,
              fontSize: 12,
              color: '#991b1b',
              wordBreak: 'break-word',
            }}
          >
            {error}
          </div>
        )}

        {result && result.ok && (
          <div
            style={{
              marginTop: 16,
              padding: '10px 14px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 6,
              fontSize: 12,
              color: '#166534',
            }}
          >
            Commit: <code>{result.commitSha?.slice(0, 7)}</code> &mdash; {result.filesCommitted} files committed
          </div>
        )}

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: 6,
              background: isRunning ? '#e5e7eb' : '#111',
              color: isRunning ? '#9ca3af' : '#fff',
              fontSize: 14,
              fontWeight: 500,
              cursor: isRunning ? 'not-allowed' : 'pointer',
            }}
          >
            {isDone ? 'Done' : hasError ? 'Close' : 'Processing...'}
          </button>
        </div>
      </div>
    </div>
  );
}
