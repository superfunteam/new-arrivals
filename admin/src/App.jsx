import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import PuzzleEditor from './components/PuzzleEditor';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [puzzles, setPuzzles] = useState([]);
  const [sha, setSha] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [view, setView] = useState('dashboard');
  const [editingPuzzle, setEditingPuzzle] = useState(null);

  useEffect(() => {
    fetch('/api/admin-puzzles')
      .then((res) => {
        if (!res.ok) {
          setAuthed(false);
          setChecking(false);
          return;
        }
        setAuthed(true);
        return res.json();
      })
      .then((data) => {
        if (data) {
          setPuzzles(data.puzzles || []);
          setSha(data.sha || null);
        }
        setChecking(false);
      })
      .catch(() => {
        setLoadError('Failed to connect');
        setChecking(false);
      });
  }, []);

  function handleNewPuzzle() {
    setEditingPuzzle(null);
    setView('editor');
  }

  function handleEditPuzzle(puzzle) {
    setEditingPuzzle(puzzle);
    setView('editor');
  }

  function handleEditorCancel() {
    setEditingPuzzle(null);
    setView('dashboard');
  }

  function handleEditorSave(puzzleData) {
    console.log('Puzzle saved:', puzzleData);
    setEditingPuzzle(null);
    setView('dashboard');
    // Re-fetch puzzles from GitHub to reflect the committed changes
    fetch('/api/admin-puzzles')
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setPuzzles(data.puzzles || []);
          setSha(data.sha || null);
        }
      })
      .catch(() => setLoadError('Failed to refresh puzzles'));
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!authed) {
    return <Login onLogin={() => {
      setAuthed(true);
      fetch('/api/admin-puzzles')
        .then((res) => res.json())
        .then((data) => {
          setPuzzles(data.puzzles || []);
          setSha(data.sha || null);
        })
        .catch(() => setLoadError('Failed to load puzzles'));
    }} />;
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <h1
          className="text-xl font-semibold"
          style={{ cursor: view !== 'dashboard' ? 'pointer' : 'default' }}
          onClick={() => { if (view !== 'dashboard') handleEditorCancel(); }}
        >
          New Arrivals — Backroom
        </h1>
        <span className="text-sm text-gray-400">
          {view === 'editor' ? (editingPuzzle ? 'Edit Puzzle' : 'New Puzzle') : 'Puzzle Admin'}
        </span>
      </header>
      <main className="p-6">
        {loadError && (
          <p className="text-red-500 text-sm mb-4">{loadError}</p>
        )}
        {view === 'dashboard' && (
          <Dashboard
            puzzles={puzzles}
            sha={sha}
            onPuzzlesChange={setPuzzles}
            onShaChange={setSha}
            onNewPuzzle={handleNewPuzzle}
            onEditPuzzle={handleEditPuzzle}
          />
        )}
        {view === 'editor' && (
          <PuzzleEditor
            puzzle={editingPuzzle}
            onSave={handleEditorSave}
            onCancel={handleEditorCancel}
          />
        )}
      </main>
    </div>
  );
}
