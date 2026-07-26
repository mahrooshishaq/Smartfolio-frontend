"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  ChevronDown,
  FileText,
  Mail,
  Mic2,
  Search,
  Sparkles,
} from "lucide-react";
import AnimatedBackground from "@/components/AnimatedBackground";
import Navbar from "@/components/Navbar";

const LAUNCH_GATE = `
try{
  var t = localStorage.getItem('accessToken');
  if (t) {
    location.replace('/dashboard');
  } else {
    var mm = function(q){ try { return window.matchMedia(q).matches; } catch(e){ return false; } };
    var standalone = mm('(display-mode: standalone)') || mm('(display-mode: fullscreen)')
      || mm('(display-mode: minimal-ui)') || window.navigator.standalone === true;
    if (standalone) location.replace('/login');
  }
}catch(e){}`;

const primaryAction =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#9b6f82] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#eadde3] transition-colors hover:bg-[#8d6275] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#eadde3]";

const featureAction =
  "mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#8d6d82] transition-colors hover:text-[#74799f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9d9e8]";

const TYPEWRITER_PHRASES = [
  "Optimize your resume",
  "Find work that fits",
  "Prepare with confidence",
];

function Typewriter() {
  const [text, setText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(TYPEWRITER_PHRASES[0]);
      return;
    }

    const phrase = TYPEWRITER_PHRASES[phraseIndex % TYPEWRITER_PHRASES.length];
    const complete = !isDeleting && text === phrase;
    const empty = isDeleting && text === "";
    const delay = complete ? 1400 : isDeleting ? 35 : 120;

    const timer = window.setTimeout(() => {
      if (complete) {
        setIsDeleting(true);
        return;
      }
      if (empty) {
        setIsDeleting(false);
        setPhraseIndex((current) => current + 1);
        return;
      }

      setText(
        isDeleting
          ? phrase.slice(0, Math.max(0, text.length - 1))
          : phrase.slice(0, text.length + 1),
      );
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isDeleting, phraseIndex, text]);

  return (
    <span className="border-r border-[#655d75] pr-1.5">
      {text}
    </span>
  );
}

function HeroAtmosphere() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
      <div className="hero-light-trail absolute left-1/2 top-[48%] h-[260px] w-[900px] -translate-x-1/2 -translate-y-1/2 rotate-[-7deg] rounded-[50%] border-t border-white/70 md:h-[380px] md:w-[1280px]" />
      <div className="hero-light-trail hero-light-trail-delayed absolute left-1/2 top-[53%] h-[300px] w-[1060px] -translate-x-1/2 -translate-y-1/2 rotate-[5deg] rounded-[50%] border-t border-[#d9e4f5]/45 md:h-[440px] md:w-[1480px]" />
      <div className="hero-grain absolute inset-0 opacity-[0.16]" />
    </div>
  );
}

