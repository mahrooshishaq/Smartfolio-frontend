// src/app/login/page.tsx
'use client';
import axios from "axios";
import { useState } from 'react';
import { FaGoogle, FaEye, FaEyeSlash } from 'react-icons/fa';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Foli, { FoliState } from '@/components/foli/Foli';
import FoliSuccessTakeover from '@/components/foli/FoliSuccessTakeover';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foli, setFoli] = useState<FoliState>('idle');
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const togglePasswordVisibility = () => {
    const next = !showPassword;
    setShowPassword(next);
    // Foli peeks through when the password is revealed.
    if (document.activeElement === document.getElementById('password')) {
      setFoli(next ? 'typing' : 'peek');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await axios.post(`${API}/auth/login`, formData);
      const { accessToken, refreshToken } = res.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      let target = '/dashboard';
      try {
        const statusRes = await axios.get(`${API}/onboarding/status`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        target = statusRes.data?.completed ? '/dashboard' : '/onboarding';
      } catch {
        target = '/dashboard';
      }
      // Celebrate, then the takeover's onDone performs the redirect.
      setFoli('success');
      setRedirectTo(target);
    } catch (err: any) {
      const backendMessage = err.response?.data?.message;
      setError(Array.isArray(backendMessage) ? backendMessage.join(', ') : (backendMessage || 'Login failed'));
      setFoli('error');
      setTimeout(() => setFoli('idle'), 900);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden font-raleway bg-[#f5f4fb]">
      <FoliSuccessTakeover
        show={!!redirectTo}
        title="Welcome back! 🎉"
        subtitle="Taking you to your dashboard…"
        onDone={() => { if (redirectTo) window.location.href = redirectTo; }}
      />

      <div className="bg-white rounded-[26px] shadow-2xl w-full max-w-[440px] z-10 relative overflow-hidden">
        {/* Mascot bay */}
        <div className="foli-bay h-44">
          <Link href="/" aria-label="Back to home"
            className="absolute left-4 top-4 text-gray-500/80 hover:text-gray-700 transition-colors z-10">
            <ArrowLeft size={22} />
          </Link>
          <Foli state={foli} className="w-[150px] h-[150px]" />
        </div>

        <div className="p-6 md:p-8">
          <div className="mb-5">
            <h1 className="text-2xl font-semibold text-gray-800 mb-1">Log in</h1>
            <p className="text-sm text-gray-500">
              Don&apos;t have an account? <a href="/signup" className="font-semibold text-purple-600 hover:text-purple-700">Sign up</a>
            </p>
          </div>

          <button
            type="button"
            className="w-full py-2.5 px-4 border border-gray-300 rounded-xl flex items-center justify-center gap-3 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium"
            onClick={() => { window.location.href = `${BACKEND_URL}/auth/google`; }}
          >
            <FaGoogle className="text-lg" /> Continue with Google
          </button>

          <div className="my-5 flex items-center gap-4">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="text-gray-400 text-xs font-medium">OR</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-2 font-medium">
              <span aria-hidden>✕</span>{error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
              <input
                type="email" id="email" name="email" value={formData.email} onChange={handleChange} required
                placeholder="you@example.com" autoComplete="email"
                onFocus={() => setFoli('typing')}
                onBlur={() => setFoli('idle')}
                className="w-full text-[15px] text-gray-800 bg-[#fbfaff] border-[1.5px] border-gray-200 rounded-xl px-3.5 py-3 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-gray-500 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"} id="password" name="password"
                  value={formData.password} onChange={handleChange} required
                  placeholder="••••••••" autoComplete="new-password"
                  onFocus={() => setFoli('peek')}
                  onBlur={() => setFoli('idle')}
                  className="w-full text-[15px] text-gray-800 bg-[#fbfaff] border-[1.5px] border-gray-200 rounded-xl px-3.5 py-3 pr-11 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition"
                />
                <button type="button" onClick={togglePasswordVisibility}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center text-gray-400 hover:text-gray-600 rounded-lg">
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm text-gray-500 hover:text-purple-600">
                Forgot your password?
              </Link>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 text-white text-[15px] font-bold rounded-xl bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 shadow-lg shadow-purple-200 hover:brightness-105 active:translate-y-px transition"
            >
              Log in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
