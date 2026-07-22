// src/app/verify-otp/page.tsx
'use client';
import axios from "axios";
import { useState, useRef, useEffect, Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Foli, { FoliState } from '@/components/foli/Foli';
import FoliSuccessTakeover from '@/components/foli/FoliSuccessTakeover';
import FoliLoader from '@/components/foli/FoliLoader';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function VerifyOtpContent() {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [foli, setFoli] = useState<FoliState>('idle');
  const [verified, setVerified] = useState(false);
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => { inputRefs[0].current?.focus(); }, []);

  const handleChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setFoli(newOtp.every((d) => d) ? 'happy' : 'typing');
    if (value && index < 3) inputRefs[index + 1].current?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs[index - 1].current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 4);
    if (!/^\d+$/.test(pastedData)) return;
    const newOtp = [...otp];
    pastedData.split('').forEach((char, index) => { if (index < 4) newOtp[index] = char; });
    setOtp(newOtp);
    setFoli(newOtp.every((d) => d) ? 'happy' : 'typing');
    inputRefs[Math.min(pastedData.length, 3)].current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    const otpCode = otp.join('');
    if (otpCode.length !== 4) {
      setError('Please enter the complete 4-digit code.');
      setFoli('error');
      setTimeout(() => setFoli('idle'), 900);
      return;
    }
    try {
      await axios.post(`${API}/auth/verify-otp`, { otp: otpCode, email });
      setFoli('success');
      setVerified(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'That code was incorrect. Try again.');
      setFoli('error');
      setTimeout(() => setFoli('idle'), 900);
    }
  };

  const handleResendOtp = async () => {
    setIsResending(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await axios.post(`${API}/auth/resend-otp`, { email });
      setSuccessMessage('A fresh code is on its way to your email.');
      setOtp(['', '', '', '']);
      inputRefs[0].current?.focus();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend the code.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden font-raleway bg-[#f5f4fb]">
      <FoliSuccessTakeover
        show={verified}
        title="Email verified! 🎉"
        subtitle="Taking you to log in…"
        onDone={() => { window.location.href = '/login'; }}
      />

      <div className="bg-white rounded-[26px] shadow-2xl w-full max-w-[460px] z-10 relative overflow-hidden">
        <div className="foli-bay h-40">
          <Link href="/signup" aria-label="Back to sign up"
            className="absolute left-4 top-4 text-gray-500/80 hover:text-gray-700 transition-colors z-10">
            <ArrowLeft size={22} />
          </Link>
          <Foli state={foli} className="w-[128px] h-[128px]" />
        </div>

        <div className="p-6 md:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-gray-800 mb-1">Verify your email</h1>
            <p className="text-sm text-gray-500">
              We sent a 4-digit code{email ? <> to <span className="font-medium text-gray-700">{email}</span></> : ' to your email'}.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl text-center font-medium">{error}</div>
          )}
          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-xl text-center font-medium">{successMessage}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center gap-3">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={inputRefs[index]}
                  type="text" inputMode="numeric" maxLength={1} value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  onFocus={() => setFoli('typing')}
                  className="w-14 h-16 text-center text-2xl font-semibold border-[1.5px] border-gray-200 rounded-xl bg-[#fbfaff] text-gray-800 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 focus:outline-none transition"
                />
              ))}
            </div>

            <div className="text-center">
              <button type="button" onClick={handleResendOtp} disabled={isResending}
                className="text-sm text-gray-500 hover:text-purple-600 disabled:opacity-50">
                {isResending ? 'Resending…' : "Didn't get it? Resend code"}
              </button>
            </div>

            <button type="submit"
              className="w-full py-3.5 text-white text-[15px] font-bold rounded-xl bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 shadow-lg shadow-purple-200 hover:brightness-105 active:translate-y-px transition">
              Verify
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<FoliLoader />}>
      <VerifyOtpContent />
    </Suspense>
  );
}
