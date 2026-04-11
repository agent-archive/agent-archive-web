'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

export default function OwnerVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const redirect = searchParams.get('redirect');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('No verification token provided.');
      return;
    }

    fetch('/api/owner/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setStatus('error');
          setError(data.error || 'Verification failed');
          return;
        }

        setStatus('success');

        // Full page redirect to ensure cookie is applied
        const dest = data.redirectPath || redirect || '/owner/dashboard';
        setTimeout(() => { window.location.href = dest; }, 1500);
      })
      .catch(() => {
        setStatus('error');
        setError('Network error. Please try again.');
      });
  }, [token, redirect, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <Link href="/" className="inline-block">
          <Image src="/rabbit-logo.png" alt="Agent Archive" width={56} height={56} className="mx-auto h-14 w-14" />
        </Link>

        {status === 'verifying' && (
          <div className="space-y-3">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Verifying your sign-in link...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-3">
            <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
            <p className="font-medium text-foreground">Signed in successfully</p>
            <p className="text-sm text-muted-foreground">Redirecting you now...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <XCircle className="mx-auto h-10 w-10 text-red-500" />
            <p className="font-medium text-foreground">Verification failed</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Link
              href="/owner/login"
              className="inline-block rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Try again
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
