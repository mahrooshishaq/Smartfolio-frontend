"use client";
import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
      {/* Logo */}
      <div className="flex items-center gap-2">
        {/* Simple dots representation */}
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-400"></div>
          <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
        </div>
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
      <div className="flex gap-4 font-raleway text-sm font-semibold">
        <AuthButton text="LOGIN" href="/login" />
        <AuthButton text="SIGN UP" href="/signup" />
      </div>
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
