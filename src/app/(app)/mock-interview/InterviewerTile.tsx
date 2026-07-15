'use client';
import { useEffect, useState } from 'react';
import { FiUser } from 'react-icons/fi';
import VoiceWave from '@/components/VoiceWave';
import type { InterviewerStyle } from './types';

/**
 * The interviewer's presence on the call stage, in the user's chosen style:
 * - 'orb'    — the abstract voice-reactive tile (Phase 3.3 behavior).
 * - 'avatar' — an animated video-style face with blinking and speech-driven
 *   mouth movement (the 5.1 look, rendered locally at zero vendor cost).
 *
 * Both styles bind to `isSpeaking` only; all speech state stays in useSpeech.
 * A future photoreal vendor stream (roadmap 5.1) drops into the 'avatar' slot.
 */

type Viseme = 'rest' | 'open' | 'mid' | 'oo';

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function AvatarFace({ isSpeaking }: { isSpeaking: boolean }) {
  const [viseme, setViseme] = useState<Viseme>('rest');
  const [blink, setBlink] = useState(false);

  // Mouth: cycle viseme shapes while speaking; a static open shape under
  // reduced motion so "speaking" is still visible without movement.
  useEffect(() => {
    if (!isSpeaking) { setViseme('rest'); return; }
    if (reducedMotion()) { setViseme('mid'); return; }
    const shapes: Viseme[] = ['open', 'mid', 'oo', 'mid'];
    const id = setInterval(() => setViseme(shapes[Math.floor(Math.random() * shapes.length)]), 110);
    return () => clearInterval(id);
  }, [isSpeaking]);

  // Blinking — skipped entirely under reduced motion.
  useEffect(() => {
    if (reducedMotion()) return;
    let closeTimer: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      setBlink(true);
      closeTimer = setTimeout(() => setBlink(false), 130);
    }, 3400 + Math.random() * 1500);
    return () => { clearInterval(id); clearTimeout(closeTimer); };
  }, []);

  return (
    <div className="relative w-64 sm:w-72 aspect-[16/10] rounded-2xl overflow-hidden border border-white/10 shadow-xl bg-[radial-gradient(120%_140%_at_30%_20%,#232B45_0%,#141A2E_55%,#0D1222_100%)]">
      {/* Gentle idle sway — disabled by the media query below */}
      <style>{`
        @keyframes folio-bob { 0%,100% { transform: rotate(-0.6deg) translateY(0); } 50% { transform: rotate(0.7deg) translateY(3px); } }
        .folio-bob { animation: folio-bob 5.2s ease-in-out infinite; transform-origin: 210px 200px; }
        @media (prefers-reduced-motion: reduce) { .folio-bob { animation: none; } }
      `}</style>
      <svg viewBox="0 0 420 262" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <defs>
          <linearGradient id="folioSkin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E8B98F" /><stop offset="1" stopColor="#C89670" />
          </linearGradient>
          <linearGradient id="folioHair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3B3430" /><stop offset="1" stopColor="#241F1C" />
          </linearGradient>
          <linearGradient id="folioShirt" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#33415E" /><stop offset="1" stopColor="#20293D" />
          </linearGradient>
        </defs>
        <g className="folio-bob">
          {/* shoulders + collar */}
          <path d="M96 262 C110 214 158 196 210 196 C262 196 310 214 324 262 Z" fill="url(#folioShirt)" />
          <path d="M196 200 L210 224 L224 200 Z" fill="#F5F0E8" opacity=".9" />
          {/* neck + head */}
          <rect x="192" y="164" width="36" height="42" rx="14" fill="#D3A379" />
          <ellipse cx="210" cy="118" rx="58" ry="66" fill="url(#folioSkin)" />
          <ellipse cx="152" cy="122" rx="9" ry="14" fill="#D3A379" />
          <ellipse cx="268" cy="122" rx="9" ry="14" fill="#D3A379" />
          <path d="M152 108 C150 62 176 44 210 44 C244 44 270 62 268 108 C268 88 252 72 210 72 C168 72 152 88 152 108 Z" fill="url(#folioHair)" />
          {/* brows */}
          <path d="M172 96 Q186 90 198 95" stroke="#3B3430" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M222 95 Q234 90 248 96" stroke="#3B3430" strokeWidth="5" fill="none" strokeLinecap="round" />
          {/* eyes */}
          <g opacity={blink ? 0 : 1}>
            <ellipse cx="186" cy="112" rx="9" ry="6.5" fill="#fff" />
            <circle cx="187" cy="113" r="3.4" fill="#3A2E24" />
            <ellipse cx="234" cy="112" rx="9" ry="6.5" fill="#fff" />
            <circle cx="235" cy="113" r="3.4" fill="#3A2E24" />
          </g>
          <g opacity={blink ? 1 : 0}>
            <rect x="175" y="104" width="24" height="14" rx="7" fill="#D8A97E" />
            <rect x="221" y="104" width="24" height="14" rx="7" fill="#D8A97E" />
          </g>
          {/* nose */}
          <path d="M208 118 Q205 134 200 140 Q207 145 214 141" stroke="#B5825C" strokeWidth="3.4" fill="none" strokeLinecap="round" />
          {/* mouth — one viseme visible at a time */}
          {viseme === 'rest' && <path d="M188 160 Q210 168 232 160" stroke="#8C5B44" strokeWidth="4.5" fill="none" strokeLinecap="round" />}
          {viseme === 'open' && <ellipse cx="210" cy="162" rx="15" ry="10" fill="#5A3226" />}
          {viseme === 'mid' && <ellipse cx="210" cy="161" rx="17" ry="5.5" fill="#5A3226" />}
          {viseme === 'oo' && <ellipse cx="210" cy="162" rx="8" ry="8" fill="#5A3226" />}
        </g>
      </svg>
      {/* vignette so the face sits in the tile like a webcam feed */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_90%_at_50%_42%,transparent_55%,rgba(0,0,0,0.45))]" />
      <span className="absolute left-2.5 top-2.5 rounded-md bg-black/45 border border-white/10 px-2 py-0.5 text-[9px] font-bold tracking-[0.12em] text-slate-300">
        LIVE
      </span>
    </div>
  );
}

export function InterviewerTile({ style, isSpeaking }: { style: InterviewerStyle; isSpeaking: boolean }) {
  if (style === 'avatar') return <AvatarFace isSpeaking={isSpeaking} />;
  return (
    <div className="relative grid place-items-center">
      {isSpeaking && <span className="absolute inset-0 m-auto w-28 h-28 rounded-full bg-indigo-500/25 animate-ping" />}
      {/* overflow-hidden keeps the equalizer bars clipped inside the circle */}
      <div className="relative w-28 h-28 rounded-full overflow-hidden grid place-items-center bg-gradient-to-br from-indigo-400 via-violet-500 to-blue-500 shadow-xl">
        {isSpeaking
          ? <span className="scale-75 grid place-items-center"><VoiceWave isActive mode="speaking" color="bg-white" /></span>
          : <FiUser className="text-white/90" size={44} />}
      </div>
    </div>
  );
}
