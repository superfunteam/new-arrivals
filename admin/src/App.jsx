import React, { useState, useEffect } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LayoutDashboard,
  CalendarDays,
  Puzzle,
  Plus,
  ExternalLink,
} from 'lucide-react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import CalendarPage from './components/CalendarPage';
import PuzzleEditor from './components/PuzzleEditor';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'editor', label: 'New Puzzle', icon: Plus },
];

function AppBreadcrumb({ view, editingPuzzle }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#">New Arrivals</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        {view === 'dashboard' && (
          <BreadcrumbItem>
            <BreadcrumbPage>Dashboard</BreadcrumbPage>
          </BreadcrumbItem>
        )}
        {view === 'calendar' && (
          <BreadcrumbItem>
            <BreadcrumbPage>Calendar</BreadcrumbPage>
          </BreadcrumbItem>
        )}
        {view === 'editor' && (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Puzzles</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {editingPuzzle ? `Edit: ${editingPuzzle.title}` : 'New Puzzle'}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

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

  function navigateTo(key) {
    if (key === 'editor') {
      handleNewPuzzle();
    } else {
      setEditingPuzzle(null);
      setView(key);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <Login
        onLogin={() => {
          setAuthed(true);
          fetch('/api/admin-puzzles')
            .then((res) => res.json())
            .then((data) => {
              setPuzzles(data.puzzles || []);
              setSha(data.sha || null);
            })
            .catch(() => setLoadError('Failed to load puzzles'));
        }}
      />
    );
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" isActive={false} tooltip="New Arrivals">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Puzzle className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">New Arrivals</span>
                    <span className="truncate text-xs text-muted-foreground">Backroom Admin</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarSeparator />
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={view === item.key}
                      onClick={() => navigateTo(item.key)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Back to Game" render={<a href="/" />}>
                  <ExternalLink />
                  <span>Back to Game</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset className="min-w-0 overflow-hidden">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 !h-4" />
            <AppBreadcrumb view={view} editingPuzzle={editingPuzzle} />
          </header>
          <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 md:p-6">
            {loadError && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <p className="text-sm text-destructive">{loadError}</p>
              </div>
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
            {view === 'calendar' && (
              <CalendarPage
                puzzles={puzzles}
                sha={sha}
                onPuzzlesChange={setPuzzles}
                onShaChange={setSha}
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
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
