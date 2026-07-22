'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import FoliLoader from '@/components/foli/FoliLoader';
import FoliSuccessTakeover from '@/components/foli/FoliSuccessTakeover';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    const handleLogin = async () => {
      const accessToken = searchParams.get('accessToken');
      const refreshToken = searchParams.get('refreshToken');
      const name = searchParams.get('name');
      const email = searchParams.get('email');

      if (accessToken && refreshToken) {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        if (name) localStorage.setItem('userName', name);
        if (email) localStorage.setItem('userEmail', email);

        try {
          const statusRes = await axios.get(`${API}/onboarding/status`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          setTarget(statusRes.data?.completed ? '/dashboard' : '/onboarding');
        } catch {
          setTarget('/dashboard');
        }
        return;
      }
      router.replace('/login');
    };
    handleLogin();
  }, [router, searchParams]);

  // Once we know where to go, celebrate; the takeover redirects on completion.
  if (target) {
    return (
      <FoliSuccessTakeover
        show
        title="Signed in with Google 🎉"
        subtitle="Taking you to your dashboard…"
        onDone={() => router.replace(target)}
      />
    );
  }
  return <FoliLoader title="Completing Google login" messages={['Verifying your account…', 'Almost there…']} />;
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<FoliLoader title="Completing Google login" />}>
      <GoogleCallbackContent />
    </Suspense>
  );
}
