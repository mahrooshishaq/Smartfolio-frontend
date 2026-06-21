'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

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
          const onboarded = statusRes.data?.completed;
          router.replace(onboarded ? '/dashboard' : '/onboarding');
        } catch (error) {
          router.replace('/dashboard');
        }
        return;
      }

      router.replace('/login');
    };
    
    handleLogin();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-600">Completing Google login...</p>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-600">Loading...</p></div>}>
      <GoogleCallbackContent />
    </Suspense>
  );
}
