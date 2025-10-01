// src/app/signup/page.tsx
'use client';

import { useState } from 'react';
import { FaGoogle } from 'react-icons/fa';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle signup logic here
    console.log('Signup data:', formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="flex items-center mb-6">
          <div className="w-8 h-8 bg-gray-300 rounded-full mr-3"></div>
          <h1 className="text-xl font-semibold">Create an account</h1>
        </div>
        
        <p className="text-sm text-gray-600 mb-6">
          Already have an account? <a href="/login" className="text-blue-600 hover:underline">Log in</a>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none transition-colors duration-200 hover:border-gray-400"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none transition-colors duration-200 hover:border-gray-400"
                required
              />
            </div>
          </div>

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

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none transition-colors duration-200 hover:border-gray-400"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-3 py-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none transition-colors duration-200 hover:border-gray-400"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 bg-gray-400 text-white rounded-full font-medium hover:bg-gray-500 transition-colors duration-200 mt-6"
          >
            Create an account
          </button>

          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="px-3 text-sm text-gray-500">OR</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          <button
            type="button"
            className="w-full py-2 px-4 border border-gray-300 rounded-full flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors duration-200"
          >
            <FaGoogle className="text-red-500" />
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}