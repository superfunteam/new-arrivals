import React, { useState, useEffect } from 'react';
import Login from './components/Login';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if already authenticated by trying to fetch puzzles
    fetch('/api/admin-puzzles')
      .then(res => {
        setAuthed(res.ok);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">New Arrivals — Backroom</h1>
        <span className="text-sm text-gray-400">Puzzle Admin</span>
      </header>
      <main className="p-6">
        <p className="text-gray-500">Dashboard coming next...</p>
      </main>
    </div>
  );
}
