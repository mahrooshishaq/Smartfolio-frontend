'use client';

import { useEffect, useState } from 'react';

/**
 * Branded launch splash for the installed PWA.
 *
 * The overlay markup is always in the DOM, but CSS keeps it `display:none` in a
 * normal browser tab and flips it to `display:flex` only under
 * `@media (display-mode: standalone)` — a pure-CSS gate that paints before
 * hydration and, unlike a class/attribute on <html>, survives React resetting
 * that element. For older iOS Safari (which doesn't match the display-mode query)
 * we re-add `data-pwa-standalone` here after hydration as a fallback gate.
 *
 * This component's job is then to fade the overlay out and unmount it once the
 * app is ready, with a minimum on-screen time so it never flickers.
 */
// Long enough for the full draw-on sequence (~1.9s) to play before the fade.
const MIN_VISIBLE_MS = 2200;

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mm = (q: string) => window.matchMedia?.(q).matches ?? false;
  return (
    mm('(display-mode: standalone)') ||
    mm('(display-mode: fullscreen)') ||
    mm('(display-mode: minimal-ui)') ||
    // iOS Safari home-screen apps report this instead of a display-mode.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function SplashScreen() {
  const [mounted, setMounted] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const isStandalone = detectStandalone();

    // Browser tab: the overlay is display:none anyway, so just drop it.
    if (!isStandalone) {
      setMounted(false);
      return;
    }

    // iOS fallback gate: the display-mode media query may not match on older
    // Safari, so ensure the attribute-based CSS gate is present.
    document.documentElement.setAttribute('data-pwa-standalone', '1');

    const start = performance.now();

    const dismiss = () => {
      const elapsed = performance.now() - start;
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      window.setTimeout(() => {
        setLeaving(true);
        // Match the 400ms CSS opacity transition before unmounting.
        window.setTimeout(() => setMounted(false), 420);
      }, wait);
    };

    if (document.readyState === 'complete') {
      dismiss();
      return;
    }

    window.addEventListener('load', dismiss, { once: true });
    // Safety net: never let a stalled asset trap the user behind the splash.
    const hardStop = window.setTimeout(dismiss, 4000);
    return () => {
      window.removeEventListener('load', dismiss);
      window.clearTimeout(hardStop);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      className={`sf-splash${leaving ? ' sf-splash--leaving' : ''}`}
      role="status"
      aria-label="Loading SmartFolio"
    >
      <svg
        className="sf-splash__logo"
        viewBox="0 0 64 64"
        role="img"
        aria-label="SmartFolio"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="sf-splash-page" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#eef1ff" />
            <stop offset="1" stopColor="#ffe6f0" />
          </linearGradient>
          <linearGradient id="sf-splash-line" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#818cf8" />
            <stop offset="0.5" stopColor="#c084fc" />
            <stop offset="1" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        <path
          d="M0 14 Q0 0 14 0 L44 0 L64 20 L64 50 Q64 64 50 64 L14 64 Q0 64 0 50 Z"
          fill="url(#sf-splash-page)"
          stroke="#ecdffb"
          strokeWidth="1"
        />
        <path d="M44 0 L64 20 L44 20 Z" fill="#ffd3bf" />
        <path
          className="sf-climb"
          d="M13 48 C22 46 25 41 27.5 36 C31 29 37 24 43 21"
          fill="none"
          stroke="url(#sf-splash-line)"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle className="sf-dot sf-d1" cx="13" cy="48" r="4" fill="#818cf8" />
        <circle className="sf-dot sf-d2" cx="27.5" cy="36" r="4" fill="#c084fc" />
        <circle className="sf-dot sf-d3" cx="43" cy="21" r="5.5" fill="#ec4899" />
        <path
          className="sf-spark"
          d="M53.5 8.5 L54.7 11.8 L58 13 L54.7 14.2 L53.5 17.5 L52.3 14.2 L49 13 L52.3 11.8 Z"
          fill="#a855f7"
        />
      </svg>
      <span className="sf-splash__wordmark">SmartFolio</span>
      <span className="sf-splash__tagline">Job Hunting Made Simple</span>
      <span className="sf-splash__loader" aria-hidden="true" />
    </div>
  );
}
