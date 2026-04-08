import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Calendar, Plus } from 'lucide-react';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function isFloating(puzzle) {
  return !puzzle.id.startsWith('training-') && !DATE_RE.test(puzzle.id);
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CalendarStrip({ puzzles, onAssign, onUnassign }) {
  const [pickerDate, setPickerDate] = useState(null);
  const [unassignPuzzle, setUnassignPuzzle] = useState(null);
  const scrollRef = useRef(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateString(today);

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const scheduledByDate = {};
  for (const p of puzzles) {
    if (DATE_RE.test(p.id)) {
      scheduledByDate[p.id] = p;
    }
  }

  const floatingPuzzles = puzzles.filter(isFloating);

  function handleAssign(puzzle) {
    if (!pickerDate) return;
    onAssign(puzzle, pickerDate);
    setPickerDate(null);
  }

  function handleUnassignConfirm() {
    if (!unassignPuzzle) return;
    onUnassign(unassignPuzzle);
    setUnassignPuzzle(null);
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Editorial Calendar
        </h3>
      </div>

      {/* Scrollable strip */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto gap-2 pb-3 snap-x snap-mandatory scrollbar-thin"
      >
        {days.map((d) => {
          const dateStr = toDateString(d);
          const isToday = dateStr === todayStr;
          const scheduled = scheduledByDate[dateStr];

          return (
            <div
              key={dateStr}
              className={[
                'min-w-[80px] p-2 rounded-lg border text-center text-xs flex-shrink-0 flex flex-col gap-1 snap-start transition-all duration-200',
                scheduled
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-dashed border-border hover:border-primary/30 hover:bg-muted/30',
                isToday ? 'ring-2 ring-primary ring-offset-2' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className={scheduled ? 'font-medium text-primary-foreground/70' : 'font-medium text-muted-foreground'}>
                {DAY_NAMES[d.getDay()]}
              </span>
              <span className={`text-lg font-semibold leading-none ${scheduled ? 'text-primary-foreground' : 'text-foreground'}`}>
                {d.getDate()}
              </span>
              <span className={scheduled ? 'text-primary-foreground/60' : 'text-muted-foreground/70'}>
                {MONTH_NAMES[d.getMonth()]}
              </span>

              {scheduled ? (
                <button
                  onClick={() => setUnassignPuzzle(scheduled)}
                  title={`Unassign "${scheduled.title}"`}
                  className="mt-1 text-primary-foreground/90 font-medium leading-tight hover:text-primary-foreground transition-colors line-clamp-2 break-words text-[0.65rem]"
                >
                  {scheduled.title}
                </button>
              ) : (
                <button
                  onClick={() => setPickerDate(dateStr)}
                  disabled={floatingPuzzles.length === 0}
                  className="mt-1 text-muted-foreground/50 hover:text-primary disabled:opacity-30 transition-colors"
                  title={
                    floatingPuzzles.length === 0
                      ? 'No floating puzzles available'
                      : `Assign puzzle to ${dateStr}`
                  }
                >
                  <Plus className="h-4 w-4 mx-auto" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Assign Dialog */}
      <Dialog open={!!pickerDate} onOpenChange={(open) => { if (!open) setPickerDate(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign puzzle to {pickerDate}</DialogTitle>
            <DialogDescription>
              Choose a floating puzzle to schedule on this date.
            </DialogDescription>
          </DialogHeader>
          {floatingPuzzles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No floating puzzles available.</p>
          ) : (
            <ul className="divide-y rounded-lg border overflow-hidden">
              {floatingPuzzles.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => handleAssign(p)}
                    className="w-full text-left px-4 py-3 hover:bg-accent transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground">{p.title}</span>
                    <span className="block text-xs text-muted-foreground font-mono mt-0.5">{p.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {/* Unassign confirm Dialog */}
      <Dialog open={!!unassignPuzzle} onOpenChange={(open) => { if (!open) setUnassignPuzzle(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Unassign puzzle?</DialogTitle>
            <DialogDescription>
              This will move <span className="font-semibold text-foreground">{unassignPuzzle?.title}</span> back
              to floating (unscheduled).
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleUnassignConfirm}
              className="flex-1"
            >
              Unassign
            </Button>
            <Button
              variant="outline"
              onClick={() => setUnassignPuzzle(null)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { slugify, isFloating };
