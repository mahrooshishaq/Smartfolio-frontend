// src/app/forgot-password/page.tsx
'use client';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import AnimatedBackground from '@/components/AnimatedBackground';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Here you would typically make an API call to send the reset email
    // For now, we'll just show the success message
    
    setIsSubmitted(true);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden font-raleway">
      <AnimatedBackground />
      
      {/* Main Card Container */}
      <div className="bg-white rounded-[2rem] shadow-2xl p-8 md:p-12 w-full max-w-[500px] z-10 relative">
        
        {/* Header: Back Arrow */}
        <div className="flex justify-between items-center mb-10 text-gray-400">
          <Link href="/login" className="hover:text-gray-600 transition-colors">
            <ArrowLeft size={24} />
          </Link>
        </div>

        {!isSubmitted ? (
          <>
            {/* Title and Subtitle */}
            <div className="mb-8">
              <h1 className="text-3xl font-normal text-gray-800 mb-2">Forgot Password?</h1>
              <p className="text-sm text-gray-500">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Animated Email Input */}
              <div className="relative w-full">
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="peer w-full border-b border-gray-300 bg-transparent py-2 text-gray-800 focus:outline-none placeholder-transparent"
                  placeholder="Email Address"
                  autoComplete="email"
                />
                {/* The Label */}
                <label
                  htmlFor="email"
                  className="absolute left-0 -top-3.5 text-xs text-gray-400 transition-all 
                             peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-2 
                             peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-gray-400"
                >
                  Email Address
                </label>
                {/* The Animated Underline */}
                <div className="absolute bottom-0 left-0 h-[1px] w-full origin-center scale-x-0 bg-gray-800 transition-transform duration-300 peer-focus:scale-x-100"></div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-[#C4C4C4] hover:bg-gray-700 active:bg-gray-800 text-gray-800 hover:text-white active:text-white text-lg font-medium rounded-full transition-all duration-200 mt-8"
              >
                Send Reset Link
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/login" className="text-sm text-gray-500 hover:text-gray-800 underline decoration-gray-400 underline-offset-2">
                Back to Log In
              </Link>
            </div>
          </>
        ) : (
          <>
            {/* Success Message */}
            <div className="text-center">
              <div className="mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-2xl font-normal text-gray-800 mb-3">Check Your Email</h1>
                <p className="text-sm text-gray-600 mb-2">
                  We've sent a password reset link to:
                </p>
                <p className="text-sm font-medium text-gray-800 mb-6">
                  {email}
                </p>
                <p className="text-sm text-gray-500">
                  If you don't see the email, check your spam folder or try again.
                </p>
              </div>

              <div className="space-y-4">
                <Link
                  href="/login"
                  className="block w-full py-3 px-4 bg-[#C4C4C4] hover:bg-gray-700 active:bg-gray-800 text-gray-800 hover:text-white active:text-white text-lg font-medium rounded-full transition-all duration-200 text-center"
                >
                  Back to Log In
                </Link>
                
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="w-full text-sm text-gray-500 hover:text-gray-800 underline decoration-gray-400 underline-offset-2"
                >
                  Try a different email
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
