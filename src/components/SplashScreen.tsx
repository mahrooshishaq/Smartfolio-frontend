'use client';

import { useEffect, useState } from 'react';
import BrandMark from '@/components/BrandMark';

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
const MIN_VISIBLE_MS = 900;

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
      <BrandMark className="sf-splash__logo" />
      <span className="sf-splash__wordmark">SmartFolio</span>
      <span className="sf-splash__tagline">Job Hunting Made Simple</span>
      <span className="sf-splash__loader" aria-hidden="true" />
    </div>
  );
}
