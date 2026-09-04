"use client";

import axios from "axios";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaEye, FaEyeSlash, FaGoogle } from "react-icons/fa";
import AuthShell from "@/components/auth/AuthShell";
import type { FoliState } from "@/components/foli/Foli";
import AuthTransition from "@/components/foli/AuthTransition";
import { API } from '@/lib/api';


const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

const STRENGTH_LABELS = ["", "Add a little more", "Getting there", "Strong", "Excellent"];
const STRENGTH_COLORS = ["#e5e0ea", "#b98da0", "#a99878", "#8f96b8", "#789a8e"];

const inputClass =
  "auth-input w-full rounded-lg border border-[#ddd8e4] bg-white px-3.5 py-2.5 text-[15px] text-[#343044] outline-none transition-colors placeholder:text-[#aaa4b5] focus:border-[#9a8db7] focus:ring-4 focus:ring-[#ece7f2]";

function scorePassword(value: string): number {
  let score = 0;
  if (value.length >= 6) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value) && value.length >= 10) score += 1;
  return score;
}

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foli, setFoli] = useState<FoliState>("idle");
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strength = scorePassword(formData.password);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match. Please re-enter them.");
      setFoli("error");
      window.setTimeout(() => setFoli("idle"), 900);
      return;
    }

    setIsSubmitting(true);
    setFoli("typing");

    try {
      await axios.post(`${API}/auth/signup`, {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        password: formData.password,
      });
      setFoli("success");
      setDone(true);
    } catch (requestError: unknown) {
      const backendMessage = axios.isAxiosError(requestError)
        ? requestError.response?.data?.message
        : undefined;
      setError(
        Array.isArray(backendMessage)
          ? backendMessage.join(", ")
          : backendMessage || "Signup failed",
      );
      setFoli("error");
      window.setTimeout(() => setFoli("idle"), 900);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell foli={foli}>
      <AuthTransition
        show={done}
        title="Account created."
        subtitle="Sending your verification code..."
        onDone={() => router.push(`/verify-otp?email=${encodeURIComponent(formData.email)}`)}
      />

      <header className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a7392]">
          Start your journey
        </p>
        <h1 className="mt-2 font-century text-4xl font-bold tracking-[0.04em] text-[#2b2440]">
          Sign Up
        </h1>
        <p className="mt-1.5 text-sm text-[#6b6580]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-bold text-[#776a96] transition-colors hover:text-[#685a88]"
          >
            Log in
          </Link>
        </p>
      </header>

      <button
        type="button"
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#d9d5df] bg-white/65 px-4 py-2.5 text-sm font-semibold text-[#514c60] transition-colors hover:border-[#c9c1cd] hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#eee8f1]"
        onClick={() => {
          window.location.href = `${BACKEND_URL}/auth/google`;
        }}
      >
        <FaGoogle className="text-base" />
        Continue with Google
      </button>

      <div className="my-4 flex items-center gap-4">
        <div className="h-px flex-1 bg-[#e4dfe8]" />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9891a2]">
          Or use email
        </span>
        <div className="h-px flex-1 bg-[#e4dfe8]" />
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-[#ead7df] bg-[#f8edf1] px-4 py-3 text-sm font-medium text-[#8d5f70]"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <AuthInput
            label="First name"
            id="firstName"
            value={formData.firstName}
            placeholder="Ada"
            onChange={handleChange}
            onFocus={() => setFoli("typing")}
            onBlur={() => setFoli("idle")}
          />
          <AuthInput
            label="Last name"
            id="lastName"
            value={formData.lastName}
            placeholder="Lovelace"
            onChange={handleChange}
            onFocus={() => setFoli("typing")}
            onBlur={() => setFoli("idle")}
          />
        </div>

        <AuthInput
          label="Email"
          id="email"
          type="email"
          value={formData.email}
          placeholder="you@example.com"
          autoComplete="email"
          onChange={handleChange}
          onFocus={() => setFoli("typing")}
          onBlur={() => setFoli("idle")}
        />

        <PasswordField
          label="Password"
          id="password"
          value={formData.password}
          visible={showPassword}
          onToggle={() => setShowPassword((current) => !current)}
          onChange={handleChange}
          onFocus={() => setFoli("peek")}
          onBlur={() => setFoli("idle")}
        />

        {formData.password && (
          <div>
            <div className="flex gap-1.5" aria-hidden="true">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className="h-1 flex-1 rounded-full transition-colors"
                  style={{
                    backgroundColor:
                      index < strength ? STRENGTH_COLORS[strength] : STRENGTH_COLORS[0],
                  }}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-[#817a8b]">
              {STRENGTH_LABELS[strength]}
            </p>
          </div>
        )}

        <PasswordField
          label="Confirm password"
          id="confirmPassword"
          value={formData.confirmPassword}
          visible={showConfirmPassword}
          onToggle={() => setShowConfirmPassword((current) => !current)}
          onChange={handleChange}
          onFocus={() => setFoli("peek")}
          onBlur={() => setFoli("idle")}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="spectrum-primary auth-spectrum w-full rounded-lg px-5 py-3 text-sm font-bold"
        >
          {isSubmitting ? "Creating your account..." : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}

function AuthInput({
  label,
  id,
  type = "text",
  value,
  placeholder,
  autoComplete,
  onChange,
  onFocus,
  onBlur,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  placeholder: string;
  autoComplete?: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onFocus: React.FocusEventHandler<HTMLInputElement>;
  onBlur: React.FocusEventHandler<HTMLInputElement>;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-bold text-[#615b6d]">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        className={inputClass}
      />
    </div>
  );
}

function PasswordField({
  label,
  id,
  value,
  visible,
  onToggle,
  onChange,
  onFocus,
  onBlur,
}: {
  label: string;
  id: string;
  value: string;
  visible: boolean;
  onToggle: () => void;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onFocus: React.FocusEventHandler<HTMLInputElement>;
  onBlur: React.FocusEventHandler<HTMLInputElement>;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-bold text-[#615b6d]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          required
          placeholder="Enter a secure password"
          autoComplete="new-password"
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          className={`${inputClass} pr-11`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-[#817a8b] transition-colors hover:bg-[#f0ebf4] hover:text-[#776a96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8e1f1]"
        >
          {visible ? <FaEyeSlash /> : <FaEye />}
        </button>
      </div>
    </div>
  );
}
