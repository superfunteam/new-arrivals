import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Plus, TrendingUp, TrendingDown, Minus, CalendarDays } from 'lucide-react';
import PuzzleTable, { getPuzzleStatus } from './PuzzleTable';

const STAT_CONFIG = [
  {
    key: 'total',
    label: 'Total Puzzles',
    icon: null,
    trend: 'neutral',
  },
  {
    key: 'floating',
    label: 'Floating',
    icon: null,
    trend: 'down',
    trendLabel: 'Need scheduling',
  },
  {
    key: 'scheduled',
    label: 'Scheduled',
    icon: null,
    trend: 'up',
    trendLabel: 'Upcoming',
  },
  {
    key: 'featured',
    label: 'Featured',
    icon: null,
    trend: 'up',
    trendLabel: 'Published',
  },
];

function TrendIndicator({ trend, label }) {
  if (trend === 'up') {
    return (
      <div className="flex items-center gap-1 text-xs text-emerald-600">
        <TrendingUp className="size-3" />
        <span>{label}</span>
      </div>
    );
  }
  if (trend === 'down') {
    return (
      <div className="flex items-center gap-1 text-xs text-amber-600">
        <TrendingDown className="size-3" />
        <span>{label}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Minus className="size-3" />
      <span>All puzzles</span>
    </div>
  );
}

function StatCard({ label, value, trend, trendLabel }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        <TrendIndicator trend={trend} label={trendLabel} />
      </CardContent>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}

function TimelineStrip({ puzzles }) {
  const today = new Date();
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const puzzle = puzzles.find(p => p.id === dateStr);
    days.push({ date: d, dateStr, dayName: dayNames[d.getDay()], dayNum: d.getDate(), puzzle });
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <CalendarDays className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Upcoming 2 Weeks</span>
      </div>
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2">
          {days.map((day, i) => {
            const isToday = i === 0;
            return (
              <div
                key={day.dateStr}
                className={`flex-shrink-0 w-[90px] rounded-md border p-2 text-center text-xs ${
                  isToday ? 'ring-2 ring-primary ring-offset-1 bg-primary/5' : ''
                } ${day.puzzle ? 'bg-primary/5 border-primary/30' : 'border-dashed border-muted-foreground/20'}`}
              >
                <div className="text-muted-foreground">{day.dayName}</div>
                <div className={`text-lg font-bold ${isToday ? 'text-primary' : ''}`}>{day.dayNum}</div>
                {day.puzzle ? (
                  <div className="text-[10px] font-medium truncate mt-0.5">{day.puzzle.title}</div>
                ) : (
                  <div className="text-[10px] text-muted-foreground/50 mt-0.5">—</div>
                )}
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Manage and schedule your daily puzzles.
          </p>
        </div>
        <Button onClick={() => onNewPuzzle && onNewPuzzle()}>
          <Plus className="mr-2 size-4" />
          New Puzzle
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CONFIG.map((stat) => (
          <StatCard
            key={stat.key}
            label={stat.label}
            value={statValues[stat.key]}
            trend={stat.trend}
            trendLabel={stat.trendLabel}
          />
        ))}
      </div>

      {/* Timeline Strip */}
      <TimelineStrip puzzles={puzzles} />

      {/* Table */}
      <PuzzleTable puzzles={puzzles} onNewPuzzle={onNewPuzzle} onEditPuzzle={onEditPuzzle} />
    </div>
  );
}
