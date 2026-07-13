import React from "react";

/**
 * SmartFolio brand mark — a dog-eared page ("Folio") with the
 * red→amber→green readiness climb rising to an AI spark on the fold.
 * Kept in sync with src/app/icon.svg (the browser-tab favicon).
 */
export default function BrandMark({
  className = "w-7 h-7",
  title = "SmartFolio",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="sf-page" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef1ff" />
          <stop offset="1" stopColor="#ffe6f0" />
        </linearGradient>
        <linearGradient id="sf-line" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#818cf8" />
          <stop offset="0.5" stopColor="#c084fc" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <path
        d="M0 14 Q0 0 14 0 L44 0 L64 20 L64 50 Q64 64 50 64 L14 64 Q0 64 0 50 Z"
        fill="url(#sf-page)"
        stroke="#ecdffb"
        strokeWidth="1"
      />
      <path d="M44 0 L64 20 L44 20 Z" fill="#ffd3bf" />
      <circle cx="43" cy="21" r="8" fill="none" stroke="#ec4899" strokeOpacity="0.22" strokeWidth="2.4" />
      <path
        d="M13 48 C22 46 25 41 27.5 36 C31 29 37 24 43 21"
        fill="none"
        stroke="url(#sf-line)"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="13" cy="48" r="4" fill="#818cf8" />
      <circle cx="27.5" cy="36" r="4" fill="#c084fc" />
      <circle cx="43" cy="21" r="5.5" fill="#ec4899" />
      <path
        d="M53.5 8.5 L54.7 11.8 L58 13 L54.7 14.2 L53.5 17.5 L52.3 14.2 L49 13 L52.3 11.8 Z"
        fill="#a855f7"
      />
    </svg>
  );
}
