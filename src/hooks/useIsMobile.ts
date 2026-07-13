'use client';

import { useEffect, useState } from 'react';

/**
 * SSR-safe hook: true below the `lg` breakpoint (1024px), where the app
 * switches from the desktop sidebar to the mobile top bar + bottom tabs.
 * Prefer CSS-only responsive classes; use this only when rendering must differ.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return isMobile;
}
