"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AnimatedBackground from "@/components/AnimatedBackground";
import BrandMark from "@/components/BrandMark";
import Foli, { FoliState } from "@/components/foli/Foli";

export default function AuthShell({
  foli,
  children,
  backHref = "/",
}: {
  foli: FoliState;
  children: React.ReactNode;
  backHref?: string;
}) {
  const modelRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    modelRef.current?.style.setProperty("--auth-tilt-x", `${(-y * 7).toFixed(2)}deg`);
    modelRef.current?.style.setProperty("--auth-tilt-y", `${(x * 9).toFixed(2)}deg`);
  };

  const resetPointerTilt = () => {
    modelRef.current?.style.setProperty("--auth-tilt-x", "0deg");
    modelRef.current?.style.setProperty("--auth-tilt-y", "0deg");
  };

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#f8f6fb] font-raleway text-[#2b2440]">
      <AnimatedBackground />
      <div className="hero-grain pointer-events-none absolute inset-0 z-[1] opacity-[0.12]" />

      <Link
        href="/"
        className="absolute left-6 top-[21px] z-20 hidden items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cfc3d5] md:left-10 lg:flex"
        aria-label="Return to Smartfolio-AI home"
      >
        <BrandMark className="h-8 w-8" />
        <span className="font-century text-xl font-bold text-[#2b2440]">Smartfolio-AI</span>
      </Link>

      <div className="relative z-10 mx-auto min-h-[100svh] w-full max-w-[1260px] lg:grid lg:grid-cols-[minmax(460px,0.96fr)_minmax(0,1.04fr)] lg:gap-3 lg:px-6">
        <section className="relative flex min-h-[100svh] items-center px-5 py-8 sm:px-10 lg:px-8 lg:py-20">
          <div className="mx-auto w-full max-w-[470px]">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <Link
                href="/"
                className="flex items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cfc3d5]"
                aria-label="Return to Smartfolio-AI home"
              >
                <BrandMark className="h-8 w-8" />
                <span className="font-century text-lg font-bold text-[#2b2440]">Smartfolio-AI</span>
              </Link>
              <Link
                href={backHref}
                aria-label="Back to home"
                className="grid h-10 w-10 place-items-center rounded-lg text-[#6b6580] transition-colors hover:bg-white/70 hover:text-[#776a96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8e1f1]"
              >
                <ArrowLeft size={19} />
              </Link>
            </div>

            <div className="mb-5 flex justify-center lg:hidden">
              <Foli state={foli} className="h-[112px] w-[112px]" />
            </div>

            <div className="auth-form-card rounded-[32px] border border-white/85 bg-white/72 p-6 backdrop-blur-xl sm:p-8">
              {children}
            </div>
          </div>
        </section>

        <section
          aria-label="Smartfolio-AI companion"
          className="relative hidden min-h-[100svh] items-center justify-center overflow-hidden lg:flex"
          onPointerMove={handlePointerMove}
          onPointerLeave={resetPointerTilt}
        >
          <div className="auth-stage-arc auth-stage-arc-one" aria-hidden="true" />
          <div className="auth-stage-arc auth-stage-arc-two" aria-hidden="true" />
          <div className="auth-foli-stage flex flex-col items-center">
            <div ref={modelRef} className="auth-foli-model">
              <Foli state={foli} className="auth-foli-character" />
            </div>
            <div className="auth-foli-shadow" />
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-[#7f7890]">
              Your career companion
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
