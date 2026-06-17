// src/app/signup/page.tsx
'use client';
import axios from "axios";
import { useState } from 'react';
import { FaGoogle, FaEye, FaEyeSlash } from 'react-icons/fa'; // Added Eye icons for password visibility
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  // State for toggling password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    try {
      console.log('Submitting:', formData);
      const res = await axios.post(`${API}/auth/signup`, {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        password: formData.password,
      });

      console.log('Backend success message:', res.data.message);
      setSuccessMessage(res.data.message);
      
      // Redirect to OTP verification page
      setTimeout(() => {
         router.push(`/verify-otp?email=${formData.email}`);
      }, 1500);
    } catch (err: any) {
      const backendMessage = err.response?.data?.message;

      if (Array.isArray(backendMessage)) {
        console.log('Backend validation errors:', backendMessage);
        setError(backendMessage.join(', '));
      } else {
        console.log('Backend error:', backendMessage);
        setError(backendMessage || "Signup failed");
      }
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden font-raleway">
      <AnimatedBackground />
      
      {/* Main Card Container */}
      <div className="bg-white rounded-2rem shadow-2xl p-6 md:p-8 w-full max-w-[480px] z-10 relative">
        
        {/* Header: Back Arrow and Close Button */}
        <div className="flex justify-between items-center mb-6 text-gray-400">
           <Link href="/" className="hover:text-gray-600 transition-colors">
             <ArrowLeft size={24} />
           </Link>
        </div>

        {/* Title and Subtitle */}
        <div className="mb-6">
            <h1 className="text-2xl font-normal text-gray-800 mb-2">Create Account</h1>
            <p className="text-sm text-gray-500">
             Already have an account? <a href="/login" className="text-gray-800 underline hover:text-black">Log in</a>
            </p>
        </div>

        {/* Google Signup Button (Moved to top to match Login style) */}
        <div className="mb-6">
          <button
            type="button"
            className="w-full py-2.5 px-4 border border-gray-300 rounded-full flex items-center justify-center gap-3 text-gray-600 hover:bg-gray-200 hover:border-gray-400 active:bg-gray-800 active:text-white active:border-gray-800 transition-all duration-200"
            onClick={() => { window.location.href = `${API}/auth/google`; }}
          >
            <FaGoogle className="text-xl" />
            <span className="text-lg font-medium">Sign up with Google</span>
          </button>
        </div>

        {/* OR Divider */}
        <div className="my-6 flex items-center gap-4">
          <div className="flex-1 border-t border-gray-300"></div>
          <span className="text-gray-400 text-sm">OR</span>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>

        {/* Error/Success Messages */}
        {error && <div className="mb-6 p-3 bg-red-50 text-red-500 text-sm rounded-lg text-center">{error}</div>}
        {successMessage && <div className="mb-6 p-3 bg-green-50 text-green-500 text-sm rounded-lg text-center">{successMessage}</div>}

        <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
          <input type="email" name="email" autoComplete="email" style={{ display: 'none' }} />
          <input type="password" name="password" autoComplete="new-password" style={{ display: 'none' }} />
          
          {/* Row: First Name & Last Name */}
          <div className="flex gap-4">
            {/* First Name */}
            <div className="relative w-full">
                <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    className="peer w-full border-b border-gray-300 bg-transparent py-2 text-gray-800 focus:outline-none placeholder-transparent"
                    placeholder="First Name"
                />
                <label htmlFor="firstName" className="absolute left-0 -top-3.5 text-xs text-gray-400 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-gray-400">
                    First Name
                </label>
                <div className="absolute bottom-0 left-0 h-1px w-full origin-center scale-x-0 bg-gray-800 transition-transform duration-300 peer-focus:scale-x-100"></div>
            </div>

            {/* Last Name */}
            <div className="relative w-full">
                <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    className="peer w-full border-b border-gray-300 bg-transparent py-2 text-gray-800 focus:outline-none placeholder-transparent"
                    placeholder="Last Name"
                />
                <label htmlFor="lastName" className="absolute left-0 -top-3.5 text-xs text-gray-400 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-gray-400">
                    Last Name
                </label>
                <div className="absolute bottom-0 left-0 h-1px w-full origin-center scale-x-0 bg-gray-800 transition-transform duration-300 peer-focus:scale-x-100"></div>
            </div>
          </div>

          {/* Email */}
          <div className="relative w-full">
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="peer w-full border-b border-gray-300 bg-transparent py-2 text-gray-800 focus:outline-none placeholder-transparent"
              placeholder="Email Address"
              autoComplete="email"
            />
            <label htmlFor="email" className="absolute left-0 -top-3.5 text-xs text-gray-400 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-gray-400">
              Email Address
            </label>
            <div className="absolute bottom-0 left-0 h-1px w-full origin-center scale-x-0 bg-gray-800 transition-transform duration-300 peer-focus:scale-x-100"></div>
          </div>

          {/* Password */}
          <div className="relative w-full">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="peer w-full border-b border-gray-300 bg-transparent py-2 pr-10 text-gray-800 focus:outline-none placeholder-transparent"
              placeholder="Password"
              autoComplete="new-password"
            />
            <label htmlFor="password" className="absolute left-0 -top-3.5 text-xs text-gray-400 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-gray-400">
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
            <div className="absolute bottom-0 left-0 h-1px w-full origin-center scale-x-0 bg-gray-800 transition-transform duration-300 peer-focus:scale-x-100"></div>
          </div>

          {/* Confirm Password */}
          <div className="relative w-full">
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="peer w-full border-b border-gray-300 bg-transparent py-2 pr-10 text-gray-800 focus:outline-none placeholder-transparent"
              placeholder="Confirm Password"
            />
            <label htmlFor="confirmPassword" className="absolute left-0 -top-3.5 text-xs text-gray-400 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-2 peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-gray-400">
              Confirm Password
            </label>
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-0 top-2 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
            <div className="absolute bottom-0 left-0 h-1px w-full origin-center scale-x-0 bg-gray-800 transition-transform duration-300 peer-focus:scale-x-100"></div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-[#C4C4C4] hover:bg-gray-700 active:bg-gray-800 text-gray-800 hover:text-white active:text-white text-lg font-medium rounded-full transition-all duration-200 mt-6"
          >
            Create Account
          </button>
        </form>
      </div>
    </div>
  );
}