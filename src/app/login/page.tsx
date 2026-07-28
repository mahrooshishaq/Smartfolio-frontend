"use client";

import axios from "axios";
import { useState } from "react";
import Link from "next/link";
import { FaEye, FaEyeSlash, FaGoogle } from "react-icons/fa";
import AuthShell from "@/components/auth/AuthShell";
import type { FoliState } from "@/components/foli/Foli";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

const inputClass =
  "auth-input w-full rounded-lg border border-[#ddd8e4] bg-white px-3.5 py-3 text-[15px] text-[#343044] outline-none transition-colors placeholder:text-[#aaa4b5] focus:border-[#9a8db7] focus:ring-4 focus:ring-[#ece7f2]";

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foli, setFoli] = useState<FoliState>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const togglePasswordVisibility = () => {
    const next = !showPassword;
    setShowPassword(next);
    if (document.activeElement === document.getElementById("password")) {
      setFoli(next ? "typing" : "peek");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    setFoli("typing");

    try {
      const response = await axios.post(`${API}/auth/login`, formData);
      const { accessToken, refreshToken } = response.data;
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);

      let target = "/dashboard";
      try {
        const statusResponse = await axios.get(`${API}/onboarding/status`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        target = statusResponse.data?.completed ? "/dashboard" : "/onboarding";
      } catch {
        target = "/dashboard";
      }

      window.location.href = target;
    } catch (requestError: unknown) {
      const backendMessage = axios.isAxiosError(requestError)
        ? requestError.response?.data?.message
        : undefined;
      setError(
        Array.isArray(backendMessage)
          ? backendMessage.join(", ")
          : backendMessage || "Login failed",
      );
      setFoli("error");
      window.setTimeout(() => setFoli("idle"), 900);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell foli={foli}>
      <header className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7392]">
          Welcome back
        </p>
        <h1 className="mt-3 font-century text-4xl font-bold tracking-[0.04em] text-[#2b2440]">
          Login
        </h1>
        <p className="mt-2 text-sm text-[#6b6580]">
          New to Smartfolio-AI?{" "}
          <Link
            href="/signup"
            className="font-bold text-[#776a96] transition-colors hover:text-[#685a88]"
          >
            Create an account
          </Link>
        </p>
      </header>

      <button
        type="button"
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#d9d5df] bg-white/65 px-4 py-3 text-sm font-semibold text-[#514c60] transition-colors hover:border-[#c9c1cd] hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#eee8f1]"
        onClick={() => {
          window.location.href = `${BACKEND_URL}/auth/google`;
        }}
      >
        <FaGoogle className="text-base" />
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-[#e4dfe8]" />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9891a2]">
          Or use email
        </span>
        <div className="h-px flex-1 bg-[#e4dfe8]" />
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-[#ead7df] bg-[#f8edf1] px-4 py-3 text-sm font-medium text-[#8d5f70]"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="mb-2 block text-xs font-bold text-[#615b6d]">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="you@example.com"
            autoComplete="email"
            onFocus={() => setFoli("typing")}
            onBlur={() => setFoli("idle")}
            className={inputClass}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-4">
            <label htmlFor="password" className="text-xs font-bold text-[#615b6d]">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-[#7c758b] transition-colors hover:text-[#776a96]"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Enter your password"
              autoComplete="current-password"
              onFocus={() => setFoli("peek")}
              onBlur={() => setFoli("idle")}
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-[#817a8b] transition-colors hover:bg-[#f0ebf4] hover:text-[#776a96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8e1f1]"
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="spectrum-primary auth-spectrum w-full rounded-lg px-5 py-3.5 text-sm font-bold"
        >
          {isSubmitting ? "Signing in..." : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}
