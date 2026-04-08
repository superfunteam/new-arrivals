import React, { useState, useEffect, useRef } from 'react';
import { apiPost } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check, X, Loader2, Circle } from 'lucide-react';

const STEPS = [
  { key: 'enrich', label: 'Enriching movie data from TMDB...' },
  { key: 'interrupts', label: 'Generating customer dialogues...' },
  { key: 'commit', label: 'Processing posters & publishing to GitHub...' },
];

function StepIcon({ status }) {
  if (status === 'complete') {
    return (
      <div className="flex size-6 items-center justify-center rounded-full bg-emerald-500 flex-shrink-0">
        <Check className="size-3.5 text-white" />
      </div>
    );
  }
  if (status === 'active') {
    return (
      <div className="flex size-6 items-center justify-center flex-shrink-0">
        <Loader2 className="size-5 text-primary animate-spin" />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="flex size-6 items-center justify-center rounded-full bg-destructive flex-shrink-0">
        <X className="size-3.5 text-white" />
      </div>
    );
  }
  return (
    <div className="flex size-6 items-center justify-center flex-shrink-0">
      <Circle className="size-5 text-muted-foreground/30" />
    </div>
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

  const completedCount = stepStates.filter((s) => s === 'complete').length;
  const progressValue = (completedCount / STEPS.length) * 100;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isRunning) onClose(); }}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => { if (isRunning) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>
            {isDone ? 'Published!' : hasError ? 'Processing Failed' : 'Processing & Publishing'}
          </DialogTitle>
          <DialogDescription>
            {isDone
              ? 'Your puzzle has been committed to GitHub. A deploy will start automatically.'
              : hasError
                ? 'An error occurred during processing.'
                : 'Please wait while we prepare and publish your puzzle...'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <Progress value={progressValue} className="mb-2" />

        {/* Step list */}
        <div className="flex flex-col gap-3 py-2">
          {STEPS.map((step, i) => (
            <div key={step.key} className="flex items-center gap-3">
              <StepIcon status={stepStates[i]} />
              <span
                className={`text-sm ${
                  stepStates[i] === 'pending'
                    ? 'text-muted-foreground'
                    : stepStates[i] === 'active'
                      ? 'text-foreground font-medium'
                      : stepStates[i] === 'error'
                        ? 'text-destructive'
                        : 'text-foreground'
                }`}
              >
                {step.label}
              </span>
              {stepStates[i] === 'complete' && (
                <Badge variant="secondary" className="ml-auto text-[10px]">Done</Badge>
              )}
            </div>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-sm text-destructive break-words">{error}</p>
          </div>
        )}

        {/* Success banner */}
        {result && result.ok && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm text-emerald-800">
              Commit: <code className="rounded bg-emerald-100 px-1 py-0.5 font-mono text-xs">
                {result.commitSha?.slice(0, 7)}
              </code>
              {' '}&mdash; {result.filesCommitted} files committed
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={onClose}
            disabled={isRunning}
            variant={isDone ? 'default' : hasError ? 'outline' : 'secondary'}
          >
            {isDone ? 'Done' : hasError ? 'Close' : 'Processing...'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
