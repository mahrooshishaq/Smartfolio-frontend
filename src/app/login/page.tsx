// src/app/login/page.tsx
'use client';
import axios from "axios";    //Backend  package
import { useState } from 'react';
import { FaGoogle, FaEye, FaEyeSlash } from 'react-icons/fa';

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null); //Backend error message
  const [successMessage, setSuccessMessage] = useState<string | null>(null); //Backend success message

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  //Backend integration starts here
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  setError(null); // clear previous errors
    setSuccessMessage(null); // clear previous success messages

    try {
      console.log('Submitting login:', formData);
      const res = await axios.post('http://localhost:3000/auth/login', formData);

      console.log('Backend success message:', res.data.message);
      setSuccessMessage(res.data.message);
      const { user, accessToken, refreshToken } = res.data;
      console.log('User:', user);
      console.log('Access Token:', accessToken);
      console.log('Refresh Token:', refreshToken);
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);


      // You can also redirect on success, e.g.:
      // window.location.href = "/dashboard";
    } catch (err: any) {
      const backendMessage = err.response?.data?.message;

      if (Array.isArray(backendMessage)) {
        console.log('Backend validation errors:', backendMessage);
        setError(backendMessage.join(', ')); // join array for UI
      } else {
        console.log('Backend error:', backendMessage);
        setError(backendMessage || 'Login failed');
      }
    }
    console.log('Login data:', formData);
  };
  //Backend integration ends here

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gray-300 rounded-full mr-3"></div>
            <h1 className="text-xl font-semibold">Log In</h1>
          </div>
          <button className="text-gray-500 hover:text-gray-700">
            ×
          </button>
        </div>
        
        <p className="text-sm text-gray-600 mb-6">
          Don't have an account? <a href="/signup" className="text-blue-600 hover:underline">Sign up</a>
        </p>

        <div className="mb-6">
          <button
            type="button"
            className="w-full py-2 px-4 border border-gray-300 rounded-full flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors duration-200"
            onClick={() => { window.location.href = 'http://localhost:3000/auth/google';}} // Backend redirection to google auth
          >
            <FaGoogle className="text-red-500" />
            Log in with Google
          </button>
        </div>

        <div className="my-6 flex items-center">
          <div className="flex-1 border-t border-gray-300"></div>
          <span className="px-3 text-sm text-gray-500">OR</span>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none transition-colors duration-200 hover:border-gray-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none transition-colors duration-200 hover:border-gray-400 pr-10"
                required
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            <div className="mt-1 text-right">
              <a href="#" className="text-xs text-gray-600 hover:text-gray-800">Forget your password</a>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 bg-gray-400 text-white rounded-full font-medium hover:bg-gray-500 transition-colors duration-200 mt-6"
          >
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}