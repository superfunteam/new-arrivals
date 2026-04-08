import React, { useState, useRef } from 'react';

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
  const [pickerDate, setPickerDate] = useState(null); // date string for assign popover
  const [unassignPuzzle, setUnassignPuzzle] = useState(null); // puzzle to confirm unassign
  const scrollRef = useRef(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateString(today);

  // Build array of next 30 days
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  // Map date strings to puzzles
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
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Editorial Calendar — Next 30 Days
      </h2>

      {/* Scrollable strip */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto gap-2 pb-2"
        style={{ scrollbarWidth: 'thin' }}
      >
        {days.map((d) => {
          const dateStr = toDateString(d);
          const isToday = dateStr === todayStr;
          const scheduled = scheduledByDate[dateStr];

          return (
            <div
              key={dateStr}
              className={[
                'min-w-[80px] p-2 rounded-lg border text-center text-xs flex-shrink-0 flex flex-col gap-1',
                scheduled
                  ? 'bg-blue-50 border-blue-200'
                  : 'border-dashed border-gray-300',
                isToday ? 'ring-2 ring-black' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="font-medium text-gray-500">
                {DAY_NAMES[d.getDay()]}
              </span>
              <span className="text-lg font-semibold leading-none text-gray-800">
                {d.getDate()}
              </span>
              <span className="text-gray-400">{MONTH_NAMES[d.getMonth()]}</span>

              {scheduled ? (
                <button
                  onClick={() => setUnassignPuzzle(scheduled)}
                  title={`Unassign "${scheduled.title}"`}
                  className="mt-1 text-blue-700 font-medium leading-tight hover:text-blue-900 transition-colors line-clamp-2 break-words"
                  style={{ fontSize: '0.65rem' }}
                >
                  {scheduled.title}
                </button>
              ) : (
                <button
                  onClick={() => setPickerDate(dateStr)}
                  disabled={floatingPuzzles.length === 0}
                  className="mt-1 text-gray-400 hover:text-black disabled:opacity-30 transition-colors text-base leading-none"
                  title={
                    floatingPuzzles.length === 0
                      ? 'No floating puzzles available'
                      : `Assign puzzle to ${dateStr}`
                  }
                >
                  +
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Assign modal */}
      {pickerDate && (
        <Modal onClose={() => setPickerDate(null)}>
          <h3 className="text-base font-semibold mb-1">Assign puzzle to {pickerDate}</h3>
          <p className="text-sm text-gray-500 mb-4">
            Choose a floating puzzle to schedule on this date.
          </p>
          {floatingPuzzles.length === 0 ? (
            <p className="text-sm text-gray-400">No floating puzzles available.</p>
          ) : (
            <ul className="divide-y border rounded-lg overflow-hidden">
              {floatingPuzzles.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => handleAssign(p)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors"
                  >
                    <span className="text-sm font-medium">{p.title}</span>
                    <span className="block text-xs text-gray-400 font-mono mt-0.5">{p.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => setPickerDate(null)}
            className="mt-4 w-full border rounded-md py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </Modal>
      )}

      {/* Unassign confirm modal */}
      {unassignPuzzle && (
        <Modal onClose={() => setUnassignPuzzle(null)}>
          <h3 className="text-base font-semibold mb-1">Unassign puzzle?</h3>
          <p className="text-sm text-gray-600 mb-1">
            <strong>{unassignPuzzle.title}</strong>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            This will move the puzzle back to floating (unscheduled).
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleUnassignConfirm}
              className="flex-1 bg-black text-white py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Unassign
            </button>
            <button
              onClick={() => setUnassignPuzzle(null)}
              className="flex-1 border rounded-md py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" />
      {/* Panel */}
      <div className="relative bg-white rounded-xl shadow-xl border p-6 w-full max-w-sm mx-4 z-10">
        {children}
      </div>
    </div>
  );
}

export { slugify, isFloating };
