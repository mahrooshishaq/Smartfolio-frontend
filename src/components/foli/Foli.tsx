'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

export type FoliState =
  | 'idle'
  | 'typing'
  | 'peek'
  | 'happy'
  | 'success'
  | 'error'
  | 'sad'
  | 'look-l'
  | 'look-r'
  // Idle-personality vignettes (driven internally when `interactive` is on).
  | 'wink'
  | 'yawn'
  | 'giggle'
  | 'sleep'
  | 'spark-play';

const MOUTH: Record<string, string> = {
  neutral: 'M88 118 Q100 126 112 118',
  smileBig: 'M84 116 Q100 134 116 116',
  frown: 'M86 124 Q100 112 114 124',
  sad: 'M89 121 Q100 115 111 121',
  small: 'M92 119 Q100 123 108 119',
};

function mouthFor(state: FoliState): string {
  if (state === 'success' || state === 'happy' || state === 'giggle' || state === 'wink') return MOUTH.smileBig;
  if (state === 'error') return MOUTH.frown;
  if (state === 'sad') return MOUTH.sad;
  if (state === 'sleep') return MOUTH.small;
  return MOUTH.neutral;
}

/** Weighted idle vignettes: [state, howLongItPlays(ms), weight] */
const VIGNETTES: [FoliState, number, number][] = [
  ['look-l', 1300, 3],
  ['look-r', 1300, 3],
  ['wink', 900, 2],
  ['giggle', 1200, 2],
  ['spark-play', 1800, 2],
  ['yawn', 1900, 1],
];

const REST_MIN = 1800;
const REST_MAX = 3600;
const SLEEP_AFTER_MS = 12000;

function pickVignette(): [FoliState, number] {
  const total = VIGNETTES.reduce((n, v) => n + v[2], 0);
  let r = Math.random() * total;
  for (const [s, dur, w] of VIGNETTES) {
    r -= w;
    if (r <= 0) return [s, dur];
  }
  return ['look-l', 1300];
}

/**
 * Foli — the SmartFolio mascot (the logo's dog-eared page, brought to life).
 *
 * Deliberate states (typing/peek/error/success/…) come from the parent. When the
 * parent leaves it at `idle` and `interactive` is on, Foli runs its own little
 * personality loop: eyes track the pointer, random vignettes play (wink, yawn,
 * giggle, the spark orbiting), tapping it makes it giggle, and after a while with
 * no activity it dozes off with Zzz — waking as soon as you come back.
 */
