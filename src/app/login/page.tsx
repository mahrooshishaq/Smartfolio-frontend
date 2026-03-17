// src/app/login/page.tsx
'use client';
import axios from "axios";
import { useState } from 'react';
import { FaGoogle, FaEye, FaEyeSlash } from 'react-icons/fa';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import AnimatedBackground from '@/components/AnimatedBackground';

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    try {
      console.log('Submitting login:', formData);
      const res = await axios.post('http://localhost:3000/auth/login', formData);

      console.log('Backend success message:', res.data.message);
      setSuccessMessage(res.data.message);
      const { user, accessToken, refreshToken } = res.data;
      
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      // Redirect to dashboard
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1000);
    } catch (err: any) {
      const backendMessage = err.response?.data?.message;
      if (Array.isArray(backendMessage)) {
        setError(backendMessage.join(', '));
      } else {
        setError(backendMessage || 'Login failed');
      }
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden font-raleway">
      <AnimatedBackground />
      
      {/* Main Card Container - Matches the rounded, clean look of your image */}
      <div className="bg-white rounded-2rem shadow-2xl p-6 md:p-8 w-full max-w-[480px] z-10 relative">
        
        {/* Header: Back Arrow and Close Button */}
        <div className="flex justify-between items-center mb-6 text-gray-400">
           <Link href="/" className="hover:text-gray-600 transition-colors">
             <ArrowLeft size={24} />
           </Link>
        </div>

        {/* Title and Subtitle */}
        <div className="mb-6">
            <h1 className="text-2xl font-normal text-gray-800 mb-2">Log In</h1>
            <p className="text-sm text-gray-500">
            Don't have an account? <a href="/signup" className="text-gray-800 underline hover:text-black">Sign up</a>
            </p>
        </div>

        {/* Google Login Button */}
        <div className="mb-6">
          <button
            type="button"
            className="w-full py-2.5 px-4 border border-gray-300 rounded-full flex items-center justify-center gap-3 text-gray-600 hover:bg-gray-200 hover:border-gray-400 active:bg-gray-800 active:text-white active:border-gray-800 transition-all duration-200"
            onClick={() => { window.location.href = 'http://localhost:3000/auth/google';}}
          >
            <FaGoogle className="text-xl" /> {/* Google colors usually handled by icon, or keep generic */}
            <span className="text-lg font-medium">Log in with Google</span>
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

        <form onSubmit={handleSubmit} className="space-y-6">
          <input type="email" name="email" autoComplete="email" style={{ display: 'none' }} />
          <input type="password" name="password" autoComplete="new-password" style={{ display: 'none' }} />
          
          {/* --- ANIMATED EMAIL INPUT --- */}
          {/* The 'group' wrapper helps organize, but the magic is in 'peer' */}
          <div className="relative w-full">
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="peer w-full border-b border-gray-300 bg-transparent py-2 text-gray-800 focus:outline-none placeholder-transparent"
              placeholder="Email Address" /* Required for the peer-placeholder-shown trick */
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
            <div className="absolute bottom-0 left-0 h-1px w-full origin-center scale-x-0 bg-gray-800 transition-transform duration-300 peer-focus:scale-x-100"></div>
          </div>

          {/* --- ANIMATED PASSWORD INPUT --- */}
          <div className="relative w-full">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="peer w-full border-b border-gray-300 bg-transparent py-2 pr-20 text-gray-800 focus:outline-none placeholder-transparent"
              placeholder="Password"
              autoComplete="new-password"
            />
            {/* The Label */}
            <label
              htmlFor="password"
              className="absolute left-0 -top-3.5 text-xs text-gray-400 transition-all 
                         peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-2 
                         peer-focus:-top-3.5 peer-focus:text-xs peer-focus:text-gray-400"
            >
              Password
            </label>

            {/* Password Toggle (Text + Icon style to match design) */}
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="absolute right-0 top-2 text-gray-400 hover:text-gray-600 flex items-center gap-1 text-sm"
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />} 
              <span className="text-xs">{showPassword ? 'Hide' : 'Show'}</span>
            </button>

            {/* The Animated Underline */}
            <div className="absolute bottom-0 left-0 h-1px w-full origin-center scale-x-0 bg-gray-800 transition-transform duration-300 peer-focus:scale-x-100"></div>
          </div>
            
          <div className="flex justify-end mt-1">
             <Link href="/forgot-password" className="text-sm text-gray-500 hover:text-gray-800 underline decoration-gray-400 underline-offset-2">
                Forgot your password?
             </Link>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-[#C4C4C4] hover:bg-gray-700 active:bg-gray-800 text-gray-800 hover:text-white active:text-white text-lg font-medium rounded-full transition-all duration-200 mt-6"
          >
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}