// src/app/reset-password/page.tsx
'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import AuthShell from '@/components/auth/AuthShell';
import type { FoliState } from '@/components/foli/Foli';
import FoliLoader from '@/components/foli/FoliLoader';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const inputClass =
  'auth-input w-full rounded-lg border border-[#ddd8e4] bg-white px-3.5 py-3 text-[15px] text-[#343044] outline-none transition-colors placeholder:text-[#aaa4b5] focus:border-[#9a8db7] focus:ring-4 focus:ring-[#ece7f2]';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [formData, setFormData] = useState({ newPassword: '', confirmPassword: '' });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [foli, setFoli] = useState<FoliState>('idle');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError(null);
  };

  const fail = (message: string) => {
    setError(message);
    setFoli('error');
    window.setTimeout(() => setFoli('idle'), 900);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (formData.newPassword !== formData.confirmPassword) {
      fail('Passwords do not match.');
      return;
    }

    if (formData.newPassword.length < 8) {
      fail('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    setFoli('typing');

    try {
      const response = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, newPassword: formData.newPassword }),
      });
      const data = await response.json();

      if (!response.ok) {
        fail(data.message || 'Something went wrong.');
        return;
      }

      router.push('/login');
    } catch {
      fail('Error resetting password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell foli={foli} backHref="/login">
      <header className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7392]">
          Account recovery
        </p>
        <h1 className="mt-3 font-century text-4xl font-bold tracking-[0.04em] text-[#2b2440]">
          Reset password
        </h1>
        <p className="mt-2 text-sm text-[#6b6580]">
          Choose a new password for your account.{' '}
          <Link
            href="/login"
            className="font-bold text-[#776a96] transition-colors hover:text-[#685a88]"
          >
            Back to login
          </Link>
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-[#ead7df] bg-[#f8edf1] px-4 py-3 text-sm font-medium text-[#8d5f70]"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="newPassword" className="mb-2 block text-xs font-bold text-[#615b6d]">
            New password
          </label>
          <div className="relative">
            <input
              type={showNewPassword ? 'text' : 'password'}
              id="newPassword"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              required
              placeholder="At least 8 characters"
              autoComplete="new-password"
              onFocus={() => setFoli('peek')}
              onBlur={() => setFoli('idle')}
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((current) => !current)}
              aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-[#817a8b] transition-colors hover:bg-[#f0ebf4] hover:text-[#776a96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8e1f1]"
            >
              {showNewPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-2 block text-xs font-bold text-[#615b6d]">
            Confirm password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Confirm your password"
              autoComplete="new-password"
              onFocus={() => setFoli('peek')}
              onBlur={() => setFoli('idle')}
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((current) => !current)}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-[#817a8b] transition-colors hover:bg-[#f0ebf4] hover:text-[#776a96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8e1f1]"
            >
              {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="spectrum-primary auth-spectrum w-full rounded-lg px-5 py-3.5 text-sm font-bold"
        >
          {isSubmitting ? 'Resetting...' : 'Reset password'}
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<FoliLoader />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
