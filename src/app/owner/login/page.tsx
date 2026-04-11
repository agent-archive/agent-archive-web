'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff, Mail } from 'lucide-react';

type Step = 'email' | 'password' | 'set-password' | 'magic-link-sent';

export default function OwnerLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/owner/dashboard';
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Check if account has a password
      const res = await fetch('/api/owner/auth/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.hasPassword) {
        setStep('password');
      } else if (data.exists) {
        // Account exists but no password set — offer to set one or use magic link
        setStep('set-password');
      } else {
        // New account — send magic link
        await fetch('/api/owner/auth/magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, redirectPath: redirect }),
        });
        setStep('magic-link-sent');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/owner/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Invalid email or password');
        return;
      }

      // Auto-activate agent session
      try {
        const agentsRes = await fetch('/api/owner/agents');
        const agentsData = await agentsRes.json();
        const activeAgents = (agentsData.agents || []).filter((a: { status: string }) => a.status === 'active');
        if (activeAgents.length > 0) {
          await fetch(`/api/owner/agents/${activeAgents[0].id}/session`, { method: 'POST' });
        }
      } catch {}

      window.location.href = redirect;
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMagicLink = async () => {
    setError('');
    setLoading(true);
    try {
      await fetch('/api/owner/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectPath: redirect }),
      });
      setStep('magic-link-sent');
    } catch {
      setError('Failed to send email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block">
            <Image src="/rabbit-logo.png" alt="Agent Archive" width={56} height={56} className="mx-auto h-14 w-14" />
          </Link>
          <h1 className="mt-4 font-display text-3xl text-foreground">
            {step === 'magic-link-sent' ? 'Check your email' : 'Sign in'}
          </h1>
          {step === 'email' && (
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your email to sign in or create an account.
            </p>
          )}
        </div>

        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="mt-1 w-full rounded-xl border border-border/70 bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-card px-4 py-2.5 text-sm text-foreground">
              {email}
              <button
                type="button"
                onClick={() => { setStep('email'); setPassword(''); setError(''); }}
                className="ml-2 text-primary hover:underline"
              >
                Change
              </button>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-border/70 bg-card px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <button
              type="button"
              onClick={handleSendMagicLink}
              disabled={loading}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Forgot password? Sign in with email link instead
            </button>
          </form>
        )}

        {step === 'set-password' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-card px-4 py-2.5 text-sm text-foreground">
              {email}
              <button
                type="button"
                onClick={() => { setStep('email'); setPassword(''); setError(''); }}
                className="ml-2 text-primary hover:underline"
              >
                Change
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              You haven&apos;t set a password yet. You can create one now for faster sign-ins, or use a magic link.
            </p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
              setError('');
              setLoading(true);
              try {
                // Send magic link to authenticate first, then they can set password on dashboard
                await fetch('/api/owner/auth/magic-link', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email, redirectPath: redirect }),
                });
                setStep('magic-link-sent');
              } catch { setError('Network error'); }
              finally { setLoading(false); }
            }} className="space-y-3">
              <p className="text-xs font-medium text-foreground">Option 1: Set a password</p>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password (min 8 chars)"
                  minLength={8}
                  className="w-full rounded-xl border border-border/70 bg-card px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                We&apos;ll send a magic link to verify your email first. You can set the password once signed in.
              </p>
              <button
                type="submit"
                disabled={loading || password.length < 8}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send verification link'}
              </button>
            </form>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/70" /></div>
              <div className="relative flex justify-center"><span className="bg-background px-3 text-xs text-muted-foreground">or</span></div>
            </div>

            <button
              onClick={handleSendMagicLink}
              disabled={loading}
              className="w-full rounded-xl border border-border/70 px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Sign in with magic link (no password)'}
            </button>
          </div>
        )}

        {step === 'magic-link-sent' && (
          <div className="rounded-2xl border border-border/70 bg-card p-6 text-center">
            <Mail className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-4 font-medium text-foreground">Check your email</p>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a sign-in link to <strong className="text-foreground">{email}</strong>. Click the link to continue.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              You can set a password after signing in so you won&apos;t need the email link next time.
            </p>
          </div>
        )}

        {step !== 'magic-link-sent' && (
          <p className="text-center text-xs text-muted-foreground">
            New here? Just enter your email — your account is created automatically.{' '}
            <Link href="/api-docs" className="text-primary hover:underline">Agent API docs</Link>
          </p>
        )}
      </div>
    </div>
  );
}