export default function Foli({
  state = 'idle',
  className = '',
  title = 'Foli',
  interactive = true,
}: {
  state?: FoliState;
  className?: string;
  title?: string;
  interactive?: boolean;
}) {
  const uid = React.useId().replace(/:/g, '');
  const bodyG = `foliBody-${uid}`;
  const lineG = `foliLine-${uid}`;

  const svgRef = useRef<SVGSVGElement>(null);
  const [vignette, setVignette] = useState<FoliState | null>(null);
  const [tracking, setTracking] = useState(false);
  const lastActivity = useRef(0);
  const timers = useRef<number[]>([]);

  // The idle engine only drives things while the parent is resting at `idle`.
  const engineOn = interactive && state === 'idle';
  const shown: FoliState = engineOn && vignette ? vignette : state;

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };

  const bump = useCallback(() => {
    lastActivity.current = Date.now();
    setVignette((v) => (v === 'sleep' ? null : v));
  }, []);

  // Randomised vignette loop + doze-off.
  useEffect(() => {
    if (!engineOn) {
      clearTimers();
      setVignette(null);
      return;
    }
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return; // stay calm for users who asked for less motion
    }
    lastActivity.current = Date.now();
    let alive = true;

    const schedule = () => {
      if (!alive) return;
      const rest = REST_MIN + Math.random() * (REST_MAX - REST_MIN);
      timers.current.push(
        window.setTimeout(() => {
          if (!alive) return;
          // Nothing happening for a while? Doze off instead of performing.
          if (Date.now() - lastActivity.current > SLEEP_AFTER_MS) {
            setVignette('sleep');
            timers.current.push(window.setTimeout(schedule, 4000));
            return;
          }
          const [v, dur] = pickVignette();
          setVignette(v);
          timers.current.push(
            window.setTimeout(() => {
              if (!alive) return;
              setVignette(null);
              schedule();
            }, dur)
          );
        }, rest)
      );
    };
    schedule();

    return () => {
      alive = false;
      clearTimers();
    };
  }, [engineOn]);

  // Eyes follow the pointer / finger.
  useEffect(() => {
    if (!engineOn) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const onMove = (e: PointerEvent) => {
      const el = svgRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const dx = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * 4.5;
      const dy = ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * 3;
      el.style.setProperty('--foli-eye-x', `${Math.max(-4.5, Math.min(4.5, dx)).toFixed(2)}px`);
      el.style.setProperty('--foli-eye-y', `${Math.max(-3, Math.min(3, dy)).toFixed(2)}px`);
      setTracking(true);
      bump();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', bump, { passive: true });
    window.addEventListener('keydown', bump);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('keydown', bump);
    };
  }, [engineOn, bump]);

  // Tap Foli → it giggles.
  const onPoke = () => {
    if (!engineOn) return;
    bump();
    clearTimers();
    setVignette('giggle');
    timers.current.push(window.setTimeout(() => setVignette(null), 1200));
  };

  const cls = ['foli', shown, tracking && engineOn && !vignette ? 'tracking' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      ref={svgRef}
      className={cls}
      viewBox="0 0 200 200"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      onClick={onPoke}
      style={engineOn ? { cursor: 'pointer' } : undefined}
    >
      <defs>
        <linearGradient id={bodyG} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fdfbff" />
          <stop offset="1" stopColor="#f2ecff" />
        </linearGradient>
        <linearGradient id={lineG} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#818cf8" />
          <stop offset=".5" stopColor="#c084fc" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="178" rx="46" ry="8" fill="#7c5cc0" opacity="0.16" />
      <g className="foli-float">
        <path
          d="M36 44 Q36 26 54 26 L128 26 L164 62 L164 150 Q164 168 146 168 L54 168 Q36 168 36 150 Z"
          fill={`url(#${bodyG})`}
          stroke="#e4d8fb"
          strokeWidth="2"
        />
        <path d="M128 26 L164 62 L128 62 Z" fill="#ffd7c2" />

        {/* AI spark — twinkles at rest, orbits the head during spark-play */}
        <g className="spark-orbit">
          <path
            className="spark"
            d="M150 40 L154 52 L166 56 L154 60 L150 72 L146 60 L134 56 L146 52 Z"
            fill="#a855f7"
          />
        </g>

        {/* Zzz — only while asleep */}
        <g className="zzz" aria-hidden="true" fill="#a78bda" fontFamily="ui-sans-serif, system-ui" fontWeight="700">
          <text className="z1" x="150" y="60" fontSize="15">z</text>
          <text className="z2" x="162" y="46" fontSize="19">z</text>
          <text className="z3" x="176" y="30" fontSize="23">z</text>
        </g>

        <rect className="brow browL" x="66" y="72" width="20" height="5" rx="2.5" fill="#b8a6e0" />
        <rect className="brow browR" x="114" y="72" width="20" height="5" rx="2.5" fill="#b8a6e0" />

        <g className="eye-open">
          <g className="eye eyeL">
            <circle cx="78" cy="92" r="13" fill="#fff" stroke="#e4d8fb" strokeWidth="1.5" />
            <circle className="pupil" cx="78" cy="92" r="6" fill="#3a2e5c" />
            <circle className="glint" cx="81" cy="89" r="2" fill="#fff" />
          </g>
          <g className="eye eyeR">
            <circle cx="122" cy="92" r="13" fill="#fff" stroke="#e4d8fb" strokeWidth="1.5" />
            <circle className="pupil" cx="122" cy="92" r="6" fill="#3a2e5c" />
            <circle className="glint" cx="125" cy="89" r="2" fill="#fff" />
          </g>
        </g>

        {/* closed/curved eyes for success, giggle, wink and sleep */}
        <g className="eye-happy" fill="none" stroke="#3a2e5c" strokeWidth="4" strokeLinecap="round">
          <path className="happyL" d="M69 94 Q78 84 87 94" />
          <path className="happyR" d="M113 94 Q122 84 131 94" />
        </g>

        <path
          className="mouth"
          d={mouthFor(shown)}
          fill="none"
          stroke={`url(#${lineG})`}
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* open mouth used by the yawn */}
        <ellipse className="mouth-yawn" cx="100" cy="122" rx="9" ry="11" fill="#4b3a6b" />

        <circle className="paw pawL" cx="52" cy="150" r="15" fill="#efe6ff" stroke="#e0d3f8" strokeWidth="2" />
        <circle className="paw pawR" cx="148" cy="150" r="15" fill="#efe6ff" stroke="#e0d3f8" strokeWidth="2" />
      </g>
    </svg>
  );
}
