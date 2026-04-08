import React from 'react';
import PuzzleTable, { getPuzzleStatus } from './PuzzleTable';

function StatCard({ label, value, color }) {
  const colors = {
    gray: 'border-gray-200 bg-gray-50',
    green: 'border-green-200 bg-green-50',
    blue: 'border-blue-200 bg-blue-50',
    orange: 'border-orange-200 bg-orange-50',
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color] || colors.gray}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

export default function Dashboard({ puzzles }) {
  const statuses = puzzles.map((p) => getPuzzleStatus(p.id));
  const total = puzzles.length;
  const floating = statuses.filter((s) => s === 'Floating').length;
  const scheduled = statuses.filter((s) => s === 'Scheduled').length;
  const featured = statuses.filter((s) => s === 'Featured').length;

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Puzzles" value={total} color="gray" />
        <StatCard label="Floating" value={floating} color="orange" />
        <StatCard label="Scheduled" value={scheduled} color="blue" />
        <StatCard label="Featured" value={featured} color="green" />
      </div>
      <PuzzleTable puzzles={puzzles} />
    </div>
  );
}
