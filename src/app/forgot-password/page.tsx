"use client";

import { useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import type { FoliState } from "@/components/foli/Foli";
import { API } from '@/lib/api';



const inputClass =
  "auth-input w-full rounded-lg border border-[#ddd8e4] bg-white px-3.5 py-3 text-[15px] text-[#343044] outline-none transition-colors placeholder:text-[#aaa4b5] focus:border-[#9a8db7] focus:ring-4 focus:ring-[#ece7f2]";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foli, setFoli] = useState<FoliState>("sad");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    setFoli("typing");

    try {
      const response = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data: { message?: string } = await response.json();
        setError(data.message || "Something went wrong.");
        setFoli("error");
        window.setTimeout(() => setFoli("sad"), 900);
        return;
      }

      setFoli("happy");
      setIsSubmitted(true);
    } catch {
      setError("Could not send the reset email. Please try again.");
      setFoli("error");
      window.setTimeout(() => setFoli("sad"), 900);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell foli={isSubmitted ? "happy" : foli} backHref="/login">
      {!isSubmitted ? (
        <>
          <header className="mb-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7392]">
              Account recovery
            </p>
            <h1 className="mt-3 font-century text-4xl font-bold tracking-[0.04em] text-[#2b2440]">
              Forgot password?
            </h1>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[#6b6580]">
              Enter your email and we will send you a secure link to reset your password.
            </p>
          </header>

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
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
                onFocus={() => setFoli("typing")}
                onBlur={() => setFoli("sad")}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="spectrum-primary auth-spectrum w-full rounded-lg px-5 py-3.5 text-sm font-bold"
            >
              {isSubmitting ? "Sending reset link..." : "Send reset link"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm font-semibold text-[#776a96] transition-colors hover:text-[#685a88]"
            >
              Back to Login
            </Link>
          </div>
        </>
      ) : (
        <div className="py-2 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7392]">
            Email sent
          </p>
          <h1 className="mt-3 font-century text-4xl font-bold tracking-[0.04em] text-[#2b2440]">
            Check your email
          </h1>
          <p className="mt-4 text-sm leading-6 text-[#6b6580]">We sent a reset link to</p>
          <p className="mt-1 break-all text-sm font-bold text-[#3f3a50]">{email}</p>
          <p className="mt-4 text-sm leading-6 text-[#7c758b]">
            It may take a moment to arrive. Please check your spam folder as well.
          </p>

          <Link
            href="/login"
            className="spectrum-primary auth-spectrum mt-7 block w-full rounded-lg px-5 py-3.5 text-sm font-bold"
          >
            Back to Login
          </Link>
          <button
            type="button"
            onClick={() => {
              setIsSubmitted(false);
              setFoli("sad");
            }}
            className="mt-4 text-sm font-semibold text-[#776a96] transition-colors hover:text-[#685a88] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8e1f1]"
          >
            Try a different email
          </button>
        </div>
      )}
    </AuthShell>
  );
}
