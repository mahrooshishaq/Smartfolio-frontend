// src/app/reset-password/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isSuccess) {
      // Redirect to login page after 2 seconds
      const timer = setTimeout(() => {
        router.push('/login');
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isSuccess, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password length
    if (formData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    // Here you would typically make an API call to reset the password
    // For now, we'll just show the success message
    
    setIsSuccess(true);
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

        {!isSuccess ? (
          <>
            {/* Title and Subtitle */}
            <div className="mb-8">
              <h1 className="text-3xl font-normal text-gray-800 mb-2">Reset Password</h1>
              <p className="text-sm text-gray-500">
                Enter your new password below.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-3 bg-red-50 text-red-500 text-sm rounded-lg text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* New Password Input */}
              <div className="relative w-full">
                <input
                  type={showNewPassword ? "text" : "password"}
                  id="newPassword"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  required
                  className="peer w-full border-b border-gray-300 bg-transparent py-2 pr-20 text-gray-800 focus:outline-none placeholder-transparent"
                  placeholder="New Password"
                  autoComplete="new-password"
                />
                {/* The Label */}
                <label
                  htmlFor="newPassword"
                  className="absolute left-0 -top-3.5 text-xs text-gray-400 transition-all 
                             peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-2 
                             peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-gray-400"
                >
                  New Password
                </label>

                {/* Password Toggle */}
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-0 top-2 text-gray-400 hover:text-gray-600 flex items-center gap-1 text-sm"
                >
                  {showNewPassword ? <FaEyeSlash /> : <FaEye />} 
                  <span className="text-xs">{showNewPassword ? 'Hide' : 'Show'}</span>
                </button>

                {/* The Animated Underline */}
                <div className="absolute bottom-0 left-0 h-[1px] w-full origin-center scale-x-0 bg-gray-800 transition-transform duration-300 peer-focus:scale-x-100"></div>
              </div>

              {/* Confirm Password Input */}
              <div className="relative w-full">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="peer w-full border-b border-gray-300 bg-transparent py-2 pr-20 text-gray-800 focus:outline-none placeholder-transparent"
                  placeholder="Confirm Password"
                  autoComplete="new-password"
                />
                {/* The Label */}
                <label
                  htmlFor="confirmPassword"
                  className="absolute left-0 -top-3.5 text-xs text-gray-400 transition-all 
                             peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-2 
                             peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-gray-400"
                >
                  Confirm Password
                </label>

                {/* Password Toggle */}
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-0 top-2 text-gray-400 hover:text-gray-600 flex items-center gap-1 text-sm"
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />} 
                  <span className="text-xs">{showConfirmPassword ? 'Hide' : 'Show'}</span>
                </button>

                {/* The Animated Underline */}
                <div className="absolute bottom-0 left-0 h-[1px] w-full origin-center scale-x-0 bg-gray-800 transition-transform duration-300 peer-focus:scale-x-100"></div>
              </div>

              {/* Password Requirements */}
              <div className="text-xs text-gray-500">
                Password must be at least 8 characters long
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-[#C4C4C4] hover:bg-gray-700 active:bg-gray-800 text-gray-800 hover:text-white active:text-white text-lg font-medium rounded-full transition-all duration-200 mt-8"
              >
                Reset Password
              </button>
            </form>
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
                <h1 className="text-2xl font-normal text-gray-800 mb-3">Password Changed Successfully!</h1>
                <p className="text-sm text-gray-600 mb-6">
                  Your password has been reset successfully. You can now log in with your new password.
                </p>
              </div>

              <Link
                href="/login"
                className="block w-full py-3 px-4 bg-[#C4C4C4] hover:bg-gray-700 active:bg-gray-800 text-gray-800 hover:text-white active:text-white text-lg font-medium rounded-full transition-all duration-200 text-center"
              >
                Go to Log In
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
