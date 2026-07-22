'use client';

import { useEffect } from 'react';

/**
 * Hides the pre-hydration boot overlay (#foli-boot, rendered in layout) once the
 * app becomes interactive. The overlay itself is plain SSR HTML + inline CSS so it
 * can appear on a slow connection before the JS/CSS bundles arrive; an inline
 * script reveals it only if the app hasn't hydrated within ~700ms, so fast opens
 * never flash it. This component's mount is that "app is ready" signal.
 */
export default function FoliBoot() {
  useEffect(() => {
    const w = window as unknown as { __appReady?: boolean; __foliBootTimer?: number };
    w.__appReady = true;
    if (w.__foliBootTimer) clearTimeout(w.__foliBootTimer);
    const el = document.getElementById('foli-boot');
    if (el) {
      el.style.transition = 'opacity .4s ease';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      setTimeout(() => { el.style.display = 'none'; }, 430);
    }
  }, []);
  return null;
}
