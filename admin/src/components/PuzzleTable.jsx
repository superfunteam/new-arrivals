import React, { useState } from 'react';

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

const STATUS_STYLES = {
  Featured: 'bg-green-100 text-green-800',
  Scheduled: 'bg-blue-100 text-blue-800',
  Floating: 'bg-orange-100 text-orange-800',
  Training: 'bg-gray-100 text-gray-600',
};

const TABS = ['All', 'Featured', 'Scheduled', 'Floating', 'Training'];

export default function PuzzleTable({ puzzles }) {
  const [activeTab, setActiveTab] = useState('All');

  const enriched = puzzles.map((p) => ({
    ...p,
    status: getPuzzleStatus(p.id),
  }));

  const filtered =
    activeTab === 'All'
      ? enriched
      : enriched.filter((p) => p.status === activeTab);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-black text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <button className="px-4 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors">
          New Puzzle
        </button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-left">
              <th className="px-4 py-3 font-medium text-gray-500">Title</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500">Date / ID</th>
              <th className="px-4 py-3 font-medium text-gray-500">Categories</th>
              <th className="px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((puzzle) => (
              <tr
                key={puzzle.id}
                onClick={() => console.log('Edit puzzle:', puzzle.id)}
                className="border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 font-medium">{puzzle.title}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[puzzle.status]}`}
                  >
                    {puzzle.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                  {puzzle.id}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {puzzle.categories.slice(0, 4).map((cat) => (
                      <span
                        key={cat.name}
                        className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                      >
                        {cat.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Edit puzzle:', puzzle.id);
                    }}
                    className="text-gray-400 hover:text-black text-xs font-medium"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No puzzles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { getPuzzleStatus };
