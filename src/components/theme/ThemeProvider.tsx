'use client';

/**
 * Platform theme (light/dark). The `.dark` class on <html> is what the CSS
 * override layer in globals.css keys off. First visit follows the OS setting;
 * once the user picks a theme it's remembered in localStorage and system
 * changes no longer override their choice.
 *
 * The class is applied pre-hydration by an inline script in app/layout.tsx
 * (THEME_INIT) so there's no white flash before React runs — this provider
 * just reads that initial state and drives later toggles.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
type ThemeCtx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };

const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  // Adopt whatever the pre-hydration script already put on <html>.
  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  const apply = useCallback((t: Theme) => {
    const root = document.documentElement;
    root.classList.toggle('dark', t === 'dark');
    root.style.colorScheme = t; // native controls, scrollbars, form fields
    try { localStorage.setItem('theme', t); } catch { /* private mode */ }
    setTheme(t);
  }, []);

  // Follow the OS only until the user has made an explicit choice.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      try { if (localStorage.getItem('theme')) return; } catch { /* ignore */ }
      apply(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [apply]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: apply, toggle: () => apply(theme === 'dark' ? 'light' : 'dark') }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a <ThemeProvider>');
  return ctx;
}
