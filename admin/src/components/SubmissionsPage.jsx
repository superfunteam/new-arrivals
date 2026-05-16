import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Inbox, Mail, Calendar as CalendarIcon, User as UserIcon,
  PencilRuler, X, Trash2, ChevronDown, ChevronRight, RefreshCw,
} from 'lucide-react';

const DIFFICULTY_COLOR = {
  1: 'bg-emerald-500',
  2: 'bg-amber-500',
  3: 'bg-blue-500',
  4: 'bg-purple-500',
};

const STATUS_BADGE = {
  pending:  { label: 'Pending',  className: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  rejected: { label: 'Rejected', className: 'bg-slate-200 text-slate-700 border-slate-300' },
};

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function SubmissionsPage({ onOpenInEditor }) {
  const [submissions, setSubmissions] = useState(null);
  const [error, setError] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [filter, setFilter] = useState('pending'); // pending | all

  async function load() {
    setError(null);
    setSubmissions(null);
    try {
      const res = await fetch('/api/puzzle-submit');
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (e) {
      setError(`Failed to load submissions: ${e.message}`);
    }
  }

  useEffect(() => { load(); }, []);

  async function patchStatus(key, status) {
    setBusyKey(key);
    try {
      const res = await fetch(`/api/puzzle-submit?key=${encodeURIComponent(key)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      await load();
    } catch (e) {
      alert(`Failed to update: ${e.message}`);
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteSubmission(key) {
    if (!confirm('Delete this submission? This cannot be undone.')) return;
    setBusyKey(key);
    try {
      const res = await fetch(`/api/puzzle-submit?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`${res.status}`);
      await load();
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    } finally {
      setBusyKey(null);
    }
  }

  const visible = !submissions ? [] : submissions.filter((s) =>
    filter === 'all' ? true : (s.status || 'pending') === 'pending'
  );
  const counts = (submissions || []).reduce((acc, s) => {
    const k = s.status || 'pending';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Inbox className="h-6 w-6" /> Submissions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Puzzles submitted by players via <code className="text-xs">/submit/</code>. Review,
            open in the editor to publish, or reject.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Button
          variant={filter === 'pending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('pending')}
        >
          Pending ({counts.pending || 0})
        </Button>
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All ({(submissions || []).length})
        </Button>
        {(counts.approved || counts.rejected) ? (
          <div className="ml-auto flex gap-1 text-xs text-muted-foreground">
            <span>Approved: {counts.approved || 0}</span>
            <span>·</span>
            <span>Rejected: {counts.rejected || 0}</span>
          </div>
        ) : null}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {submissions === null && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      )}

      {submissions && visible.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Inbox className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>No {filter === 'pending' ? 'pending ' : ''}submissions yet.</p>
            <p className="text-xs mt-1">Players can submit at <code>/submit/</code>.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {visible.map((s) => {
          const isExpanded = expandedKey === s.key;
          const status = s.status || 'pending';
          const badge = STATUS_BADGE[status] || STATUS_BADGE.pending;
          return (
            <Card key={s.key} className={status === 'pending' ? '' : 'opacity-70'}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <button
                    className="mt-0.5 flex-shrink-0"
                    onClick={() => setExpandedKey(isExpanded ? null : s.key)}
                    title={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">{s.title || '(untitled)'}</CardTitle>
                      <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                      {s.publishedAs && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          → {s.publishedAs}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs mt-1 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-3 w-3" /> {s.submittedBy || 'Anonymous'}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" /> {fmtTime(s.submittedAt)}
                      </span>
                      {s.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {s.email}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    {status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => onOpenInEditor({ ...s, _submissionKey: s.key })}
                          disabled={busyKey === s.key}
                        >
                          <PencilRuler className="h-3.5 w-3.5 mr-1" />
                          Open in editor
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => patchStatus(s.key, 'rejected')}
                          disabled={busyKey === s.key}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteSubmission(s.key)}
                      disabled={busyKey === s.key}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="pt-0">
                  <Separator className="mb-4" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(s.categories || []).map((cat, i) => {
                      const dot = DIFFICULTY_COLOR[cat.difficulty] || 'bg-slate-400';
                      const movies = cat.items || cat.movies || [];
                      return (
                        <div key={i} className="rounded-md border bg-slate-50 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`h-2 w-2 rounded-full ${dot}`} />
                            <span className="text-sm font-medium">{cat.name || '(no name)'}</span>
                          </div>
                          <ul className="text-xs space-y-1 ml-4">
                            {movies.length === 0 && <li className="text-muted-foreground">(no movies)</li>}
                            {movies.map((m, mi) => (
                              <li key={mi}>
                                {m?.title || '?'}
                                {m?.year ? <span className="text-muted-foreground"> ({m.year})</span> : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                  {s.adminNotes && (
                    <div className="mt-3 text-xs text-muted-foreground italic">
                      Notes: {s.adminNotes}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
