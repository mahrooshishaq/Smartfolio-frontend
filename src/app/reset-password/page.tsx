// src/app/reset-password/page.tsx
'use client';
import { useState, Suspense } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Foli, { FoliState } from '@/components/foli/Foli';
import FoliSuccessTakeover from '@/components/foli/FoliSuccessTakeover';
import FoliLoader from '@/components/foli/FoliLoader';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function ResetPasswordContent() {
  const router = useRouter();
  const [formData, setFormData] = useState({ newPassword: '', confirmPassword: '' });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [foli, setFoli] = useState<FoliState>('idle');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const fail = (msg: string) => {
    setError(msg);
    setFoli('error');
    setTimeout(() => setFoli('idle'), 900);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (formData.newPassword !== formData.confirmPassword) return fail('Passwords do not match.');
    if (formData.newPassword.length < 8) return fail('Password must be at least 8 characters long.');
    try {
      const response = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, newPassword: formData.newPassword }),
      });
      const data = await response.json();
      if (!response.ok) return fail(data.message || 'Something went wrong.');
      setFoli('success');
      setIsSuccess(true);
    } catch {
      fail('Error resetting password.');
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden font-raleway bg-[#f5f4fb]">
      <FoliSuccessTakeover
        show={isSuccess}
        title="Password changed! 🎉"
        subtitle="Taking you to log in…"
        onDone={() => router.push('/login')}
      />

      <div className="bg-white rounded-[26px] shadow-2xl w-full max-w-[460px] z-10 relative overflow-hidden">
        <div className="foli-bay h-40">
          <Link href="/login" aria-label="Back to log in"
            className="absolute left-4 top-4 text-gray-500/80 hover:text-gray-700 transition-colors z-10">
            <ArrowLeft size={22} />
          </Link>
          <Foli state={foli} className="w-[128px] h-[128px]" />
        </div>

        <div className="p-6 md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-800 mb-1">Reset password</h1>
            <p className="text-sm text-gray-500">Choose a new password for your account.</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl text-center font-medium">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-xs font-semibold text-gray-500 mb-1.5">New password</label>
              <div className="relative">
                <input type={showNewPassword ? "text" : "password"} id="newPassword" name="newPassword"
                  value={formData.newPassword} onChange={handleChange} required placeholder="At least 8 characters"
                  autoComplete="new-password" onFocus={() => setFoli('peek')} onBlur={() => setFoli('idle')}
                  className="w-full text-[15px] text-gray-800 bg-[#fbfaff] border-[1.5px] border-gray-200 rounded-xl px-3.5 py-3 pr-11 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition" />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center text-gray-400 hover:text-gray-600 rounded-lg">
                  {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-semibold text-gray-500 mb-1.5">Confirm password</label>
              <div className="relative">
                <input type={showConfirmPassword ? "text" : "password"} id="confirmPassword" name="confirmPassword"
                  value={formData.confirmPassword} onChange={handleChange} required placeholder="••••••••"
                  autoComplete="new-password" onFocus={() => setFoli('peek')} onBlur={() => setFoli('idle')}
                  className="w-full text-[15px] text-gray-800 bg-[#fbfaff] border-[1.5px] border-gray-200 rounded-xl px-3.5 py-3 pr-11 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition" />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center text-gray-400 hover:text-gray-600 rounded-lg">
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <button type="submit"
              className="w-full py-3.5 text-white text-[15px] font-bold rounded-xl bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 shadow-lg shadow-purple-200 hover:brightness-105 active:translate-y-px transition">
              Reset password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<FoliLoader />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
