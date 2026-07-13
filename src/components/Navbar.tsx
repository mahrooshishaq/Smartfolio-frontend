"use client";
import { useState } from "react";
import Link from "next/link";
import { FiMenu, FiX } from "react-icons/fi";
import BrandMark from "@/components/BrandMark";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/10 backdrop-blur-md border-b border-white/20">
      <div className="flex items-center justify-between px-4 md:px-8 py-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <BrandMark className="w-7 h-7" />
          <span className="font-baloo text-xl tracking-wide text-gray-800">
            SmartFolio - AI
          </span>
        </div>

        {/* Middle Links */}
        <div className="hidden md:flex gap-8 font-raleway text-sm font-medium tracking-wide text-gray-700">
          <Link href="#features" className="hover:text-black transition-colors">Features</Link>
          <Link href="#about" className="hover:text-black transition-colors">About</Link>
          <Link href="#contact" className="hover:text-black transition-colors">Contact Us</Link>
        </div>

        {/* Auth Buttons */}
        <div className="hidden md:flex gap-4 font-raleway text-sm font-semibold">
          <AuthButton text="LOGIN" href="/login" />
          <AuthButton text="SIGN UP" href="/signup" />
        </div>

        {/* Mobile menu toggle */}
        <button
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen(!open)}
          className="md:hidden p-2.5 -mr-1 rounded-xl text-gray-700 hover:bg-white/40 min-h-11 min-w-11 flex items-center justify-center"
        >
          {open ? <FiX size={22} /> : <FiMenu size={22} />}
        </button>
      </div>

      {/* Mobile menu panel */}
      {open && (
        <div className="md:hidden px-4 pb-5 pt-1 space-y-1 bg-white/80 backdrop-blur-md border-t border-white/30 font-raleway">
          {[
            { href: "#features", label: "Features" },
            { href: "#about", label: "About" },
            { href: "#contact", label: "Contact Us" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/60"
            >
              {l.label}
            </Link>
          ))}
          <div className="flex gap-3 pt-3 text-sm font-semibold">
            <Link href="/login" className="flex-1">
              <button className="w-full px-6 py-2.5 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-200">LOGIN</button>
            </Link>
            <Link href="/signup" className="flex-1">
              <button className="w-full px-6 py-2.5 rounded-full bg-gray-800 text-white border border-gray-800 hover:bg-gray-700">SIGN UP</button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

// Custom Button Component for the specific states
function AuthButton({ text, href }: { text: string; href: string }) {
  return (
    <Link href={href}>
      <button className="px-6 py-2 rounded-full border border-gray-300 text-gray-600 transition-all duration-200
        hover:bg-gray-200 hover:border-gray-400
        active:bg-gray-800 active:text-white active:border-gray-800">
        {text}
      </button>
    </Link>
  );
}
