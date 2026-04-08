import React, { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CalendarDays, Puzzle as PuzzleIcon, Plus, X } from 'lucide-react';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromDateString(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isFloating(puzzle) {
  return !puzzle.id.startsWith('training-') && !DATE_RE.test(puzzle.id);
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function CalendarPage({ puzzles, sha, onPuzzlesChange, onShaChange, onEditPuzzle }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false);

  // Build lookup of scheduled puzzles by date
  const scheduledByDate = {};
  for (const p of puzzles) {
    if (DATE_RE.test(p.id)) {
      scheduledByDate[p.id] = p;
    }
  }

  const scheduledDates = Object.keys(scheduledByDate).map(fromDateString);
  const floatingPuzzles = puzzles.filter(isFloating);

  const selectedDateStr = selectedDate ? toDateString(selectedDate) : null;
  const selectedPuzzle = selectedDateStr ? scheduledByDate[selectedDateStr] : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateString(today);

  async function savePuzzles(updatedPuzzles) {
    try {
      const res = await fetch('/api/admin-puzzles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzles: updatedPuzzles, sha }),
      });
      if (!res.ok) throw new Error(`PUT failed: ${res.status}`);
      const data = await res.json();
      onPuzzlesChange(updatedPuzzles);
      if (data.sha) onShaChange(data.sha);
    } catch (err) {
      console.error('Failed to save puzzles:', err);
      alert('Failed to save. Please try again.');
    }
  }

  function handleAssign(puzzle) {
    if (!selectedDateStr) return;
    const updated = puzzles.map((p) =>
      p.id === puzzle.id ? { ...p, id: selectedDateStr } : p
    );
    savePuzzles(updated);
    setAssignDialogOpen(false);
  }

  function handleUnassign() {
    if (!selectedPuzzle) return;
    const slug = slugify(selectedPuzzle.title);
    const updated = puzzles.map((p) =>
      p.id === selectedPuzzle.id ? { ...p, id: slug } : p
    );
    savePuzzles(updated);
    setUnassignDialogOpen(false);
  }

  // Custom modifiers for the calendar
  const modifiers = {
    scheduled: scheduledDates,
    today: today,
  };

  const modifiersClassNames = {
    scheduled: 'bg-primary/10 text-primary font-semibold',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Calendar</h2>
        <p className="text-sm text-muted-foreground">
          Schedule puzzles to specific dates. Click a day to view or assign.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        {/* Calendar */}
        <Card>
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
              className="w-full [--cell-size:--spacing(10)]"
              classNames={{
                months: 'flex flex-col',
                month: 'w-full',
                table: 'w-full border-collapse',
                head_row: 'flex w-full',
                head_cell: 'flex-1 text-center',
                row: 'flex w-full mt-2',
                cell: 'flex-1 text-center',
                day: 'w-full',
              }}
            />
          </CardContent>
        </Card>

        {/* Day Detail Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="size-4 text-muted-foreground" />
                {selectedDate
                  ? selectedDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Select a date'}
              </CardTitle>
              {selectedDateStr === todayStr && (
                <Badge variant="secondary" className="w-fit">Today</Badge>
              )}
            </CardHeader>
            <CardContent>
              {selectedPuzzle ? (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{selectedPuzzle.title}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          {selectedPuzzle.id}
                        </p>
                      </div>
                      <Badge variant="default">Scheduled</Badge>
                    </div>
                    {selectedPuzzle.categories && (
                      <div className="mt-3 space-y-1">
                        {selectedPuzzle.categories.map((cat, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className={`size-1.5 rounded-full ${['bg-emerald-400', 'bg-amber-400', 'bg-blue-400', 'bg-purple-400'][i % 4]}`} />
                            <span className="truncate">{cat.name}</span>
                            <span className="ml-auto tabular-nums">{(cat.items || cat.movies || []).length} movies</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => onEditPuzzle && onEditPuzzle(selectedPuzzle)}
                    >
                      <PuzzleIcon className="mr-1.5 size-3" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => setUnassignDialogOpen(true)}
                    >
                      <X className="mr-1.5 size-3" />
                      Unassign
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col items-center py-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
                      <PuzzleIcon className="size-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No puzzle scheduled</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Assign a floating puzzle to this date
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={floatingPuzzles.length === 0}
                    onClick={() => setAssignDialogOpen(true)}
                  >
                    <Plus className="mr-1.5 size-3" />
                    Assign Puzzle
                  </Button>
                  {floatingPuzzles.length === 0 && (
                    <p className="text-xs text-center text-muted-foreground">
                      No floating puzzles available
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Floating puzzles summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Floating Puzzles
              </CardTitle>
              <CardDescription>
                {floatingPuzzles.length} unscheduled
              </CardDescription>
            </CardHeader>
            <CardContent>
              {floatingPuzzles.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">All puzzles are scheduled.</p>
              ) : (
                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {floatingPuzzles.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => {
                          if (selectedDateStr && !selectedPuzzle) {
                            handleAssign(p);
                          }
                        }}
                      >
                        <span className="truncate">{p.title}</span>
                        <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                          Floating
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign puzzle to {selectedDateStr}</DialogTitle>
            <DialogDescription>
              Choose a floating puzzle to schedule on this date.
            </DialogDescription>
          </DialogHeader>
          {floatingPuzzles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No floating puzzles available.
            </p>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="space-y-1">
                {floatingPuzzles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleAssign(p)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                      <PuzzleIcon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{p.title}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.id}</p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Unassign Dialog */}
      <Dialog open={unassignDialogOpen} onOpenChange={setUnassignDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Unassign puzzle?</DialogTitle>
            <DialogDescription>
              This will move "{selectedPuzzle?.title}" back to floating (unscheduled).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnassignDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleUnassign}>
              Unassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
