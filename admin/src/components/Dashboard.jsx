import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';
import PuzzleTable, { getPuzzleStatus } from './PuzzleTable';
import CalendarStrip from './CalendarStrip';

const STAT_CONFIG = [
  { key: 'total', label: 'Total Puzzles', accent: 'border-l-gray-400 bg-gray-50/50' },
  { key: 'floating', label: 'Floating', accent: 'border-l-amber-400 bg-amber-50/50' },
  { key: 'scheduled', label: 'Scheduled', accent: 'border-l-blue-400 bg-blue-50/50' },
  { key: 'featured', label: 'Featured', accent: 'border-l-emerald-400 bg-emerald-50/50' },
];

function StatCard({ label, value, accent }) {
  return (
    <Card className={`border-l-4 ${accent}`}>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1 text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-l-4 border-l-gray-200">
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-28 w-full rounded-lg" />
      <div className="space-y-3">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function Dashboard({ puzzles, sha, onPuzzlesChange, onShaChange, onNewPuzzle, onEditPuzzle }) {
  const statuses = puzzles.map((p) => getPuzzleStatus(p.id));
  const total = puzzles.length;
  const floating = statuses.filter((s) => s === 'Floating').length;
  const scheduled = statuses.filter((s) => s === 'Scheduled').length;
  const featured = statuses.filter((s) => s === 'Featured').length;

  const statValues = { total, floating, scheduled, featured };

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

  function handleAssign(puzzle, dateString) {
    const updated = puzzles.map((p) =>
      p.id === puzzle.id ? { ...p, id: dateString } : p
    );
    savePuzzles(updated);
  }

  function handleUnassign(puzzle) {
    const slug = puzzle.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const updated = puzzles.map((p) =>
      p.id === puzzle.id ? { ...p, id: slug } : p
    );
    savePuzzles(updated);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-foreground">Dashboard</h2>
        <Button onClick={() => onNewPuzzle && onNewPuzzle()}>
          <Plus className="h-4 w-4 mr-2" />
          New Puzzle
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {STAT_CONFIG.map((stat) => (
          <StatCard
            key={stat.key}
            label={stat.label}
            value={statValues[stat.key]}
            accent={stat.accent}
          />
        ))}
      </div>

      {/* Calendar */}
      <CalendarStrip
        puzzles={puzzles}
        onAssign={handleAssign}
        onUnassign={handleUnassign}
      />

      {/* Table */}
      <PuzzleTable puzzles={puzzles} onNewPuzzle={onNewPuzzle} onEditPuzzle={onEditPuzzle} />
    </div>
  );
}
