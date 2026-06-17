// src/app/verify-otp/page.tsx
'use client';
import axios from "axios";
import { useState, useRef, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import AnimatedBackground from '@/components/AnimatedBackground';
import { useSearchParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';


export default function VerifyOtpPage() {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  // Create refs for each input
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Focus first input on mount
  useEffect(() => {
    inputRefs[0].current?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 4);
    
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];
    pastedData.split('').forEach((char, index) => {
      if (index < 4) {
        newOtp[index] = char;
      }
    });
    setOtp(newOtp);

    // Focus the next empty input or the last one
    const nextIndex = Math.min(pastedData.length, 3);
    inputRefs[nextIndex].current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const otpCode = otp.join('');
    
    if (otpCode.length !== 4) {
      setError('Please enter the complete OTP');
      return;
    }

    try {
      console.log('Verifying OTP:', otpCode);
      const res = await axios.post(`${API}/auth/verify-otp`, {
        otp: otpCode,
        email: email,
      });

      console.log('Backend success message:', res.data.message);
      setSuccessMessage(res.data.message);
      
      //Redirect to login or dashboard after successful verification
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    } catch (err: any) {
      const backendMessage = err.response?.data?.message;
      setError(backendMessage || 'OTP verification failed');
    }
  };

  const handleResendOtp = async () => {
    setIsResending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      console.log('Resending OTP');
      const res = await axios.post(`${API}/auth/resend-otp`, {
        email: email,
      });

      setSuccessMessage('OTP has been resent to your email');
      setOtp(['', '', '', '']);
      inputRefs[0].current?.focus();
    } catch (err: any) {
      const backendMessage = err.response?.data?.message;
      setError(backendMessage || 'Failed to resend OTP');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden font-raleway">
      <AnimatedBackground />
      
      {/* Main Card Container */}
      <div className="bg-white rounded-[2rem] shadow-2xl p-8 md:p-12 w-full max-w-[500px] z-10 relative">
        
        {/* Header: Back Arrow */}
        <div className="flex justify-between items-center mb-10 text-gray-400">
           <Link href="/signup" className="hover:text-gray-600 transition-colors">
             <ArrowLeft size={24} />
           </Link>
        </div>

        {/* Title and Subtitle */}
        <div className="mb-8 text-center">
            <h1 className="text-3xl font-normal text-gray-800 mb-2">Verify Your Email</h1>
            <p className="text-sm text-gray-500">
              We've sent a 4-digit code to your email address
            </p>
        </div>

        {/* Error/Success Messages */}
        {error && <div className="mb-6 p-3 bg-red-50 text-red-500 text-sm rounded-lg text-center">{error}</div>}
        {successMessage && <div className="mb-6 p-3 bg-green-50 text-green-500 text-sm rounded-lg text-center">{successMessage}</div>}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* OTP Input Boxes */}
          <div className="flex justify-center gap-4">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                className="w-16 h-16 text-center text-2xl font-semibold border-2 border-gray-300 rounded-xl focus:border-gray-800 focus:outline-none transition-colors bg-gray-50 text-gray-800"
              />
            ))}
          </div>

          {/* Resend OTP Button */}
          <div className="text-center">
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={isResending}
              className="text-sm text-gray-600 hover:text-gray-800 underline decoration-gray-400 underline-offset-2 disabled:opacity-50"
            >
              {isResending ? 'Resending...' : "Didn't receive the code? Resend OTP"}
            </button>
          </div>

          {/* Verify Button */}
          <button
            type="submit"
            className="w-full py-4 px-4 bg-[#C4C4C4] hover:bg-gray-700 active:bg-gray-800 text-gray-800 hover:text-white active:text-white text-lg font-medium rounded-full transition-all duration-200"
          >
            Verify
          </button>
        </form>
      </div>
    </div>
  );
}
