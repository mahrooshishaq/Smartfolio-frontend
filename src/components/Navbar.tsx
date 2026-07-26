"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiMenu, FiX } from "react-icons/fi";
import BrandMark from "@/components/BrandMark";

const sectionLinks = [
  { href: "#journey", label: "Features" },
  { href: "#about", label: "About" },
  { href: "#contact", label: "Contact Us" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const updateScrolledState = () => setScrolled(window.scrollY > 24);

    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", updateScrolledState, { passive: true });
    updateScrolledState();

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", updateScrolledState);
    };
  }, []);

  const scrollToSection = (href: string) => {
    const target = document.querySelector(href);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", href);
    setOpen(false);
  };

  return (
    <nav
      aria-label="Main navigation"
      className={`fixed inset-x-0 top-0 z-50 border-b font-raleway transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${
        scrolled || open
          ? "border-[#ebe5f0]/55 bg-[#f7f3fa]/60 shadow-[0_8px_32px_rgba(75,67,98,0.045)] backdrop-blur-xl"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="flex h-[74px] items-center justify-between px-6 md:px-10">
        <a
          href="#top"
          onClick={(event) => {
            event.preventDefault();
            scrollToSection("#top");
          }}
          className="flex items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a82ac]"
          aria-label="Smartfolio-AI home"
        >
          <BrandMark className="h-8 w-8" />
          <span className="font-century text-xl font-bold text-[#2b2440]">Smartfolio-AI</span>
        </a>

        <div className="hidden items-center gap-9 text-sm font-medium text-[#465064] lg:flex">
          {sectionLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(event) => {
                event.preventDefault();
                scrollToSection(link.href);
              }}
              className="rounded-sm py-2 transition-colors hover:text-[#8d6d82] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9d9e8]"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-5 text-sm font-semibold lg:flex">
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-[#5d5a6d] transition-colors hover:text-[#826276] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9d9e8]"
          >
            LOGIN
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-[#9b6f82] px-6 py-2.5 text-white shadow-[0_8px_24px_rgba(155,111,130,0.18)] transition-colors hover:bg-[#8d6275] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#eadde3]"
          >
            SIGN UP
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen((current) => !current)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[#6b6580] hover:bg-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9d9e8] lg:hidden"
        >
          {open ? <FiX size={22} /> : <FiMenu size={22} />}
        </button>
      </div>

      {open && (
        <div
          id="mobile-navigation"
          className="border-y border-white/60 bg-white/90 px-6 pb-6 pt-3 shadow-lg shadow-purple-100/50 backdrop-blur-lg lg:hidden"
        >
          <div className="mx-auto max-w-7xl">
            {sectionLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(event) => {
                  event.preventDefault();
                  scrollToSection(link.href);
                }}
                className="block rounded-lg px-3 py-3 text-sm font-semibold text-[#6b6580] hover:bg-[#f5f1f7] hover:text-[#8d6d82] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9d9e8]"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-purple-100 pt-5 text-center text-sm font-semibold">
              <Link
                href="/login"
                className="rounded-lg px-4 py-3 text-[#5d5a6d] hover:bg-[#f5f1f7] hover:text-[#826276] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9d9e8]"
              >
                LOGIN
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-[#9b6f82] px-4 py-3 text-white shadow-[0_8px_24px_rgba(155,111,130,0.16)] hover:bg-[#8d6275] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#eadde3]"
              >
                SIGN UP
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
