// src/app/forgot-password/page.tsx
'use client';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Foli, { FoliState } from '@/components/foli/Foli';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foli, setFoli] = useState<FoliState>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.message || "Something went wrong.");
        setFoli('error');
        setTimeout(() => setFoli('idle'), 900);
        return;
      }
      setFoli('happy');
      setIsSubmitted(true);
    } catch {
      setError("Couldn't send the reset email. Try again.");
      setFoli('error');
      setTimeout(() => setFoli('idle'), 900);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden font-raleway bg-[#f5f4fb]">
      <div className="bg-white rounded-[26px] shadow-2xl w-full max-w-[440px] z-10 relative overflow-hidden">
        <div className="foli-bay h-40">
          <Link href="/login" aria-label="Back to log in"
            className="absolute left-4 top-4 text-gray-500/80 hover:text-gray-700 transition-colors z-10">
            <ArrowLeft size={22} />
          </Link>
          <Foli state={isSubmitted ? 'happy' : foli} className="w-[128px] h-[128px]" />
        </div>

        <div className="p-6 md:p-8">
          {!isSubmitted ? (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold text-gray-800 mb-1">Forgot password?</h1>
                <p className="text-sm text-gray-500">Enter your email and we&apos;ll send you a reset link.</p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl text-center font-medium">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
                  <input type="email" id="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    placeholder="you@example.com" autoComplete="email" onFocus={() => setFoli('typing')} onBlur={() => setFoli('idle')}
                    className="w-full text-[15px] text-gray-800 bg-[#fbfaff] border-[1.5px] border-gray-200 rounded-xl px-3.5 py-3 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition" />
                </div>
                <button type="submit"
                  className="w-full py-3.5 text-white text-[15px] font-bold rounded-xl bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 shadow-lg shadow-purple-200 hover:brightness-105 active:translate-y-px transition">
                  Send reset link
                </button>
              </form>

              <div className="mt-5 text-center">
                <Link href="/login" className="text-sm text-gray-500 hover:text-purple-600">Back to log in</Link>
              </div>
            </>
          ) : (
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-gray-800 mb-2">Check your email</h1>
              <p className="text-sm text-gray-600 mb-1">We&apos;ve sent a reset link to</p>
              <p className="text-sm font-semibold text-gray-800 mb-4">{email}</p>
              <p className="text-sm text-gray-500 mb-6">Don&apos;t see it? Check spam, or try again.</p>
              <Link href="/login"
                className="block w-full py-3.5 text-white text-[15px] font-bold rounded-xl bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 shadow-lg shadow-purple-200 hover:brightness-105 transition text-center">
                Back to log in
              </Link>
              <button onClick={() => { setIsSubmitted(false); setFoli('idle'); }}
                className="mt-4 w-full text-sm text-gray-500 hover:text-purple-600">
                Try a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
