// src/app/verify-otp/page.tsx
'use client';

import axios from 'axios';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import type { FoliState } from '@/components/foli/Foli';
import AuthTransition from '@/components/foli/AuthTransition';
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

  useEffect(() => {
    inputRefs[0].current?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const nextOtp = [...otp];
    nextOtp[index] = value;
    setOtp(nextOtp);
    setFoli(nextOtp.every(Boolean) ? 'happy' : 'typing');
    if (value && index < 3) inputRefs[index + 1].current?.focus();
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').slice(0, 4);
    if (!/^\d+$/.test(pasted)) return;
    const nextOtp = [...otp];
    pasted.split('').forEach((char, index) => {
      if (index < 4) nextOtp[index] = char;
    });
    setOtp(nextOtp);
    setFoli(nextOtp.every(Boolean) ? 'happy' : 'typing');
    inputRefs[Math.min(pasted.length, 3)].current?.focus();
  };

  const fail = (message: string) => {
    setError(message);
    setFoli('error');
    window.setTimeout(() => setFoli('idle'), 900);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    const otpCode = otp.join('');

    if (otpCode.length !== 4) {
      fail('Please enter the complete 4-digit code.');
      return;
    }

    try {
      await axios.post(`${API}/auth/verify-otp`, { otp: otpCode, email });
      setFoli('success');
      setVerified(true);
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message
        : undefined;
      fail(message || 'That code was incorrect. Try again.');
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
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message
        : undefined;
      setError(message || 'Failed to resend the code.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthShell foli={foli} backHref="/signup">
      <AuthTransition
        show={verified}
        title="Email verified."
        subtitle="Taking you to log in..."
        onDone={() => {
          window.location.href = '/login';
        }}
      />

      <header className="mb-7 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7392]">
          Confirm your email
        </p>
        <h1 className="mt-3 font-century text-4xl font-bold tracking-[0.04em] text-[#2b2440]">
          Verify email
        </h1>
        <p className="mt-2 text-sm text-[#6b6580]">
          We sent a 4-digit code
          {email ? <> to <span className="font-bold text-[#514c60]">{email}</span></> : ' to your email'}.
        </p>
      </header>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-[#ead7df] bg-[#f8edf1] px-4 py-3 text-sm font-medium text-[#8d5f70]">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-center gap-3">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={inputRefs[index]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(event) => handleChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onPaste={index === 0 ? handlePaste : undefined}
              onFocus={() => setFoli('typing')}
              className="h-16 w-14 rounded-lg border border-[#ddd8e4] bg-white text-center text-2xl font-bold text-[#343044] outline-none transition-colors focus:border-[#9a8db7] focus:ring-4 focus:ring-[#ece7f2]"
            />
          ))}
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={isResending}
            className="text-sm font-semibold text-[#7c758b] transition-colors hover:text-[#776a96] disabled:opacity-50"
          >
            {isResending ? 'Resending...' : "Didn't get it? Resend code"}
          </button>
        </div>

        <button type="submit" className="spectrum-primary auth-spectrum w-full rounded-lg px-5 py-3.5 text-sm font-bold">
          Verify
        </button>

        <Link href="/signup" className="block text-center text-xs font-bold text-[#7c758b] transition-colors hover:text-[#776a96]">
          Back to sign up
        </Link>
      </form>
    </AuthShell>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<FoliLoader />}>
      <VerifyOtpContent />
    </Suspense>
  );
}
