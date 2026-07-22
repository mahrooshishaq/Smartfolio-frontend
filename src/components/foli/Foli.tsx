import React from 'react';

export type FoliState =
  | 'idle'
  | 'typing'
  | 'peek'
  | 'happy'
  | 'success'
  | 'error'
  | 'look-l'
  | 'look-r';

const MOUTH: Record<string, string> = {
  neutral: 'M88 118 Q100 126 112 118',
  smileBig: 'M84 116 Q100 134 116 116',
  frown: 'M86 124 Q100 112 114 124',
};

function mouthFor(state: FoliState): string {
  if (state === 'success' || state === 'happy') return MOUTH.smileBig;
  if (state === 'error') return MOUTH.frown;
  return MOUTH.neutral;
}

/**
 * Foli — the SmartFolio mascot (the logo's dog-eared page, brought to life).
 * Expression is driven entirely by the `state` class; see the `.foli.*` rules in
 * globals.css. Gradient "lips" are the shipped look.
 */
export default function Foli({
  state = 'idle',
  className = '',
  title = 'Foli',
}: {
  state?: FoliState;
  className?: string;
  title?: string;
}) {
  // Unique gradient ids per instance so multiple Foli on one page don't collide.
  const uid = React.useId().replace(/:/g, '');
  const bodyG = `foliBody-${uid}`;
  const lineG = `foliLine-${uid}`;

  return (
    <svg
      className={`foli ${state} ${className}`.trim()}
      viewBox="0 0 200 200"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
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
        <path
          className="spark"
          d="M150 40 L154 52 L166 56 L154 60 L150 72 L146 60 L134 56 L146 52 Z"
          fill="#a855f7"
        />
        <rect className="brow browL" x="66" y="72" width="20" height="5" rx="2.5" fill="#b8a6e0" />
        <rect className="brow browR" x="114" y="72" width="20" height="5" rx="2.5" fill="#b8a6e0" />
        <g className="eye-open">
          <circle cx="78" cy="92" r="13" fill="#fff" stroke="#e4d8fb" strokeWidth="1.5" />
          <circle cx="122" cy="92" r="13" fill="#fff" stroke="#e4d8fb" strokeWidth="1.5" />
          <circle className="pupil" cx="78" cy="92" r="6" fill="#3a2e5c" />
          <circle className="pupil" cx="122" cy="92" r="6" fill="#3a2e5c" />
          <circle cx="81" cy="89" r="2" fill="#fff" />
          <circle cx="125" cy="89" r="2" fill="#fff" />
        </g>
        <g className="eye-happy" fill="none" stroke="#3a2e5c" strokeWidth="4" strokeLinecap="round">
          <path d="M69 94 Q78 84 87 94" />
          <path d="M113 94 Q122 84 131 94" />
        </g>
        <path
          className="mouth"
          d={mouthFor(state)}
          fill="none"
          stroke={`url(#${lineG})`}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle className="paw pawL" cx="52" cy="150" r="15" fill="#efe6ff" stroke="#e0d3f8" strokeWidth="2" />
        <circle className="paw pawR" cx="148" cy="150" r="15" fill="#efe6ff" stroke="#e0d3f8" strokeWidth="2" />
      </g>
    </svg>
  );
}
