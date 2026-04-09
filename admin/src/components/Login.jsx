import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Lock, Mail, Puzzle, Check } from 'lucide-react';
import { loginWithEmail, handleAuthCallback, acceptInvite } from '@/lib/identity';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [backupPw, setBackupPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [inviteAccepted, setInviteAccepted] = useState(false);

  useEffect(() => {
    handleAuthCallback().then((result) => {
      if (result?.type === 'invite') {
        setInviteToken(result.token);
      } else if (result?.type === 'confirmed' || result?.type === 'login') {
        onLogin();
      }
    });
  }, []);

  async function handleAcceptInvite(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await acceptInvite(inviteToken, newPassword);
      setInviteAccepted(true);
      // Also set backup cookie
      await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: 'vhsgarage' }),
      });
      window.location.hash = '';
      setTimeout(() => onLogin(), 1500);
    } catch (err) {
      setError(err.message || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  }

  async function handleIdentityLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await loginWithEmail(email, password);
      // Also set the backup cookie for API auth
      await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: 'vhsgarage' }),
      });
      onLogin();
    } catch (err) {
      setError(err.message || 'Login failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  }

  async function handleBackupLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: backupPw }),
      });
      if (res.ok) {
        onLogin();
      } else {
        const data = await res.json();
        setError(data.error || 'Wrong password');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }

  // Invite acceptance screen
  if (inviteToken) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Puzzle className="size-6" />
            </div>
            <CardTitle className="text-xl">Welcome to the Backroom</CardTitle>
            <CardDescription>Set your password to get started</CardDescription>
          </CardHeader>
          <CardContent>
            {inviteAccepted ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check className="size-6" />
                </div>
                <p className="text-sm font-medium">Account created! Signing you in...</p>
              </div>
            ) : (
              <form onSubmit={handleAcceptInvite} className="space-y-3">
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Choose a password"
                    autoFocus
                    className="h-10 pl-9"
                  />
                </div>
                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                    <p className="text-sm text-destructive font-medium">{error}</p>
                  </div>
                )}
                <Button type="submit" disabled={loading || !newPassword || newPassword.length < 6} className="w-full h-10">
                  {loading ? <><Loader2 className="mr-2 size-4 animate-spin" /> Setting up...</> : 'Create Account'}
                </Button>
                <p className="text-xs text-muted-foreground text-center">Minimum 6 characters</p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Puzzle className="size-6" />
          </div>
          <CardTitle className="text-xl">New Arrivals</CardTitle>
          <CardDescription>Sign in to access the backroom</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="identity" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="identity">Email Login</TabsTrigger>
              <TabsTrigger value="backup">Password</TabsTrigger>
            </TabsList>

            <TabsContent value="identity">
              <form onSubmit={handleIdentityLogin} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    autoFocus
                    className="h-10 pl-9"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="h-10 pl-9"
                  />
                </div>
                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                    <p className="text-sm text-destructive font-medium">{error}</p>
                  </div>
                )}
                <Button type="submit" disabled={loading || !email || !password} className="w-full h-10">
                  {loading ? <><Loader2 className="mr-2 size-4 animate-spin" /> Signing in...</> : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="backup">
              <form onSubmit={handleBackupLogin} className="space-y-3">
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    value={backupPw}
                    onChange={(e) => setBackupPw(e.target.value)}
                    placeholder="Backup password"
                    className="h-10 pl-9"
                  />
                </div>
                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                    <p className="text-sm text-destructive font-medium">{error}</p>
                  </div>
                )}
                <Button type="submit" disabled={loading || !backupPw} className="w-full h-10">
                  {loading ? <><Loader2 className="mr-2 size-4 animate-spin" /> Checking...</> : 'Enter Backroom'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
