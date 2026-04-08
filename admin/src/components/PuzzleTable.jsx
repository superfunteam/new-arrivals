import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, LayoutGrid } from 'lucide-react';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function getPuzzleStatus(id) {
  if (id.startsWith('training-')) return 'Training';
  if (DATE_RE.test(id)) {
    const puzzleDate = new Date(id + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return puzzleDate < today ? 'Featured' : 'Scheduled';
  }
  return 'Floating';
}

const STATUS_VARIANT = {
  Featured: 'success',
  Scheduled: 'info',
  Floating: 'warning',
  Training: 'secondary',
};

const CATEGORY_DOTS = [
  'bg-emerald-400',
  'bg-amber-400',
  'bg-blue-400',
  'bg-purple-400',
];

const TABS_LIST = ['All', 'Featured', 'Scheduled', 'Floating', 'Training'];

function PuzzleTableInner({ puzzles, onEditPuzzle }) {
  if (puzzles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
          <LayoutGrid className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No puzzles found</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Try a different filter or create a new puzzle
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b text-left">
            <th className="px-4 py-3 font-medium text-muted-foreground">Title</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Date / ID</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Categories</th>
            <th className="px-4 py-3 font-medium text-muted-foreground text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {puzzles.map((puzzle, idx) => (
            <tr
              key={puzzle.id}
              onClick={() => onEditPuzzle && onEditPuzzle(puzzle)}
              className={`border-b last:border-b-0 cursor-pointer transition-colors hover:bg-muted/40 ${
                idx % 2 === 1 ? 'bg-muted/20' : ''
              }`}
            >
              <td className="px-4 py-3 font-medium text-foreground">
                {puzzle.title}
              </td>
              <td className="px-4 py-3">
                <Badge variant={STATUS_VARIANT[puzzle.status]}>
                  {puzzle.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                {puzzle.id}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {puzzle.categories.slice(0, 4).map((cat, ci) => (
                    <span
                      key={cat.name}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <span className={`h-2 w-2 rounded-full ${CATEGORY_DOTS[ci % CATEGORY_DOTS.length]}`} />
                      <span className="max-w-[80px] truncate">{cat.name}</span>
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPuzzle && onEditPuzzle(puzzle);
                  }}
                >
                  <Pencil className="h-3 w-3 mr-1.5" />
                  Edit
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PuzzleTable({ puzzles, onNewPuzzle, onEditPuzzle }) {
  const enriched = puzzles.map((p) => ({
    ...p,
    status: getPuzzleStatus(p.id),
  }));

  return (
    <Tabs defaultValue="All">
      <div className="flex items-center justify-between mb-4">
        <TabsList>
          {TABS_LIST.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
        <Button onClick={() => onNewPuzzle && onNewPuzzle()}>
          New Puzzle
        </Button>
      </div>

      {TABS_LIST.map((tab) => {
        const filtered =
          tab === 'All'
            ? enriched
            : enriched.filter((p) => p.status === tab);
        return (
          <TabsContent key={tab} value={tab} className="mt-0">
            <PuzzleTableInner puzzles={filtered} onEditPuzzle={onEditPuzzle} />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

export { getPuzzleStatus };
