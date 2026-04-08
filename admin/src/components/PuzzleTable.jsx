import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
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

const STATUS_BADGE_VARIANT = {
  Featured: 'default',
  Scheduled: 'secondary',
  Floating: 'outline',
  Training: 'secondary',
};

const STATUS_DOT_COLOR = {
  Featured: 'bg-emerald-500',
  Scheduled: 'bg-blue-500',
  Floating: 'bg-amber-500',
  Training: 'bg-muted-foreground',
};

const CATEGORY_DOTS = [
  'bg-emerald-400',
  'bg-amber-400',
  'bg-blue-400',
  'bg-purple-400',
];

const TABS_LIST = ['All', 'Featured', 'Scheduled', 'Floating', 'Training'];

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
        <LayoutGrid className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">No puzzles found</p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        Try a different filter or create a new puzzle
      </p>
    </div>
  );
}

function PuzzleTableInner({ puzzles, onEditPuzzle }) {
  if (puzzles.length === 0) {
    return <EmptyState />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead>Title</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date / ID</TableHead>
          <TableHead>Categories</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {puzzles.map((puzzle) => (
          <TableRow
            key={puzzle.id}
            onClick={() => onEditPuzzle && onEditPuzzle(puzzle)}
            className="cursor-pointer"
          >
            <TableCell className="font-medium">{puzzle.title}</TableCell>
            <TableCell>
              <Badge variant={STATUS_BADGE_VARIANT[puzzle.status]}>
                <span className={`mr-1.5 inline-block size-1.5 rounded-full ${STATUS_DOT_COLOR[puzzle.status]}`} />
                {puzzle.status}
              </Badge>
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {puzzle.id}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1.5 flex-wrap">
                {puzzle.categories.slice(0, 4).map((cat, ci) => (
                  <span
                    key={cat.name}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                  >
                    <span className={`size-1.5 rounded-full ${CATEGORY_DOTS[ci % CATEGORY_DOTS.length]}`} />
                    <span className="max-w-[80px] truncate">{cat.name}</span>
                  </span>
                ))}
              </div>
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditPuzzle && onEditPuzzle(puzzle);
                }}
              >
                <Pencil className="mr-1.5 size-3" />
                Edit
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
          {TABS_LIST.map((tab) => {
            const count = tab === 'All'
              ? enriched.length
              : enriched.filter((p) => p.status === tab).length;
            return (
              <TabsTrigger key={tab} value={tab}>
                {tab}
                <span className="ml-1.5 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground group-data-[variant=default]/tabs-list:bg-background/50">
                  {count}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {TABS_LIST.map((tab) => {
        const filtered =
          tab === 'All'
            ? enriched
            : enriched.filter((p) => p.status === tab);
        return (
          <TabsContent key={tab} value={tab} className="mt-0">
            <Card className="overflow-hidden">
              <PuzzleTableInner puzzles={filtered} onEditPuzzle={onEditPuzzle} />
            </Card>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

export { getPuzzleStatus };
