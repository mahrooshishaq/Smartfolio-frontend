// src/app/signup/page.tsx
'use client';
import axios from "axios";
import { useState } from 'react';
import { FaGoogle, FaEye, FaEyeSlash } from 'react-icons/fa';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Foli, { FoliState } from '@/components/foli/Foli';
import FoliSuccessTakeover from '@/components/foli/FoliSuccessTakeover';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

const STRENGTH_LABELS = ['', 'Weak — add length', 'Getting there', 'Strong', 'Excellent 💪'];
function scorePassword(v: string): number {
  let s = 0;
  if (v.length >= 6) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/\d/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v) && v.length >= 10) s++;
  return s;
}

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foli, setFoli] = useState<FoliState>('idle');
  const [done, setDone] = useState(false);

  const strength = scorePassword(formData.password);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords don't match — please re-enter them.");
      setFoli('error');
      setTimeout(() => setFoli('idle'), 900);
      return;
    }

    try {
      await axios.post(`${API}/auth/signup`, {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        password: formData.password,
      });
      setFoli('success');
      setDone(true);
    } catch (err: any) {
      const backendMessage = err.response?.data?.message;
      setError(Array.isArray(backendMessage) ? backendMessage.join(', ') : (backendMessage || 'Signup failed'));
      setFoli('error');
      setTimeout(() => setFoli('idle'), 900);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden font-raleway bg-[#f5f4fb]">
      <FoliSuccessTakeover
        show={done}
        title="Account created! 🎉"
        subtitle="Sending your verification code…"
        onDone={() => router.push(`/verify-otp?email=${encodeURIComponent(formData.email)}`)}
      />

      <div className="bg-white rounded-[26px] shadow-2xl w-full max-w-[460px] z-10 relative overflow-hidden">
        <div className="foli-bay h-40">
          <Link href="/" aria-label="Back to home"
            className="absolute left-4 top-4 text-gray-500/80 hover:text-gray-700 transition-colors z-10">
            <ArrowLeft size={22} />
          </Link>
          <Foli state={foli} className="w-[132px] h-[132px]" />
        </div>

        <div className="p-6 md:p-8">
          <div className="mb-5">
            <h1 className="text-2xl font-semibold text-gray-800 mb-1">Create account</h1>
            <p className="text-sm text-gray-500">
              Already have an account? <a href="/login" className="font-semibold text-purple-600 hover:text-purple-700">Log in</a>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-xs font-semibold text-gray-500 mb-1.5">First name</label>
                <input type="text" id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} required
                  placeholder="Ada" onFocus={() => setFoli('typing')} onBlur={() => setFoli('idle')}
                  className="w-full text-[15px] text-gray-800 bg-[#fbfaff] border-[1.5px] border-gray-200 rounded-xl px-3.5 py-3 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition" />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-xs font-semibold text-gray-500 mb-1.5">Last name</label>
                <input type="text" id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} required
                  placeholder="Lovelace" onFocus={() => setFoli('typing')} onBlur={() => setFoli('idle')}
                  className="w-full text-[15px] text-gray-800 bg-[#fbfaff] border-[1.5px] border-gray-200 rounded-xl px-3.5 py-3 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition" />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
              <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required
                placeholder="you@example.com" autoComplete="email" onFocus={() => setFoli('typing')} onBlur={() => setFoli('idle')}
                className="w-full text-[15px] text-gray-800 bg-[#fbfaff] border-[1.5px] border-gray-200 rounded-xl px-3.5 py-3 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition" />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-gray-500 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} id="password" name="password" value={formData.password} onChange={handleChange} required
                  placeholder="••••••••" autoComplete="new-password" onFocus={() => setFoli('peek')} onBlur={() => setFoli('idle')}
                  className="w-full text-[15px] text-gray-800 bg-[#fbfaff] border-[1.5px] border-gray-200 rounded-xl px-3.5 py-3 pr-11 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center text-gray-400 hover:text-gray-600 rounded-lg">
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {formData.password && (
                <>
                  <div className="flex gap-1.5 mt-2" aria-hidden>
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className="h-1.5 flex-1 rounded-full transition-colors"
                        style={{ background: i < strength
                          ? (strength <= 1 ? '#f43f5e' : strength === 2 ? '#f59e0b' : strength === 3 ? '#c084fc' : '#12b981')
                          : '#e5e0f0' }} />
                    ))}
                  </div>
                  <p className="text-[11.5px] text-gray-500 mt-1.5">{STRENGTH_LABELS[strength]}</p>
                </>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-semibold text-gray-500 mb-1.5">Confirm password</label>
              <div className="relative">
                <input type={showConfirmPassword ? "text" : "password"} id="confirmPassword" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required
                  placeholder="••••••••" onFocus={() => setFoli('peek')} onBlur={() => setFoli('idle')}
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
              Create account
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