export default function Home() {
  return (
    <main className="relative bg-[#fbfaff] font-raleway text-[#2b2440]">
      <script dangerouslySetInnerHTML={{ __html: LAUNCH_GATE }} />

      <section
        id="top"
        className="relative flex min-h-[100svh] flex-col overflow-hidden bg-white text-center"
      >
        <AnimatedBackground />
        <HeroAtmosphere />
        <Navbar />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-16 pt-24 md:pb-20">
          <p className="mb-5 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[#8a7392] md:text-xs">
            Your AI career workspace
          </p>
          <h1 className="whitespace-nowrap font-century text-[2.15rem] font-bold lowercase tracking-[0.08em] text-[#252c3d] [text-shadow:0_5px_22px_rgba(63,58,82,0.12)] md:text-7xl md:tracking-[0.12em]">
            smartfolio - ai
          </h1>
          <div className="mt-4 h-8 font-raleway text-base font-medium text-[#656278] md:text-lg">
            <Typewriter />
          </div>
        </div>
        <a
          href="#journey"
          aria-label="Explore Smartfolio-AI features"
          className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-[#74798a] transition-colors hover:text-[#8d6d82] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9d9e8]"
        >
          <ChevronDown className="hero-scroll-cue h-7 w-7" />
        </a>
      </section>

      <section id="journey" className="scroll-mt-24 bg-[#fbfaff] px-6 py-20 md:px-20 md:py-28">
        <div className="mx-auto max-w-7xl">
          <header className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-[#8a7392]">
              One connected journey
            </p>
            <h2 className="mt-4 font-century text-4xl font-bold leading-tight text-[#2b2440] md:text-5xl">
              Each step knows where you have been.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#6b6580]">
              Start with your resume. Smartfolio-AI carries that context forward as you create,
              learn, discover, and prepare.
            </p>
          </header>

          <JourneyTimeline>
            <JourneyStep
              number="01"
              label="Understand"
              icon={Search}
              title="See what your resume needs."
              description="Get a clear view of your strengths, gaps, and readiness before your next application."
              action="Analyze my resume"
              tone="from-[#eef1ff] to-[#f7f4ff]"
              dot="bg-[#858db8]"
              visual={<ResumeVisual />}
            />

            <JourneyStep
              number="02"
              label="Create"
              icon={FileText}
              title="Shape documents around your story."
              description="Turn your experience into editable cover letters and application documents for each role."
              action="Create a document"
              tone="from-[#f4efff] to-[#ffeef5]"
              dot="bg-[#9a82ac]"
              visual={<DocumentVisual />}
              reverse
            />

            <JourneyStep
              number="03"
              label="Grow"
              icon={BookOpen}
              title="Focus on the skills that move you forward."
              description="Connect resume insights to relevant learning instead of searching through an endless catalogue."
              action="Explore learning paths"
              tone="from-[#fff5ee] to-[#fff0f5]"
              dot="bg-[#aa809d]"
              visual={<LearningVisual />}
            />

            <JourneyStep
              number="04"
              label="Discover"
              icon={BriefcaseBusiness}
              title="Find opportunities that fit."
              description="Explore roles shaped around your skills, goals, location, and experience."
              action="Explore matching jobs"
              tone="from-[#eef4ff] to-[#f4f0ff]"
              dot="bg-[#8e94b6]"
              visual={<JobsVisual />}
              reverse
            />

            <JourneyStep
              number="05"
              label="Prepare"
              icon={Mic2}
              title="Practice until the conversation feels natural."
              description="Rehearse role-specific questions in a calm, guided voice interview."
              action="Start practicing"
              tone="from-[#ffeef5] to-[#f4efff]"
              dot="bg-[#b57b8e]"
              visual={<InterviewVisual />}
            />
          </JourneyTimeline>
        </div>
      </section>

      <section id="about" className="scroll-mt-24 bg-white px-6 py-20 md:px-20 md:py-28">
        <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#8a7392]">
              <Sparkles size={15} />
              Our vision
            </div>
            <h2 className="mt-5 font-century text-4xl font-bold leading-tight text-[#2b2440] md:text-5xl">
              Career growth should feel guided, personal, and within reach.
            </h2>
          </div>
          <div className="space-y-5">
            <p className="text-base leading-8 text-[#6b6580]">
              Smartfolio-AI exists to make thoughtful career support more accessible. We want
              every person to understand the value of their experience, communicate it clearly,
              and approach new opportunities with confidence.
            </p>
            <p className="text-base leading-8 text-[#6b6580]">
              Our vision is a connected workspace that grows with its users: one that turns
              career preparation from a collection of disconnected tasks into a calm, purposeful
              journey while keeping people in control of every decision.
            </p>
            <p className="border-l-2 border-[#b98da0] pl-5 font-century text-xl font-bold leading-8 text-[#4a4059]">
              Technology should make ambition feel clearer, never more overwhelming.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-[#eef1ff] via-[#f5efff] to-[#ffe6f0] px-6 py-20 text-center md:px-20 md:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest text-[#8a7392]">
            Start where you are
          </p>
          <h2 className="mt-5 font-century text-4xl font-bold leading-tight text-[#2b2440] md:text-5xl">
            Your next step can feel simpler.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[#6b6580] md:text-base">
            Create your profile once and let each part of Smartfolio-AI build naturally on the last.
          </p>
          <Link href="/signup" className={`${primaryAction} mt-8`}>
            Create your account
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <footer id="contact" className="scroll-mt-24 bg-white px-6 py-10 md:px-20">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-century text-xl font-bold text-[#2b2440]">Smartfolio-AI</p>
            <p className="mt-2 text-sm text-[#6b6580]">
              A calmer way to prepare for what comes next.
            </p>
          </div>
          <div className="text-sm md:text-right">
            <p className="mb-2 text-[#9189a3]">Questions, feedback, or partnerships</p>
            <a
              href="mailto:smartfolio0.ai@gmail.com"
              className="inline-flex items-center gap-2 font-semibold text-[#6b6580] hover:text-[#8d6d82]"
            >
              <Mail size={15} />
              smartfolio0.ai@gmail.com
            </a>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-7xl border-t border-[#ece7f2] pt-5 text-xs text-[#9189a3]">
          © {new Date().getFullYear()} Smartfolio-AI. AI-assisted guidance, with you in control.
        </div>
      </footer>
    </main>
  );
}

function JourneyTimeline({ children }: { children: React.ReactNode }) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (progressRef.current) progressRef.current.style.transform = "scaleY(1)";
      return;
    }

    let frame = 0;

    const updateProgress = () => {
      frame = 0;
      if (!timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const start = window.innerHeight * 0.58;
      const distance = rect.height + window.innerHeight * 0.16;
      const nextProgress = Math.min(1, Math.max(0, (start - rect.top) / distance));
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleY(${nextProgress})`;
      }
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={timelineRef} className="relative mt-16 md:mt-24">
      <div className="absolute bottom-20 left-[17px] top-8 w-[2px] bg-[#e8e2eb] lg:left-1/2" />
      <div className="absolute bottom-20 left-[17px] top-8 w-[2px] overflow-hidden lg:left-1/2">
        <div
          ref={progressRef}
          className="h-full w-full origin-top bg-gradient-to-b from-[#858db8] via-[#a889b0] to-[#b57b8e] shadow-[0_0_14px_rgba(168,137,176,0.32)] will-change-transform"
          style={{ transform: "scaleY(0)" }}
        />
      </div>
      {children}
    </div>
  );
}

function JourneyStep({
  number,
  label,
  icon: Icon,
  title,
  description,
  action,
  tone,
  dot,
  visual,
  reverse = false,
}: {
  number: string;
  label: string;
  icon: typeof Search;
  title: string;
  description: string;
  action: string;
  tone: string;
  dot: string;
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const copy = (
    <div
      className={`${reverse ? "lg:order-2" : ""} transition-all duration-700 ease-out ${
        revealed ? "translate-y-0 opacity-100" : "translate-y-7 opacity-0"
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#8a7392]">
        <span className="text-[#b6a5bd] lg:hidden">{number}</span>
        <Icon size={15} />
        {label}
      </div>
      <h3 className="mt-4 max-w-lg font-century text-3xl font-bold leading-tight text-[#2b2440] md:text-4xl">
        {title}
      </h3>
      <p className="mt-4 max-w-lg text-base leading-7 text-[#6b6580]">{description}</p>
      <Link href="/login" className={featureAction}>
        {action}
        <ArrowRight size={16} />
      </Link>
    </div>
  );

  const visualPanel = (
    <div
      className={`rounded-lg bg-gradient-to-br ${tone} p-4 transition-all delay-150 duration-700 ease-out sm:p-7 ${
        reverse ? "lg:order-1" : ""
      } ${revealed ? "translate-y-0 opacity-100" : "translate-y-9 opacity-0"}`}
    >
      {visual}
    </div>
  );

  return (
    <article
      ref={sectionRef}
      className="relative grid gap-10 py-14 pl-14 md:py-20 lg:grid-cols-2 lg:items-center lg:gap-28 lg:pl-0"
    >
      <div
        className={`absolute left-[9px] top-[62px] z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-8 ring-[#fbfaff] transition-all duration-500 md:top-[86px] lg:left-1/2 lg:-translate-x-1/2 ${dot} ${
          revealed
            ? "scale-100 opacity-100 shadow-[0_0_0_5px_rgba(154,130,172,0.10),0_0_20px_rgba(154,130,172,0.22)]"
            : "scale-50 opacity-30"
        }`}
      >
        <span className="sr-only">Step {number}</span>
      </div>
      <span
        className={`absolute left-0 top-[86px] hidden -translate-x-full pr-5 text-xs font-bold text-[#b6a5bd] transition-opacity delay-200 duration-500 lg:left-1/2 lg:block ${
          revealed ? "opacity-100" : "opacity-0"
        }`}
      >
        {number}
      </span>
      {copy}
      {visualPanel}
    </article>
  );
}

function DocumentVisual() {
  return (
    <div className="overflow-hidden rounded-lg border border-white/80 bg-white shadow-[0_16px_45px_rgba(119,85,150,0.10)]">
      <div className="flex items-center justify-between border-b border-[#eee9f2] px-5 py-4 sm:px-7">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f3eef8] text-[#8a7392]">
            <FileText size={17} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#9c94aa]">
              Application document
            </p>
            <p className="mt-1 text-sm font-bold text-[#403653]">Product Designer</p>
          </div>
        </div>
        <span className="rounded-full bg-[#f3eef8] px-3 py-1 text-xs font-bold text-[#8a7392]">
          Tailored
        </span>
      </div>

      <div className="px-6 py-7 sm:px-9 sm:py-9">
        <p className="text-xs font-semibold text-[#9189a3]">Dear Hiring Team,</p>
        <div className="mt-6 space-y-3" aria-hidden="true">
          <div className="h-2 w-full rounded-full bg-[#ebe8f0]" />
          <div className="h-2 w-[92%] rounded-full bg-[#ebe8f0]" />
          <div className="h-2 w-[78%] rounded-full bg-[#f1eef4]" />
          <div className="h-2 w-[96%] rounded-full bg-[#ebe8f0]" />
          <div className="h-2 w-[86%] rounded-full bg-[#ebe8f0]" />
          <div className="h-2 w-[62%] rounded-full bg-[#f1eef4]" />
        </div>
        <div className="mt-7 flex flex-wrap gap-2">
          <span className="rounded-full bg-[#eef1ff] px-3 py-1.5 text-xs font-semibold text-[#74799f]">
            Profile-aware
          </span>
          <span className="rounded-full bg-[#fff0f6] px-3 py-1.5 text-xs font-semibold text-[#9b6f82]">
            Ready to edit
          </span>
        </div>
      </div>
    </div>
  );
}

function JobsVisual() {
  const roles = [
    {
      title: "Product Designer",
      company: "Northstar Studio",
      match: "88% match",
      details: "Remote · Product strategy",
      tone: "bg-[#eef1ff] text-[#74799f]",
    },
    {
      title: "UX Researcher",
      company: "Lumen Labs",
      match: "82% match",
      details: "Hybrid · User research",
      tone: "bg-[#fff0f6] text-[#9b6f82]",
    },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-white/80 bg-white px-5 shadow-[0_16px_45px_rgba(119,85,150,0.10)] sm:px-7">
      <div className="flex items-end justify-between border-b border-[#eee9f2] py-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#9c94aa]">
            Jobs for your profile
          </p>
          <h4 className="mt-2 font-century text-xl font-bold text-[#2b2440]">
            Strong matches
          </h4>
        </div>
        <BriefcaseBusiness size={20} className="text-[#8a7392]" />
      </div>

      <div className="divide-y divide-[#eee9f2]">
        {roles.map(({ title, company, match, details, tone }) => (
          <div key={title} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-sm font-bold text-[#403653]">{title}</p>
              <p className="mt-1 text-xs text-[#9189a3]">{company}</p>
              <p className="mt-2 text-xs text-[#6b6580]">{details}</p>
            </div>
            <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${tone}`}>
              {match}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResumeVisual() {
  return (
    <div className="rounded-lg border border-white/80 bg-white p-5 shadow-[0_16px_45px_rgba(119,85,150,0.10)] sm:p-7">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#9189a3]">Resume score</p>
          <p className="mt-2 font-century text-xl font-bold text-[#2b2440]">A clear starting point</p>
        </div>
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-[7px] border-purple-100">
          <span className="font-century text-2xl font-bold text-[#8a7392]">81</span>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {[
          ["Your experience shows strong role alignment.", "bg-indigo-300"],
          ["Two skill areas could use more evidence.", "bg-purple-300"],
        ].map(([text, color]) => (
          <div key={text} className="flex items-center gap-3 rounded-lg bg-[#fbfaff] p-4">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
            <p className="text-sm leading-6 text-[#6b6580]">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LearningVisual() {
  return (
    <div className="rounded-lg border border-white/80 bg-white p-5 shadow-[0_16px_45px_rgba(119,85,150,0.10)] sm:p-7">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#9189a3]">
            Based on your goals
          </p>
          <h4 className="mt-2 font-century text-xl font-bold text-[#2b2440]">A focused learning path</h4>
        </div>
        <BookOpen className="text-[#8a7392]" size={22} />
      </div>
      <div className="mt-6 space-y-3">
        {[
          ["01", "Data analysis foundations", "Skill gap"],
          ["02", "Applied AI for professionals", "Career goal"],
        ].map(([number, title, reason]) => (
          <div key={title} className="grid grid-cols-[auto_1fr] gap-4 rounded-lg bg-[#fbfaff] p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
            <span className="text-xs font-bold text-[#9a82ac]">{number}</span>
            <p className="text-sm font-semibold text-[#403653]">{title}</p>
            <span className="col-start-2 w-fit rounded-full bg-[#f5f1f7] px-2.5 py-1 text-xs font-semibold text-[#8a7392] sm:col-start-auto">
              {reason}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InterviewVisual() {
  const bars = [18, 30, 46, 64, 38, 72, 54, 82, 44, 66, 34, 52, 24];
  const barColors = ["#8f96b8", "#a789a0", "#9b8fb2"];

  return (
    <div className="rounded-lg border border-white/80 bg-white p-6 text-center shadow-[0_16px_45px_rgba(119,85,150,0.10)] sm:p-9">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f0eaf3] text-[#8a7392]">
        <Mic2 size={21} />
      </div>
      <p className="mx-auto mt-5 max-w-sm font-century text-lg font-bold leading-7 text-[#2b2440]">
        Tell me about a challenge you solved with your team.
      </p>
      <div className="mx-auto mt-7 flex h-20 max-w-sm items-center justify-center gap-1.5" aria-hidden="true">
        {bars.map((height, index) => (
          <span
            key={`${height}-${index}`}
            className="w-1.5 rounded-full opacity-80"
            style={{ height, backgroundColor: barColors[index % barColors.length] }}
          />
        ))}
      </div>
      <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#f7edf2] px-4 py-2 text-xs font-bold text-[#8f6d7d]">
        <span className="h-2 w-2 rounded-full bg-[#b98da0]" />
        Listening to your response
      </div>
    </div>
  );
}
